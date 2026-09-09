import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Server, 
  Key, 
  Link, 
  Eye, 
  EyeOff, 
  Save, 
  Trash2, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Layers, 
  ArrowDownCircle, 
  ExternalLink,
  Info
} from 'lucide-react';
import { 
  DeveloperSettings, 
  DatabaseProviderType 
} from '../../types';
import { 
  getActiveDatabaseConfig, 
  saveDatabaseConfig, 
  checkUniversalConnection, 
  checkConnection, 
  initializeDatabaseSchema, 
  syncConfigFromServerEnv, 
  disconnectDatabase,
  pullAndMergeFromUniversalDatabase,
  StoredDatabaseConfig
} from '../../supabaseClient';

interface ServerlessDatabaseConfigProps {
  developerSettings: DeveloperSettings;
  onUpdateDeveloperSettings: (settings: DeveloperSettings) => void;
  onSyncComplete?: (data: any) => void;
}

export const ServerlessDatabaseConfig: React.FC<ServerlessDatabaseConfigProps> = ({
  developerSettings,
  onUpdateDeveloperSettings,
  onSyncComplete
}) => {
  // Active configuration in client storage
  const [activeConfig, setActiveConfig] = useState<StoredDatabaseConfig>(() => getActiveDatabaseConfig());
  
  // Selected provider in the form
  const [selectedProvider, setSelectedProvider] = useState<DatabaseProviderType>(() => {
    return activeConfig.provider || developerSettings.databaseProvider || 'turso';
  });

  // Form states
  const [tursoUrl, setTursoUrl] = useState(activeConfig.tursoUrl || developerSettings.tursoUrl || '');
  const [tursoAuthToken, setTursoAuthToken] = useState(activeConfig.tursoAuthToken || developerSettings.tursoAuthToken || '');
  const [neonConnectionString, setNeonConnectionString] = useState(activeConfig.connectionString || developerSettings.dbConnectionString || '');
  const [supabaseUrl, setSupabaseUrl] = useState(activeConfig.supabaseUrl || developerSettings.supabaseUrl || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(activeConfig.supabaseAnonKey || developerSettings.supabaseAnonKey || '');
  const [upstashUrl, setUpstashUrl] = useState(activeConfig.upstashUrl || developerSettings.upstashUrl || '');
  const [upstashToken, setUpstashToken] = useState(activeConfig.upstashToken || developerSettings.upstashToken || '');

  // Password visibility toggles
  const [showTursoToken, setShowTursoToken] = useState(false);
  const [showNeonString, setShowNeonString] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [showUpstashToken, setShowUpstashToken] = useState(false);

  // Testing and action states
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Status feedback
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    timestamp?: string;
    details?: any;
    error?: string;
  } | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Live connection status of currently active config
  const [liveStatus, setLiveStatus] = useState<'checking' | 'online' | 'offline' | 'local'>('checking');
  const [liveLatency, setLiveLatency] = useState<number | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // Check live status on mount or when activeConfig changes
  useEffect(() => {
    let isMounted = true;
    const evaluateStatus = async () => {
      if (activeConfig.provider === 'none' || !activeConfig.provider) {
        if (isMounted) {
          setLiveStatus('local');
          setLiveLatency(null);
        }
        return;
      }
      setLiveStatus('checking');
      const start = performance.now();
      const online = await checkConnection();
      const latency = Math.round(performance.now() - start);
      if (isMounted) {
        setLiveStatus(online ? 'online' : 'offline');
        setLiveLatency(online ? latency : null);
      }
    };
    evaluateStatus();
    return () => {
      isMounted = false;
    };
  }, [activeConfig]);

  // Construct current form configuration object
  const getCurrentFormConfig = (): StoredDatabaseConfig => {
    const config: StoredDatabaseConfig = {
      provider: selectedProvider,
      tursoUrl: tursoUrl.trim(),
      tursoAuthToken: tursoAuthToken.trim(),
      connectionString: neonConnectionString.trim(),
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      upstashUrl: upstashUrl.trim(),
      upstashToken: upstashToken.trim(),
    };
    return config;
  };

  // Test connection button handler
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const formConfig = getCurrentFormConfig();

    if (selectedProvider === 'none') {
      setIsTesting(false);
      setTestResult({
        success: true,
        message: 'Modo Local Ativo: O sistema armazena todos os registos offline no navegador com alta velocidade e segurança.',
        latencyMs: 1,
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    try {
      const result = await checkUniversalConnection(selectedProvider, formConfig);
      const timestamp = new Date().toLocaleTimeString();

      if (result.success) {
        setTestResult({
          success: true,
          message: result.message || `Conexão estabelecida com sucesso ao provedor ${getProviderLabel(selectedProvider)}!`,
          latencyMs: result.latencyMs,
          details: result.details,
          timestamp
        });
        showToast('success', `Conexão OK (${result.latencyMs ? result.latencyMs + 'ms' : 'Ativa'}) com ${getProviderLabel(selectedProvider)}`);
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Falha ao conectar com o banco de dados remoto.',
          timestamp,
          error: result.error
        });
        showToast('error', `Erro na conexão: ${result.error || 'Verifique as credenciais.'}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Falha na requisição de checagem.',
        timestamp: new Date().toLocaleTimeString(),
        error: err?.message
      });
      showToast('error', 'Falha ao executar checagem de conexão.');
    } finally {
      setIsTesting(false);
    }
  };

  // Save and activate connection
  const handleSaveAndActivate = async () => {
    setIsSaving(true);
    try {
      const formConfig = getCurrentFormConfig();

      // 1. Save to localStorage and notify supabaseClient
      saveDatabaseConfig(formConfig);
      setActiveConfig(formConfig);

      // 2. Update parent developerSettings state
      const updatedDevSettings: DeveloperSettings = {
        ...developerSettings,
        databaseProvider: selectedProvider,
        tursoUrl: formConfig.tursoUrl,
        tursoAuthToken: formConfig.tursoAuthToken,
        dbConnectionString: formConfig.connectionString,
        supabaseUrl: formConfig.supabaseUrl,
        supabaseAnonKey: formConfig.supabaseAnonKey,
        upstashUrl: formConfig.upstashUrl,
        upstashToken: formConfig.upstashToken,
      };
      onUpdateDeveloperSettings(updatedDevSettings);

      // 3. Dispatch global sync state change
      window.dispatchEvent(new Event('supabase-sync-state-change'));

      showToast('success', `Configuração salva! Provedor ativo: ${getProviderLabel(selectedProvider)}`);

      // 4. Automatically run a quick live check
      if (selectedProvider !== 'none') {
        const start = performance.now();
        const online = await checkConnection();
        const latency = Math.round(performance.now() - start);
        setLiveStatus(online ? 'online' : 'offline');
        setLiveLatency(online ? latency : null);
      } else {
        setLiveStatus('local');
        setLiveLatency(null);
      }
    } catch (err: any) {
      showToast('error', 'Erro ao salvar configuração: ' + (err?.message || 'Desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-detect environment variables on server
  const handleDetectServerEnv = async () => {
    setIsDetecting(true);
    try {
      const detected = await syncConfigFromServerEnv();
      if (detected && detected.provider && detected.provider !== 'none') {
        setSelectedProvider(detected.provider);
        if (detected.tursoUrl) setTursoUrl(detected.tursoUrl);
        if (detected.tursoAuthToken) setTursoAuthToken(detected.tursoAuthToken);
        if (detected.connectionString) setNeonConnectionString(detected.connectionString);
        if (detected.supabaseUrl) setSupabaseUrl(detected.supabaseUrl);
        if (detected.supabaseAnonKey) setSupabaseAnonKey(detected.supabaseAnonKey);
        if (detected.upstashUrl) setUpstashUrl(detected.upstashUrl);
        if (detected.upstashToken) setUpstashToken(detected.upstashToken);

        setActiveConfig(detected);
        showToast('success', `Configuração detectada do servidor (.env): ${getProviderLabel(detected.provider)}`);
      } else {
        showToast('info', 'Nenhuma variável de ambiente de banco de dados encontrada no servidor.');
      }
    } catch (err: any) {
      showToast('error', 'Falha ao buscar variáveis do servidor.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Initialize schema / tables on remote database
  const handleInitializeSchema = async () => {
    if (selectedProvider === 'none') {
      showToast('info', 'Em modo local, as tabelas residem no armazenamento do navegador.');
      return;
    }

    setIsInitializing(true);
    try {
      const formConfig = getCurrentFormConfig();
      const res = await initializeDatabaseSchema(formConfig);
      if (res.success) {
        showToast('success', res.message || 'Tabelas criadas com sucesso na base de dados!');
        setTestResult({
          success: true,
          message: res.message || 'Tabelas criadas/verificadas com sucesso no banco de dados remoto.',
          timestamp: new Date().toLocaleTimeString()
        });
      } else {
        showToast('error', res.error || 'Falha ao inicializar tabelas.');
        setTestResult({
          success: false,
          message: res.error || 'Erro ao inicializar tabelas.',
          timestamp: new Date().toLocaleTimeString(),
          error: res.error
        });
      }
    } catch (err: any) {
      showToast('error', 'Erro na criação de tabelas: ' + (err?.message || 'Falha'));
    } finally {
      setIsInitializing(false);
    }
  };

  // Sincronizar dados agora (Pull & Merge)
  const handlePullAndSync = async () => {
    if (selectedProvider === 'none') {
      showToast('info', 'Modo local: os dados já estão sincronizados no seu dispositivo.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await pullAndMergeFromUniversalDatabase();
      if (result && onSyncComplete) {
        onSyncComplete(result);
      }
      showToast('success', 'Sincronização bidirecional concluída com sucesso!');
    } catch (err: any) {
      showToast('error', 'Falha ao sincronizar dados: ' + (err?.message || 'Verifique a conexão'));
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect & reset to local mode
  const handleDisconnect = async () => {
    try {
      await disconnectDatabase();
      setSelectedProvider('none');
      setTursoUrl('');
      setTursoAuthToken('');
      setNeonConnectionString('');
      setSupabaseUrl('');
      setSupabaseAnonKey('');
      setUpstashUrl('');
      setUpstashToken('');

      const localConfig: StoredDatabaseConfig = { provider: 'none' };
      setActiveConfig(localConfig);

      const updatedDevSettings: DeveloperSettings = {
        ...developerSettings,
        databaseProvider: 'none',
        tursoUrl: '',
        tursoAuthToken: '',
        dbConnectionString: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
        upstashUrl: '',
        upstashToken: '',
      };
      onUpdateDeveloperSettings(updatedDevSettings);
      window.dispatchEvent(new Event('supabase-sync-state-change'));

      setLiveStatus('local');
      setLiveLatency(null);
      setTestResult(null);

      showToast('info', 'Base de dados remota desconectada. Sistema agora em Modo Local.');
    } catch (err: any) {
      showToast('error', 'Erro ao desconectar: ' + (err?.message || 'Falha'));
    }
  };

  const getProviderLabel = (p: DatabaseProviderType) => {
    switch (p) {
      case 'turso':
        return 'Turso (LibSQL SQLite)';
      case 'neon':
      case 'vercel_postgres':
        return 'Neon / Vercel Postgres';
      case 'supabase':
        return 'Supabase (PostgreSQL)';
      case 'upstash':
      case 'vercel_kv':
        return 'Upstash (Redis / KV)';
      case 'none':
      default:
        return 'Modo Local (Offline-First)';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header with live status */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Database size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Conexão a Base de Dados Serverless & Nuvem
              </h3>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Painel Desenvolvedor
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Configure a base de dados remota serverless para sincronização em tempo real de quartos, reservas, faturas e stocks, ou mantenha a operação em modo local offline-first.
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 shrink-0">
          <div className="relative flex h-3 w-3">
            {liveStatus === 'online' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : liveStatus === 'offline' ? (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            ) : liveStatus === 'local' ? (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 animate-pulse"></span>
            )}
          </div>
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Estado da Ligação</p>
            <p className="text-xs font-bold text-white flex items-center gap-1.5">
              {liveStatus === 'online' && (
                <>
                  <span className="text-emerald-400 font-semibold">Conectado</span>
                  {liveLatency !== null && <span className="text-[10px] font-mono text-slate-300">({liveLatency}ms)</span>}
                </>
              )}
              {liveStatus === 'offline' && <span className="text-rose-400 font-semibold">Offline / Desconectado</span>}
              {liveStatus === 'local' && <span className="text-slate-300 font-semibold">Modo Local Seguro</span>}
              {liveStatus === 'checking' && <span className="text-amber-300 font-semibold">A Verificar...</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Notifications banner */}
      {notification && (
        <div className={`px-6 py-3 border-b flex items-center justify-between text-xs font-medium transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : notification.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertCircle size={16} className="text-rose-600 shrink-0" />}
            {notification.type === 'info' && <Info size={16} className="text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Provider Selector Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            1. Selecione o Provedor de Base de Dados Serverless
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Turso */}
            <button
              type="button"
              id="provider-select-turso"
              onClick={() => setSelectedProvider('turso')}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'turso'
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Turso</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">LibSQL</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">SQLite Serverless em Edge. Latência ultrabaixa.</p>
              {selectedProvider === 'turso' && (
                <div className="mt-2 text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Selecionado
                </div>
              )}
            </button>

            {/* Neon / Vercel Postgres */}
            <button
              type="button"
              id="provider-select-neon"
              onClick={() => setSelectedProvider('neon')}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'neon' || selectedProvider === 'vercel_postgres'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Neon</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Postgres</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">PostgreSQL Serverless com connection pooling.</p>
              {(selectedProvider === 'neon' || selectedProvider === 'vercel_postgres') && (
                <div className="mt-2 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Selecionado
                </div>
              )}
            </button>

            {/* Supabase */}
            <button
              type="button"
              id="provider-select-supabase"
              onClick={() => setSelectedProvider('supabase')}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'supabase'
                  ? 'border-teal-600 bg-teal-50/50 shadow-sm ring-2 ring-teal-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Supabase</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">Cloud DB</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">PostgreSQL com PostgREST e APIs em tempo real.</p>
              {selectedProvider === 'supabase' && (
                <div className="mt-2 text-[10px] font-bold text-teal-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Selecionado
                </div>
              )}
            </button>

            {/* Upstash Redis */}
            <button
              type="button"
              id="provider-select-upstash"
              onClick={() => setSelectedProvider('upstash')}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'upstash' || selectedProvider === 'vercel_kv'
                  ? 'border-rose-600 bg-rose-50/50 shadow-sm ring-2 ring-rose-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Upstash KV</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Redis</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">Chave-valor serverless HTTP REST para dados velozes.</p>
              {(selectedProvider === 'upstash' || selectedProvider === 'vercel_kv') && (
                <div className="mt-2 text-[10px] font-bold text-rose-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Selecionado
                </div>
              )}
            </button>

            {/* Modo Local */}
            <button
              type="button"
              id="provider-select-local"
              onClick={() => setSelectedProvider('none')}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'none'
                  ? 'border-slate-700 bg-slate-100 shadow-sm ring-2 ring-slate-400/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Modo Local</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Offline</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">100% offline-first no navegador. Sem nuvem externa.</p>
              {selectedProvider === 'none' && (
                <div className="mt-2 text-[10px] font-bold text-slate-700 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Selecionado
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Provider Form Fields */}
        <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Server size={14} className="text-indigo-600" />
              2. Parâmetros de Conexão: {getProviderLabel(selectedProvider)}
            </h4>
            {selectedProvider !== 'none' && (
              <button
                type="button"
                id="btn-detect-env"
                onClick={handleDetectServerEnv}
                disabled={isDetecting}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Procura variáveis de ambiente como DATABASE_URL, TURSO_URL ou SUPABASE_URL já declaradas no servidor"
              >
                <Zap size={13} className={isDetecting ? 'animate-spin' : ''} />
                {isDetecting ? 'Detectando...' : 'Auto-detectar do Servidor (.env)'}
              </button>
            )}
          </div>

          {/* Turso Configuration */}
          {selectedProvider === 'turso' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>URL da Base de Dados Turso (LibSQL):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ex: libsql://meu-hotel-db.turso.io</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Link size={14} />
                  </div>
                  <input
                    type="text"
                    id="turso-url-input"
                    value={tursoUrl}
                    onChange={(e) => setTursoUrl(e.target.value)}
                    placeholder="libsql://hotel-perola-db.turso.io ou https://..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Token de Autenticação Turso (Auth Token / JWT):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Gerado com `turso db tokens create`</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key size={14} />
                  </div>
                  <input
                    type={showTursoToken ? 'text' : 'password'}
                    id="turso-token-input"
                    value={tursoAuthToken}
                    onChange={(e) => setTursoAuthToken(e.target.value)}
                    placeholder="eyJhbGciOiJFZERTQSI..."
                    className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTursoToken(!showTursoToken)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showTursoToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-2">
                <Info size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  O <strong>Turso</strong> opera em arquitetura serverless SQLite distribuída na borda (edge). Se a sua base de dados for nova, clique em <strong>Inicializar Tabelas / Esquema</strong> abaixo para criar automaticamente as tabelas de quartos, reservas, bar, funcionários e despesas.
                </p>
              </div>
            </div>
          )}

          {/* Neon / PostgreSQL Configuration */}
          {(selectedProvider === 'neon' || selectedProvider === 'vercel_postgres') && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>String de Conexão PostgreSQL (Neon / Vercel Postgres):</span>
                  <span className="text-[10px] text-slate-400 font-normal">postgresql://user:pass@ep-xyz.neon.tech/neondb</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Link size={14} />
                  </div>
                  <input
                    type={showNeonString ? 'text' : 'password'}
                    id="neon-connection-string-input"
                    value={neonConnectionString}
                    onChange={(e) => setNeonConnectionString(e.target.value)}
                    placeholder="postgresql://user:password@ep-cool-cloud.eu-west-1.neon.tech/neondb?sslmode=require"
                    className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNeonString(!showNeonString)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNeonString ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 text-[11px] text-emerald-900 flex items-start gap-2">
                <Info size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  O <strong>Neon PostgreSQL</strong> é 100% serverless, ideal para deploy na Vercel e Cloud Run com poolers HTTP nativos. Você pode colar tanto a URL direta quanto a instrução do painel Neon.
                </p>
              </div>
            </div>
          )}

          {/* Supabase Configuration */}
          {selectedProvider === 'supabase' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>URL do Projeto Supabase:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ex: https://xyzcompany.supabase.co</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Link size={14} />
                  </div>
                  <input
                    type="text"
                    id="supabase-url-input"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzproject.supabase.co"
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Chave Anónima / Public Anon Key (apikey):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Obtido em Project Settings &gt; API</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key size={14} />
                  </div>
                  <input
                    type={showSupabaseKey ? 'text' : 'password'}
                    id="supabase-key-input"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showSupabaseKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upstash Configuration */}
          {(selectedProvider === 'upstash' || selectedProvider === 'vercel_kv') && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>URL REST do Upstash Redis / Vercel KV:</span>
                  <span className="text-[10px] text-slate-400 font-normal">https://...upstash.io</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Link size={14} />
                  </div>
                  <input
                    type="text"
                    id="upstash-url-input"
                    value={upstashUrl}
                    onChange={(e) => setUpstashUrl(e.target.value)}
                    placeholder="https://glorious-fox-123.upstash.io"
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Token REST do Upstash:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Obtido no console Upstash</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key size={14} />
                  </div>
                  <input
                    type={showUpstashToken ? 'text' : 'password'}
                    id="upstash-token-input"
                    value={upstashToken}
                    onChange={(e) => setUpstashToken(e.target.value)}
                    placeholder="AXr4ASQgNm..."
                    className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUpstashToken(!showUpstashToken)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showUpstashToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modo Local Details */}
          {selectedProvider === 'none' && (
            <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Modo Local Offline-First Ativado</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Neste modo, o sistema opera de forma totalmente independente da internet. Todos os dados (reservas, faturas com hash SAFT, quartos, funcionários e consumos do bar) são gravados e persistidos localmente com segurança criptográfica no navegador.
              </p>
              <p className="text-[11px] text-slate-400">
                Para conectar a um banco em nuvem posteriormente, selecione Turso, Neon ou Supabase acima e preencha as credenciais.
              </p>
            </div>
          )}
        </div>

        {/* Live Test Diagnostic Card */}
        {testResult && (
          <div className={`p-4 rounded-xl border transition-all ${
            testResult.success 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50/80 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                {testResult.success ? (
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">
                      {testResult.success ? 'Conexão Bem-Sucedida!' : 'Falha na Checagem de Conexão'}
                    </span>
                    {testResult.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/70 font-semibold border border-emerald-300">
                        Latência: {testResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">{testResult.message}</p>
                  {testResult.error && (
                    <p className="text-[11px] font-mono mt-1 text-rose-700 bg-rose-100/50 p-2 rounded">
                      {testResult.error}
                    </p>
                  )}
                  {testResult.details && (
                    <div className="mt-2 text-[10px] text-slate-600 bg-white/60 p-2 rounded font-mono">
                      {typeof testResult.details === 'object' ? JSON.stringify(testResult.details) : String(testResult.details)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                {testResult.timestamp}
              </span>
            </div>
          </div>
        )}

        {/* Action & Check Buttons Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Left Group: Check Connection & Diagnostic tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Primary Test Connection Button */}
            <button
              type="button"
              id="btn-test-db-connection"
              onClick={handleTestConnection}
              disabled={isTesting}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isTesting
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <RefreshCw size={14} className={isTesting ? 'animate-spin text-indigo-400' : ''} />
              <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão Agora'}</span>
            </button>

            {/* Initialize Schema Button */}
            {(selectedProvider === 'turso' || selectedProvider === 'neon' || selectedProvider === 'vercel_postgres') && (
              <button
                type="button"
                id="btn-init-db-schema"
                onClick={handleInitializeSchema}
                disabled={isInitializing}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 transition-all ${
                  isInitializing
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
                title="Cria ou valida as tabelas necessárias na base de dados remota"
              >
                <Layers size={14} className={isInitializing ? 'animate-spin text-slate-400' : 'text-slate-500'} />
                <span>{isInitializing ? 'Criando Tabelas...' : 'Inicializar Tabelas / Esquema'}</span>
              </button>
            )}

            {/* Pull & Sync Button */}
            {selectedProvider !== 'none' && (
              <button
                type="button"
                id="btn-pull-db-sync"
                onClick={handlePullAndSync}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 transition-all ${
                  isSyncing
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
                title="Descarrega os registos da nuvem e mescla com a base local"
              >
                <ArrowDownCircle size={14} className={isSyncing ? 'animate-bounce text-indigo-600' : 'text-indigo-600'} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Dados'}</span>
              </button>
            )}
          </div>

          {/* Right Group: Save and Disconnect */}
          <div className="flex items-center gap-2.5 ml-auto">
            {activeConfig.provider !== 'none' && (
              <button
                type="button"
                id="btn-disconnect-db"
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
                title="Remove a conexão remota e opera somente offline"
              >
                <Trash2 size={14} />
                <span>Desconectar</span>
              </button>
            )}

            <button
              type="button"
              id="btn-save-db-config"
              onClick={handleSaveAndActivate}
              disabled={isSaving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                isSaving
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 hover:shadow-indigo-200'
              }`}
            >
              <Save size={14} />
              <span>{isSaving ? 'Salvando...' : 'Guardar e Ativar Conexão'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
