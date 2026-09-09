import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseProviderType } from './types';

export interface StoredDatabaseConfig {
  provider: DatabaseProviderType;
  connectionString?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  tursoUrl?: string;
  tursoAuthToken?: string;
  upstashUrl?: string;
  upstashToken?: string;
  customApiUrl?: string;
  customApiKey?: string;
  locked?: boolean;
}

// Retrieve the active database configuration from dedicated storage, developer settings, or default to local mode
export const getActiveDatabaseConfig = (): StoredDatabaseConfig => {
  try {
    // 1. Check dedicated credentials key first
    const rawDedicated = localStorage.getItem('perola_database_credentials');
    if (rawDedicated) {
      const parsed = JSON.parse(rawDedicated);
      if (parsed && typeof parsed === 'object') {
        return {
          provider: parsed.provider || 'none',
          connectionString: parsed.connectionString || '',
          supabaseUrl: parsed.supabaseUrl || '',
          supabaseAnonKey: parsed.supabaseAnonKey || '',
          tursoUrl: parsed.tursoUrl || '',
          tursoAuthToken: parsed.tursoAuthToken || '',
          upstashUrl: parsed.upstashUrl || '',
          upstashToken: parsed.upstashToken || '',
          customApiUrl: parsed.customApiUrl || '',
          customApiKey: parsed.customApiKey || '',
          locked: Boolean(parsed.locked)
        };
      }
    }

    // 2. Check general developer settings
    const rawDevSettings = localStorage.getItem('perola_developer_settings');
    if (rawDevSettings) {
      const parsed = JSON.parse(rawDevSettings);
      return {
        provider: parsed.databaseProvider || 'none',
        connectionString: parsed.dbConnectionString || '',
        supabaseUrl: parsed.supabaseUrl || '',
        supabaseAnonKey: parsed.supabaseAnonKey || '',
        tursoUrl: parsed.tursoUrl || '',
        tursoAuthToken: parsed.tursoAuthToken || '',
        upstashUrl: parsed.upstashUrl || '',
        upstashToken: parsed.upstashToken || '',
        customApiUrl: parsed.customApiUrl || '',
        customApiKey: parsed.customApiKey || '',
        locked: Boolean(parsed.supabaseLocked)
      };
    }
  } catch (e) {
    console.error('Erro ao ler configuração de base de dados:', e);
  }

  // 3. Fallback: 'none' (operar em modo local offline-first sem variáveis de ambiente)
  return {
    provider: 'none',
    connectionString: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    tursoUrl: '',
    tursoAuthToken: '',
    upstashUrl: '',
    upstashToken: '',
    customApiUrl: '',
    customApiKey: '',
    locked: false
  };
};

// Disconnect and remove all database configurations (Manual Mode / Clean State)
export const disconnectDatabase = async () => {
  try {
    localStorage.removeItem('perola_database_credentials');
    localStorage.removeItem('perola_temp_supabase_url');
    localStorage.removeItem('perola_temp_supabase_anon_key');

    const rawDev = localStorage.getItem('perola_developer_settings');
    if (rawDev) {
      const dev = JSON.parse(rawDev);
      dev.databaseProvider = 'none';
      delete dev.tursoUrl;
      delete dev.tursoAuthToken;
      delete dev.supabaseUrl;
      delete dev.supabaseAnonKey;
      delete dev.dbConnectionString;
      delete dev.upstashUrl;
      delete dev.upstashToken;
      localStorage.setItem('perola_developer_settings', JSON.stringify(dev));
    }

    cachedSupabaseClient = null;
    cachedSupabaseUrl = '';
    cachedSupabaseKey = '';
    cachedIsOnline = false;

    globalSyncState.isOnline = false;
    Object.keys(globalSyncState.tables).forEach(t => {
      globalSyncState.tables[t].status = 'offline';
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-sync-state-change'));
      window.dispatchEvent(new CustomEvent('perola-database-config-changed', {
        detail: { provider: 'none', locked: false }
      }));
    }

    await fetch('/api/db/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});

    addSyncLog('info', 'connection', 'Todas as conexões à base de dados foram removidas. O sistema está a operar em modo puramente local.');
    console.log('[Database] Todas as conexões foram desfeitas e removidas com sucesso.');
  } catch (err) {
    console.error('Erro ao desconectar base de dados:', err);
  }
};

// Helper to initialize database schema on demand (Turso, Neon PostgreSQL, etc.)
export const initializeDatabaseSchema = async (customConfig?: any) => {
  const config = customConfig || getActiveDatabaseConfig();
  try {
    const res = await fetch('/api/db/init-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: config?.provider, config })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao inicializar tabelas na base de dados' };
  }
};

export const initializeTursoSchema = initializeDatabaseSchema;

// Helper to asynchronously fetch and merge environment variables configured on the server
export const syncConfigFromServerEnv = async (): Promise<StoredDatabaseConfig | null> => {
  try {
    const res = await fetch('/api/db/env-detect');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.detected) {
      const d = data.detected;
      const current = getActiveDatabaseConfig();
      const merged: StoredDatabaseConfig = {
        provider: current.provider,
        connectionString: current.connectionString || d.neonOrPostgres || '',
        supabaseUrl: current.supabaseUrl || d.supabaseUrl || '',
        supabaseAnonKey: current.supabaseAnonKey || d.supabaseAnonKey || '',
        tursoUrl: current.tursoUrl || d.tursoUrl || '',
        tursoAuthToken: current.tursoAuthToken || d.tursoAuthToken || '',
        upstashUrl: current.upstashUrl || d.upstashUrl || '',
        upstashToken: current.upstashToken || d.upstashToken || '',
        customApiUrl: current.customApiUrl || '',
        customApiKey: current.customApiKey || '',
        locked: current.locked
      };

      if (!current.connectionString && d.neonOrPostgres) {
        merged.connectionString = d.neonOrPostgres;
      }
      if (!current.supabaseUrl && d.supabaseUrl) {
        merged.supabaseUrl = d.supabaseUrl;
        merged.supabaseAnonKey = d.supabaseAnonKey || '';
      }

      saveDatabaseConfig(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[DB Config] Detecção automática de variáveis do servidor indisponível:', err);
  }
  return null;
};

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedSupabaseUrl = '';
let cachedSupabaseKey = '';

// Helper to get or dynamically instantiate the supabase client whenever credentials change
export const getSupabaseClient = (): SupabaseClient | null => {
  const active = getActiveDatabaseConfig();
  let rawUrl = (active.supabaseUrl || '').trim().replace(/['"]+/g, '');
  rawUrl = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  const key = (active.supabaseAnonKey || '').trim().replace(/['"]+/g, '');

  if (!rawUrl || !key) {
    return null;
  }

  const formattedUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') 
    ? rawUrl 
    : `https://${rawUrl}`;

  if (!cachedSupabaseClient || cachedSupabaseUrl !== formattedUrl || cachedSupabaseKey !== key) {
    try {
      cachedSupabaseClient = createClient(formattedUrl, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
      cachedSupabaseUrl = formattedUrl;
      cachedSupabaseKey = key;
      console.log('[Supabase Client] Instância atualizada dinamicamente com sucesso para:', formattedUrl);
    } catch (err) {
      console.error('[Supabase Client] Falha ao criar cliente Supabase:', err);
      return null;
    }
  }

  return cachedSupabaseClient;
};

// Save database configuration securely into localStorage and notify state
export const saveDatabaseConfig = (config: StoredDatabaseConfig) => {
  try {
    // 1. Save to dedicated credentials store
    localStorage.setItem('perola_database_credentials', JSON.stringify(config));

    // 2. Also keep developer settings in sync
    const rawDev = localStorage.getItem('perola_developer_settings');
    const existingDev = rawDev ? JSON.parse(rawDev) : {};
    const updatedDev = {
      ...existingDev,
      databaseProvider: config.provider,
      dbConnectionString: config.connectionString || '',
      supabaseUrl: config.supabaseUrl || '',
      supabaseAnonKey: config.supabaseAnonKey || '',
      tursoUrl: config.tursoUrl || '',
      tursoAuthToken: config.tursoAuthToken || '',
      upstashUrl: config.upstashUrl || '',
      upstashToken: config.upstashToken || '',
      customApiUrl: config.customApiUrl || '',
      customApiKey: config.customApiKey || '',
      supabaseLocked: Boolean(config.locked)
    };
    localStorage.setItem('perola_developer_settings', JSON.stringify(updatedDev));

    // 3. Clear temporary inputs
    localStorage.removeItem('perola_temp_supabase_url');
    localStorage.removeItem('perola_temp_supabase_anon_key');

    // 4. Force re-evaluation of supabase client
    cachedSupabaseClient = null;
    cachedSupabaseUrl = '';
    cachedSupabaseKey = '';
    getSupabaseClient();

    // 5. Notify listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-sync-state-change'));
      window.dispatchEvent(new CustomEvent('perola-database-config-changed', { detail: config }));
    }

    // 6. Asynchronously persist to server-side .env.local
    fetch('/api/save-env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        connectionString: config.connectionString,
        url: config.supabaseUrl,
        anonKey: config.supabaseAnonKey,
        tursoUrl: config.tursoUrl,
        tursoAuthToken: config.tursoAuthToken,
        upstashUrl: config.upstashUrl,
        upstashToken: config.upstashToken
      })
    }).catch(err => console.warn('Aviso: Não foi possível salvar no .env.local do servidor:', err));

    console.log('[Database Config] Configurações salvas e aplicadas com sucesso:', config.provider);
  } catch (err) {
    console.error('Erro ao salvar configuração de base de dados:', err);
  }
};

// Dynamic proxy so any direct use of `supabase.from(...)` uses the active client
export const supabase: any = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      return (...args: any[]) => ({
        select: () => ({ maybeSingle: async () => ({ data: null, error: new Error('Base de dados não configurada') }), data: [], error: null }),
        insert: async () => ({ data: null, error: new Error('Base de dados não configurada') }),
        upsert: async () => ({ data: null, error: new Error('Base de dados não configurada') }),
        update: async () => ({ data: null, error: new Error('Base de dados não configurada') }),
        delete: async () => ({ data: null, error: new Error('Base de dados não configurada') }),
        rpc: async () => ({ data: null, error: new Error('Base de dados não configurada') }),
        eq: function() { return this; }
      });
    }
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'success' | 'warning' | 'error' | 'info';
  table: string;
  message: string;
}

export interface TableSyncStatus {
  tableName: string;
  status: 'synced' | 'pending' | 'failed' | 'offline';
  lastSynced: string;
  errorMessage?: string;
  recordCount?: number;
}

export interface GlobalSyncState {
  isOnline: boolean;
  lastSyncTime: string | null;
  tables: Record<string, TableSyncStatus>;
  logs: SyncLog[];
}

export const globalSyncState: GlobalSyncState = {
  isOnline: false,
  lastSyncTime: null,
  tables: {
    company_config: { tableName: 'company_config', status: 'pending', lastSynced: '' },
    billing_series: { tableName: 'billing_series', status: 'pending', lastSynced: '' },
    rooms: { tableName: 'rooms', status: 'pending', lastSynced: '' },
    menu_items: { tableName: 'menu_items', status: 'pending', lastSynced: '' },
    employees: { tableName: 'employees', status: 'pending', lastSynced: '' },
    expenses: { tableName: 'expenses', status: 'pending', lastSynced: '' },
    bookings: { tableName: 'bookings', status: 'pending', lastSynced: '' },
    bar_orders: { tableName: 'bar_orders', status: 'pending', lastSynced: '' },
    events: { tableName: 'events', status: 'pending', lastSynced: '' },
    developer_settings: { tableName: 'developer_settings', status: 'pending', lastSynced: '' },
    users_custom: { tableName: 'users_custom', status: 'pending', lastSynced: '' },
    payroll_records: { tableName: 'payroll_records', status: 'pending', lastSynced: '' },
  },
  logs: [],
};

export const addSyncLog = (type: 'success' | 'warning' | 'error' | 'info', table: string, message: string) => {
  const log: SyncLog = {
    id: Math.random().toString(36).substring(2, 11),
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    type,
    table,
    message
  };
  globalSyncState.logs.unshift(log);
  if (globalSyncState.logs.length > 100) {
    globalSyncState.logs.pop();
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-sync-state-change'));
  }
};

export const updateTableSyncStatus = (
  table: string,
  status: 'synced' | 'pending' | 'failed' | 'offline',
  recordCount?: number,
  errorMessage?: string
) => {
  if (globalSyncState.tables[table]) {
    globalSyncState.tables[table].status = status;
    globalSyncState.tables[table].lastSynced = new Date().toLocaleTimeString('pt-BR');
    globalSyncState.tables[table].errorMessage = errorMessage;
    if (recordCount !== undefined) {
      globalSyncState.tables[table].recordCount = recordCount;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-sync-state-change'));
    }
  }
};

// Helper to generate cryptographically strong UUID v4 (RFC 4122) on client/server insertion
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40; // Version 4
    buffer[8] = (buffer[8] & 0x3f) | 0x80; // Variant 10xx
    const hex = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  // Safe pseudo-random fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper to generate collision-resistant CUID / K-Sortable Unique ID on client
export const generateCUID = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 6);
  return prefix ? `${prefix}_${timestamp}${randomPart}${randomPart2}` : `c_${timestamp}${randomPart}${randomPart2}`;
};

// Helper to generate consistent, RFC4122-compliant UUIDs from plain IDs
export const toUUID = (id: string) => {
  if (!id) return generateUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  
  // Create a predictable md5/hash representation to make a valid UUID
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  const hex = Math.abs(hash).toString(16).padStart(32, '0');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4${hex.substring(13, 16)}-a${hex.substring(17, 20)}-${hex.substring(20, 32)}`;
};

const DEFAULT_MENU: any = {
  Bebidas: [
    { id: 'c1', name: 'Cocktail Pérola', price: 12, description: 'Especialidade da casa com frutas tropicais', img: 'https://picsum.photos/seed/cocktail/300/300', stock: 50, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'c2', name: 'Vinho Tinto Reserva', price: 25, description: 'Garrafa 750ml de Setúbal', img: 'https://picsum.photos/seed/wine/300/300', stock: 24, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'c3', name: 'Cerveja Artesanal', price: 6, description: 'Pressão 50cl - IPA da Casa', img: 'https://picsum.photos/seed/beer/300/300', stock: 100, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'c4', name: 'Caipirinha', price: 8, description: 'Cachaça, lima e açúcar', img: 'https://picsum.photos/seed/cocktail-1/300/300', stock: 40, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
  ],
  Comida: [
    { id: 'f1', name: 'Hambúrguer Gourmet', price: 18, description: 'Carne angus, queijo cheddar e bacon', img: 'https://picsum.photos/seed/burger/300/300', stock: 30, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'f2', name: 'Salada Tropical', price: 14, description: 'Mix de folhas, manga e molho especial', img: 'https://picsum.photos/seed/salad/300/300', stock: 20, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'f3', name: 'Tábua de Queijos', price: 22, description: 'Seleção de queijos nacionais e importados', img: 'https://picsum.photos/seed/cheese/300/300', stock: 15, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
  ],
  Sobremesas: [
    { id: 'd1', name: 'Pudim de Leite', price: 6, description: 'Caseiro com calda de caramelo', img: 'https://picsum.photos/seed/pudding/300/300', stock: 25, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'd2', name: 'Mousse de Chocolate', price: 7, description: 'Chocolate belga 70% cacau', img: 'https://picsum.photos/seed/chocolate/300/300', stock: 20, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
  ],
  Cocktails: [
    { id: 'ck1', name: 'Mojito', price: 9, description: 'Rum, hortelã, lima e soda', img: 'https://picsum.photos/seed/cocktail-2/300/300', stock: 45, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'ck2', name: 'Margarita', price: 10, description: 'Tequila, triple sec e sumo de lima', img: 'https://picsum.photos/seed/cocktail-3/300/300', stock: 35, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
    { id: 'ck3', name: 'Pina Colada', price: 11, description: 'Rum, coco e sumo de ananás', img: 'https://picsum.photos/seed/cocktail-4/300/300', stock: 30, taxConfig: { type: 'IVA', rate: 14, code: 'NOR', description: 'IVA Taxa Normal 14%' } },
  ],
};

// Helper to resolve or create customer record dynamically
const getOrCreateCustomer = async (client: any, b: any) => {
  const name = b.name || b.customerName || 'Cliente';
  const docId = b.documentId || b.customerNif || b.nif || `DOC-${name.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ANON'}`;
  const phone = b.phone || b.customerPhone || '';

  try {
    const { data: existing } = await client
      .from('customers')
      .select('id')
      .eq('document_id', docId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: inserted, error } = await client
      .from('customers')
      .insert({ name, document_id: docId, phone })
      .select('id')
      .maybeSingle();

    if (error) {
      // If code is unique violation from parallel operations, fetch again
      const { data: fallback } = await client
        .from('customers')
        .select('id')
        .eq('document_id', docId)
        .maybeSingle();
      return fallback?.id || null;
    }

    return inserted?.id || null;
  } catch (err) {
    console.error('Erro ao resolver cliente:', err);
    return null;
  }
};

// Synchronize specific collection to Supabase (Local -> Cloud)
export const syncCollectionToSupabase = async (key: string, data: any) => {
  const client = getSupabaseClient();
  if (!client) return;

  const isOnline = await checkConnectionCached();
  if (!isOnline) {
    console.log(`[Supabase Sync] Ignorando sincronização para ${key} porque o Supabase está offline.`);
    return;
  }

  try {
    if (key === 'rooms') {
      const roomsToSync = data.map(room => ({
        id: toUUID(`room-${room.id || room.number}`),
        number: room.number,
        type: ['single', 'double', 'suite', 'deluxe'].includes(room.type?.toLowerCase()) 
          ? room.type.toLowerCase() 
          : 'double',
        price: Number(room.price) || 0,
        status: ['available', 'occupied', 'maintenance', 'dirty'].includes(room.status?.toLowerCase())
          ? room.status.toLowerCase()
          : 'available',
        created_at: new Date().toISOString()
      }));

      const { error } = await client.from('rooms').upsert(roomsToSync, { onConflict: 'number' });
      if (error) console.error('[Supabase Sync] Erro em rooms:', error);
    }

    else if (key === 'bookings') {
      const currentRooms = storage.get('rooms') || [];
      await syncCollectionToSupabase('rooms', currentRooms);
      
      const { data: dbRooms } = await client.from('rooms').select('id, number');
      const roomMap = new Map((dbRooms || []).map(r => [r.number, r.id]));

      const bookingsToSync = [];
      for (const b of data) {
        const customerId = await getOrCreateCustomer(client, b);
        const roomId = roomMap.get(b.room) || null;
        
        let status = 'pending';
        const rawStatus = b.status?.toLowerCase().replace(/\s/g, '_');
        if (rawStatus === 'checked_in' || rawStatus === 'check_in' || b.status === 'Checked In') status = 'checked_in';
        else if (rawStatus === 'confirmed' || rawStatus === 'confirmado' || b.status === 'Confirmado') status = 'confirmed';
        else if (rawStatus === 'checked_out' || rawStatus === 'checkout' || rawStatus === 'check-out' || b.status === 'Check-out') status = 'checked_out';
        else if (rawStatus === 'cancelled' || rawStatus === 'cancelado' || b.status === 'Cancelado') status = 'cancelled';
        
        let paymentStatus = 'pending';
        const rawPayStatus = b.paymentStatus?.toLowerCase();
        if (rawPayStatus === 'pago' || rawPayStatus === 'paid') paymentStatus = 'paid';
        else if (rawPayStatus === 'parcial' || rawPayStatus === 'partial') paymentStatus = 'partial';
        else if (rawPayStatus === 'pendente' || rawPayStatus === 'pending') paymentStatus = 'pending';

        bookingsToSync.push({
          id: toUUID(`booking-${b.id}`),
          customer_id: customerId,
          room_id: roomId,
          check_in: b.in || b.checkIn || new Date().toISOString(),
          check_out: b.out || b.checkOut || new Date().toISOString(),
          status,
          payment_status: paymentStatus,
          total_amount: Number(b.totalAmount || b.totalPrice || 0),
          tax_amount: Number(b.taxAmount || 0),
          tax_config: b.taxConfig || null,
          withholding_rate: Number(b.withholdingRate || 0),
          withholding_amount: Number(b.withholdingAmount || 0),
          invoice_number: b.invoiceNumber || null,
          invoice_series: b.invoiceSeries || null,
          signature: b.signature || null,
          created_at: b.createdAt || new Date().toISOString()
        });
      }

      const { error } = await client.from('bookings').upsert(bookingsToSync);
      if (error) console.error('[Supabase Sync] Erro em bookings:', error);
    }

    else if (key === 'bar_orders') {
      const currentRooms = storage.get('rooms') || [];
      await syncCollectionToSupabase('rooms', currentRooms);
      
      const { data: dbRooms } = await client.from('rooms').select('id, number');
      const roomMap = new Map((dbRooms || []).map(r => [r.number, r.id]));

      const ordersToSync = data.map(o => {
        const roomId = roomMap.get(o.room) || null;
        let status = 'paid';
        if (o.status === 'pending' || o.status === 'Pendente') status = 'pending';
        else if (o.status === 'delivered') status = 'delivered';
        else if (o.status === 'voided' || o.status === 'Cancelada') status = 'voided';
        else if (o.status === 'completed' || o.status === 'Pago') status = 'paid';

        return {
          id: toUUID(`order-${o.id}`),
          items: typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []),
          total: Number(o.total || 0),
          tax_amount: Number(o.taxAmount || 0),
          tax_config: o.taxConfig || null,
          room_id: roomId,
          is_cash: o.isCash !== undefined ? o.isCash : true,
          status,
          signature: o.signature || null,
          created_at: o.date || o.createdAt || new Date().toISOString()
        };
      });

      const { error } = await client.from('bar_orders').upsert(ordersToSync);
      if (error) console.error('[Supabase Sync] Erro em bar_orders:', error);
    }

    else if (key === 'leisure_events') {
      const eventsToSync = [];
      for (const e of data) {
        const customerId = await getOrCreateCustomer(client, e);
        eventsToSync.push({
          id: toUUID(`event-${e.id}`),
          name: e.name,
          date: e.date || new Date().toISOString(),
          end_date: e.endDate || null,
          start_time: e.startTime || null,
          end_time: e.endTime || null,
          location: e.location || 'Salão de Lazer',
          customer_id: customerId,
          price: Number(e.price || 0),
          paid_amount: Number(e.paidAmount || 0),
          tax_amount: Number(e.taxAmount || 0),
          tax_config: e.taxConfig || null,
          withholding_rate: Number(e.withholdingRate || 0),
          withholding_amount: Number(e.withholdingAmount || 0),
          base_price: Number(e.basePrice || e.price || 0),
          penalty_fee: Number(e.penaltyFee || 0),
          status: e.status?.toLowerCase() || 'scheduled',
          invoice_number: e.invoiceNumber || null,
          invoice_series: e.invoiceSeries || null,
          signature: e.signature || null,
          created_at: e.createdAt || new Date().toISOString()
        });
      }

      const { error } = await client.from('events').upsert(eventsToSync);
      if (error) console.error('[Supabase Sync] Erro em events (leisure_events):', error);
    }

    else if (key === 'expenses') {
      const expensesToSync = data.map(ex => ({
        id: toUUID(`expense-${ex.id}`),
        description: ex.description,
        amount: Number(ex.amount) || 0,
        category: ['rooms', 'bar', 'leisure', 'general', 'other'].includes(ex.category)
          ? ex.category
          : 'other',
        date: ex.date || new Date().toISOString().split('T')[0],
        created_at: ex.createdAt || new Date().toISOString()
      }));

      const { error } = await client.from('expenses').upsert(expensesToSync);
      if (error) console.error('[Supabase Sync] Erro em expenses:', error);
    }

    else if (key === 'employees') {
      const employeesToSync = data.map(emp => ({
        id: toUUID(`employee-${emp.id}`),
        name: emp.name,
        role: ['receptionist', 'cleaner', 'barman', 'manager', 'maintenance'].includes(emp.role)
          ? emp.role
          : 'receptionist',
        salary: Number(emp.salary) || 0,
        phone: emp.phone || null,
        status: ['active', 'inactive'].includes(emp.status) ? emp.status : 'active',
        document_id: emp.documentId || null,
        inss_number: emp.inssNumber || null,
        contract_details: emp.contractDetails || null,
        qualifications: emp.qualifications || null,
        family_details: emp.familyDetails || null,
        bonus: Number(emp.bonus || 0),
        supplements_and_allowances_value: Number(emp.supplementsAndAllowancesValue || 0),
        supplements_and_allowances: emp.supplementsAndAllowances || null,
        payroll_config: emp.payrollConfig || null,
        created_at: new Date().toISOString()
      }));

      const { error } = await client.from('employees').upsert(employeesToSync);
      if (error) console.error('[Supabase Sync] Erro em employees:', error);
    }

    else if (key === 'bar_menu') {
      let flatItems: any[] = [];
      if (Array.isArray(data)) {
        flatItems = data;
      } else if (data && typeof data === 'object') {
        Object.entries(data).forEach(([category, items]) => {
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              flatItems.push({
                ...item,
                category: item.category || category
              });
            });
          }
        });
      }

      const menuToSync = flatItems.map(item => ({
        id: toUUID(`menu-${item.id}`),
        name: item.name,
        price: Number(item.price) || 0,
        description: item.description || null,
        img: item.img || null,
        stock: Number(item.stock) || 0,
        category: item.category || null,
        tax_config: item.taxConfig || null,
        created_at: new Date().toISOString()
      }));

      const { error } = await client.from('menu_items').upsert(menuToSync);
      if (error) console.error('[Supabase Sync] Erro em menu_items:', error);
    }

    else if (key === 'company_config') {
      const configObj = {
        id: 1,
        name: data.name || 'Nova Pérola de Malanje',
        nif: data.nif || '000000000',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        currency: data.currency || 'Kz',
        logo: data.logo || null,
        default_withholding_rate: Number(data.defaultWithholdingRate || 6.5),
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('company_config').upsert(configObj);
      if (error) console.error('[Supabase Sync] Erro em company_config:', error);

      if (Array.isArray(data.billingSeries)) {
        const seriesToSync = data.billingSeries.map((s: any) => ({
          id: s.id,
          name: s.name,
          prefix: s.prefix,
          next_number: Number(s.nextNumber || 1),
          is_default: Boolean(s.isDefault),
          created_at: new Date().toISOString()
        }));
        const { error: seriesErr } = await client.from('billing_series').upsert(seriesToSync);
        if (seriesErr) console.error('[Supabase Sync] Erro em billing_series:', seriesErr);
      }
    }

    else if (key === 'developer_settings') {
      const settingsObj = {
        id: 1,
        payment_status: data.paymentStatus || 'paid',
        license_type: data.licenseType || 'lifetime',
        expiry_date: data.expiryDate || null,
        limitations: data.limitations || null,
        payment_methods: data.paymentMethods || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('developer_settings').upsert(settingsObj);
      if (error) console.error('[Supabase Sync] Erro em developer_settings:', error);
    }

    else if (key === 'users') {
      const usersToSync = data.map((u: any) => ({
        id: toUUID(`user-${u.id}`),
        username: u.username,
        name: u.name,
        role: ['admin', 'receptionist', 'manager', 'rooms_user', 'bar_user', 'events_user', 'hr_user'].includes(u.role)
          ? u.role
          : 'receptionist',
        permissions: u.permissions || null,
        created_at: new Date().toISOString()
      }));

      const { error } = await client.from('users_custom').upsert(usersToSync);
      if (error) console.error('[Supabase Sync] Erro em users_custom:', error);
    }

    else if (key === 'payroll_records') {
      const { data: dbEmployees } = await client.from('employees').select('id, name');
      const employeeMap = new Map((dbEmployees || []).map(emp => [emp.name, emp.id]));

      const recordsToSync = data.map((r: any) => {
        const empId = r.employeeId?.length === 36 ? r.employeeId : (employeeMap.get(r.employeeName) || toUUID(`employee-${r.employeeId}`));
        return {
          id: toUUID(`payroll-${r.id}`),
          employee_id: empId,
          month: r.month || new Date().toISOString().slice(0, 7),
          base_salary: Number(r.baseSalary || 0),
          food_allowance: Number(r.foodAllowance || 0),
          transport_allowance: Number(r.transportAllowance || 0),
          bonus: Number(r.bonus || 0),
          supplements: Number(r.supplements || 0),
          social_security: Number(r.socialSecurity || 0),
          irt: Number(r.irt || 0),
          other_deductions: Number(r.otherDeductions || 0),
          net_salary: Number(r.netSalary || 0),
          status: ['pending', 'paid'].includes(r.status) ? r.status : 'pending',
          payment_date: r.paymentDate || null,
          created_at: new Date().toISOString()
        };
      });

      const { error } = await client.from('payroll_records').upsert(recordsToSync);
      if (error) console.error('[Supabase Sync] Erro em payroll_records:', error);
    }
  } catch (err) {
    console.error(`[Supabase Sync] Erro na sincronização offline-first para ${key}:`, err);
  }
};

// Pull and Bidirectional Merge (Cloud -> Local) with safety
export const pullAndMergeFromSupabase = async () => {
  const client = getSupabaseClient();
  if (!client) return null;

  const isOnline = await checkConnectionCached();
  if (!isOnline) {
    console.log('[Supabase Sync] Supabase está offline. Carregando dados locais.');
    return {
      rooms: storage.get('rooms') || [],
      bookings: storage.get('bookings') || [],
      bar_orders: storage.get('bar_orders') || [],
      leisure_events: storage.get('leisure_events') || [],
      expenses: storage.get('expenses') || [],
      employees: storage.get('employees') || [],
      bar_menu: storage.get('bar_menu') || DEFAULT_MENU,
      company_config: storage.get('company_config') || null,
      developer_settings: storage.get('developer_settings') || null,
      users: storage.get('users') || [],
      payroll_records: storage.get('payroll_records') || []
    };
  }

  console.log('[Supabase Sync] Iniciando sincronização bidirecional isolada (Cloud <-> Local)...');
  addSyncLog('info', 'sync_all', 'Iniciando sincronização bidirecional (Cloud <-> Local)...');

  // Pre-populate with local defaults so we never return null/incomplete data if any fetch fails
  let finalCompany = storage.get('company_config') || null;
  let finalRooms = storage.get('rooms') || [];
  let finalMenu = storage.get('bar_menu') || DEFAULT_MENU;
  let finalEmployees = storage.get('employees') || [];
  let finalExpenses = storage.get('expenses') || [];
  let finalBookings = storage.get('bookings') || [];
  let finalBarOrders = storage.get('bar_orders') || [];
  let finalEvents = storage.get('leisure_events') || [];
  let finalDevSettings = storage.get('developer_settings') || null;
  let finalUsers = storage.get('users') || [];
  let finalPayroll = storage.get('payroll_records') || [];

  // 1. Company config & billing series
  try {
    const { data: dbCompany, error: compErr } = await client.from('company_config').select('*').eq('id', 1).maybeSingle();
    const { data: dbSeries, error: seriesErr } = await client.from('billing_series').select('*');
    
    if (compErr) throw compErr;
    if (seriesErr) throw seriesErr;

    const mappedSeries = (dbSeries || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      prefix: s.prefix,
      nextNumber: Number(s.next_number || 1),
      isDefault: Boolean(s.is_default)
    }));

    if (dbCompany) {
      finalCompany = {
        name: dbCompany.name,
        nif: dbCompany.nif,
        phone: dbCompany.phone || '',
        email: dbCompany.email || '',
        address: dbCompany.address || '',
        currency: dbCompany.currency || 'Kz',
        logo: dbCompany.logo || '',
        defaultWithholdingRate: Number(dbCompany.default_withholding_rate || 6.5),
        billingSeries: mappedSeries
      };
      
      const rawLocal = localStorage.getItem('perola_company_config');
      if (rawLocal) {
        const local = JSON.parse(rawLocal);
        const mergedSeries = [...(local.billingSeries || [])];
        mappedSeries.forEach((ds: any) => {
          const idx = mergedSeries.findIndex((ls: any) => ls.id === ds.id);
          if (idx > -1) {
            mergedSeries[idx] = { ...mergedSeries[idx], ...ds };
          } else {
            mergedSeries.push(ds);
          }
        });
        finalCompany.billingSeries = mergedSeries;
      }

      // Se a tabela de billing_series estiver vazia na nuvem, popular com as séries locais/padrão
      if (mappedSeries.length === 0 && finalCompany.billingSeries && finalCompany.billingSeries.length > 0) {
        console.log('[Supabase Sync] Populando billing_series vazia no Supabase...');
        const seriesToSync = finalCompany.billingSeries.map((s: any) => ({
          id: s.id,
          name: s.name,
          prefix: s.prefix,
          next_number: Number(s.nextNumber || 1),
          is_default: Boolean(s.isDefault),
          created_at: new Date().toISOString()
        }));
        await client.from('billing_series').upsert(seriesToSync);
      }

      localStorage.setItem('perola_company_config', JSON.stringify(finalCompany));
    } else {
      let localCompany = localStorage.getItem('perola_company_config');
      if (!localCompany) {
        const defaultCompany = {
          name: 'Pérola do Oceano Resort',
          nif: '5000123456',
          phone: '+244 923 000 000',
          email: 'contacto@peroladooceano.com',
          address: 'Av. Marginal, Luanda, Angola',
          currency: 'Kz',
          logo: '',
          defaultWithholdingRate: 6.5,
          billingSeries: [
            { id: 'AGT', name: 'Série Geral', prefix: 'AGT', nextNumber: 1, isDefault: true },
            { id: 'RES', name: 'Série Reservas', prefix: 'RES', nextNumber: 1 }
          ]
        };
        localStorage.setItem('perola_company_config', JSON.stringify(defaultCompany));
        localCompany = JSON.stringify(defaultCompany);
      }
      await syncCollectionToSupabase('company_config', JSON.parse(localCompany));
      finalCompany = JSON.parse(localCompany);
    }

    updateTableSyncStatus('company_config', 'synced', 1);
    updateTableSyncStatus('billing_series', 'synced', mappedSeries.length);
    addSyncLog('success', 'company_config', 'Configuração da empresa sincronizada.');
    addSyncLog('success', 'billing_series', `Séries de faturação sincronizadas (${mappedSeries.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em company_config / billing_series:', err);
    updateTableSyncStatus('company_config', 'failed', undefined, err.message || String(err));
    updateTableSyncStatus('billing_series', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'company_config', `Erro company_config: ${err.message || String(err)}`);
  }

  // 2. Rooms
  try {
    const { data: dbRooms, error } = await client.from('rooms').select('*');
    if (error) throw error;

    if (dbRooms && dbRooms.length > 0) {
      const mapped = dbRooms.map(r => ({
        id: r.id,
        number: r.number,
        type: r.type,
        price: Number(r.price),
        status: r.status
      }));
      const rawLocal = localStorage.getItem('perola_rooms');
      const local = rawLocal ? JSON.parse(rawLocal) : [];
      
      const merged = [...local];
      mapped.forEach(dr => {
        const index = merged.findIndex(lr => lr.number === dr.number);
        if (index > -1) {
          merged[index] = { ...merged[index], ...dr };
        } else {
          merged.push(dr);
        }
      });
      finalRooms = merged;
      localStorage.setItem('perola_rooms', JSON.stringify(finalRooms));
    } else {
      const rawLocal = localStorage.getItem('perola_rooms');
      if (rawLocal) {
        await syncCollectionToSupabase('rooms', JSON.parse(rawLocal));
      }
    }

    updateTableSyncStatus('rooms', 'synced', finalRooms.length);
    addSyncLog('success', 'rooms', `Quartos sincronizados (${finalRooms.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em rooms:', err);
    updateTableSyncStatus('rooms', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'rooms', `Erro quartos: ${err.message || String(err)}`);
  }

  // 3. Menu Items (Bar Inventory)
  try {
    const { data: dbMenu, error } = await client.from('menu_items').select('*');
    if (error) throw error;

    const mappedMenu = (dbMenu || []).map(m => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      description: m.description || '',
      img: m.img || '',
      stock: Number(m.stock || 0),
      category: m.category || 'Outros',
      taxConfig: m.tax_config
    }));

    if (mappedMenu && mappedMenu.length > 0) {
      const rawLocal = localStorage.getItem('perola_bar_menu');
      const local = rawLocal ? JSON.parse(rawLocal) : {};
      
      const dbMenuByCategory: { [key: string]: any[] } = {};
      mappedMenu.forEach(item => {
        const cat = item.category || 'Outros';
        if (!dbMenuByCategory[cat]) {
          dbMenuByCategory[cat] = [];
        }
        dbMenuByCategory[cat].push(item);
      });

      const merged = { ...local };
      Object.entries(dbMenuByCategory).forEach(([category, dbItems]) => {
        if (!merged[category]) {
          merged[category] = [];
        }
        dbItems.forEach(dbItem => {
          const index = merged[category].findIndex((li: any) => li.name === dbItem.name);
          if (index > -1) {
            merged[category][index] = { ...merged[category][index], ...dbItem };
          } else {
            merged[category].push(dbItem);
          }
        });
      });

      finalMenu = merged;
      localStorage.setItem('perola_bar_menu', JSON.stringify(finalMenu));
    } else {
      let rawLocal = localStorage.getItem('perola_bar_menu');
      if (!rawLocal) {
        localStorage.setItem('perola_bar_menu', JSON.stringify(DEFAULT_MENU));
        rawLocal = JSON.stringify(DEFAULT_MENU);
      }
      await syncCollectionToSupabase('bar_menu', JSON.parse(rawLocal));
      finalMenu = JSON.parse(rawLocal);
    }

    const totalMenuItems = Object.values(finalMenu).reduce((acc: number, val: any) => acc + (val?.length || 0), 0) as number;
    updateTableSyncStatus('menu_items', 'synced', totalMenuItems);
    addSyncLog('success', 'menu_items', `Menu do bar/inventário sincronizado (${totalMenuItems} itens).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em menu_items:', err);
    updateTableSyncStatus('menu_items', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'menu_items', `Erro menu do bar: ${err.message || String(err)}`);
  }

  // 4. Employees
  try {
    const { data: dbEmployees, error } = await client.from('employees').select('*');
    if (error) throw error;

    if (dbEmployees && dbEmployees.length > 0) {
      const mapped = dbEmployees.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        salary: Number(e.salary),
        phone: e.phone || '',
        status: e.status,
        documentId: e.document_id || '',
        inssNumber: e.inss_number || '',
        contractDetails: e.contract_details || '',
        qualifications: e.qualifications || '',
        familyDetails: e.family_details || '',
        bonus: Number(e.bonus || 0),
        supplementsAndAllowancesValue: Number(e.supplements_and_allowances_value || 0),
        supplementsAndAllowances: e.supplements_and_allowances || '',
        payrollConfig: e.payroll_config
      }));
      const rawLocal = localStorage.getItem('perola_employees');
      const local = rawLocal ? JSON.parse(rawLocal) : [];
      
      const merged = [...local];
      mapped.forEach(de => {
        const index = merged.findIndex(le => le.name === de.name);
        if (index > -1) {
          merged[index] = { ...merged[index], ...de };
        } else {
          merged.push(de);
        }
      });
      finalEmployees = merged;
      localStorage.setItem('perola_employees', JSON.stringify(finalEmployees));
    } else {
      const rawLocal = localStorage.getItem('perola_employees');
      if (rawLocal) {
        await syncCollectionToSupabase('employees', JSON.parse(rawLocal));
      }
    }

    updateTableSyncStatus('employees', 'synced', finalEmployees.length);
    addSyncLog('success', 'employees', `Funcionários sincronizados (${finalEmployees.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em employees:', err);
    updateTableSyncStatus('employees', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'employees', `Erro funcionários: ${err.message || String(err)}`);
  }

  // 5. Expenses
  try {
    const { data: dbExpenses, error } = await client.from('expenses').select('*');
    if (error) throw error;

    if (dbExpenses && dbExpenses.length > 0) {
      const mapped = dbExpenses.map(ex => ({
        id: ex.id,
        description: ex.description,
        amount: Number(ex.amount),
        category: ex.category,
        date: ex.date,
        createdAt: ex.created_at
      }));
      const rawLocal = localStorage.getItem('perola_expenses');
      const local = rawLocal ? JSON.parse(rawLocal) : [];
      
      const merged = [...local];
      mapped.forEach(dex => {
        const index = merged.findIndex(lex => lex.description === dex.description && lex.amount === dex.amount && lex.date === dex.date);
        if (index === -1) {
          merged.push(dex);
        }
      });
      finalExpenses = merged;
      localStorage.setItem('perola_expenses', JSON.stringify(finalExpenses));
    } else {
      const rawLocal = localStorage.getItem('perola_expenses');
      if (rawLocal) {
        await syncCollectionToSupabase('expenses', JSON.parse(rawLocal));
      }
    }

    updateTableSyncStatus('expenses', 'synced', finalExpenses.length);
    addSyncLog('success', 'expenses', `Despesas sincronizadas (${finalExpenses.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em expenses:', err);
    updateTableSyncStatus('expenses', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'expenses', `Erro despesas: ${err.message || String(err)}`);
  }

  // 6. Bookings
  try {
    const { data: dbBookings, error } = await client.from('bookings').select('*, customers(*), rooms(*)');
    if (error) throw error;

    if (dbBookings && dbBookings.length > 0) {
      const mapped = dbBookings.map(b => {
        let status = 'Confirmado';
        if (b.status === 'checked_in') status = 'Checked In';
        else if (b.status === 'confirmed') status = 'Confirmado';
        else if (b.status === 'checked_out') status = 'Check-out';
        else if (b.status === 'cancelled') status = 'Cancelado';

        let paymentStatus = 'Pendente';
        if (b.payment_status === 'paid') paymentStatus = 'Pago';
        else if (b.payment_status === 'partial') paymentStatus = 'Parcial';
        else if (b.payment_status === 'pending') paymentStatus = 'Pendente';

        return {
          id: b.id,
          name: b.customers?.name || 'Cliente',
          room: b.rooms?.number || 'Avulsa',
          in: b.check_in,
          out: b.check_out,
          status,
          paymentStatus,
          documentId: b.customers?.document_id || '',
          phone: b.customers?.phone || '',
          totalAmount: Number(b.total_amount),
          taxAmount: Number(b.tax_amount || 0),
          taxConfig: b.tax_config,
          withholdingRate: Number(b.withholding_rate || 0),
          withholdingAmount: Number(b.withholding_amount || 0),
          invoiceNumber: b.invoice_number,
          invoiceSeries: b.invoice_series,
          signature: b.signature,
          createdAt: b.created_at
        };
      });
      const rawLocal = localStorage.getItem('perola_bookings');
      const local = rawLocal ? JSON.parse(rawLocal) : [];

      const merged = [...local];
      mapped.forEach(db => {
        const index = merged.findIndex(lb => lb.id === db.id || (lb.name === db.name && lb.in === db.in && lb.room === db.room));
        if (index > -1) {
          merged[index] = { ...merged[index], ...db };
        } else {
          merged.push(db);
        }
      });
      finalBookings = merged;
      localStorage.setItem('perola_bookings', JSON.stringify(finalBookings));
    } else {
      const rawLocal = localStorage.getItem('perola_bookings');
      if (rawLocal) {
        await syncCollectionToSupabase('bookings', JSON.parse(rawLocal));
      }
    }

    updateTableSyncStatus('bookings', 'synced', finalBookings.length);
    addSyncLog('success', 'bookings', `Reservas sincronizadas (${finalBookings.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em bookings:', err);
    updateTableSyncStatus('bookings', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'bookings', `Erro reservas: ${err.message || String(err)}`);
  }

  // 7. Bar Orders
  try {
    const { data: dbOrders, error } = await client.from('bar_orders').select('*, rooms(*)');
    if (error) throw error;

    if (dbOrders && dbOrders.length > 0) {
      const mapped = dbOrders.map(o => {
        let status = 'Pago';
        if (o.status === 'pending') status = 'Pendente';
        else if (o.status === 'delivered') status = 'Entregue';
        else if (o.status === 'voided') status = 'Cancelada';
        else if (o.status === 'paid') status = 'Pago';

        let itemsArr = [];
        try {
          itemsArr = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        } catch (e) {
          console.error(e);
        }

        return {
          id: o.id,
          date: o.created_at,
          items: itemsArr,
          total: Number(o.total),
          taxAmount: Number(o.tax_amount || 0),
          taxConfig: o.tax_config,
          room: o.rooms?.number || 'Avulsa',
          isCash: o.is_cash,
          status,
          signature: o.signature
        };
      });
      const rawLocal = localStorage.getItem('perola_bar_orders');
      const local = rawLocal ? JSON.parse(rawLocal) : [];

      const merged = [...local];
      mapped.forEach(dob => {
        const index = merged.findIndex(lob => lob.id === dob.id || (lob.date === dob.date && lob.total === dob.total));
        if (index > -1) {
          merged[index] = { ...merged[index], ...dob };
        } else {
          merged.push(dob);
        }
      });
      finalBarOrders = merged;
      localStorage.setItem('perola_bar_orders', JSON.stringify(finalBarOrders));
    } else {
      const rawLocal = localStorage.getItem('perola_bar_orders');
      if (rawLocal) {
        await syncCollectionToSupabase('bar_orders', JSON.parse(rawLocal));
      }
    }

    updateTableSyncStatus('bar_orders', 'synced', finalBarOrders.length);
    addSyncLog('success', 'bar_orders', `Pedidos do bar sincronizados (${finalBarOrders.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em bar_orders:', err);
    updateTableSyncStatus('bar_orders', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'bar_orders', `Erro pedidos do bar: ${err.message || String(err)}`);
  }

  // 8. Leisure Events
  try {
    const { data: dbEvents, error } = await client.from('events').select('*, customers(*)');
    if (error) throw error;

    if (dbEvents && dbEvents.length > 0) {
      const mapped = dbEvents.map(e => ({
        id: e.id,
        name: e.name,
        date: e.date,
        endDate: e.end_date,
        startTime: e.start_time,
        endTime: e.end_time,
        location: e.location,
        price: Number(e.price),
        paidAmount: Number(e.paid_amount || 0),
        taxAmount: Number(e.tax_amount || 0),
        taxConfig: e.tax_config,
        withholdingRate: Number(e.withholding_rate || 0),
        withholdingAmount: Number(e.withholding_amount || 0),
        basePrice: Number(e.base_price || e.price),
        penaltyFee: Number(e.penalty_fee || 0),
        status: e.status,
        invoiceNumber: e.invoice_number,
        invoiceSeries: e.invoice_series,
        signature: e.signature,
        customerName: e.customers?.name || 'Cliente',
        customerPhone: e.customers?.phone || '',
        customerNif: e.customers?.document_id || ''
      }));
      const rawLocal = localStorage.getItem('perola_leisure_events');
      const local = rawLocal ? JSON.parse(rawLocal) : [];

      const merged = [...local];
      mapped.forEach(de => {
        const index = merged.findIndex(le => le.id === de.id || (le.name === de.name && le.date === de.date));
        if (index > -1) {
          merged[index] = { ...merged[index], ...de };
        } else {
          merged.push(de);
        }
      });
      finalEvents = merged;
      localStorage.setItem('perola_leisure_events', JSON.stringify(finalEvents));
    } else {
      const rawLocal = localStorage.getItem('perola_leisure_events');
      if (rawLocal) {
        await syncCollectionToSupabase('leisure_events', JSON.parse(rawLocal));
      }
    }

    updateTableSyncStatus('events', 'synced', finalEvents.length);
    addSyncLog('success', 'events', `Eventos de lazer sincronizados (${finalEvents.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em leisure_events (events):', err);
    updateTableSyncStatus('events', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'events', `Erro eventos de lazer: ${err.message || String(err)}`);
  }

  // 9. Developer Settings
  try {
    const { data: dbDevSettings, error } = await client.from('developer_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;

    if (dbDevSettings) {
      finalDevSettings = {
        paymentStatus: dbDevSettings.payment_status || 'paid',
        licenseType: dbDevSettings.license_type || 'lifetime',
        expiryDate: dbDevSettings.expiry_date || '',
        limitations: dbDevSettings.limitations || {},
        paymentMethods: dbDevSettings.payment_methods || {}
      };
      
      const rawLocal = localStorage.getItem('perola_developer_settings');
      if (rawLocal) {
        const local = JSON.parse(rawLocal);
        finalDevSettings = { ...local, ...finalDevSettings };
      }
      localStorage.setItem('perola_developer_settings', JSON.stringify(finalDevSettings));
    } else {
      let rawLocal = localStorage.getItem('perola_developer_settings');
      if (!rawLocal) {
        const defaultDevSettings = {
          paymentStatus: 'paid',
          licenseType: 'monthly',
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          devUsername: 'fox',
          devPassword: 'Arvex1',
          limitations: {
            blockSystem: false,
            disableReports: false,
            disableRooms: false,
            disableBar: false,
            disableLeisure: false
          },
          paymentMethods: {
            bankTransfer: 'Banco BAI',
            multicaixaExpress: '+244 923 000 000',
            iban: 'AO06 0000 0000 0000 0000 0000 0'
          }
        };
        localStorage.setItem('perola_developer_settings', JSON.stringify(defaultDevSettings));
        rawLocal = JSON.stringify(defaultDevSettings);
      }
      await syncCollectionToSupabase('developer_settings', JSON.parse(rawLocal));
      finalDevSettings = JSON.parse(rawLocal);
    }

    updateTableSyncStatus('developer_settings', 'synced', 1);
    addSyncLog('success', 'developer_settings', 'Definições do programador sincronizadas.');
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em developer_settings:', err);
    updateTableSyncStatus('developer_settings', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'developer_settings', `Erro definições do programador: ${err.message || String(err)}`);
  }

  // 10. Users
  try {
    const { data: dbUsers, error } = await client.from('users_custom').select('*');
    if (error) throw error;

    if (dbUsers && dbUsers.length > 0) {
      const mapped = dbUsers.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        permissions: u.permissions
      }));
      const rawLocal = localStorage.getItem('perola_users');
      const local = rawLocal ? JSON.parse(rawLocal) : [];
      
      const merged = [...local];
      mapped.forEach((du: any) => {
        const index = merged.findIndex((lu: any) => lu.username === du.username);
        if (index > -1) {
          merged[index] = { ...merged[index], ...du };
        } else {
          merged.push(du);
        }
      });
      finalUsers = merged;
      localStorage.setItem('perola_users', JSON.stringify(finalUsers));
    } else {
      let rawLocal = localStorage.getItem('perola_users');
      if (!rawLocal) {
        const defaultUsers = [
          { id: '1', username: 'admin', password: '123', role: 'admin', name: 'Administrador' },
          { id: '2', username: 'recepcao', password: '123', role: 'rooms_user', name: 'Recepcionista Quartos' },
          { id: '3', username: 'bar', password: '123', role: 'bar_user', name: 'Atendente Bar' },
          { id: '4', username: 'eventos', password: '123', role: 'events_user', name: 'Gestor Eventos' },
          { id: '5', username: 'rh', password: '123', role: 'hr_user', name: 'Gestor RH' },
        ];
        localStorage.setItem('perola_users', JSON.stringify(defaultUsers));
        rawLocal = JSON.stringify(defaultUsers);
      }
      await syncCollectionToSupabase('users', JSON.parse(rawLocal));
      finalUsers = JSON.parse(rawLocal);
    }

    updateTableSyncStatus('users_custom', 'synced', finalUsers.length);
    addSyncLog('success', 'users_custom', `Utilizadores sincronizados (${finalUsers.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em users_custom:', err);
    updateTableSyncStatus('users_custom', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'users_custom', `Erro utilizadores: ${err.message || String(err)}`);
  }

  // 11. Payroll Records
  try {
    const { data: dbPayroll, error } = await client.from('payroll_records').select('*, employees(*)');
    if (error) throw error;

    if (dbPayroll && dbPayroll.length > 0) {
      const mapped = dbPayroll.map((p: any) => ({
        id: p.id,
        employeeId: p.employee_id,
        employeeName: p.employees?.name || 'Funcionário',
        month: p.month,
        baseSalary: Number(p.base_salary),
        foodAllowance: Number(p.food_allowance || 0),
        transportAllowance: Number(p.transport_allowance || 0),
        bonus: Number(p.bonus || 0),
        supplements: Number(p.supplements || 0),
        socialSecurity: Number(p.social_security),
        irt: Number(p.irt),
        otherDeductions: Number(p.other_deductions || 0),
        netSalary: Number(p.net_salary),
        status: p.status,
        paymentDate: p.payment_date
      }));
      const rawLocal = localStorage.getItem('perola_payroll_records');
      const local = rawLocal ? JSON.parse(rawLocal) : [];

      const merged = [...local];
      mapped.forEach((dp: any) => {
        const index = merged.findIndex((lp: any) => lp.id === dp.id);
        if (index > -1) {
          merged[index] = { ...merged[index], ...dp };
        } else {
          merged.push(dp);
        }
      });
      finalPayroll = merged;
      localStorage.setItem('perola_payroll_records', JSON.stringify(finalPayroll));
    } else {
      let rawLocal = localStorage.getItem('perola_payroll_records');
      if (!rawLocal) {
        const defaultPayroll = [
          {
            id: '1-2026-05',
            employeeId: '1',
            employeeName: 'Ricardo Sousa',
            month: '2026-05',
            baseSalary: 85000,
            foodAllowance: 10000,
            transportAllowance: 10000,
            bonus: 5000,
            socialSecurity: 2550,
            irt: 3000,
            otherDeductions: 0,
            netSalary: 99450,
            status: 'paid',
            paymentDate: new Date('2026-05-30').toISOString()
          },
          {
            id: '3-2026-05',
            employeeId: '3',
            employeeName: 'Miguel Silva',
            month: '2026-05',
            baseSalary: 95000,
            foodAllowance: 10000,
            transportAllowance: 10000,
            bonus: 0,
            socialSecurity: 2850,
            irt: 3500,
            otherDeductions: 1000,
            netSalary: 107650,
            status: 'paid',
            paymentDate: new Date('2026-05-30').toISOString()
          }
        ];
        localStorage.setItem('perola_payroll_records', JSON.stringify(defaultPayroll));
        rawLocal = JSON.stringify(defaultPayroll);
      }
      await syncCollectionToSupabase('payroll_records', JSON.parse(rawLocal));
      finalPayroll = JSON.parse(rawLocal);
    }

    updateTableSyncStatus('payroll_records', 'synced', finalPayroll.length);
    addSyncLog('success', 'payroll_records', `Folha de pagamento sincronizada (${finalPayroll.length} registos).`);
  } catch (err: any) {
    console.error('[Supabase Sync] Erro isolado em payroll_records:', err);
    updateTableSyncStatus('payroll_records', 'failed', undefined, err.message || String(err));
    addSyncLog('error', 'payroll_records', `Erro folha de pagamento: ${err.message || String(err)}`);
  }

  globalSyncState.lastSyncTime = new Date().toLocaleTimeString('pt-BR');
  addSyncLog('info', 'sync_all', 'Sincronização bidirecional completa finalizada com sucesso.');

  return {
    rooms: finalRooms,
    bookings: finalBookings,
    bar_orders: finalBarOrders,
    leisure_events: finalEvents,
    expenses: finalExpenses,
    employees: finalEmployees,
    bar_menu: finalMenu,
    company_config: finalCompany,
    developer_settings: finalDevSettings,
    users: finalUsers,
    payroll_records: finalPayroll
  };
};

export const storage = {
  get: (key: string) => {
    try {
      const data = localStorage.getItem(`perola_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(`perola_${key}`, JSON.stringify(value));
      // Asynchronously push change to active database so that data updates in real-time
      const syncKeys = ['rooms', 'bookings', 'bar_orders', 'leisure_events', 'expenses', 'employees', 'bar_menu', 'company_config', 'developer_settings', 'users', 'payroll_records'];
      if (syncKeys.includes(key)) {
        setTimeout(() => {
          syncCollectionToUniversalDatabase(key, value).catch(err => {
            console.error(`[Universal DB Async Sync] Falha de sync para ${key}:`, err);
          });
        }, 50);
      }
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(`perola_${key}`);
    } catch (e) {
      console.error('Error removing from localStorage:', e);
    }
  },
  sync: async (key: string, _table: string) => {
    const localData = storage.get(key) || [];
    await syncCollectionToUniversalDatabase(key, localData);
  }
};

export const pullAndMergeFromUniversalDatabase = async () => {
  const active = getActiveDatabaseConfig();
  
  // If no database provider is connected (purely local / offline-first mode)
  if (active.provider === 'none' || !active.provider) {
    return {
      rooms: storage.get('rooms') || [],
      bookings: storage.get('bookings') || [],
      bar_orders: storage.get('bar_orders') || [],
      leisure_events: storage.get('leisure_events') || [],
      expenses: storage.get('expenses') || [],
      employees: storage.get('employees') || [],
      bar_menu: storage.get('bar_menu') || DEFAULT_MENU,
      company_config: storage.get('company_config') || null,
      developer_settings: storage.get('developer_settings') || null,
      users: storage.get('users') || [],
      payroll_records: storage.get('payroll_records') || []
    };
  }

  if (active.provider === 'supabase') {
    return await pullAndMergeFromSupabase();
  }

  const isOnline = await checkConnectionCached();
  if (!isOnline) {
    console.log(`[Universal DB Sync] ${active.provider} está offline ou não configurado. Utilizando dados locais.`);
    return {
      rooms: storage.get('rooms') || [],
      bookings: storage.get('bookings') || [],
      bar_orders: storage.get('bar_orders') || [],
      leisure_events: storage.get('leisure_events') || [],
      expenses: storage.get('expenses') || [],
      employees: storage.get('employees') || [],
      bar_menu: storage.get('bar_menu') || DEFAULT_MENU,
      company_config: storage.get('company_config') || null,
      developer_settings: storage.get('developer_settings') || null,
      users: storage.get('users') || [],
      payroll_records: storage.get('payroll_records') || []
    };
  }

  addSyncLog('info', 'sync_all', `Iniciando sincronização unificada com ${active.provider}...`);

  try {
    const res = await fetch('/api/db/sync-pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: active.provider,
        config: active
      })
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) {
        const remoteData = payload.data;
        const keys = ['rooms', 'bookings', 'bar_orders', 'leisure_events', 'expenses', 'employees', 'bar_menu', 'company_config', 'developer_settings', 'users', 'payroll_records'];
        
        let hasAnyRemoteData = false;
        keys.forEach(k => {
          if (remoteData[k] !== undefined && remoteData[k] !== null) {
            hasAnyRemoteData = true;
            if (k === 'developer_settings') {
              const currentCreds = getActiveDatabaseConfig();
              const merged = { ...remoteData[k], ...currentCreds };
              storage.set(k, merged);
            } else {
              storage.set(k, remoteData[k]);
            }
            updateTableSyncStatus(k, 'synced', Array.isArray(remoteData[k]) ? remoteData[k].length : 1);
          }
        });

        // Se a base remota estava vazia, efetuar push inicial com os dados padrão locais
        if (!hasAnyRemoteData || Object.keys(remoteData).length === 0) {
          console.log(`[Universal DB Sync] Base remota vazia. Populando com dados padrão...`);
          addSyncLog('info', 'sync_all', `Base remota vazia. Enviando dados locais...`);
          for (const k of keys) {
            const localVal = storage.get(k);
            if (localVal) {
              await syncCollectionToUniversalDatabase(k, localVal);
            }
          }
        }

        globalSyncState.lastSyncTime = new Date().toLocaleTimeString('pt-BR');
        addSyncLog('success', 'sync_all', `Sincronização com ${active.provider} finalizada com sucesso.`);

        return {
          rooms: storage.get('rooms') || [],
          bookings: storage.get('bookings') || [],
          bar_orders: storage.get('bar_orders') || [],
          leisure_events: storage.get('leisure_events') || [],
          expenses: storage.get('expenses') || [],
          employees: storage.get('employees') || [],
          bar_menu: storage.get('bar_menu') || DEFAULT_MENU,
          company_config: storage.get('company_config') || null,
          developer_settings: storage.get('developer_settings') || null,
          users: storage.get('users') || [],
          payroll_records: storage.get('payroll_records') || []
        };
      }
    }
  } catch (err: any) {
    console.error(`[Universal DB Sync] Erro ao sincronizar com ${active.provider}:`, err);
    addSyncLog('error', 'sync_all', `Erro na sincronização: ${err.message || String(err)}`);
  }

  return {
    rooms: storage.get('rooms') || [],
    bookings: storage.get('bookings') || [],
    bar_orders: storage.get('bar_orders') || [],
    leisure_events: storage.get('leisure_events') || [],
    expenses: storage.get('expenses') || [],
    employees: storage.get('employees') || [],
    bar_menu: storage.get('bar_menu') || DEFAULT_MENU,
    company_config: storage.get('company_config') || null,
    developer_settings: storage.get('developer_settings') || null,
    users: storage.get('users') || [],
    payroll_records: storage.get('payroll_records') || []
  };
};

export const syncDatabaseSchema = async () => {
  // Sincronização segura apenas de dados, sem auto-atualização ou alteração da estrutura/tabelas da base de dados
  return await pullAndMergeFromUniversalDatabase();
};

export const checkDynamicConnection = async (url: string, key: string) => {
  if (!url || !key) return false;
  
  // 1. Try direct client-side fetch first (fastest, standard)
  try {
    let cleanUrl = url.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isTargetHttps = cleanUrl.startsWith('https:');

    // To prevent immediate mixed-content blocks, only fetch directly if protocol matches
    if (!isHttpsPage || isTargetHttps) {
      const response = await fetch(`${cleanUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': key.trim(),
          'Authorization': `Bearer ${key.trim()}`
        }
      });

      if (response.ok) {
        return true;
      }
    }
  } catch (err) {
    console.warn('Direct client-side checkDynamicConnection failed or was blocked, falling back to secure backend proxy:', err);
  }

  // 2. Fallback: secure backend proxy
  try {
    const response = await fetch('/api/db/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'supabase',
        config: { supabaseUrl: url, supabaseAnonKey: key }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return !!data.success;
    }
    return false;
  } catch (err) {
    console.warn('Secure backend proxy checkDynamicConnection failed:', err);
    return false;
  }
};

export const checkUniversalConnection = async (customProvider?: string, customConfig?: any) => {
  const active = getActiveDatabaseConfig();
  const provider = customProvider || active.provider;
  const config = customConfig || active;

  try {
    const response = await fetch('/api/db/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, config })
    });

    if (response.ok) {
      const res = await response.json();
      return res;
    }
    return { success: false, error: 'Falha na resposta do servidor de teste.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro de rede ao testar base de dados.' };
  }
};

export const syncCollectionToUniversalDatabase = async (key: string, data: any) => {
  const active = getActiveDatabaseConfig();
  if (active.provider === 'none' || !active.provider) {
    return;
  }

  // If Supabase, run standard PostgREST sync if client available
  if (active.provider === 'supabase') {
    const client = getSupabaseClient();
    if (client) {
      await syncCollectionToSupabase(key, data);
    }
  }

  // Push to server API for Neon / Turso / Upstash / Postgres / Custom
  try {
    const response = await fetch('/api/db/sync-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: active.provider,
        config: active,
        collection: key,
        data
      })
    });
    if (response.ok) {
      const res = await response.json();
      if (res.success) {
        updateTableSyncStatus(key, 'synced', Array.isArray(data) ? data.length : 1);
      }
    }
  } catch (err: any) {
    console.warn(`[Universal DB Sync] Erro no push para ${key}:`, err);
  }
};

export const checkConnection = async () => {
  const active = getActiveDatabaseConfig();
  if (!active || active.provider === 'none' || !active.provider) {
    return false;
  }

  if (active.provider === 'turso') {
    if (!active.tursoUrl) return false;
  }

  if (active.provider === 'supabase') {
    if (active.supabaseUrl && active.supabaseAnonKey) {
      return checkDynamicConnection(active.supabaseUrl, active.supabaseAnonKey);
    }
    return false;
  }

  if ((active.provider === 'neon' || active.provider === 'vercel_postgres' || active.provider === 'postgres_custom') && !active.connectionString) {
    return false;
  }

  if ((active.provider === 'upstash' || active.provider === 'vercel_kv') && !active.upstashUrl) {
    return false;
  }

  const result = await checkUniversalConnection(active.provider, active);
  return !!result.success;
};

let cachedIsOnline: boolean | null = null;
let lastCheckTime = 0;

export const checkConnectionCached = async () => {
  const active = getActiveDatabaseConfig();
  if (!active || active.provider === 'none' || !active.provider) {
    globalSyncState.isOnline = false;
    return false;
  }

  const now = Date.now();
  if (cachedIsOnline !== null && now - lastCheckTime < 15000) {
    return cachedIsOnline;
  }
  cachedIsOnline = await checkConnection();
  lastCheckTime = Date.now();

  const prevOnline = globalSyncState.isOnline;
  globalSyncState.isOnline = cachedIsOnline;
  
  if (prevOnline !== cachedIsOnline) {
    const providerName = active.provider === 'neon' || active.provider === 'vercel_postgres'
      ? 'Neon / Vercel Postgres'
      : active.provider === 'turso'
      ? 'Turso SQLite'
      : active.provider === 'upstash' || active.provider === 'vercel_kv'
      ? 'Vercel KV / Upstash'
      : active.provider === 'supabase'
      ? 'Supabase'
      : 'Base de Dados';

    addSyncLog(
      cachedIsOnline ? 'success' : 'error',
      'connection',
      cachedIsOnline 
        ? `Conexão com ${providerName} estabelecida com sucesso.` 
        : `${providerName} está offline ou credenciais não configuradas.`
    );
  }

  return cachedIsOnline;
};




