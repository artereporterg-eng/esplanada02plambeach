import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Hotel,
  LayoutDashboard,
  Wine,
  Palmtree,
  Users,
  Settings,
  LogOut,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Bed,
  Calendar,
  DollarSign,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Save,
  User,
  IdCard,
  Lock,
  FileText,
  FileCheck,
  Download,
  FileDown,
  Printer,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  BarChart3,
  BedDouble,
  GlassWater,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Key,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  LogIn,
  FolderOpen,
  UploadCloud,
  FileSpreadsheet,
  Layers,
  ShoppingBag,
  CreditCard,
  Receipt,
  UserCheck,
  AlertTriangle,
  Info,
  CalendarDays,
  Percent,
  History,
  FilePlus,
  Compass,
  Coffee,
  PieChart as PieChartIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
  addMonths,
  isAfter,
  differenceInDays,
  addDays,
  areIntervalsOverlapping
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AppTab,
  Room,
  Booking,
  Customer,
  BarOrder,
  Event,
  Employee,
  Expense,
  User as UserType,
  CompanyConfig,
  DeveloperSettings,
  TaxConfig,
  MenuItem,
  BillingSeries
} from "../../types";
import {
  storage
} from "../../supabaseClient";
import { CryptoService } from "../../services/cryptoService";
import { SafTService } from "../../services/saftService";
import { SignatureBadge } from "../common/SignatureBadge";
import { TAX_IVA_14, TAX_IVA_EXEMPT, TAX_IS_1, MOCK_ROOMS, MOCK_USERS, MOCK_COMPANY, DEFAULT_MENU } from "../../constants/initialData";

export function AdminView({ companyConfig, onUpdateCompany, developerSettings, onUpdateDeveloperSettings }: { 
  companyConfig: CompanyConfig, 
  onUpdateCompany: (config: CompanyConfig) => void,
  developerSettings: DeveloperSettings,
  onUpdateDeveloperSettings: (settings: DeveloperSettings) => void
}) {
  const [adminTab, setAdminTab] = useState<'general' | 'developer'>('general');
  const [users, setUsers] = useState<UserType[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'receptionist' | 'manager' | 'rooms_user' | 'bar_user' | 'events_user' | 'hr_user'>('rooms_user');
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<UserType | null>(null);

  // Developer Login State
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false);
  const [devLoginUsername, setDevLoginUsername] = useState('');
  const [devLoginPassword, setDevLoginPassword] = useState('');
  const [devLoginError, setDevLoginError] = useState(false);

  // Developer Password Change State
  const [newDevPassword, setNewDevPassword] = useState('');
  const [confirmDevPassword, setConfirmDevPassword] = useState('');
  const [devPassMessage, setDevPassMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Developer Settings Local State
  const [devPaymentStatus, setDevPaymentStatus] = useState(developerSettings.paymentStatus);
  const [devLicenseType, setDevLicenseType] = useState(developerSettings.licenseType);
  const [devExpiryDate, setDevExpiryDate] = useState(developerSettings.expiryDate);
  const [devBlockSystem, setDevBlockSystem] = useState(developerSettings.limitations.blockSystem);
  const [devDisableReports, setDevDisableReports] = useState(developerSettings.limitations.disableReports);
  const [devDisableRooms, setDevDisableRooms] = useState(developerSettings.limitations.disableRooms);
  const [devDisableBar, setDevDisableBar] = useState(developerSettings.limitations.disableBar);
  const [devDisableLeisure, setDevDisableLeisure] = useState(developerSettings.limitations.disableLeisure);
  const [devReadOnlyRooms, setDevReadOnlyRooms] = useState(developerSettings.limitations.readOnlyRooms || false);
  const [devReadOnlyBar, setDevReadOnlyBar] = useState(developerSettings.limitations.readOnlyBar || false);
  const [devReadOnlyLeisure, setDevReadOnlyLeisure] = useState(developerSettings.limitations.readOnlyLeisure || false);
  const [devBank, setDevBank] = useState(developerSettings.paymentMethods.bankTransfer);
  const [devIban, setDevIban] = useState(developerSettings.paymentMethods.iban);
  const [devExpress, setDevExpress] = useState(developerSettings.paymentMethods.multicaixaExpress);
  
  // Company Config local state
  const [compName, setCompName] = useState(companyConfig.name);
  const [compNif, setCompNif] = useState(companyConfig.nif);
  const [compPhone, setCompPhone] = useState(companyConfig.phone);
  const [compEmail, setCompEmail] = useState(companyConfig.email);
  const [compAddress, setCompAddress] = useState(companyConfig.address);
  const [compCurrency, setCompCurrency] = useState(companyConfig.currency);
  const [compLogo, setCompLogo] = useState(companyConfig.logo || "");
  const [compBillingSeries, setCompBillingSeries] = useState<BillingSeries[]>(companyConfig.billingSeries || []);
  const [compWithholdingRate, setCompWithholdingRate] = useState(companyConfig.defaultWithholdingRate || 6.5);

  useEffect(() => {
    setUsers(storage.get("users") || []);
  }, []);

  const handleDevLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (devLoginUsername === (developerSettings.devUsername || "fox") && 
        devLoginPassword === (developerSettings.devPassword || "Arvex1")) {
      setIsDevAuthenticated(true);
      setDevLoginError(false);
    } else {
      setDevLoginError(true);
    }
  };

  const handleUpdateDevPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDevPassword !== confirmDevPassword) {
      setDevPassMessage({ type: "error", text: "As senhas não coincidem" });
      return;
    }
    if (newDevPassword.length < 4) {
      setDevPassMessage({ type: "error", text: "A senha deve ter pelo menos 4 caracteres" });
      return;
    }
    const newSettings: DeveloperSettings = {
      ...developerSettings,
      devPassword: newDevPassword
    };
    onUpdateDeveloperSettings(newSettings);
    setDevPassMessage({ type: "success", text: "Senha alterada com sucesso!" });
    setNewDevPassword("");
    setConfirmDevPassword("");
    setTimeout(() => setDevPassMessage(null), 3000);
  };

  const handleUpdateDeveloper = (e: React.FormEvent) => {
    e.preventDefault();
    const newSettings: DeveloperSettings = {
      ...developerSettings,
      paymentStatus: devPaymentStatus,
      licenseType: devLicenseType,
      expiryDate: devExpiryDate,
      limitations: {
        blockSystem: devBlockSystem,
        disableReports: devDisableReports,
        disableRooms: devDisableRooms,
        disableBar: devDisableBar,
        disableLeisure: devDisableLeisure,
        readOnlyRooms: devReadOnlyRooms,
        readOnlyBar: devReadOnlyBar,
        readOnlyLeisure: devReadOnlyLeisure
      },
      paymentMethods: {
        bankTransfer: devBank,
        iban: devIban,
        multicaixaExpress: devExpress
      },
      databaseProvider: developerSettings.databaseProvider || "none"
    };
    onUpdateDeveloperSettings(newSettings);
    alert("Configurações do Desenvolvedor atualizadas com sucesso!");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig: CompanyConfig = {
      name: compName,
      nif: compNif,
      phone: compPhone,
      email: compEmail,
      address: compAddress,
      currency: compCurrency,
      logo: compLogo,
      billingSeries: compBillingSeries,
      defaultWithholdingRate: compWithholdingRate
    };
    onUpdateCompany(newConfig);
    storage.set('company_config', newConfig);
  };

  const handleAddUser = () => {
    if (!newUsername || !newPassword || !newName) return;
    const newUser: UserType = {
      id: Math.random().toString(36).substr(2, 9),
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
      permissions: {
        tabs: getDefaultTabsForRole(newRole),
        actions: []
      }
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    storage.set('users', updatedUsers);
    setNewUsername('');
    setNewPassword('');
    setNewName('');
  };

  const getDefaultTabsForRole = (role: string): AppTab[] => {
    switch (role) {
      case 'admin': return ['dashboard', 'reception', 'bar', 'leisure', 'secretaria', 'hr', 'admin', 'reports', 'finances'];
      case 'manager': return ['dashboard', 'reception', 'bar', 'leisure', 'hr', 'reports'];
      case 'receptionist':
      case 'rooms_user': return ['dashboard', 'reception'];
      case 'bar_user': return ['bar'];
      case 'events_user': return ['leisure'];
      case 'hr_user': return ['hr'];
      default: return ['dashboard'];
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === '1') return; // Don't delete main admin
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    storage.set('users', updatedUsers);
  };

  const handleToggleTabPermission = (userId: string, tab: AppTab) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        const currentTabs = u.permissions?.tabs || [];
        const newTabs = currentTabs.includes(tab) 
          ? currentTabs.filter(t => t !== tab)
          : [...currentTabs, tab];
        return { ...u, permissions: { ...u.permissions, tabs: newTabs, actions: u.permissions?.actions || [] } };
      }
      return u;
    });
    setUsers(updatedUsers);
    storage.set('users', updatedUsers);
    if (editingPermissionsUser?.id === userId) {
      setEditingPermissionsUser(updatedUsers.find(u => u.id === userId) || null);
    }
  };

  const handleToggleActionPermission = (userId: string, action: string) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        const currentActions = u.permissions?.actions || [];
        const newActions = currentActions.includes(action) 
          ? currentActions.filter(a => a !== action)
          : [...currentActions, action];
        return { ...u, permissions: { ...u.permissions, tabs: u.permissions?.tabs || [], actions: newActions } };
      }
      return u;
    });
    setUsers(updatedUsers);
    storage.set('users', updatedUsers);
    if (editingPermissionsUser?.id === userId) {
      setEditingPermissionsUser(updatedUsers.find(u => u.id === userId) || null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-2 h-8 bg-violet-500 rounded-full"></div>
          Administração
        </h3>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setAdminTab('general')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'general' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Geral
          </button>
          <button 
            onClick={() => setAdminTab('developer')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'developer' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Desenvolvedor
          </button>
        </div>
      </div>

      {adminTab === 'general' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Settings size={20} className="text-indigo-600" />
                Dados da Empresa
              </h3>
              <form onSubmit={handleUpdateCompany} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome da Empresa</label>
                    <input 
                      type="text" 
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">NIF</label>
                    <input 
                      type="text" 
                      value={compNif}
                      onChange={(e) => setCompNif(e.target.value)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telefone</label>
                    <input 
                      type="text" 
                      value={compPhone}
                      onChange={(e) => setCompPhone(e.target.value)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">E-mail</label>
                    <input 
                      type="email" 
                      value={compEmail}
                      onChange={(e) => setCompEmail(e.target.value)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Endereço</label>
                  <input 
                    type="text" 
                    value={compAddress}
                    onChange={(e) => setCompAddress(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Moeda (Símbolo)</label>
                  <input 
                    type="text" 
                    value={compCurrency}
                    onChange={(e) => setCompCurrency(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Logotipo da Empresa</label>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    {compLogo ? (
                      <div className="relative group">
                        <img src={compLogo} alt="Logo Preview" className="w-16 h-16 object-contain rounded-lg bg-white p-1 border border-slate-100" />
                        <button 
                          type="button"
                          onClick={() => setCompLogo('')}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        <Hotel size={24} />
                      </div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden" 
                        id="logo-upload"
                      />
                      <label 
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <Download size={14} />
                        Selecionar Logotipo
                      </label>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG ou SVG. Recomendado: 200x200px</p>
                    </div>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(79, 70, 229, 1)' }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Atualizar Dados
                </motion.button>
              </form>

              <div className="mt-8 space-y-6">
                <h3 className="text-xl font-bold text-slate-900 border-t pt-8 flex items-center gap-2">
                  <FileText size={20} className="text-emerald-600" />
                  Séries de Faturação
                </h3>
                
                <div className="space-y-4">
                   <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Taxa de Retenção Padrão IRT/Serviços (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={compWithholdingRate}
                      onChange={(e) => setCompWithholdingRate(Number(e.target.value))}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                    />
                  </div>

                  <div className="space-y-3">
                    {compBillingSeries.map((series, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                        <div className="flex-1 grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Nome</p>
                            <input 
                              type="text" 
                              value={series.name}
                              onChange={(e) => {
                                const newSeries = [...compBillingSeries];
                                newSeries[idx].name = e.target.value;
                                setCompBillingSeries(newSeries);
                              }}
                              className="w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Prefixo</p>
                            <input 
                              type="text" 
                              value={series.prefix}
                              onChange={(e) => {
                                const newSeries = [...compBillingSeries];
                                newSeries[idx].prefix = e.target.value;
                                setCompBillingSeries(newSeries);
                              }}
                              className="w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0 font-mono"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Próximo Nº</p>
                            <input 
                              type="number" 
                              value={series.nextNumber}
                              onChange={(e) => {
                                const newSeries = [...compBillingSeries];
                                newSeries[idx].nextNumber = Number(e.target.value);
                                setCompBillingSeries(newSeries);
                              }}
                              className="w-full bg-transparent border-none p-0 text-sm font-bold focus:ring-0"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => setCompBillingSeries(compBillingSeries.filter((_, i) => i !== idx))}
                          className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => setCompBillingSeries([...compBillingSeries, { id: Math.random().toString(36).substr(2, 5).toUpperCase(), name: 'Nova Série', prefix: 'NEW', nextNumber: 1 }])}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Adicionar Nova Série
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Users size={20} className="text-violet-600" />
                Gestão de Utilizadores
              </h3>
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Adicionar Novo Utilizador</p>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Nome Completo" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Username" 
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                    />
                    <input 
                      type="password" 
                      placeholder="Senha" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm" 
                    />
                  </div>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm"
                  >
                    <option value="rooms_user">Quartos (Recepção)</option>
                    <option value="bar_user">Bar & Restaurante</option>
                    <option value="events_user">Lazer & Eventos</option>
                    <option value="hr_user">Recursos Humanos (RH)</option>
                    <option value="manager">Gerente Geral</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(109, 40, 217, 1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddUser}
                    className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-100 transition-all"
                  >
                    Criar Utilizador
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-4">Nome</th>
                    <th className="pb-4">Username</th>
                    <th className="pb-4">Cargo</th>
                    <th className="pb-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user) => (
                    <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-semibold text-slate-700">{user.name}</td>
                      <td className="py-4 text-slate-500">{user.username}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          user.role === 'admin' ? 'bg-violet-100 text-violet-700' :
                          user.role === 'manager' ? 'bg-indigo-100 text-indigo-700' :
                          user.role === 'rooms_user' ? 'bg-emerald-100 text-emerald-700' :
                          user.role === 'bar_user' ? 'bg-orange-100 text-orange-700' :
                          user.role === 'events_user' ? 'bg-rose-100 text-rose-700' :
                          user.role === 'hr_user' ? 'bg-cyan-100 text-cyan-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setEditingPermissionsUser(user)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Gerir Permissões"
                          >
                            <Lock size={16} />
                          </button>
                          {user.id !== '1' && (
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : !isDevAuthenticated ? (
        <div className="flex items-center justify-center py-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={32} />
              </div>
              <h4 className="text-xl font-bold text-slate-900">Acesso Restrito</h4>
              <p className="text-sm text-slate-500">Credenciais de Desenvolvedor Necessárias</p>
            </div>

            <form onSubmit={handleDevLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Utilizador</label>
                <input 
                  type="text" 
                  value={devLoginUsername}
                  onChange={(e) => setDevLoginUsername(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                  placeholder="fox"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Senha</label>
                <input 
                  type="password" 
                  value={devLoginPassword}
                  onChange={(e) => setDevLoginPassword(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
              {devLoginError && (
                <p className="text-xs font-bold text-rose-500 text-center">Credenciais inválidas</p>
              )}
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-100 transition-all"
              >
                Entrar na Área Dev
              </motion.button>
            </form>
          </motion.div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 size={20} className="text-rose-600" />
                Estado da Licença & Pagamentos
              </h3>
              <form onSubmit={handleUpdateDeveloper} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estado de Pagamento</label>
                    <select 
                      value={devPaymentStatus}
                      onChange={(e) => setDevPaymentStatus(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                    >
                      <option value="paid">Pago</option>
                      <option value="pending">Pendente</option>
                      <option value="overdue">Em Atraso</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo de Licença</label>
                    <select 
                      value={devLicenseType}
                      onChange={(e) => setDevLicenseType(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                    >
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                      <option value="lifetime">Vitalícia</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data de Expiração</label>
                  <input 
                    type="date" 
                    value={devExpiryDate.split('T')[0]}
                    onChange={(e) => setDevExpiryDate(new Date(e.target.value).toISOString())}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                  />
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Limitações do Sistema</p>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devBlockSystem ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Lock size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Bloquear Sistema</p>
                          <p className="text-[10px] text-slate-500">Impede o acesso total em caso de atraso</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devBlockSystem}
                        onChange={(e) => setDevBlockSystem(e.target.checked)}
                        className="w-5 h-5 accent-rose-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devDisableReports ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                          <BarChart3 size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Desativar Relatórios</p>
                          <p className="text-[10px] text-slate-500">Oculta a secção de relatórios e finanças</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devDisableReports}
                        onChange={(e) => setDevDisableReports(e.target.checked)}
                        className="w-5 h-5 accent-amber-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devDisableRooms ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Hotel size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Limitar Quartos</p>
                          <p className="text-[10px] text-slate-500">Oculta a secção de recepção e quartos</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devDisableRooms}
                        onChange={(e) => setDevDisableRooms(e.target.checked)}
                        className="w-5 h-5 accent-emerald-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devReadOnlyRooms ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                          <IdCard size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Quartos: Apenas Leitura</p>
                          <p className="text-[10px] text-slate-500">Permite ver, mas impede edições e reservas</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devReadOnlyRooms}
                        onChange={(e) => setDevReadOnlyRooms(e.target.checked)}
                        className="w-5 h-5 accent-indigo-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devDisableBar ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Wine size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Limitar Bar & Restaurante</p>
                          <p className="text-[10px] text-slate-500">Oculta a secção de bar e restaurante</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devDisableBar}
                        onChange={(e) => setDevDisableBar(e.target.checked)}
                        className="w-5 h-5 accent-orange-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devReadOnlyBar ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                          <GlassWater size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Bar: Apenas Leitura</p>
                          <p className="text-[10px] text-slate-500">Permite ver pedidos, mas impede novos registros</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devReadOnlyBar}
                        onChange={(e) => setDevReadOnlyBar(e.target.checked)}
                        className="w-5 h-5 accent-amber-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devDisableLeisure ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Palmtree size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Limitar Lazer & Eventos</p>
                          <p className="text-[10px] text-slate-500">Oculta a secção de lazer e eventos</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devDisableLeisure}
                        onChange={(e) => setDevDisableLeisure(e.target.checked)}
                        className="w-5 h-5 accent-rose-600"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${devReadOnlyLeisure ? 'bg-violet-100 text-violet-600' : 'bg-slate-200 text-slate-400'}`}>
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Lazer: Apenas Leitura</p>
                          <p className="text-[10px] text-slate-500">Permite ver calendário, mas impede novas faturas</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={devReadOnlyLeisure}
                        onChange={(e) => setDevReadOnlyLeisure(e.target.checked)}
                        className="w-5 h-5 accent-violet-600"
                      />
                    </label>
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(225, 29, 72, 1)' }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-100 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Guardar Configurações Dev
                </motion.button>
              </form>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-600" />
                Segurança & Integridade Digital
              </h3>
              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-900">Assinatura Digital RSA Ativa</p>
                    <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Garantia de Integridade de Dados</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chave Pública do Sistema (SPKI)</p>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 font-mono text-[9px] text-slate-500 break-all leading-relaxed max-h-32 overflow-y-auto">
                    {localStorage.getItem('rsa_public_key') || 'A configurar chaves...'}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                  Este sistema utiliza criptografia assimétrica RSA de 2048 bits para assinar cada transação. Facturas e registos assinados não podem ser alterados sem invalidar a sua assinatura digital.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Lock size={20} className="text-rose-600" />
                Segurança do Desenvolvedor
              </h3>
              <form onSubmit={handleUpdateDevPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nova Senha de Acesso</label>
                  <input 
                    type="password" 
                    value={newDevPassword}
                    onChange={(e) => setNewDevPassword(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                    placeholder="Nova senha"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    value={confirmDevPassword}
                    onChange={(e) => setConfirmDevPassword(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                    placeholder="Confirmar senha"
                  />
                </div>
                {devPassMessage && (
                  <p className={`text-xs font-bold text-center ${devPassMessage.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {devPassMessage.text}
                  </p>
                )}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  Alterar Senha Dev
                </motion.button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* User Permissions Modal */}
      <AnimatePresence>
        {editingPermissionsUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-800">
                    Permissões de {editingPermissionsUser.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">
                      Configure o acesso aos módulos e operações do sistema
                    </p>
                  </div>
                  <button onClick={() => setEditingPermissionsUser(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LayoutDashboard size={14} />
                    Acesso a Menus e Secções
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'dashboard', label: 'Dashboard' },
                      { id: 'reception', label: 'Quartos' },
                      { id: 'bar', label: 'Bar & Restaurante' },
                      { id: 'leisure', label: 'Lazer & Eventos' },
                      { id: 'hr', label: 'Recursos Humanos' },
                      { id: 'reports', label: 'Relatórios' },
                      { id: 'secretaria', label: 'Secretaria' },
                      { id: 'finances', label: 'Finanças' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => handleToggleTabPermission(editingPermissionsUser.id, tab.id as AppTab)}
                        className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-left flex items-center justify-between ${
                          editingPermissionsUser.permissions?.tabs.includes(tab.id as AppTab)
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        {tab.label}
                        {editingPermissionsUser.permissions?.tabs.includes(tab.id as AppTab) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings size={14} />
                    Funcionalidades Específicas
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'void_order', label: 'Devolução de Pedidos (Bar)' },
                      { id: 'delete_employee', label: 'Demitir Funcionários' },
                      { id: 'edit_prices', label: 'Alterar Preços (Menu/Quartos)' },
                      { id: 'export_reports', label: 'Exportar Relatórios' },
                      { id: 'manage_stock', label: 'Gerir Stock Crítico' },
                    ].map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleToggleActionPermission(editingPermissionsUser.id, action.id)}
                        className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-left flex items-center justify-between ${
                          editingPermissionsUser.permissions?.actions.includes(action.id)
                            ? 'bg-violet-50 border-violet-500 text-violet-700'
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        {action.label}
                        {editingPermissionsUser.permissions?.actions.includes(action.id) && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                    Nota: O Administrador principal tem acesso total e não pode ter as suas permissões alteradas. 
                    As alterações de permissões entram em vigor imediatamente após a gravação.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setEditingPermissionsUser(null)}
                  className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
                >
                  Concluir Configuração
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
