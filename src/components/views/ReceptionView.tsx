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

export function ReceptionView({ rooms, bookings, onUpdateBookings, companyConfig, getNextInvoiceNumber, readOnly, currentUser }: { rooms: Room[], bookings: any[], onUpdateBookings: (b: any[]) => void, companyConfig: CompanyConfig, getNextInvoiceNumber: (s: string) => { number: string, series: string }, readOnly?: boolean, currentUser?: UserType | null }) {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [initialBooking, setInitialBooking] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [activeTooltipRoom, setActiveTooltipRoom] = useState<string | null>(null);
  
  // New States for Invoice Management
  const [selectedSeries, setSelectedSeries] = useState(companyConfig.billingSeries?.find(s => s.isDefault)?.id || 'AGT');
  const [isLegalEntity, setIsLegalEntity] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const pendingCheckouts = bookings.filter(b => b.status === 'Check-out Pendente' || b.status === 'Checked In');

  const alerts = pendingCheckouts.map(b => {
    const outTime = new Date(b.out).getTime();
    const now = currentTime.getTime();
    const diff = outTime - now;
    const diffMinutes = Math.floor(diff / (1000 * 60));

    if (diffMinutes <= 0) {
      return { type: 'expired', booking: b, minutes: Math.abs(diffMinutes) };
    } else if (diffMinutes <= 30) {
      return { type: 'approaching', booking: b, minutes: diffMinutes };
    }
    return null;
  }).filter(Boolean) as { type: 'expired' | 'approaching', booking: any, minutes: number }[];

  const isDirty = JSON.stringify(selectedBooking) !== JSON.stringify(initialBooking);

  const forceCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedBooking(null);
    setInitialBooking(null);
    setShowConfirmClose(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      forceCloseModal();
    }
  }, [isDirty, forceCloseModal]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isModalOpen && isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isModalOpen, isDirty, handleCloseModal]);

  const handleNew = (roomNumber?: string) => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatDateTime = (date: Date) => {
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const h = pad(date.getHours());
      const min = pad(date.getMinutes());
      return `${y}-${m}-${d}T${h}:${min}`;
    };

    const firstAvailableRoom = rooms.find(r => r.status === 'available')?.number || '';
    const newBooking = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      room: roomNumber || firstAvailableRoom,
      in: formatDateTime(now),
      out: formatDateTime(new Date(now.getTime() + 3600000)), // Default 1 hour
      status: 'Confirmado',
      paymentStatus: 'Pendente',
      documentId: '',
      phone: ''
    };
    setSelectedBooking(newBooking);
    setInitialBooking(newBooking);
    setIsModalOpen(true);
  };

  const handleRoomClick = (room: Room) => {
    if (room.status === 'occupied') {
      if (activeTooltipRoom === room.number) {
        // If clicking again, open the full edit modal
        const activeBooking = bookings.find(b => 
          b.room === room.number && 
          (b.status === 'Checked In' || b.status === 'Confirmado' || b.status === 'Check-out Pendente')
        );
        if (activeBooking) {
          handleEdit(activeBooking);
        }
        setActiveTooltipRoom(null);
      } else {
        setActiveTooltipRoom(room.number);
      }
    } else if (room.status === 'available') {
      handleNew(room.number);
    }
  };

  const handleEdit = (booking: any) => {
    const b = { ...booking };
    setSelectedBooking(b);
    setInitialBooking(b);
    setIsModalOpen(true);
  };


  const handleVoid = () => {
    const msg = selectedBooking.paymentStatus === 'Pago' 
      ? 'Deseja processar a devolução de valores e anular esta fatura?' 
      : 'Tem certeza que deseja anular esta fatura/reserva?';
    if (window.confirm(msg)) {
      const updatedBookings = bookings.map(b => 
        b.id === selectedBooking.id ? { ...b, status: 'cancelled' } : b
      );
      onUpdateBookings(updatedBookings);
      setIsModalOpen(false);
      setShowInvoice(false);
    }
  };

  const handlePrintReservationInvoice = () => {
    if (!selectedBooking) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const baseAmount = calculateTotal(selectedBooking);
    const netAmount = baseAmount / (1 + (selectedBooking.taxConfig?.rate || 14) / 100);
    const taxAmount = baseAmount - netAmount;
    const withholding = selectedBooking.withholdingAmount || 0;
    const finalTotal = baseAmount - withholding;

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura de Reserva - ${selectedBooking.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .company-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
            .company-info p { margin: 2px 0; font-size: 12px; color: #64748b; }
            .invoice-title { text-align: right; }
            .invoice-title h2 { margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
            .invoice-title p { margin: 2px 0; font-size: 12px; color: #94a3b8; font-weight: bold; }
            
            .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .section-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
            .client-info p { margin: 2px 0; font-size: 14px; font-weight: 700; color: #334155; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f8fafc; padding: 12px 15px; text-align: left; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
            td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; vertical-align: top; }
            .text-right { text-align: right; }
            
            .totals { margin-left: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
            .total-row.grand-total { border-top: 2px solid #0f172a; margin-top: 10px; padding-top: 15px; font-weight: 900; font-size: 16px; color: #0f172a; }
            .withholding { color: #dc2626; }

            .footer { margin-top: 60px; text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 20px; font-size: 10px; color: #94a3b8; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>${companyConfig.name}</h1>
              <p>NIF: ${companyConfig.nif}</p>
              <p>${companyConfig.address}</p>
            </div>
            <div class="invoice-title">
              <h2>${selectedBooking.invoiceNumber ? 'Fatura' : 'Fatura Proforma'}</h2>
              <p>${selectedBooking.invoiceNumber || 'Processada por Computador'}</p>
              <p>Série: ${selectedBooking.invoiceSeries || 'N/A'}</p>
              <p>Data: ${new Date().toLocaleDateString('pt-PT')}</p>
            </div>
          </div>

          <div class="details-grid">
            <div class="client-info">
              <div class="section-label">Cliente / Hóspede</div>
              <p>${selectedBooking.name}</p>
              <p>Doc: ${selectedBooking.documentId || 'N/A'}</p>
              <p>Tel: ${selectedBooking.phone || 'N/A'}</p>
            </div>
            <div class="client-info text-right">
              <div class="section-label">Detalhes da Estadia</div>
              <p>Quarto ${selectedBooking.room}</p>
              <p>Check-in: ${format(new Date(selectedBooking.in), 'dd/MM/yyyy HH:mm')}</p>
              <p>Check-out: ${format(new Date(selectedBooking.out), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th class="text-right">Valor Base</th>
                <th class="text-right">IVA (${selectedBooking.taxConfig?.rate || 14}%)</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Alojamento - Quarto ${selectedBooking.room}</strong><br/>
                  <small style="color: #64748b">Período de Estadia</small>
                </td>
                <td class="text-right">Kz ${netAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right">Kz ${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right"><strong>Kz ${baseAmount.toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal</span>
              <span>Kz ${baseAmount.toLocaleString()}</span>
            </div>
            ${withholding > 0 ? `
              <div class="total-row withholding">
                <span>Retenção na Fonte (${selectedBooking.withholdingRate}%)</span>
                <span>- Kz ${withholding.toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>TOTAL LÍQUIDO</span>
              <span>Kz ${finalTotal.toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            <p>Software de Gestão Hoteleira validado pela AGT.</p>
            <p>Obrigado pela sua preferência!</p>
          </div>

          <script>
            window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSave = () => {
    // Check for overlapping bookings in the same room
    const newIn = new Date(selectedBooking.in).getTime();
    const newOut = new Date(selectedBooking.out).getTime();

    const hasOverlap = bookings.some(b => {
      // Skip the current booking if we are editing it
      if (b.id === selectedBooking.id) return false;
      // Skip cancelled bookings
      if (b.status === 'Cancelado') return false;
      
      if (b.room === selectedBooking.room) {
        const existingIn = new Date(b.in).getTime();
        const existingOut = new Date(b.out).getTime();
        
        // Overlap condition: (StartA < EndB) and (EndA > StartB)
        return newIn < existingOut && newOut > existingIn;
      }
      return false;
    });

    if (hasOverlap) {
      setOverlapError(`O quarto ${selectedBooking.room} já está ocupado ou reservado para este período.`);
      return;
    }

    let newBookings;
    const total = calculateTotal(selectedBooking);
    
    // New logic for sequencing and withholding
    let withholdingAmount = 0;
    if (isLegalEntity && companyConfig.defaultWithholdingRate) {
      // Automatic calculation of withholding tax
      withholdingAmount = total * (companyConfig.defaultWithholdingRate / 100);
    }

    let finalInvoiceNumber = selectedBooking.invoiceNumber;
    let finalInvoiceSeries = selectedBooking.invoiceSeries;
    
    // Assign numerical sequence only if not already assigned and status is 'Pago' (or 'Checked In')
    if (!finalInvoiceNumber && (selectedBooking.status === 'Checked In' || selectedBooking.paymentStatus === 'Pago')) {
      const { number, series } = getNextInvoiceNumber(selectedSeries);
      finalInvoiceNumber = number;
      finalInvoiceSeries = series;
    }

    const bookingToStore = {
      ...selectedBooking,
      totalAmount: total,
      taxConfig: selectedBooking.taxConfig || TAX_IVA_14,
      withholdingRate: isLegalEntity ? (companyConfig.defaultWithholdingRate || 6.5) : 0,
      withholdingAmount: withholdingAmount,
      invoiceNumber: finalInvoiceNumber,
      invoiceSeries: finalInvoiceSeries,
      user: selectedBooking.user || currentUser?.name || 'Recepcionista Quartos'
    };

    const exists = bookings.find(b => b.id === selectedBooking.id);
    if (exists) {
      newBookings = bookings.map(b => b.id === selectedBooking.id ? bookingToStore : b);
    } else {
      newBookings = [...bookings, bookingToStore];
    }
    onUpdateBookings(newBookings);
    setIsModalOpen(false);
    setSelectedBooking(null);
    setInitialBooking(null);
  };

  const calculateTotal = (booking: any) => {
    const room = rooms.find(r => r.number === booking.room);
    if (!room) return 0;
    const start = new Date(booking.in);
    const end = new Date(booking.out);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60)) || 1;
    return diffHours * room.price;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
          Receção & Check-in
        </h3>
        <div className="flex gap-4">
          {!readOnly && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNew()}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all"
            >
              <Plus size={20} />
              Nova Reserva
            </motion.button>
          )}
          {readOnly && (
            <div className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-400 rounded-xl font-bold border border-slate-200">
              <Lock size={16} />
              Modo Leitura
            </div>
          )}
        </div>
      </div>

      {/* Notifications Section */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            {alerts.map((alert, idx) => (
              <motion.div 
                key={`${alert.booking.id}-${alert.type}`}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center justify-between p-4 rounded-2xl border shadow-sm ${
                  alert.type === 'expired' 
                    ? 'bg-rose-50 border-rose-100 text-rose-800' 
                    : 'bg-amber-50 border-amber-100 text-amber-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${alert.type === 'expired' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                    {alert.type === 'expired' ? <AlertCircle size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {alert.type === 'expired' 
                        ? `TEMPO ESGOTADO: Quarto ${alert.booking.room}` 
                        : `CHECK-OUT PRÓXIMO: Quarto ${alert.booking.room}`}
                    </p>
                    <p className="text-xs opacity-80">
                      Hóspede: <span className="font-bold">{alert.booking.name}</span> • 
                      {alert.type === 'expired' 
                        ? ` Atrasado há ${alert.minutes} min` 
                        : ` Faltam ${alert.minutes} min`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => handleEdit(alert.booking)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    alert.type === 'expired' 
                      ? 'bg-rose-600 text-white hover:bg-rose-700' 
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  Gerir Check-out
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Occupancy Map */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Read Only Warning */}
        {readOnly && (
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3 text-amber-700">
            <Lock size={20} />
            <div>
              <p className="text-sm font-bold tracking-tight">Modo de Apenas Leitura Ativo</p>
              <p className="text-xs opacity-80">As funcionalidades de reserva, check-in e check-out estão bloqueadas temporariamente.</p>
            </div>
          </div>
        )}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <LayoutDashboard size={20} className="text-indigo-600" />
            <h3 className="font-bold text-slate-800">Mapa de Ocupação Interativo</h3>
          </div>
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Livre
            </div>
            <div className="flex items-center gap-1.5 text-indigo-600">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              Ocupado
            </div>
            <div className="flex items-center gap-1.5 text-orange-600">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              Manutenção
            </div>
          </div>
        </div>
        <div className="p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {rooms.map((room) => {
            const isOccupied = room.status === 'occupied';
            const isMaintenance = room.status === 'maintenance';
            const isAvailable = room.status === 'available';
            
            return (
              <motion.div 
                key={room.number}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleRoomClick(room)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative group ${
                  isAvailable ? 'border-emerald-100 bg-emerald-50/30 text-emerald-700 hover:border-emerald-400 hover:bg-white hover:shadow-xl hover:shadow-emerald-100' :
                  isOccupied ? 'border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:border-indigo-400 hover:bg-white hover:shadow-xl hover:shadow-indigo-100' :
                  'border-orange-100 bg-orange-50/30 text-orange-700 hover:border-orange-400 hover:bg-white hover:shadow-xl hover:shadow-orange-100'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="font-black text-xl tracking-tight">{room.number}</span>
                  <div className={`p-1.5 rounded-lg ${
                    isAvailable ? 'bg-emerald-100' : isOccupied ? 'bg-indigo-100' : 'bg-orange-100'
                  }`}>
                    <Bed size={14} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-black tracking-tighter opacity-60">{room.type}</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      isAvailable ? 'bg-emerald-500' : isOccupied ? 'bg-indigo-500' : 'bg-orange-500'
                    }`}></div>
                    <p className="text-xs font-bold">
                      {isAvailable ? 'Disponível' : isOccupied ? 'Ocupado' : 'Manutenção'}
                    </p>
                  </div>
                </div>
                
                {/* Quick Action Hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 backdrop-blur-[1px] rounded-2xl">
                  <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-lg ${
                    isAvailable ? 'bg-emerald-600' : isOccupied ? 'bg-indigo-600' : 'bg-orange-600'
                  }`}>
                    {isAvailable ? 'Check-in Rápido' : isOccupied ? 'Ver Detalhes' : 'Gerir Quarto'}
                  </div>
                </div>

                {/* Guest Info Tooltip */}
                <AnimatePresence>
                  {activeTooltipRoom === room.number && isOccupied && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-48 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45" />
                      {(() => {
                        const b = bookings.find(bk => 
                          bk.room === room.number && 
                          (bk.status === 'Checked In' || bk.status === 'Confirmado' || bk.status === 'Check-out Pendente')
                        );
                        if (!b) return <p className="text-[10px] text-slate-400">Sem dados de reserva</p>;
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
                                {b.name.charAt(0)}
                              </div>
                              <p className="text-xs font-bold truncate">{b.name}</p>
                            </div>
                            <div className="h-px bg-white/10" />
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] uppercase tracking-wider text-slate-400">Pagamento</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                b.paymentStatus === 'Pago' ? 'bg-emerald-500/20 text-emerald-400' :
                                b.paymentStatus === 'Parcial' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-rose-500/20 text-rose-400'
                              }`}>
                                {b.paymentStatus || 'Pendente'}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-500 text-center pt-1 italic">Clique novamente para gerir</p>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <Calendar size={20} className="text-slate-400" />
          <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Lista de Reservas Recentes</h4>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hóspede</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quarto</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Entrada</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Saída</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assinatura</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pagamento</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((booking, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                      {booking.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-slate-900">{booking.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-600">{booking.room}</td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {booking.in.replace('T', ' ')}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {booking.out.replace('T', ' ')}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    booking.status === 'Checked In' ? 'bg-emerald-100 text-emerald-700' :
                    booking.status === 'Confirmado' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {booking.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <SignatureBadge signature={booking.signature} />
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    booking.paymentStatus === 'Pago' ? 'bg-emerald-100 text-emerald-700' :
                    booking.paymentStatus === 'Parcial' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {booking.paymentStatus || 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleEdit(booking)}
                    className="text-indigo-600 font-bold text-sm hover:text-indigo-800"
                  >
                    Gerir
                  </motion.button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      {/* Edit / Nova Reserva Modal */}
      <AnimatePresence>
        {isModalOpen && selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            >
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-base sm:text-lg font-bold">
                    {!selectedBooking.name ? "Nova Reserva" : "Gerir Reserva"}
                  </h3>
                  <SignatureBadge signature={selectedBooking.signature} />
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
                {/* Linha 1: Dados do Hóspede */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <User size={13} />
                      Nome do Hóspede
                    </label>
                    <input 
                      type="text" 
                      value={selectedBooking.name}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, name: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      placeholder="Nome completo"
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <IdCard size={13} />
                      BI / Passaporte
                    </label>
                    <input 
                      type="text" 
                      value={selectedBooking.documentId || ''}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, documentId: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                      placeholder="001234567LA045"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={13} />
                      Contacto / Telefone
                    </label>
                    <input 
                      type="text" 
                      value={selectedBooking.phone || ''}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, phone: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                      placeholder="+244 9XX XXX XXX"
                    />
                  </div>
                </div>

                {/* Linha 2: Check-in e Check-out */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={13} />
                      Check-in (Data & Hora)
                    </label>
                    <input 
                      type="datetime-local" 
                      value={selectedBooking.in}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, in: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-xs sm:text-sm rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={13} />
                      Check-out (Data & Hora)
                    </label>
                    <input 
                      type="datetime-local" 
                      value={selectedBooking.out}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, out: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-xs sm:text-sm rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    />
                  </div>
                </div>

                {/* Linha 3: Quarto, Status e Pagamento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Bed size={13} />
                      Quarto
                    </label>
                    <select 
                      value={selectedBooking.room}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, room: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm appearance-none rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    >
                      {rooms.filter(r => {
                        if (r.status === 'maintenance') return false;

                        const newIn = new Date(selectedBooking.in).getTime();
                        const newOut = new Date(selectedBooking.out).getTime();
                        
                        const hasConflict = bookings.some(b => {
                          if (b.id === selectedBooking.id) return false;
                          if (b.status === 'cancelled' || b.status === 'Cancelado') return false;
                          if (b.room !== r.number) return false;
                          
                          const existingIn = new Date(b.in).getTime();
                          const existingOut = new Date(b.out).getTime();
                          
                          return newIn < existingOut && newOut > existingIn;
                        });
                        
                        return !hasConflict;
                      }).map(r => (
                        <option key={r.number} value={r.number}>
                          Quarto {r.number} ({r.type.charAt(0).toUpperCase() + r.type.slice(1)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle size={13} />
                      Status da Reserva
                    </label>
                    <select 
                      value={selectedBooking.status}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, status: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm appearance-none rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    >
                      <option value="Confirmado">Confirmado</option>
                      <option value="Checked In">Checked In</option>
                      <option value="Check-out Pendente">Check-out Pendente</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={13} />
                      Status Pagamento
                    </label>
                    <select 
                      value={selectedBooking.paymentStatus || 'Pendente'}
                      onChange={(e) => setSelectedBooking({ ...selectedBooking, paymentStatus: e.target.value })}
                      disabled={selectedBooking.paymentStatus === 'Pago'}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm appearance-none rounded-xl ${selectedBooking.paymentStatus === 'Pago' ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Parcial">Parcial</option>
                      <option value="Pago">Pago</option>
                    </select>
                  </div>
                </div>

                {/* Linha 4: Série de Faturação e Entidade Jurídica */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={13} />
                      Série de Faturação
                    </label>
                    <select 
                      value={selectedSeries}
                      onChange={(e) => setSelectedSeries(e.target.value)}
                      disabled={!!selectedBooking.invoiceNumber}
                      className={`w-full py-2 px-3 border-2 transition-all outline-none font-medium text-sm appearance-none rounded-xl ${selectedBooking.invoiceNumber ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-transparent focus:border-indigo-500 focus:bg-white'}`}
                    >
                      {companyConfig.billingSeries?.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200/80 rounded-xl h-[42px]">
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox" 
                        checked={isLegalEntity}
                        onChange={(e) => setIsLegalEntity(e.target.checked)}
                        disabled={selectedBooking.paymentStatus === 'Pago'}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">Entidade Jurídica (Retenção)</span>
                  </div>
                </div>

                {/* Resumo de Valores Compacto */}
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Preço do Quarto</p>
                      <p className="text-sm font-black text-indigo-700 leading-tight mt-0.5">
                        {companyConfig.currency}{rooms.find(r => r.number === selectedBooking.room)?.price || 0} 
                        <span className="text-xs font-normal opacity-60 ml-1">/ hora</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Total Líquido</p>
                    <p className="text-base sm:text-lg font-black text-indigo-600 leading-tight mt-0.5">
                      {companyConfig.currency}{(() => {
                        const base = calculateTotal(selectedBooking);
                        if (isLegalEntity && companyConfig.defaultWithholdingRate) {
                          return (base - (base * companyConfig.defaultWithholdingRate / 100)).toLocaleString();
                        }
                        return base.toLocaleString();
                      })()}
                    </p>
                    {isLegalEntity && (
                       <p className="text-[9px] font-bold text-rose-500 uppercase tracking-tight">
                         Retenção {companyConfig.defaultWithholdingRate}%: {companyConfig.currency}{(calculateTotal(selectedBooking) * companyConfig.defaultWithholdingRate! / 100).toLocaleString()}
                       </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rodapé de Ações */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3 shrink-0">
                {!readOnly && (
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(254, 226, 226, 1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleVoid}
                    className="flex-1 py-2.5 text-rose-600 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    {selectedBooking.paymentStatus === 'Pago' ? <DollarSign size={16} /> : <Trash2 size={16} />}
                    {selectedBooking.paymentStatus === 'Pago' ? "Devolução" : "Anular"}
                  </motion.button>
                )}
                <motion.button 
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(241, 245, 249, 1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowInvoice(true)}
                  className="flex-1 py-2.5 text-slate-600 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <FileText size={16} />
                  Fatura
                </motion.button>
                {!readOnly && selectedBooking.paymentStatus !== 'Pago' && (
                  <motion.button 
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(4, 120, 87, 1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
                    className="flex-[2] py-2.5 bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Save size={16} />
                    Guardar
                  </motion.button>
                )}
                {readOnly && (
                   <div className="flex-[2] py-2.5 bg-slate-200 text-slate-500 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 border border-slate-300">
                    <Lock size={16} />
                    Bloqueado (Leitura)
                   </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog for Unsaved Changes */}
      <AnimatePresence>
        {showConfirmClose && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmClose(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Alterações não guardadas</h4>
              <p className="text-slate-500 mb-8">Tem a certeza que deseja sair? Todas as alterações feitas serão perdidas.</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowConfirmClose(false)}
                  className="py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Continuar a Editar
                </button>
                <button 
                  onClick={forceCloseModal}
                  className="py-3 px-4 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
                >
                  Sair sem Guardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Overlap Alert Modal */}
      <AnimatePresence>
        {overlapError && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOverlapError(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Quarto Ocupado</h4>
              <p className="text-slate-500 mb-8">{overlapError}</p>
              <button 
                onClick={() => setOverlapError(null)}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Modal */}
      <AnimatePresence>
        {showInvoice && selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInvoice(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedBooking.invoiceNumber ? 'FATURA' : 'FATURA PROFORMA'}</h2>
                  <p className="text-slate-500 font-medium">{selectedBooking.invoiceNumber || `#${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`}</p>
                </div>
                <button onClick={() => setShowInvoice(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emitido por</p>
                    <p className="text-lg font-black text-slate-900">{companyConfig.name}</p>
                    <div className="text-sm text-slate-500 leading-relaxed">
                      <p>NIF: {companyConfig.nif}</p>
                      <p>{companyConfig.address}</p>
                      <p>Tel: {companyConfig.phone}</p>
                      <p>{companyConfig.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Faturado a</p>
                    <p className="text-lg font-black text-slate-900">{selectedBooking.name}</p>
                    <div className="text-sm text-slate-500 leading-relaxed">
                      <p>Doc: {selectedBooking.documentId || 'N/A'}</p>
                      <p>Tel: {selectedBooking.phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase text-[10px] tracking-widest">Descrição</th>
                        <th className="px-6 py-4 text-center font-bold text-slate-500 uppercase text-[10px] tracking-widest">Qtd/Horas</th>
                        <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">Preço Unit.</th>
                        <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr>
                        <td className="px-6 py-6">
                          <p className="font-bold text-slate-900">Alojamento - Quarto {selectedBooking.room}</p>
                          <p className="text-xs text-slate-400 mt-1">Período: {selectedBooking.in.replace('T', ' ')} a {selectedBooking.out.replace('T', ' ')}</p>
                          {selectedBooking.taxConfig?.rate === 0 && (
                            <p className="text-[10px] text-slate-400 mt-1 italic">
                              Isento: {selectedBooking.taxConfig.exemptionCode} - {selectedBooking.taxConfig.exemptionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-6 text-center font-medium text-slate-600">
                          {Math.ceil(Math.abs(new Date(selectedBooking.out).getTime() - new Date(selectedBooking.in).getTime()) / (1000 * 60 * 60)) || 1}
                        </td>
                        <td className="px-6 py-6 text-right font-medium text-slate-600">
                          {companyConfig.currency}{((rooms.find(r => r.number === selectedBooking.room)?.price || 0) / (1 + (selectedBooking.taxConfig?.rate || 14) / 100)).toFixed(2)}
                        </td>
                        <td className="px-6 py-6 text-right font-black text-slate-900">
                          {companyConfig.currency}{(calculateTotal(selectedBooking) / (1 + (selectedBooking.taxConfig?.rate || 14) / 100)).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Base Tributável</td>
                        <td className="px-6 py-3 text-right font-bold text-slate-600">
                          {companyConfig.currency}{(calculateTotal(selectedBooking) / (1 + (selectedBooking.taxConfig?.rate || 14) / 100)).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">IVA ({selectedBooking.taxConfig?.rate || 14}%)</td>
                        <td className="px-6 py-3 text-right font-bold text-emerald-600">
                          {companyConfig.currency}{(calculateTotal(selectedBooking) - (calculateTotal(selectedBooking) / (1 + (selectedBooking.taxConfig?.rate || 14) / 100))).toFixed(2)}
                        </td>
                      </tr>
                      {selectedBooking.withholdingAmount > 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-3 text-right text-xs font-bold text-rose-500 uppercase tracking-widest">Retenção na Fonte ({selectedBooking.withholdingRate}%)</td>
                          <td className="px-6 py-3 text-right font-bold text-rose-600">
                            -{companyConfig.currency}{selectedBooking.withholdingAmount.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white">
                      <tr>
                        <td colSpan={3} className="px-6 py-6 text-right font-bold uppercase text-xs tracking-widest opacity-70">Total Líquido</td>
                        <td className="px-6 py-6 text-right text-xl font-black">
                          {companyConfig.currency}{(calculateTotal(selectedBooking) - (selectedBooking.withholdingAmount || 0)).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                  <div className="flex gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleVoid}
                      className="px-6 py-3 bg-rose-100 text-rose-700 rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                      {selectedBooking.paymentStatus === 'Pago' ? <DollarSign size={18} /> : <Trash2 size={18} />}
                      {selectedBooking.paymentStatus === 'Pago' ? "Devolução de Valores" : "Anular Fatura"}
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                      <Download size={18} />
                      Download
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePrintReservationInvoice}
                      className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                      <Printer size={18} />
                      Imprimir
                    </motion.button>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowInvoice(false)}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-indigo-100"
                  >
                    Confirmar & Fechar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
