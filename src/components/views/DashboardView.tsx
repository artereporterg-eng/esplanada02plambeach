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

export function DashboardView({ rooms, bookings, companyConfig, onSeeAllRooms, onAddEvent }: { rooms: Room[], bookings: any[], companyConfig: CompanyConfig, onSeeAllRooms: () => void, onAddEvent: () => void }) {
  const [showCalendar, setShowCalendar] = useState(false);

  const calculateTotalRevenue = () => {
    return bookings.filter(b => b.status !== 'cancelled').reduce((acc, b) => {
      const room = rooms.find(r => r.number === b.room);
      if (!room) return acc;
      const start = new Date(b.in);
      const end = new Date(b.out);
      const diffHours = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60)) || 1;
      return acc + (diffHours * room.price);
    }, 0);
  };

  const stats = [
    { 
      label: 'Ocupação', 
      value: `${Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100)}%`, 
      icon: <CheckCircle2 className="text-white" />, 
      color: 'bg-emerald-500', 
      shadow: 'shadow-emerald-200', 
      border: 'border-emerald-500' 
    },
    { 
      label: 'Check-ins Hoje', 
      value: bookings.filter(b => b.status === 'Checked In').length.toString(), 
      icon: <Clock className="text-white" />, 
      color: 'bg-orange-500', 
      shadow: 'shadow-orange-200', 
      border: 'border-orange-500' 
    },
    { 
      label: 'Receita Total', 
      value: `${companyConfig.currency}${calculateTotalRevenue().toLocaleString()}`, 
      icon: <DollarSign className="text-white" />, 
      color: 'bg-rose-500', 
      shadow: 'shadow-rose-200', 
      border: 'border-rose-500' 
    },
    { 
      label: 'Manutenção', 
      value: rooms.filter(r => r.status === 'maintenance').length.toString(), 
      icon: <AlertCircle className="text-white" />, 
      color: 'bg-cyan-500', 
      shadow: 'shadow-cyan-200', 
      border: 'border-cyan-500' 
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className={`bg-white p-6 rounded-2xl shadow-sm border-t-4 ${stat.border} border-x border-b border-slate-100 flex items-center gap-4 hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color} shadow-lg ${stat.shadow}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Mapa de Ocupação</h3>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSeeAllRooms}
              className="text-indigo-600 text-sm font-semibold hover:underline"
            >
              Ver Todos
            </motion.button>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <div 
                key={room.number}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:scale-105 ${
                  room.status === 'available' ? 'border-emerald-100 bg-emerald-50/50 text-emerald-700 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100' :
                  room.status === 'occupied' ? 'border-indigo-100 bg-indigo-50/50 text-indigo-700 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-100' :
                  'border-orange-100 bg-orange-50/50 text-orange-700 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-lg">{room.number}</span>
                  <Bed size={16} />
                </div>
                <p className="text-[10px] uppercase font-bold tracking-wider opacity-70">{room.type}</p>
                <p className="text-xs font-medium mt-1">{room.status === 'available' ? 'Livre' : room.status === 'occupied' ? 'Ocupado' : 'Indisp.'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-6">Próximos Eventos</h3>
          <div className="space-y-6">
            {[
              { title: 'Casamento Silva', date: 'Amanhã, 18:00', loc: 'Salão de Festas' },
              { title: 'Pool Party VIP', date: 'Sábado, 14:00', loc: 'Piscina' },
              { title: 'Workshop Tech', date: 'Próx. Segunda', loc: 'Auditório' },
            ].map((ev, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Calendar size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{ev.date}</p>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">{ev.loc}</p>
                </div>
              </div>
            ))}
          </div>
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(226, 232, 240, 1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCalendar(true)}
            className="w-full mt-8 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Calendário Completo
          </motion.button>
        </div>
      </div>

      {/* Events Calendar Modal */}
      <AnimatePresence>
        {showCalendar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCalendar(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <Calendar size={24} />
                  <h3 className="text-xl font-bold">Calendário de Eventos</h3>
                </div>
                <button 
                  onClick={() => setShowCalendar(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 grid grid-cols-1 md:grid-cols-7 gap-4">
                {/* Simple Calendar View */}
                <div className="md:col-span-5 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-slate-800">Abril 2026</h4>
                    <div className="flex gap-2">
                      <button className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><ChevronLeft size={20} /></button>
                      <button className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 30 }).map((_, i) => {
                      const day = i + 1;
                      const hasEvent = [2, 5, 12, 18, 25].includes(day);
                      return (
                        <div 
                          key={i} 
                          className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative group cursor-pointer transition-all ${
                            hasEvent ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`text-sm font-bold ${hasEvent ? 'text-indigo-600' : 'text-slate-600'}`}>{day}</span>
                          {hasEvent && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Event Details Sidebar */}
                <div className="md:col-span-2 bg-slate-50 rounded-2xl p-6 space-y-6">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-3">Eventos do Mês</h4>
                  <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                    {[
                      { title: 'Casamento Silva', date: '02 Abr, 18:00', loc: 'Salão A' },
                      { title: 'Pool Party VIP', date: '05 Abr, 14:00', loc: 'Piscina' },
                      { title: 'Workshop Tech', date: '12 Abr, 09:00', loc: 'Auditório' },
                      { title: 'Jantar Executivo', date: '18 Abr, 20:00', loc: 'Restaurante' },
                      { title: 'Concerto Jazz', date: '25 Abr, 21:30', loc: 'Lounge' },
                    ].map((ev, i) => (
                      <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase">{ev.date}</p>
                        <h5 className="text-sm font-bold text-slate-800 mt-1">{ev.title}</h5>
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                          {ev.loc}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      setShowCalendar(false);
                      onAddEvent();
                    }}
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all text-sm"
                  >
                    Novo Evento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
