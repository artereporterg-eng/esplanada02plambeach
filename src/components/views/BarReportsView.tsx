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
import { ReportsView } from "./ReportsView";

export function BarReportsView({ barOrders, inventoryLogs, companyConfig, onUpdateOrders, onVoidOrder, onReorder }: { 
  barOrders: any[], 
  inventoryLogs: any[],
  companyConfig: CompanyConfig, 
  onUpdateOrders: (orders: any[]) => void,
  onVoidOrder: (orderId: string) => void,
  onReorder: (order: any) => void
}) {
  const [reportTab, setReportTab] = useState<'dashboard' | 'orders' | 'inventory'>('dashboard');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  const filteredOrders = barOrders.filter(order => {
    if (order.status === 'voided') return false;
    if (timeRange === 'all') return true;
    const days = timeRange === '7d' ? 7 : 30;
    const limitDate = subDays(new Date(), days);
    return new Date(order.date) >= limitDate;
  });

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const totalItems = filteredOrders.reduce((sum, order) => sum + order.items.reduce((s: number, i: any) => s + i.qty, 0), 0);

  // Most sold items
  const itemSales: { [key: string]: number } = {};
  filteredOrders.forEach(order => {
    order.items.forEach((item: any) => {
      itemSales[item.name] = (itemSales[item.name] || 0) + item.qty;
    });
  });

  const mostSoldItems = Object.entries(itemSales)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Revenue by day
  const revenueByDay: { [key: string]: number } = {};
  filteredOrders.forEach(order => {
    const day = format(new Date(order.date), 'dd/MM');
    revenueByDay[day] = (revenueByDay[day] || 0) + order.total;
  });

  const chartData = Object.entries(revenueByDay)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => {
      const [dayA, monthA] = a.date.split('/').map(Number);
      const [dayB, monthB] = b.date.split('/').map(Number);
      return monthA !== monthB ? monthA - monthB : dayA - dayB;
    });

  const COLORS = ['#f97316', '#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-8">
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setReportTab('dashboard')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${reportTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
        >
          Dashboard
        </button>
        <button 
          onClick={() => setReportTab('orders')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${reportTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
        >
          Histórico de Pedidos
        </button>
        <button 
          onClick={() => setReportTab('inventory')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${reportTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
        >
          Atividade de Inventário
        </button>
      </div>

      {reportTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Receita Total</p>
                  <p className="text-2xl font-black text-slate-900">{companyConfig.currency}{totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Wine size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Itens Vendidos</p>
                  <p className="text-2xl font-black text-slate-900">{totalItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total de Pedidos</p>
                  <p className="text-2xl font-black text-slate-900">{filteredOrders.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900 mb-6">Receita por Período</h4>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900 mb-6">Itens Mais Vendidos</h4>
              <div className="h-[300px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mostSoldItems}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="qty"
                    >
                      {mostSoldItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {reportTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h4 className="text-lg font-bold text-slate-900">Histórico de Pedidos</h4>
            <div className="flex gap-2">
              {(['7d', '30d', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${timeRange === range ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {range === '7d' ? '7 Dias' : range === '30d' ? '30 Dias' : 'Tudo'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Itens</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Destino</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Integridade</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {barOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(order => (
                  <tr key={order.id} className={`hover:bg-slate-50/50 transition-colors ${order.status === 'voided' ? 'opacity-50 grayscale' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{format(new Date(order.date), 'dd/MM/yyyy')}</p>
                      <p className="text-xs text-slate-500">{format(new Date(order.date), 'HH:mm')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {order.items.map((item: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded">
                            {item.qty}x {item.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.room === 'Avulsa' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {order.room === 'Avulsa' ? 'Venda Avulsa' : `Quarto ${order.room}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        order.status === 'voided' ? 'bg-rose-100 text-rose-700' : 
                        order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {order.status === 'voided' ? 'Devolvida' : 
                         order.status === 'paid' ? 'Paga' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <SignatureBadge signature={order.signature} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-slate-900">{companyConfig.currency}{order.total.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {order.status !== 'voided' && (
                          <>
                            <button 
                              onClick={() => onReorder(order)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Repetir Pedido"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button 
                              onClick={() => onVoidOrder(order.id)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                              title="Processar Devolução de Valores"
                            >
                              <DollarSign size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h4 className="text-lg font-bold text-slate-900">Histórico de Atividade de Inventário</h4>
            <p className="text-xs text-slate-500 mt-1">Registo de todas as inserções, atualizações e eliminações de produtos.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Data & Hora</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Ação</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Produto/Item</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Detalhes</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Utilizador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">
                      Nenhuma atividade de inventário registada.
                    </td>
                  </tr>
                ) : (
                  inventoryLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{format(new Date(log.date), 'dd/MM/yyyy')}</p>
                        <p className="text-xs text-slate-500">{format(new Date(log.date), 'HH:mm:ss')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          log.action === 'Inserção' || log.action === 'Nova Categoria' ? 'bg-emerald-100 text-emerald-700' :
                          log.action === 'Eliminação' || log.action === 'Eliminar Categoria' || log.action === 'Anulação Fatura' ? 'bg-rose-100 text-rose-700' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900">{log.itemName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500">{log.details}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {log.user.charAt(0)}
                          </div>
                          <span className="text-xs font-bold text-slate-600">{log.user}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
