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
  Database,
  Key,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  LogIn,
  Check,
  Copy,
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
  BillingSeries,
  DatabaseProviderType
} from "../../types";
import {
  syncDatabaseSchema,
  storage,
  checkConnection,
  checkDynamicConnection,
  checkUniversalConnection,
  getActiveDatabaseConfig,
  saveDatabaseConfig,
  pullAndMergeFromUniversalDatabase
} from "../../supabaseClient";
import { CryptoService } from "../../services/cryptoService";
import { SafTService } from "../../services/saftService";
import { SignatureBadge } from "../common/SignatureBadge";
import { TAX_IVA_14, TAX_IVA_EXEMPT, TAX_IS_1, MOCK_ROOMS, MOCK_USERS, MOCK_COMPANY, DEFAULT_MENU } from "../../constants/initialData";

export function ReportsView({ menu, bookings, barOrders, leisureEvents, companyConfig, inventoryLogs }: { 
  menu: any,
  bookings: any[], 
  barOrders: any[], 
  leisureEvents: any[], 
  companyConfig: CompanyConfig,
  inventoryLogs: any[]
}) {
  const [activeReport, setActiveReport] = useState<'rooms' | 'bar' | 'leisure' | 'users'>('rooms');
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year' | 'custom'>('day');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOperator, setSelectedOperator] = useState<string>('all');

  const filterData = (data: any[], dateField: string) => {
    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      if (filterType === 'day') {
        return format(itemDate, 'yyyy-MM-dd') === startDate;
      } else if (filterType === 'month') {
        return format(itemDate, 'yyyy-MM') === format(new Date(startDate), 'yyyy-MM');
      } else if (filterType === 'year') {
        return format(itemDate, 'yyyy') === format(new Date(startDate), 'yyyy');
      } else {
        return isWithinInterval(itemDate, { start, end });
      }
    });
  };

  const filteredBookings = filterData(bookings, 'in');
  const filteredBarOrders = filterData(barOrders, 'date');
  const filteredLeisureEvents = filterData(leisureEvents, 'date');

  const getRoomsStats = () => {
    const revenue = filteredBookings.reduce((sum, b) => {
      // Simple calculation for mock data
      const days = Math.max(1, Math.ceil((new Date(b.out).getTime() - new Date(b.in).getTime()) / (1000 * 60 * 60 * 24)));
      return sum + (days * 200); // Assuming average price 200
    }, 0);
    return { revenue, count: filteredBookings.length };
  };

  const getBarStats = () => {
    const revenue = filteredBarOrders.reduce((sum, o) => sum + o.total, 0);
    return { revenue, count: filteredBarOrders.length };
  };

  const getLeisureStats = () => {
    const revenue = filteredLeisureEvents.reduce((sum, e) => sum + e.price, 0);
    return { revenue, count: filteredLeisureEvents.length };
  };

  const handlePrint = () => {
    window.print();
  };

  const [isExportingSaft, setIsExportingSaft] = useState(false);

  const handleExportSaft = async () => {
    setIsExportingSaft(true);
    try {
      const xml = SafTService.generateXml({
        company: companyConfig,
        menu, // Accessible from parent scope or passed as prop
        bookings,
        barOrders,
        leisureEvents,
        month: format(new Date(startDate), 'yyyy-MM')
      });
      
      const fileName = `SAFT_AO_${companyConfig.nif}_${format(new Date(startDate), 'yyyyMM')}.xml`;
      SafTService.download(xml, fileName);
    } catch (error) {
      console.error('Error generating SAF-T:', error);
      alert('Erro ao gerar o ficheiro SAF-T. Verifique as configurações da empresa.');
    } finally {
      setIsExportingSaft(false);
    }
  };

  const renderRoomsReport = () => {
    const stats = getRoomsStats();
    const roomTypeData = [
      { name: 'Suite', value: filteredBookings.filter(b => b.room.startsWith('1')).length },
      { name: 'Single', value: filteredBookings.filter(b => b.room.startsWith('2')).length },
      { name: 'Outros', value: filteredBookings.filter(b => !b.room.startsWith('1') && !b.room.startsWith('2')).length },
    ];

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Distribuição por Tipo</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roomTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    <Cell fill="#4f46e5" />
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Receita Estimada</p>
                <p className="text-4xl font-black text-slate-900">{companyConfig.currency}{stats.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Reservas</p>
                <p className="text-4xl font-black text-indigo-600">{stats.count}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hóspede</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quarto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Check-in</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBookings.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-700">{b.name}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{b.room}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{format(new Date(b.in), 'dd/MM/yyyy')}</td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBarReport = () => {
    const stats = getBarStats();
    const barData = filteredBarOrders.map(o => ({
      date: format(new Date(o.date), 'HH:mm'),
      total: o.total
    })).slice(-10);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Vendas Recentes</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Faturamento Bar</p>
                <p className="text-4xl font-black text-slate-900">{companyConfig.currency}{stats.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pedidos Realizados</p>
                <p className="text-4xl font-black text-orange-600">{stats.count}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h4 className="text-lg font-black text-slate-900">Histórico de Vendas</h4>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBarOrders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-400">#{o.id.slice(-4)}</td>
                  <td className="px-8 py-5 text-slate-700 font-bold">
                    {o.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}
                  </td>
                  <td className="px-8 py-5 font-black text-slate-900">{companyConfig.currency}{o.total}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{format(new Date(o.date), 'dd/MM HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50">
            <h4 className="text-lg font-black text-slate-900">Atividade de Inventário</h4>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data & Hora</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ação</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilizador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inventoryLogs.slice(0, 10).map(log => (
                <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-900">{format(new Date(log.date), 'dd/MM/yyyy')}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(log.date), 'HH:mm:ss')}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      log.action === 'Inserção' ? 'bg-emerald-50 text-emerald-600' :
                      log.action === 'Eliminação' ? 'bg-rose-50 text-rose-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-bold text-slate-700">{log.itemName}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLeisureReport = () => {
    const stats = getLeisureStats();
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Receita Eventos</p>
                <p className="text-4xl font-black text-slate-900">{companyConfig.currency}{stats.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Eventos Realizados</p>
                <p className="text-4xl font-black text-rose-600">{stats.count}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Destaque</h4>
            <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
              <Palmtree className="text-rose-600 mb-4" size={32} />
              <p className="text-lg font-black text-rose-900">Áreas de Lazer</p>
              <p className="text-sm text-rose-700 opacity-80">Ocupação média de 75% no período selecionado.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Evento</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Local</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLeisureEvents.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-700">{e.name}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{e.location}</td>
                  <td className="px-8 py-5 font-black text-slate-900">{companyConfig.currency}{e.price.toLocaleString()}</td>
                  <td className="px-8 py-5 text-slate-500 font-medium">{format(new Date(e.date), 'dd/MM/yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderUserReport = () => {
    const normBookings = filteredBookings.map(b => ({
      ...b,
      user: b.user || 'Recepcionista Quartos',
      module: 'Quartos',
      details: b.room ? `Alojamento - Quarto ${b.room} (${b.name})` : `Alojamento (${b.name})`,
      amount: b.totalAmount || 0,
      dateFormatted: b.in
    }));

    const normBarOrders = filteredBarOrders.map(o => ({
      ...o,
      user: o.user || 'Atendente Bar',
      module: 'Bar & Restaurante',
      details: o.items ? (Array.isArray(o.items) ? o.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ') : o.items) : 'Pedido Bar & Restaurante',
      amount: o.total || 0,
      dateFormatted: o.date
    }));

    const normEvents = filteredLeisureEvents.map(e => ({
      ...e,
      user: e.user || 'Gestor Eventos',
      module: 'Lazer & Eventos',
      details: `Evento: ${e.name} (${e.location})`,
      amount: e.price || 0,
      dateFormatted: e.date
    }));

    // Find all unique developers/operators across actual records
    const foundOperators = Array.from(new Set([
      ...normBookings.map(b => b.user),
      ...normBarOrders.map(o => o.user),
      ...normEvents.map(e => e.user)
    ]));

    const systemOperators = ['Administrador', 'Recepcionista Quartos', 'Atendente Bar', 'Gestor Eventos', 'Gestor RH'];
    const allUniqueOperators = Array.from(new Set([...foundOperators, ...systemOperators])).filter(name => name && name !== 'Sistema');

    // Aggregate stats per employee
    const operatorStats = allUniqueOperators.map(opName => {
      const opBookings = normBookings.filter(b => b.user === opName);
      const opBarOrders = normBarOrders.filter(o => o.user === opName);
      const opEvents = normEvents.filter(e => e.user === opName);

      const roomsRevenue = opBookings.reduce((sum, b) => sum + b.amount, 0);
      const barRevenue = opBarOrders.reduce((sum, o) => sum + o.amount, 0);
      const leisureRevenue = opEvents.reduce((sum, e) => sum + e.amount, 0);

      const totalRevenue = roomsRevenue + barRevenue + leisureRevenue;
      const totalCount = opBookings.length + opBarOrders.length + opEvents.length;

      return {
        name: opName,
        roomsCount: opBookings.length,
        roomsRevenue,
        barCount: opBarOrders.length,
        barRevenue,
        leisureCount: opEvents.length,
        leisureRevenue,
        totalRevenue,
        totalCount
      };
    });

    // Sort by revenue descending
    operatorStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Filter transactions based on selection
    const allNormalizedTransactions = [
      ...normBookings,
      ...normBarOrders,
      ...normEvents
    ];

    const filteredTx = selectedOperator === 'all' 
      ? allNormalizedTransactions
      : allNormalizedTransactions.filter(t => t.user === selectedOperator);

    filteredTx.sort((a, b) => new Date(b.dateFormatted).getTime() - new Date(a.dateFormatted).getTime());

    const totalTxCount = filteredTx.length;
    const totalTxRevenue = filteredTx.reduce((sum, t) => sum + t.amount, 0);

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between shadow-sm font-sans">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendas Totais</p>
              <h5 className="text-3xl font-black text-slate-900">{totalTxCount}</h5>
            </div>
            <span className="text-[10px] text-slate-400 mt-3 block">Transações no período</span>
          </div>
          <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50 flex flex-col justify-between shadow-sm font-sans">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Faturação Quartos</p>
              <h5 className="text-3xl font-black text-indigo-900">
                {companyConfig.currency}{filteredTx.filter(t => t.module === 'Quartos').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
              </h5>
            </div>
            <span className="text-[10px] text-indigo-400 mt-3 block">
              {filteredTx.filter(t => t.module === 'Quartos').length} reserva(s)
            </span>
          </div>
          <div className="bg-orange-50/50 p-6 rounded-[2rem] border border-orange-100/50 flex flex-col justify-between shadow-sm font-sans">
            <div>
              <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Faturação Bar</p>
              <h5 className="text-3xl font-black text-orange-900">
                {companyConfig.currency}{filteredTx.filter(t => t.module === 'Bar & Restaurante').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
              </h5>
            </div>
            <span className="text-[10px] text-orange-400 mt-3 block">
              {filteredTx.filter(t => t.module === 'Bar & Restaurante').length} pedido(s)
            </span>
          </div>
          <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100/50 flex flex-col justify-between shadow-sm font-sans">
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Faturação Lazer</p>
              <h5 className="text-3xl font-black text-rose-900">
                {companyConfig.currency}{filteredTx.filter(t => t.module === 'Lazer & Eventos').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
              </h5>
            </div>
            <span className="text-[10px] text-rose-400 mt-3 block">
              {filteredTx.filter(t => t.module === 'Lazer & Eventos').length} evento(s)
            </span>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h4 className="text-lg font-black text-slate-900">Resumo de Contas por Funcionário</h4>
              <p className="text-xs text-slate-500">Demonstração de contas separadas por menu para cada um dos utilizadores</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar Detalhes:</span>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none cursor-pointer"
              >
                <option value="all">Ver Todos os Funcionários</option>
                {allUniqueOperators.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Funcionário / Utilizador</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Menu Quartos</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Menu Bar</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Menu Lazer</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Vendas</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Faturação Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {operatorStats.map((op) => (
                  <tr 
                    key={op.name} 
                    className={`hover:bg-slate-50/50 transition-all ${
                      selectedOperator !== 'all' && selectedOperator !== op.name ? 'opacity-40 filter grayscale' : ''
                    }`}
                  >
                    <td className="py-5 font-black text-slate-800 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200/60 font-black text-xs text-slate-600 flex items-center justify-center uppercase shadow-sm">
                        {op.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{op.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Operador do Sistema</p>
                      </div>
                    </td>
                    <td className="py-5 text-center">
                      <p className="text-xs font-black text-indigo-600">{op.roomsCount} vendas</p>
                      <p className="text-[10px] font-medium text-slate-400">{companyConfig.currency}{op.roomsRevenue.toLocaleString()}</p>
                    </td>
                    <td className="py-5 text-center">
                      <p className="text-xs font-black text-orange-600">{op.barCount} vendas</p>
                      <p className="text-[10px] font-medium text-slate-400">{companyConfig.currency}{op.barRevenue.toLocaleString()}</p>
                    </td>
                    <td className="py-5 text-center">
                      <p className="text-xs font-black text-rose-600">{op.leisureCount} vendas</p>
                      <p className="text-[10px] font-medium text-slate-400">{companyConfig.currency}{op.leisureRevenue.toLocaleString()}</p>
                    </td>
                    <td className="py-5 text-center">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {op.totalCount} transações
                      </span>
                    </td>
                    <td className="py-5 text-right font-black text-slate-900 text-sm">
                      {companyConfig.currency}{op.totalRevenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-black text-slate-900">
                {selectedOperator === 'all' ? 'Extrato de Atividade no Dia / Período' : `Extrato de Atividade — ${selectedOperator}`}
              </h4>
              <p className="text-xs text-slate-500 font-medium">Listagem detalhada das transações registadas para fins de auditoria e fecho de caixa</p>
            </div>
            <div className="bg-white px-5 py-2.5 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 font-mono shadow-sm animate-pulse">
              Total Faturado: <span className="text-indigo-600 font-black">{companyConfig.currency}{totalTxRevenue.toLocaleString()}</span>
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <User size={48} className="mx-auto mb-4 text-slate-350" />
              <p className="font-bold text-sm">Nenhuma venda encontrada para o filtro selecionado.</p>
              <p className="text-xs text-slate-400 mt-1">Registe faturas ou utilize outros filtros de datas diários / mensais.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/30">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora & Data</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Menu / Origem</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Funcionário / Operador</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalhes da Transação</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTx.map((tx: any, idx) => {
                    const badgeColor = 
                      tx.module === 'Quartos' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' :
                      tx.module === 'Bar & Restaurante' ? 'bg-orange-50 border-orange-100 text-orange-700' :
                      'bg-rose-50 border-rose-100 text-rose-700';

                    return (
                      <tr key={tx.id || idx} className="hover:bg-slate-50/20 transition-colors">
                        <td className="px-8 py-5">
                          <p className="text-xs text-slate-700 font-bold">{format(new Date(tx.dateFormatted), 'dd/MM/yyyy')}</p>
                          <p className="text-[10px] text-slate-400 font-mono font-medium">{format(new Date(tx.dateFormatted), 'HH:mm')}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-2.5 py-1 border rounded-lg text-[10px] font-black uppercase tracking-widest ${badgeColor}`}>
                            {tx.module}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-xs font-black text-slate-800">{tx.user}</span>
                        </td>
                        <td className="px-8 py-5 text-xs text-slate-600 font-bold max-w-[320px] truncate" title={tx.details}>
                          {tx.details}
                        </td>
                        <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">
                          {companyConfig.currency}{tx.amount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20 no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Central de Relatórios</h3>
          <p className="text-slate-500 font-medium">Análise completa de todas as atividades do resort</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExportSaft}
            disabled={isExportingSaft}
            className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm font-bold text-white shadow-lg shadow-slate-200 flex items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {isExportingSaft ? <RefreshCw size={18} className="animate-spin" /> : <FileText size={18} className="text-orange-500" />}
            Exportar SAF-T AO
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePrint}
            className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Printer size={18} />
            Gerar PDF
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
            {(['day', 'month', 'year', 'custom'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {type === 'day' ? 'Diário' : type === 'month' ? 'Mensal' : type === 'year' ? 'Anual' : 'Personalizado'}
              </button>
            ))}
          </div>
          
          <div className="flex flex-1 items-center gap-4">
            <div className="flex-1 relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type={filterType === 'month' ? 'month' : filterType === 'year' ? 'number' : 'date'}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {filterType === 'custom' && (
              <>
                <span className="text-slate-300 font-bold">até</span>
                <div className="flex-1 relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activity Tabs */}
      <div className="flex gap-4 border-b border-slate-200 pb-1">
        {[
          { id: 'rooms', label: 'Quartos', icon: <Bed size={18} /> },
          { id: 'bar', label: 'Bar & Restaurante', icon: <Wine size={18} /> },
          { id: 'leisure', label: 'Lazer & Eventos', icon: <Palmtree size={18} /> },
          { id: 'users', label: 'Por Funcionário / Operador', icon: <User size={18} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeReport === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab.icon}
            {tab.label}
            {activeReport === tab.id && (
              <motion.div layoutId="activeReportTab" className="absolute bottom-[-1px] left-0 right-0 h-1 bg-indigo-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="print-content">
        {activeReport === 'rooms' && renderRoomsReport()}
        {activeReport === 'bar' && renderBarReport()}
        {activeReport === 'leisure' && renderLeisureReport()}
        {activeReport === 'users' && renderUserReport()}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { display: block !important; }
          body { background: white; }
          .bg-white { border: none !important; box-shadow: none !important; }
          .rounded-[2.5rem] { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}
