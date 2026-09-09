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

export function BarStockView({ menu, setMenu, companyConfig, addInventoryLog, onEditItem, onDeleteItem }: { 
  menu: any, 
  setMenu: (menu: any) => void, 
  companyConfig: CompanyConfig,
  addInventoryLog: (action: string, itemName: string, details: string) => void,
  onEditItem: (cat: string, item: any) => void,
  onDeleteItem: (cat: string, id: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showReplenishment, setShowReplenishment] = useState(false);

  const handleUpdateStock = (cat: string, id: string, newStock: number) => {
    const itemToUpdate = menu[cat]?.find((i: any) => i.id === id);
    const updatedMenu = { ...menu };
    updatedMenu[cat] = updatedMenu[cat].map((item: any) => 
      item.id === id ? { ...item, stock: Math.max(0, newStock) } : item
    );
    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    if (itemToUpdate) {
      addInventoryLog('Ajuste de Stock', itemToUpdate.name, `Novo Stock: ${Math.max(0, newStock)} (Anterior: ${itemToUpdate.stock})`);
    }
  };

  const allItems = Object.entries(menu).flatMap(([cat, items]: [string, any]) => 
    items.map((item: any) => ({ ...item, cat }))
  );

  const filteredItems = allItems.filter((item: any) => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.cat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = allItems.filter((item: any) => item.stock < 10);

  return (
    <div className="space-y-6">
      {/* Low Stock Alerts Section */}
      <AnimatePresence>
        {lowStockItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-rose-50 border border-rose-100 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-rose-800">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm uppercase tracking-widest">Alertas de Stock Baixo</h4>
                  <p className="text-xs opacity-80">Existem {lowStockItems.length} produtos que necessitam de reposição imediata.</p>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowReplenishment(true)}
                className="px-6 py-2 bg-rose-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-rose-200"
              >
                Gerar Pedido de Reposição
              </motion.button>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.slice(0, 5).map(item => (
                <div key={item.id} className="px-3 py-1.5 bg-white/50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  {item.name}: {item.stock} un.
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <div className="px-3 py-1.5 bg-white/50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-700">
                  + {lowStockItems.length - 5} outros
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-900">Gestão de Inventário</h3>
          <p className="text-sm text-slate-500">Controlo de stock e reposição de produtos</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Procurar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Produto</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Preço (Custo/Venda)</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Stock Atual</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center">
                        <img src={item.img} alt={item.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-bold text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {item.cat}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900">Venda: {companyConfig.currency}{item.price.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Custo: {companyConfig.currency}{(item.costPrice || 0).toFixed(2)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        value={item.stock}
                        onChange={(e) => handleUpdateStock(item.cat, item.id, parseInt(e.target.value) || 0)}
                        className="w-16 p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-center focus:ring-1 focus:ring-orange-500"
                      />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.unit || 'unid.'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.stock <= (item.minStock || 3) ? (
                      <span className="flex items-center gap-1.5 text-rose-600 text-xs font-bold">
                        <AlertCircle size={14} />
                        Crítico
                      </span>
                    ) : item.stock < 10 ? (
                      <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                        <Clock size={14} />
                        Baixo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                        <CheckCircle2 size={14} />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => handleUpdateStock(item.cat, item.id, item.stock - 1)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <button 
                        onClick={() => handleUpdateStock(item.cat, item.id, item.stock + 1)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>
                      <button 
                        onClick={() => onEditItem(item.cat, item)}
                        className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm('Eliminar este produto do inventário?')) {
                            onDeleteItem(item.cat, item.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replenishment Request Modal */}
      <AnimatePresence>
        {showReplenishment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReplenishment(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-600 text-white">
                <div className="flex items-center gap-3">
                  <Download size={24} />
                  <h3 className="text-xl font-bold">Pedido de Reposição</h3>
                </div>
                <button 
                  onClick={() => setShowReplenishment(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8">
                <div className="mb-6 p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3">
                  <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-bold text-rose-900">Documento de Requisição Interna</p>
                    <p className="text-xs text-rose-700">Este documento lista todos os itens com stock abaixo de 10 unidades para aprovação de compra.</p>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white overflow-hidden border border-slate-200 flex items-center justify-center">
                          <img src={item.img} alt={item.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.cat}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-rose-600">{item.stock} un.</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock Atual</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex gap-4">
                  <button 
                    onClick={() => setShowReplenishment(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      alert('Pedido de reposição enviado para a administração com sucesso!');
                      setShowReplenishment(false);
                    }}
                    className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Printer size={20} />
                    Imprimir & Enviar
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
