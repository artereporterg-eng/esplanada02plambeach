import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Server, 
  FileText, 
  ChevronDown, 
  Terminal,
  Activity
} from 'lucide-react';
import { globalSyncState, syncDatabaseSchema, SyncLog, TableSyncStatus, getActiveDatabaseConfig } from '../supabaseClient';

interface SupabaseSyncIndicatorProps {
  onSyncComplete?: (data: any) => void;
}

export const SupabaseSyncIndicator: React.FC<SupabaseSyncIndicatorProps> = ({ onSyncComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncState, setSyncState] = useState(() => ({ ...globalSyncState }));
  const [activeConfig, setActiveConfig] = useState(() => getActiveDatabaseConfig());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSyncChange = () => {
      setSyncState({ ...globalSyncState });
      setActiveConfig(getActiveDatabaseConfig());
    };
    window.addEventListener('supabase-sync-state-change', handleSyncChange);

    // Initial check
    setSyncState({ ...globalSyncState });
    setActiveConfig(getActiveDatabaseConfig());

    return () => {
      window.removeEventListener('supabase-sync-state-change', handleSyncChange);
    };
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncDatabaseSchema();
      if (result && onSyncComplete) {
        onSyncComplete(result);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const getProviderName = () => {
    switch (activeConfig.provider) {
      case 'none':
        return 'Modo Local';
      case 'neon':
      case 'vercel_postgres':
        return 'Neon (Postgres)';
      case 'turso':
        return 'Turso (SQLite)';
      case 'upstash':
      case 'vercel_kv':
        return 'Upstash KV';
      case 'supabase':
        return 'Supabase';
      case 'postgres_custom':
        return 'PostgreSQL';
      case 'custom_rest':
        return 'API REST';
      default:
        return 'Modo Local';
    }
  };

  const getStatusBadge = (status: TableSyncStatus['status']) => {
    switch (status) {
      case 'synced':
        return (
          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-100">
            <CheckCircle2 size={10} className="text-emerald-500" /> Sincronizado
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-rose-100">
            <AlertCircle size={10} className="text-rose-500" /> Falhou
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-100 animate-pulse">
            <Clock size={10} className="text-amber-500" /> Pendente
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-slate-100">
            <WifiOff size={10} className="text-slate-400" /> Offline
          </span>
        );
    }
  };

  const formatTableName = (name: string) => {
    const names: Record<string, string> = {
      company_config: 'Empresa',
      billing_series: 'Séries de Faturação',
      rooms: 'Quartos',
      menu_items: 'Menu / Inventário',
      employees: 'Funcionários',
      expenses: 'Despesas',
      bookings: 'Reservas',
      bar_orders: 'Pedidos de Bar',
      events: 'Eventos de Lazer',
      developer_settings: 'Definições Dev',
      users_custom: 'Utilizadores',
      payroll_records: 'Folha de Pagamento',
    };
    return names[name] || name;
  };

  const tablesArray = Object.values(syncState.tables);
  const isNoneProvider = activeConfig.provider === 'none' || !activeConfig.provider;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Visual Indicator Button at Top */}
      <button
        id="supabase-status-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm border ${
          isNoneProvider
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            : syncState.isOnline 
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-700 border-emerald-200' 
            : 'bg-gradient-to-r from-rose-50 to-orange-50 hover:from-rose-100 hover:to-orange-100 text-rose-700 border-rose-200'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isNoneProvider ? (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
          ) : syncState.isOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {isNoneProvider ? (
            <Database size={13} className="text-slate-500" />
          ) : syncState.isOnline ? (
            <Wifi size={13} className="text-emerald-600" />
          ) : (
            <WifiOff size={13} className="text-rose-600" />
          )}
          <span>{isNoneProvider ? 'Modo Local (Manual)' : `${getProviderName()}: ${syncState.isOnline ? 'Sincronizado' : 'Offline'}`}</span>
        </div>
        <ChevronDown size={14} className={`opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div 
          id="supabase-status-dropdown"
          className="absolute right-0 mt-3 w-[450px] max-w-[calc(100vw-20px)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 text-slate-700 origin-top-right transition-all animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-150 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="text-blue-600" size={18} />
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Estado do Armazenamento ({getProviderName()})</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {isNoneProvider ? 'Operando em armazenamento local no navegador' : 'Sincronização bidirecional em tempo real (Vercel Ready)'}
                </p>
              </div>
            </div>
            
            {!isNoneProvider && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSyncing 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                }`}
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            )}
          </div>

          {isNoneProvider && (
            <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/60 text-xs text-amber-900 flex items-start gap-2.5">
              <Database size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Nenhuma Base de Dados Conectada:</span>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Todas as reservas, quartos e faturas estão seguras localmente. Para conectar uma base de dados externa manualmente (Turso, Supabase, Neon PostgreSQL, Upstash KV), vá ao menu <strong>Definições / Administrador</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Connection Details */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <Server size={12} className="text-slate-400" />
              <span>Driver / Provedor</span>
            </div>
            <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              {isNoneProvider ? 'Local Offline-First (Sem BD Remota)' : syncState.isOnline ? `${getProviderName()} Serverless Active` : 'Local Storage Fallback'}
            </span>
          </div>

          {/* Tabs / Scrollable Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {/* Table Grid Status */}
            <div className="p-4">
              <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-1.5">
                <Activity size={12} className="text-slate-400" />
                Estado das Tabelas ({tablesArray.length})
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {tablesArray.map((table) => (
                  <div 
                    key={table.tableName}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        table.status === 'synced' ? 'bg-emerald-500' :
                        table.status === 'failed' ? 'bg-rose-500' :
                        table.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                      }`} />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{formatTableName(table.tableName)}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {table.recordCount !== undefined ? `${table.recordCount} registos` : 'Sem dados'} 
                          {table.lastSynced && ` • Sinc: ${table.lastSynced}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {table.errorMessage && (
                        <div className="group relative">
                          <AlertCircle size={14} className="text-rose-400 cursor-help" />
                          <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg z-50">
                            {table.errorMessage}
                          </div>
                        </div>
                      )}
                      {getStatusBadge(table.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Logs */}
            <div className="p-4 bg-slate-50/50">
              <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-1.5">
                <Terminal size={12} className="text-slate-400" />
                Log de Sincronização ({syncState.logs.length})
              </h4>
              {syncState.logs.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <FileText size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Nenhum registo no log de sincronização.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {syncState.logs.map((log) => (
                    <div 
                      key={log.id} 
                      className="text-[11px] p-2 bg-white rounded-lg border border-slate-100 flex items-start gap-2 shadow-sm"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                        log.type === 'success' ? 'bg-emerald-500' :
                        log.type === 'error' ? 'bg-rose-500' :
                        log.type === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-600 break-words font-medium">{log.message}</p>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium mt-1">
                          <span className="capitalize px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{formatTableName(log.table)}</span>
                          <span>{log.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          {syncState.lastSyncTime && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-medium">
              Última sincronização geral realizada às {syncState.lastSyncTime}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
