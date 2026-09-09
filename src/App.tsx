import React, { useState, useEffect, useCallback } from "react";
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
  Database,
  Key,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  LogIn
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO, addMonths, isAfter, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppTab, Room, Booking, Customer, BarOrder, Event, Employee, Expense, User as UserType, CompanyConfig, DeveloperSettings, TaxConfig, MenuItem, BillingSeries, DatabaseProviderType } from "./types";
import { syncDatabaseSchema, storage, checkConnection, checkDynamicConnection, checkUniversalConnection, getActiveDatabaseConfig, saveDatabaseConfig, pullAndMergeFromUniversalDatabase } from "./supabaseClient";
import { SupabaseSyncIndicator } from "./components/SupabaseSyncIndicator";
import { NavItem } from "./components/common/NavItem";
import { SignatureBadge } from "./components/common/SignatureBadge";
import { MOCK_ROOMS, MOCK_USERS, MOCK_COMPANY, DEFAULT_MENU, TAX_IVA_14 } from "./constants/initialData";
import { CryptoService } from "./services/cryptoService";

// Extracted Sub-View Components
import { DashboardView } from "./components/views/DashboardView";
import { ReceptionView } from "./components/views/ReceptionView";
import { BarView } from "./components/views/BarView";
import { ReportsView } from "./components/views/ReportsView";
import { LeisureView } from "./components/views/LeisureView";
import { SecretariaView } from "./components/views/SecretariaView";
import { AdminView } from "./components/views/AdminView";
import { HRView } from "./components/views/HRView";
import { ManualsView } from "./components/views/ManualsView";
import { LoginView } from "./components/views/LoginView";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [menu, setMenu] = useState<any>(storage.get('bar_menu') || DEFAULT_MENU);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [barOrders, setBarOrders] = useState<any[]>([]);
  const [leisureEvents, setLeisureEvents] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>(storage.get('expenses') || []);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>(storage.get('inventory_logs') || []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>(MOCK_COMPANY);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [employees, setEmployees] = useState<Employee[]>(storage.get('employees') || []);
  const [developerSettings, setDeveloperSettings] = useState<DeveloperSettings>(storage.get('developer_settings') || {
    paymentStatus: 'paid',
    licenseType: 'monthly',
    expiryDate: addMonths(new Date(), 1).toISOString(),
    devUsername: 'fox',
    devPassword: 'Arvex1',
    limitations: {
      blockSystem: false,
      disableReports: false,
      disableRooms: false,
      disableBar: false,
      disableLeisure: false,
      readOnlyRooms: false,
      readOnlyBar: false,
      readOnlyLeisure: false
    },
    paymentMethods: {
      bankTransfer: 'Banco BAI',
      multicaixaExpress: '+244 923 000 000',
      iban: 'AO06 0000 0000 0000 0000 0000 0'
    }
  });

  const isExpired = isAfter(new Date(), new Date(developerSettings.expiryDate));
  const isOverdue = developerSettings.paymentStatus === 'overdue' || isExpired;

  const isReadOnly = (module: 'rooms' | 'bar' | 'leisure') => {
    if (module === 'rooms') return developerSettings.limitations.readOnlyRooms || (isOverdue && !developerSettings.limitations.blockSystem);
    if (module === 'bar') return developerSettings.limitations.readOnlyBar || (isOverdue && !developerSettings.limitations.blockSystem);
    if (module === 'leisure') return developerSettings.limitations.readOnlyLeisure || (isOverdue && !developerSettings.limitations.blockSystem);
    return false;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    storage.remove('auth_user');
  };

  const handleLogin = (user: UserType) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    storage.set('auth_user', user);
  };

  const handleSyncComplete = (syncedData: any) => {
    if (syncedData) {
      if (syncedData.rooms) setRooms(syncedData.rooms);
      if (syncedData.bookings) setBookings(syncedData.bookings);
      if (syncedData.bar_orders) setBarOrders(syncedData.bar_orders);
      if (syncedData.leisure_events) setLeisureEvents(syncedData.leisure_events);
      if (syncedData.expenses) setExpenses(syncedData.expenses);
      if (syncedData.employees) setEmployees(syncedData.employees);
      if (syncedData.bar_menu) setMenu(syncedData.bar_menu);
      if (syncedData.company_config) setCompanyConfig(syncedData.company_config);
      if (syncedData.developer_settings) setDeveloperSettings(syncedData.developer_settings);
    }
  };

  useEffect(() => {
    // Initialize Crypto Keys for Digital Signatures
    CryptoService.ensureKeys();

    // Check for existing session
    const savedUser = storage.get('auth_user');
    if (savedUser) {
      setIsAuthenticated(true);
      setCurrentUser(savedUser);
    }

    // Initialize users
    const localUsers = storage.get('users');
    if (!localUsers) {
      storage.set('users', MOCK_USERS);
    }

    const localCompany = storage.get('company_config');
    if (!localCompany) {
      storage.set('company_config', MOCK_COMPANY);
      setCompanyConfig(MOCK_COMPANY);
    } else {
      setCompanyConfig(localCompany);
    }

    // Initialize data
    const localRooms = storage.get('rooms');
    if (!localRooms) {
      storage.set('rooms', MOCK_ROOMS);
      setRooms(MOCK_ROOMS);
    } else {
      setRooms(localRooms);
    }

    const localBookings = storage.get('bookings');
    if (!localBookings) {
      const initialBookings = [
        { id: '1', name: 'João Manuel', room: '101', in: '2024-03-30T14:00', out: '2024-04-05T12:00', status: 'Checked In', paymentStatus: 'Pago', documentId: '123456789', phone: '+244 923 000 111', totalAmount: 2400, taxConfig: TAX_IVA_14 },
        { id: '2', name: 'Maria Santos', room: '202', in: '2024-04-01T10:00', out: '2024-04-03T10:00', status: 'Confirmado', paymentStatus: 'Parcial', documentId: '987654321', phone: '+244 912 222 333', totalAmount: 7200, taxConfig: TAX_IVA_14 },
        { id: '3', name: 'Carlos Alberto', room: '105', in: '2024-03-28T08:00', out: '2024-03-31T18:00', status: 'Check-out Pendente', paymentStatus: 'Pendente', documentId: '456789123', phone: '+244 931 444 555', totalAmount: 3600, taxConfig: TAX_IVA_14 },
      ];
      storage.set('bookings', initialBookings);
      setBookings(initialBookings);
    } else {
      setBookings(localBookings);
    }

    const localBarOrders = storage.get('bar_orders');
    if (!localBarOrders) {
      const initialOrders = [
        { id: 'o1', date: '2024-03-30T18:30:00Z', items: [{ name: 'Cocktail Pérola', price: 12, qty: 2 }, { name: 'Salada Tropical', price: 14, qty: 1 }], total: 38, room: '101' },
        { id: 'o2', date: '2024-03-31T12:15:00Z', items: [{ name: 'Hambúrguer Gourmet', price: 18, qty: 1 }, { name: 'Cerveja Artesanal', price: 6, qty: 2 }], total: 30, room: '202' },
        { id: 'o3', date: '2024-04-01T20:00:00Z', items: [{ name: 'Vinho Tinto Reserva', price: 25, qty: 1 }, { name: 'Tábua de Queijos', price: 22, qty: 1 }], total: 47, room: '101' },
        { id: 'o4', date: '2024-04-01T21:30:00Z', items: [{ name: 'Cocktail Pérola', price: 12, qty: 3 }], total: 36, room: 'Avulsa' },
        { id: 'o5', date: '2024-04-02T10:00:00Z', items: [{ name: 'Sumo Natural', price: 4, qty: 2 }], total: 8, room: '105' },
      ];
      storage.set('bar_orders', initialOrders);
      setBarOrders(initialOrders);
    } else {
      setBarOrders(localBarOrders);
    }

    const localLeisureEvents = storage.get('leisure_events');
    if (!localLeisureEvents) {
      const initialEvents = [
        { id: 'e1', name: 'Casamento Família Silva', date: '2024-04-10T18:00:00Z', location: 'Salão de Festas', price: 2500, status: 'Confirmado' },
        { id: 'e2', name: 'Aniversário Infantil', date: '2024-04-15T14:00:00Z', location: 'Piscina', price: 800, status: 'Pendente' },
        { id: 'e3', name: 'Conferência Tech', date: '2024-04-20T09:00:00Z', location: 'Salão de Festas', price: 1500, status: 'Confirmado' },
      ];
      storage.set('leisure_events', initialEvents);
      setLeisureEvents(initialEvents);
    } else {
      setLeisureEvents(localLeisureEvents);
    }

    const localExpenses = storage.get('expenses');
    if (!localExpenses) {
      const initialExpenses: Expense[] = [
        { id: '1', description: 'Manutenção de Ar Condicionado', amount: 45000, category: 'rooms', date: format(new Date(), 'yyyy-MM-dd'), createdAt: new Date().toISOString() },
        { id: '2', description: 'Reposicao de Stock Bar', amount: 120000, category: 'bar', date: format(new Date(), 'yyyy-MM-dd'), createdAt: new Date().toISOString() },
        { id: '3', description: 'Electricidade (ENE)', amount: 65000, category: 'general', date: format(subDays(new Date(), 2), 'yyyy-MM-dd'), createdAt: new Date().toISOString() },
      ];
      storage.set('expenses', initialExpenses);
      setExpenses(initialExpenses);
    } else {
      setExpenses(localExpenses);
    }

    const localEmployees = storage.get('employees');
    if (!localEmployees) {
      const initialEmployees: Employee[] = [
        { id: '1', name: 'Ricardo Sousa', role: 'receptionist', salary: 85000, status: 'active', phone: '+244 923 111 222' },
        { id: '2', name: 'Ana Pereira', role: 'cleaner', salary: 72000, status: 'inactive', phone: '+244 912 333 444' },
        { id: '3', name: 'Miguel Silva', role: 'barman', salary: 95000, status: 'active', phone: '+244 931 555 666' },
        { id: '4', name: 'Sofia Costa', role: 'manager', salary: 250000, status: 'active', phone: '+244 924 777 888' },
      ];
      storage.set('employees', initialEmployees);
      setEmployees(initialEmployees);
    } else {
      setEmployees(localEmployees);
    }

    const localDevSettings = storage.get('developer_settings');
    if (!localDevSettings) {
      const initialDevSettings: DeveloperSettings = {
        paymentStatus: 'paid',
        licenseType: 'monthly',
        expiryDate: addMonths(new Date(), 1).toISOString(),
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
      storage.set('developer_settings', initialDevSettings);
      setDeveloperSettings(initialDevSettings);
    }

    // Sync data on mount (no schema changes)
    pullAndMergeFromUniversalDatabase().then(handleSyncComplete).catch(err => {
      console.error('Erro na sincronizacao inicial:', err);
    });

    // Connection monitoring
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic Supabase check
    const checkSupabase = async () => {
      const connected = await checkConnection();
      setIsOnline(connected);
    };

    const interval = setInterval(checkSupabase, 30000); // Check every 30s
    checkSupabase(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // --- Automatic Room Availability & Status Synchronization ---
  useEffect(() => {
    const syncStatus = () => {
      const now = new Date();
      setRooms(prevRooms => {
        let changed = false;
        const updated = prevRooms.map(room => {
          // Maintenance status is manual and should be respected over automatic bookings
          if (room.status === 'maintenance') return room;

          // Check if there is an active booking for this room right now
          const activeBooking = bookings.find(b => 
            b.room === room.number && 
            (b.status === 'Checked In' || b.status === 'Confirmado' || b.status === 'Check-out Pendente') &&
            new Date(b.in) <= now && 
            new Date(b.out) >= now
          );

          if (activeBooking) {
            // Room should be occupied if there is an active booking
            if (room.status !== 'occupied') {
              changed = true;
              return { ...room, status: 'occupied' as Room['status'] };
            }
          } else {
            // If no active booking, but it was occupied, set it to available (or dirty if we wanted)
            if (room.status === 'occupied') {
              changed = true;
              return { ...room, status: 'available' as Room['status'] };
            }
          }
          return room;
        });

        if (changed) {
          storage.set('rooms', updated);
          return updated;
        }
        return prevRooms;
      });
    };

    syncStatus();
    const interval = setInterval(syncStatus, 60000); // Re-sync every minute
    return () => clearInterval(interval);
  }, [bookings]); 

  const updateBookings = async (newBookings: any[]) => {
    const signedBookings = await Promise.all(newBookings.map(async (b) => {
      if (b.signature) return b;
      const signature = await CryptoService.signData(b);
      return { ...b, signature };
    }));
    setBookings(signedBookings);
    storage.set('bookings', signedBookings);
  };

  const updateBarOrders = async (newOrders: any[]) => {
    const signedOrders = await Promise.all(newOrders.map(async (o) => {
      if (o.signature) return o;
      const signature = await CryptoService.signData(o);
      return { ...o, signature };
    }));
    setBarOrders(signedOrders);
    storage.set('bar_orders', signedOrders);
  };

  const updateLeisureEvents = async (newEvents: any[]) => {
    const signedEvents = await Promise.all(newEvents.map(async (e) => {
      if (e.signature) return e;
      const signature = await CryptoService.signData(e);
      return { ...e, signature };
    }));
    setLeisureEvents(signedEvents);
    storage.set('leisure_events', signedEvents);
  };

  const updateExpenses = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    storage.set('expenses', newExpenses);
  };

  const getNextInvoiceNumber = (seriesId: string) => {
    const series = companyConfig.billingSeries?.find(s => s.id === seriesId);
    if (!series) return { number: '', series: '' };

    const currentYear = new Date().getFullYear();
    const formattedNumber = `${series.prefix} ${currentYear}/${String(series.nextNumber).padStart(4, '0')}`;
    
    // Increment local state counter
    const updatedSeries = companyConfig.billingSeries?.map(s => 
      s.id === seriesId ? { ...s, nextNumber: s.nextNumber + 1 } : s
    );
    
    const newConfig = { ...companyConfig, billingSeries: updatedSeries };
    setCompanyConfig(newConfig);
    storage.set('company_config', newConfig);
    
    return { number: formattedNumber, series: series.id };
  };

  const updateEmployees = (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    storage.set('employees', newEmployees);
  };

  const updateDeveloperSettings = (newSettings: DeveloperSettings) => {
    setDeveloperSettings(newSettings);
    storage.set('developer_settings', newSettings);
  };

  const addInventoryLog = (action: string, itemName: string, details: string) => {
    const newLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      action,
      itemName,
      details,
      user: currentUser?.name || 'Sistema'
    };
    const updatedLogs = [newLog, ...inventoryLogs];
    setInventoryLogs(updatedLogs);
    storage.set('inventory_logs', updatedLogs);
  };

  const calculateAngolanIRT = (salary: number) => {
    // 2020 Angolan IRT Table (Simplified/Standard)
    if (salary <= 70000) return 0;
    if (salary <= 100000) return (salary - 70000) * 0.10;
    if (salary <= 150000) return 3000 + (salary - 100000) * 0.13;
    if (salary <= 200000) return 9500 + (salary - 150000) * 0.16;
    if (salary <= 300000) return 17500 + (salary - 200000) * 0.18;
    if (salary <= 500000) return 35500 + (salary - 300000) * 0.19;
    if (salary <= 1000000) return 73500 + (salary - 500000) * 0.20;
    if (salary <= 1500000) return 173500 + (salary - 1000000) * 0.21;
    if (salary <= 2000000) return 278500 + (salary - 1500000) * 0.22;
    if (salary <= 5000000) return 388500 + (salary - 2000000) * 0.23;
    if (salary <= 10000000) return 1078500 + (salary - 5000000) * 0.24;
    return 2278500 + (salary - 10000000) * 0.25;
  };

  const renderContent = () => {
    // Check if user has permission for the active tab
    const hasPermission = currentUser?.role === 'admin' || currentUser?.permissions?.tabs.includes(activeTab);
    
    if (!hasPermission && activeTab !== 'dashboard') {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-400">
          <Lock size={48} className="opacity-20" />
          <p className="font-bold">Você não tem permissão para aceder a esta secção.</p>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100"
          >
            Voltar ao Dashboard
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return <DashboardView rooms={rooms} bookings={bookings} companyConfig={companyConfig} onSeeAllRooms={() => setActiveTab('reception')} onAddEvent={() => setActiveTab('leisure')} />;
      case 'reception': 
        if (developerSettings.limitations.disableRooms) {
          return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-400">
              <AlertCircle size={48} className="text-emerald-500" />
              <p className="font-bold text-center">Acesso aos Quartos desativado por limitação de licença.</p>
            </div>
          );
        }
        return <ReceptionView 
          rooms={rooms} 
          bookings={bookings} 
          onUpdateBookings={updateBookings} 
          companyConfig={companyConfig} 
          getNextInvoiceNumber={getNextInvoiceNumber} 
          readOnly={isReadOnly('rooms')}
          currentUser={currentUser}
        />;
      case 'bar': 
        if (developerSettings.limitations.disableBar) {
          return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-400">
              <AlertCircle size={48} className="text-orange-500" />
              <p className="font-bold text-center">Acesso ao Bar & Restaurante desativado por limitação de licença.</p>
            </div>
          );
        }
        return <BarView 
          menu={menu} 
          setMenu={setMenu} 
          rooms={rooms} 
          companyConfig={companyConfig} 
          currentUser={currentUser} 
          barOrders={barOrders} 
          onUpdateOrders={updateBarOrders} 
          inventoryLogs={inventoryLogs} 
          addInventoryLog={addInventoryLog} 
          readOnly={isReadOnly('bar')}
        />;
      case 'leisure': 
        if (developerSettings.limitations.disableLeisure) {
          return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-400">
              <AlertCircle size={48} className="text-rose-500" />
              <p className="font-bold text-center">Acesso ao Lazer & Eventos desativado por limitação de licença.</p>
            </div>
          );
        }
        return <LeisureView 
          events={leisureEvents} 
          onUpdateEvents={updateLeisureEvents} 
          companyConfig={companyConfig} 
          getNextInvoiceNumber={getNextInvoiceNumber} 
          readOnly={isReadOnly('leisure')}
          currentUser={currentUser}
        />;
      case 'reports': 
        if (developerSettings.limitations.disableReports) {
          return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-400">
              <AlertCircle size={48} className="text-amber-500" />
              <p className="font-bold">Relatórios desativados por falta de pagamento ou limitação de licença.</p>
            </div>
          );
        }
        return <ReportsView menu={menu} bookings={bookings} barOrders={barOrders} leisureEvents={leisureEvents} companyConfig={companyConfig} inventoryLogs={inventoryLogs} />;
      case 'secretaria': return <SecretariaView companyConfig={companyConfig} rooms={rooms} bookings={bookings} barOrders={barOrders} leisureEvents={leisureEvents} expenses={expenses} onUpdateRooms={(newRooms) => { setRooms(newRooms); storage.set('rooms', newRooms); }} onUpdateExpenses={updateExpenses} />;
      case 'finances': return <SecretariaView companyConfig={companyConfig} rooms={rooms} bookings={bookings} barOrders={barOrders} leisureEvents={leisureEvents} expenses={expenses} onUpdateRooms={(newRooms) => { setRooms(newRooms); storage.set('rooms', newRooms); }} onUpdateExpenses={updateExpenses} initialTab="finances" />;
      case 'admin': return <AdminView companyConfig={companyConfig} onUpdateCompany={setCompanyConfig} developerSettings={developerSettings} onUpdateDeveloperSettings={updateDeveloperSettings} />;
      case 'manuals': return <ManualsView companyConfig={companyConfig} />;
      case 'hr': return <HRView companyConfig={companyConfig} employees={employees} onUpdateEmployees={updateEmployees} calculateIRT={calculateAngolanIRT} />;
      default: return <DashboardView rooms={rooms} bookings={bookings} companyConfig={companyConfig} onSeeAllRooms={() => setActiveTab('reception')} onAddEvent={() => setActiveTab('leisure')} />;
    }
  };

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} companyConfig={companyConfig} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      {/* System Blocked Overlay */}
      {isOverdue && developerSettings.limitations.blockSystem && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md space-y-6"
          >
            <div className="w-24 h-24 bg-rose-500 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-rose-500/20 mx-auto">
              <Lock size={48} />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Sistema Bloqueado</h1>
              <p className="text-slate-400 font-medium">O acesso ao sistema foi suspenso devido a pagamentos pendentes. Por favor, regularize a sua situação para continuar a utilizar o Hotel Gest Pro.</p>
            </div>
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4 text-left">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dados para Pagamento</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Banco:</span>
                  <span className="text-white font-bold">{developerSettings.paymentMethods.bankTransfer}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">IBAN:</span>
                  <span className="text-white font-bold font-mono text-xs">{developerSettings.paymentMethods.iban}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Express:</span>
                  <span className="text-white font-bold">{developerSettings.paymentMethods.multicaixaExpress}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Após o pagamento, envie o comprovativo para o suporte técnico.</p>
          </motion.div>
        </div>
      )}

      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-white border-r border-slate-200 flex flex-col shadow-sm z-20"
      >
        <div className="p-6 flex items-center gap-3 border-bottom border-slate-100">
          {companyConfig.logo ? (
            <img src={companyConfig.logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-indigo-100 bg-white p-1" />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Hotel size={24} />
            </div>
          )}
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-xl tracking-tighter bg-gradient-to-r from-indigo-600 to-rose-500 bg-clip-text text-transparent uppercase truncate"
            >
              {companyConfig.name.split(' ')[0]}
            </motion.span>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {(currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.permissions?.tabs.includes('dashboard')) && (
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-indigo-500"
            />
          )}
          {!developerSettings.limitations.disableRooms && (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'rooms_user' || currentUser?.role === 'receptionist' || currentUser?.permissions?.tabs.includes('reception')) && (
            <NavItem 
              icon={<Bed size={20} />} 
              label="Quartos" 
              active={activeTab === 'reception'} 
              onClick={() => setActiveTab('reception')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-emerald-500"
            />
          )}
          {!developerSettings.limitations.disableBar && (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'bar_user' || currentUser?.permissions?.tabs.includes('bar')) && (
            <NavItem 
              icon={<Wine size={20} />} 
              label="Bar & Restaurante" 
              active={activeTab === 'bar'} 
              onClick={() => setActiveTab('bar')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-orange-500"
            />
          )}
          {!developerSettings.limitations.disableLeisure && (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'events_user' || currentUser?.permissions?.tabs.includes('leisure')) && (
            <NavItem 
              icon={<Palmtree size={20} />} 
              label="Lazer & Eventos" 
              active={activeTab === 'leisure'} 
              onClick={() => setActiveTab('leisure')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-rose-500"
            />
          )}
          {!developerSettings.limitations.disableReports && (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.permissions?.tabs.includes('reports')) && (
            <NavItem 
              icon={<BarChart3 size={20} />} 
              label="Relatórios" 
              active={activeTab === 'reports'} 
              onClick={() => setActiveTab('reports')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-slate-700"
            />
          )}
          <div className="pt-4 pb-2">
            {isSidebarOpen && <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão</p>}
          </div>
          {(currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'hr_user' || currentUser?.permissions?.tabs.includes('hr')) && (
            <NavItem 
              icon={<Users size={20} />} 
              label="Recursos Humanos" 
              active={activeTab === 'hr'} 
              onClick={() => setActiveTab('hr')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-cyan-500"
            />
          )}
          {(currentUser?.role === 'admin' || currentUser?.permissions?.tabs.includes('secretaria')) && (
            <NavItem 
              icon={<DollarSign size={20} />} 
              label="Secretaria" 
              active={activeTab === 'secretaria'} 
              onClick={() => setActiveTab('secretaria')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-emerald-500"
            />
          )}
          {(currentUser?.role === 'admin' || currentUser?.permissions?.tabs.includes('finances')) && (
            <NavItem 
              icon={<TrendingUp size={20} />} 
              label="Finanças" 
              active={activeTab === 'finances'} 
              onClick={() => setActiveTab('finances')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-emerald-600"
            />
          )}
          {currentUser?.role === 'admin' && (
            <NavItem 
              icon={<Settings size={20} />} 
              label="Administração" 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
              collapsed={!isSidebarOpen}
              activeColor="bg-violet-500"
            />
          )}
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Manuais" 
            active={activeTab === 'manuals'} 
            onClick={() => setActiveTab('manuals')} 
            collapsed={!isSidebarOpen}
            activeColor="bg-slate-600"
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(254, 242, 242, 1)', color: 'rgba(220, 38, 38, 1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 rounded-xl transition-all duration-200"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sair</span>}
          </motion.button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(241, 245, 249, 1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg text-slate-500 transition-colors"
            >
              <ChevronRight className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`} />
            </motion.button>
            <h2 className="text-xl font-semibold text-slate-800 capitalize">
              {activeTab === 'hr' ? 'Recursos Humanos' : activeTab === 'reception' ? 'Quartos' : activeTab === 'manuals' ? 'Manuais' : activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 w-64 transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <SupabaseSyncIndicator onSyncComplete={handleSyncComplete} />
              <div className="h-8 w-px bg-slate-200 mx-2"></div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900 leading-none">Admin Pérola</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Gerente Geral</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
                  <img src="https://picsum.photos/seed/admin/100/100" alt="Avatar" referrerPolicy="no-referrer" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Sub-Views ---

