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

export function LeisureView({ events, onUpdateEvents, companyConfig, getNextInvoiceNumber, readOnly, currentUser }: { events: any[], onUpdateEvents: (events: any[]) => void, companyConfig: CompanyConfig, getNextInvoiceNumber: (s: string) => { number: string, series: string }, readOnly?: boolean, currentUser?: UserType | null }) {
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [eventLocation, setEventLocation] = useState('Salão de Festas');
  const [eventPrice, setEventPrice] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [organizer, setOrganizer] = useState('');
  const [isLastMinute, setIsLastMinute] = useState(false);
  
  // Sequence and Withholding States
  const [selectedSeries, setSelectedSeries] = useState(companyConfig.billingSeries?.find(s => s.isDefault)?.id || 'AGT');
  const [isLegalEntity, setIsLegalEntity] = useState(false);
  const [penaltyPercentage, setPenaltyPercentage] = useState<number>(15);
  const [selectedArea, setSelectedArea] = useState<any | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [eventToInvoice, setEventToInvoice] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetailedEvent, setSelectedDetailedEvent] = useState<any | null>(null);
  const [areas, setAreas] = useState([
    { id: 'a1', name: 'Piscina Infinita', status: 'Aberto', icon: <Palmtree />, color: 'bg-cyan-50 text-cyan-700' },
    { id: 'a2', name: 'Pista de Dança', status: 'Reservado', icon: <Users />, color: 'bg-purple-50 text-purple-700' },
    { id: 'a3', name: 'Salão de Festas', status: 'Livre', icon: <Calendar />, color: 'bg-rose-50 text-rose-700' },
  ]);

  const handleAddEvent = () => {
    setError(null);
    if (!eventName || !eventDate || eventPrice <= 0) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const today = startOfDay(new Date());
    const selectedDate = startOfDay(new Date(eventDate));
    const selectedEndDate = startOfDay(new Date(eventEndDate || eventDate));
    
    if (isAfter(today, selectedDate)) {
      setError('A data do evento não pode estar no passado.');
      return;
    }

    if (isAfter(selectedDate, selectedEndDate)) {
      setError('A data de término não pode ser anterior à data de início.');
      return;
    }

    // Overlap Check
    const startDateTime = new Date(`${eventDate}T${startTime}`);
    const endDateTime = new Date(`${eventEndDate || eventDate}T${endTime}`);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      setError('Data ou horário inválido.');
      return;
    }

    if (isAfter(startDateTime, endDateTime)) {
      setError('O horário de término não pode ser anterior ao horário de início.');
      return;
    }

    const hasOverlap = events.some(event => {
      if (event.location !== eventLocation) return false;
      
      const d = new Date(event.date);
      const ed = new Date(event.endDate || event.date);
      if (isNaN(d.getTime()) || isNaN(ed.getTime())) return false;

      const existingStart = new Date(`${format(d, 'yyyy-MM-dd')}T${event.startTime || '00:00'}`);
      const existingEnd = new Date(`${format(ed, 'yyyy-MM-dd')}T${event.endTime || '23:59'}`);
      
      if (isNaN(existingStart.getTime()) || isNaN(existingEnd.getTime())) return false;

      return areIntervalsOverlapping(
        { start: startDateTime, end: endDateTime },
        { start: existingStart, end: existingEnd }
      );
    });

    if (hasOverlap) {
      const msg = 'Já existe um evento agendado para este local neste horário.';
      setError(msg);
      setShowAlertModal(true);
      return;
    }

    const penaltyFee = isLastMinute ? eventPrice * (penaltyPercentage / 100) : 0;
    const finalPrice = eventPrice + penaltyFee;

    if (paidAmount > finalPrice) {
      setError('O valor pago não pode ser superior ao preço total (incluindo multa).');
      return;
    }

    // Assign numerical sequence and calculate withholding
    const { number: invNum, series: invSer } = getNextInvoiceNumber(selectedSeries);
    let withholdingAmount = 0;
    if (isLegalEntity && companyConfig.defaultWithholdingRate) {
      withholdingAmount = finalPrice * (companyConfig.defaultWithholdingRate / 100);
    }

    const newEvent = {
      id: Math.random().toString(36).substr(2, 9),
      name: eventName,
      organizer: organizer,
      date: new Date(eventDate).toISOString(),
      endDate: eventEndDate ? new Date(eventEndDate).toISOString() : new Date(eventDate).toISOString(),
      startTime: startTime,
      endTime: endTime,
      location: eventLocation,
      price: finalPrice,
      basePrice: eventPrice,
      penaltyFee: penaltyFee,
      paidAmount: paidAmount,
      status: paidAmount >= finalPrice ? 'Pago' : 'Parcial',
      taxConfig: TAX_IVA_14,
      invoiceNumber: invNum,
      invoiceSeries: invSer,
      withholdingRate: isLegalEntity ? companyConfig.defaultWithholdingRate : 0,
      withholdingAmount: withholdingAmount,
      user: currentUser?.name || 'Gestor Eventos'
    };
    onUpdateEvents([...events, newEvent]);
    setEventToInvoice(newEvent);
    setShowInvoice(true);
    setEventName('');
    setOrganizer('');
    setEventDate('');
    setEventEndDate('');
    setStartTime('08:00');
    setEndTime('18:00');
    setEventPrice(0);
    setPaidAmount(0);
    setIsLastMinute(false);
  };

  const handleUpdatePayment = (eventId: string, additionalAmount: number) => {
    let updatedEventObj = null;
    const updatedEvents = events.map(event => {
      if (event.id === eventId) {
        const newPaidAmount = (event.paidAmount || 0) + additionalAmount;
        updatedEventObj = {
          ...event,
          paidAmount: Math.min(newPaidAmount, event.price),
          status: newPaidAmount >= event.price ? 'Pago' : 'Parcial'
        };
        return updatedEventObj;
      }
      return event;
    });
    onUpdateEvents(updatedEvents);
    if (updatedEventObj) {
      setEventToInvoice(updatedEventObj);
      setShowInvoice(true);
    }
  };

  const handleCancelEventFromInvoice = (eventId: string) => {
    if (window.confirm('Tem a certeza que deseja cancelar este evento?')) {
      const updatedEvents = events.filter(e => e.id !== eventId);
      onUpdateEvents(updatedEvents);
      setShowInvoice(false);
      setEventToInvoice(null);
    }
  };

  const handlePrintInvoice = () => {
    if (!eventToInvoice) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const netPrice = (eventToInvoice.price) / (1 + (eventToInvoice.taxConfig?.rate || 14) / 100);
    const taxAmount = eventToInvoice.price - netPrice;

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura de Evento - ${eventToInvoice.name}</title>
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
            .total-row.paid { color: #059669; }
            .total-row.due { color: #dc2626; border-top: 1px solid #fee2e2; margin-top: 5px; }

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
              <h2>Fatura de Evento</h2>
              <p>${eventToInvoice.invoiceNumber || 'Proforma'}</p>
              <p>Série: ${eventToInvoice.invoiceSeries || 'N/A'}</p>
              <p>Data: ${new Date().toLocaleDateString('pt-PT')}</p>
            </div>
          </div>

          <div class="details-grid">
            <div class="client-info">
              <div class="section-label">Organizador / Cliente</div>
              <p>${eventToInvoice.organizer || 'Consumidor Final'}</p>
            </div>
            <div class="client-info text-right">
              <div class="section-label">Detalhes do Evento</div>
              <p>${eventToInvoice.name}</p>
              <p>${eventToInvoice.location}</p>
              <p>${format(new Date(eventToInvoice.date), 'dd/MM/yyyy')}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th class="text-right">Valor Base</th>
                <th class="text-right">IVA (${eventToInvoice.taxConfig?.rate || 14}%)</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${eventToInvoice.name}</strong><br/>
                  <small style="color: #64748b">${eventToInvoice.location} | ${eventToInvoice.startTime} - ${eventToInvoice.endTime}</small>
                  ${eventToInvoice.penaltyFee > 0 ? `<br/><small style="color: #ef4444">+ Taxa Reserva Antecipada: Kz ${eventToInvoice.penaltyFee.toLocaleString()}</small>` : ''}
                  ${eventToInvoice.taxConfig?.rate === 0 ? `<br/><small style="color: #94a3b8">Isenção: ${eventToInvoice.taxConfig.exemptionCode}</small>` : ''}
                </td>
                <td class="text-right">Kz ${netPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right">Kz ${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="text-right"><strong>Kz ${eventToInvoice.price.toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Valor Total</span>
              <span>Kz ${eventToInvoice.price.toLocaleString()}</span>
            </div>
            <div class="total-row paid">
              <span>Total Pago</span>
              <span>Kz ${eventToInvoice.paidAmount.toLocaleString()}</span>
            </div>
            ${eventToInvoice.withholdingAmount > 0 ? `
              <div class="total-row" style="color: #6d28d9">
                <span>Retenção na Fonte (${eventToInvoice.withholdingRate}%)</span>
                <span>- Kz ${eventToInvoice.withholdingAmount.toLocaleString()}</span>
              </div>
            ` : ''}
            ${eventToInvoice.price > eventToInvoice.paidAmount ? `
              <div class="total-row due font-bold">
                <span>Saldo em Dívida</span>
                <span>Kz ${(eventToInvoice.price - eventToInvoice.paidAmount).toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>TOTAL</span>
              <span>Kz ${eventToInvoice.price.toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            <p>Este documento não serve de fatura definitiva. Software validado pela AGT.</p>
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

  const handleDownloadInvoice = () => {
    if (!eventToInvoice) return;
    
    // For download, we'll generate a simple text representation or HTML as a file
    const netPrice = (eventToInvoice.price) / (1 + (eventToInvoice.taxConfig?.rate || 14) / 100);
    const taxAmount = eventToInvoice.price - netPrice;
    
    const content = `
FATURA DE EVENTO #${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}
--------------------------------------------------
EMISSOR: ${companyConfig.name}
NIF: ${companyConfig.nif}
ENDEREÇO: ${companyConfig.address}

CLIENTE: ${eventToInvoice.organizer || 'Consumidor Final'}
EVENTO: ${eventToInvoice.name}
DATA: ${format(new Date(eventToInvoice.date), 'dd/MM/yyyy')}
LOCAL: ${eventToInvoice.location}

DESCRICAO                      VALOR BASE    IVA      TOTAL
--------------------------------------------------
${eventToInvoice.name.padEnd(30)} Kz ${netPrice.toFixed(2).padStart(10)} Kz ${taxAmount.toFixed(2).padStart(8)} Kz ${eventToInvoice.price.toFixed(2).padStart(10)}

TOTAL PAGO: Kz ${eventToInvoice.paidAmount.toLocaleString()}
SALDO DEVEDOR: Kz ${(eventToInvoice.price - eventToInvoice.paidAmount).toLocaleString()}
--------------------------------------------------
Obrigado pela preferência!
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fatura_Evento_${eventToInvoice.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFreePeriods = (location: string) => {
    const today = startOfDay(new Date());
    const next90Days = Array.from({ length: 90 }, (_, i) => addDays(today, i));
    const bookedDates = events
      .filter(e => e.location === location)
      .map(e => {
        const d = new Date(e.date);
        return !isNaN(d.getTime()) ? format(d, 'yyyy-MM-dd') : null;
      })
      .filter(Boolean) as string[];

    const freeDates = next90Days.filter(date => !bookedDates.includes(format(date, 'yyyy-MM-dd')));
    
    // Group consecutive free dates into periods
    const periods: { start: Date, end: Date }[] = [];
    if (freeDates.length === 0) return [];

    let currentPeriod = { start: freeDates[0], end: freeDates[0] };
    for (let i = 1; i < freeDates.length; i++) {
      if (differenceInDays(freeDates[i], freeDates[i-1]) === 1) {
        currentPeriod.end = freeDates[i];
      } else {
        periods.push(currentPeriod);
        currentPeriod = { start: freeDates[i], end: freeDates[i] };
      }
    }
    periods.push(currentPeriod);
    return periods.slice(0, 5); // Show only next 5 free periods
  };

  const getOccupiedPeriods = (location: string) => {
    return events
      .filter(e => e.location === location)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5); // Show next 5 occupied periods
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
        <div className="w-2 h-8 bg-rose-500 rounded-full"></div>
        Áreas de Lazer & Eventos
      </h3>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-indigo-600" size={20} />
            Mapa de Disponibilidade (Próximos 90 dias)
          </h3>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCalendar(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm border border-indigo-100"
          >
            <Calendar size={16} />
            Ver Calendário
          </motion.button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {areas.map(area => {
            const freePeriods = getFreePeriods(area.name);
            const occupiedPeriods = getOccupiedPeriods(area.name);
            return (
              <div key={area.id} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${area.color}`}>
                    {React.cloneElement(area.icon as React.ReactElement, { size: 16 })}
                  </div>
                  <p className="font-bold text-sm text-slate-900">{area.name}</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Próximas Datas Livres</p>
                    {freePeriods.length > 0 ? (
                      freePeriods.map((period, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-emerald-100/40 rounded-xl border border-emerald-200">
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-emerald-600" />
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Livre</span>
                          </div>
                          <p className="text-[11px] font-black text-slate-900">
                            {format(period.start, 'dd/MM')} {differenceInDays(period.end, period.start) > 0 ? `a ${format(period.end, 'dd/MM')}` : ''}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center bg-slate-100 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sem datas livres próximas</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Espaços Ocupados</p>
                    {occupiedPeriods.length > 0 ? (
                      occupiedPeriods.map((event, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-rose-100/40 rounded-xl border border-rose-200">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={12} className="text-rose-600" />
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Ocupado</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-slate-900">
                              {(() => {
                                const d = new Date(event.date);
                                const ed = event.endDate ? new Date(event.endDate) : null;
                                if (isNaN(d.getTime())) return 'Data Inválida';
                                let str = format(d, 'dd/MM');
                                if (ed && !isNaN(ed.getTime()) && event.endDate !== event.date) {
                                  str += ` a ${format(ed, 'dd/MM')}`;
                                }
                                return str;
                              })()}
                            </p>
                            <p className="text-[9px] font-bold text-slate-600 truncate max-w-[100px]">{event.name}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center bg-slate-100 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sem ocupações próximas</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {areas.map((area) => (
          <div key={area.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${area.color}`}>
              {area.icon}
            </div>
            <h4 className="font-bold text-lg text-slate-900">{area.name}</h4>
            <div className="flex items-center justify-between mt-4">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                area.status === 'Aberto' ? 'bg-emerald-100 text-emerald-700' :
                area.status === 'Reservado' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {area.status}
              </span>
              {!readOnly ? (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedArea(area)}
                  className="text-indigo-600 font-bold text-sm"
                >
                  Gerir
                </motion.button>
              ) : (
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-tighter flex items-center gap-1">
                  <Lock size={10} />
                  Bloqueado
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-6">Controle de Acesso & Reservas de Espaço</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div id="new-event-form" className="space-y-4">
            <p className="font-bold text-slate-700">Nova Reserva de Espaço & Faturação</p>
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <input 
              type="text" 
              placeholder="Nome do Evento" 
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
            />
            <input 
              type="text" 
              placeholder="Organizador / Cliente" 
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Início do Evento</label>
                <input 
                  type="date" 
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fim do Evento</label>
                <input 
                  type="date" 
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora de Início</label>
                <input 
                  type="time" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora de Término</label>
                <input 
                  type="time" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Local</label>
                <select 
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                >
                  <option>Salão de Festas</option>
                  <option>Piscina</option>
                  <option>Pista de Dança</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Total (Kz)</label>
                <input 
                  type="number" 
                  placeholder="Preço Total" 
                  value={eventPrice || ''}
                  onChange={(e) => setEventPrice(Number(e.target.value))}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pagamento Inicial (Kz)</label>
                <input 
                  type="number" 
                  placeholder="Valor Pago" 
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold" 
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <input 
                type="checkbox" 
                id="last-minute"
                checked={isLastMinute}
                onChange={(e) => setIsLastMinute(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
              />
              <div className="flex-1">
                <label htmlFor="last-minute" className="text-xs font-bold text-slate-600 cursor-pointer block">
                  Reserva de Última Hora
                </label>
                {isLastMinute && (
                  <p className="text-[10px] text-rose-500 font-bold">Aplica-se uma multa de {penaltyPercentage}% sobre o valor base.</p>
                )}
              </div>
              <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Taxa %</span>
                <input 
                  type="number" 
                  value={penaltyPercentage}
                  onChange={(e) => setPenaltyPercentage(Number(e.target.value))}
                  className="w-12 text-xs font-bold text-slate-700 border-none p-0 focus:ring-0"
                />
              </div>
            </div>
            {isLastMinute && eventPrice > 0 && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Valor Base:</span>
                  <span>Kz{eventPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-rose-600">
                  <span>Multa ({penaltyPercentage}%):</span>
                  <span>+ Kz{(eventPrice * (penaltyPercentage / 100)).toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-rose-200 flex justify-between text-sm font-black text-slate-900">
                  <span>Total Final:</span>
                  <span>Kz{(eventPrice * (1 + penaltyPercentage / 100)).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Série de Faturação</label>
                <select 
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                  className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"
                >
                  {companyConfig.billingSeries?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input 
                  type="checkbox" 
                  id="legal-entity-event"
                  checked={isLegalEntity}
                  onChange={(e) => setIsLegalEntity(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                />
                <label htmlFor="legal-entity-event" className="text-[10px] font-bold text-slate-600 cursor-pointer uppercase tracking-widest leading-tight">
                  Entidade Jurídica<br/>(Retenção na Fonte)
                </label>
              </div>
            </div>

            {!readOnly ? (
              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(190, 18, 60, 1)', boxShadow: "0 20px 25px -5px rgba(225, 29, 72, 0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddEvent}
                className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-100 transition-all flex items-center justify-center gap-2"
              >
                <FileCheck size={20} />
                Confirmar Reserva & Gerar Fatura
              </motion.button>
            ) : (
              <div className="w-full py-3 bg-slate-100 text-slate-400 font-bold rounded-xl text-center border border-slate-200 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                <Lock size={14} />
                Agendamento Bloqueado (Leitura)
              </div>
            )}
          </div>
          <div className="bg-slate-50 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="font-bold text-slate-700">Próximos Eventos & Pagamentos</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                   document.getElementById('new-event-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 uppercase tracking-widest transition-all"
              >
                <Plus size={12} />
                Nova Fatura
              </motion.button>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {events.slice().reverse().map(event => (
                <motion.div 
                  key={event.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedDetailedEvent(event)}
                  className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 space-y-3 cursor-pointer hover:border-rose-200 hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">{event.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {(() => {
                          const d = new Date(event.date);
                          const ed = event.endDate ? new Date(event.endDate) : null;
                          if (isNaN(d.getTime())) return 'Data Inválida';
                          
                          let str = format(d, 'dd/MM/yyyy');
                          if (ed && !isNaN(ed.getTime()) && event.endDate !== event.date) {
                            str += ` a ${format(ed, 'dd/MM/yyyy')}`;
                          }
                          if (event.startTime) {
                            str += ` • ${event.startTime} às ${event.endTime}`;
                          }
                          str += ` • ${event.location}`;
                          return str;
                        })()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                        event.status === 'Pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {event.status}
                      </span>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEventToInvoice(event);
                          setShowInvoice(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-bold shadow-sm hover:bg-slate-800 transition-all uppercase tracking-widest"
                      >
                        <FileText size={10} />
                        Fatura
                      </motion.button>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <SignatureBadge signature={event.signature} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Progresso do Pagamento</span>
                      <span>Kz{event.paidAmount?.toLocaleString()} / Kz{event.price.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(event.paidAmount / event.price) * 100}%` }}
                        className={`h-full ${event.status === 'Pago' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      />
                    </div>
                  </div>

                  {event.status !== 'Pago' && (
                    <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="number"
                        placeholder="Valor"
                        className="flex-1 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = Number((e.target as HTMLInputElement).value);
                            if (val > 0) {
                              handleUpdatePayment(event.id, val);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button 
                        onClick={(e) => {
                          const input = (e.currentTarget.previousSibling as HTMLInputElement);
                          const val = Number(input.value);
                          if (val > 0) {
                            handleUpdatePayment(event.id, val);
                            input.value = '';
                          }
                        }}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold"
                      >
                        Pagar
                      </button>
                      <button 
                        onClick={() => handleUpdatePayment(event.id, event.price - event.paidAmount)}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold"
                      >
                        Pagar Tudo
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAlertModal && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAlertModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Conflito de Horário</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                Já existe um evento agendado para este local neste horário. Por favor, verifique o mapa de disponibilidade ou escolha outro horário/local.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAlertModal(false)}
                className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all"
              >
                Entendido
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCalendar && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCalendar(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Calendário de Eventos</h3>
                    <p className="text-xs font-medium text-slate-500">Visualize todas as ocupações e disponibilidades</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCalendar(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                  {/* Calendar Grid - Simple 35 day view */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="grid grid-cols-7 gap-2">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {day}
                        </div>
                      ))}
                      {Array.from({ length: 35 }, (_, i) => {
                        const date = addDays(startOfDay(new Date()), i - new Date().getDay());
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const dayEvents = events.filter(e => {
                          const startDate = new Date(e.date);
                          const endDate = new Date(e.endDate || e.date);
                          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
                          
                          const start = format(startDate, 'yyyy-MM-dd');
                          const end = format(endDate, 'yyyy-MM-dd');
                          return dateStr >= start && dateStr <= end;
                        });

                        return (
                          <div 
                            key={i} 
                            className={`min-h-[100px] p-2 rounded-xl border transition-all ${
                              format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                                ? 'bg-indigo-50/30 border-indigo-200 ring-2 ring-indigo-100'
                                : 'bg-white border-slate-100'
                            }`}
                          >
                            <p className={`text-xs font-black mb-2 ${
                              format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                                ? 'text-indigo-600'
                                : 'text-slate-400'
                            }`}>
                              {format(date, 'd')}
                            </p>
                            <div className="space-y-1">
                              {dayEvents.map((e, idx) => (
                                <div 
                                  key={idx} 
                                  className={`text-[8px] p-1 rounded font-bold truncate ${
                                    e.location === 'Salão de Festas' ? 'bg-rose-100 text-rose-700' :
                                    e.location === 'Piscina' ? 'bg-cyan-100 text-cyan-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}
                                  title={`${e.name} (${e.startTime} - ${e.endTime})`}
                                >
                                  {e.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legend & Summary */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <h4 className="font-bold text-slate-900 mb-4 text-sm">Legenda de Cores</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                          <span className="text-xs font-bold text-slate-600">Salão de Festas</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                          <span className="text-xs font-bold text-slate-600">Piscina</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                          <span className="text-xs font-bold text-slate-600">Pista de Dança</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
                      <h4 className="font-bold mb-2 text-sm">Resumo Mensal</h4>
                      <p className="text-indigo-100 text-[10px] mb-4 uppercase font-black tracking-widest">Ocupação Total</p>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-black">{events.length}</span>
                        <span className="text-indigo-200 text-xs font-bold mb-1">Eventos Ativos</span>
                      </div>
                      <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                        <div className="bg-white h-full" style={{ width: `${Math.min(100, (events.length / 30) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setShowCalendar(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200"
                >
                  Fechar Calendário
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedArea && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArea(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedArea.color}`}>
                    {selectedArea.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedArea.name}</h3>
                </div>
                <button 
                  onClick={() => setSelectedArea(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Estado Atual</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Aberto', 'Reservado', 'Livre'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setAreas(areas.map(a => a.id === selectedArea.id ? { ...a, status } : a));
                          setSelectedArea({ ...selectedArea, status });
                        }}
                        className={`py-3 rounded-xl text-xs font-bold transition-all ${
                          selectedArea.status === status 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Alterar o estado desta área afetará a visibilidade para novas reservas e o controle de acesso dos hóspedes.
                  </p>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedArea(null)}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all"
                >
                  Concluir Alterações
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDetailedEvent && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDetailedEvent(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 line-clamp-1">{selectedDetailedEvent.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                        selectedDetailedEvent.status === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedDetailedEvent.status}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">#{selectedDetailedEvent.id}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDetailedEvent(null)}
                  className="p-2 hover:bg-white rounded-full transition-colors shadow-sm border border-slate-100"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock size={10} /> Início
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {format(new Date(selectedDetailedEvent.date), 'dd/MM/yyyy')}
                      {selectedDetailedEvent.startTime && ` às ${selectedDetailedEvent.startTime}`}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-end">
                      <Clock size={10} /> Término
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      {format(new Date(selectedDetailedEvent.endDate || selectedDetailedEvent.date), 'dd/MM/yyyy')}
                      {selectedDetailedEvent.endTime && ` às ${selectedDetailedEvent.endTime}`}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-rose-500 shadow-sm border border-slate-100">
                      <Palmtree size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Localização</p>
                      <p className="text-sm font-bold text-slate-700">{selectedDetailedEvent.location}</p>
                    </div>
                  </div>
                  
                  {selectedDetailedEvent.organizer && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                        <User size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organizador</p>
                        <p className="text-sm font-bold text-slate-700">{selectedDetailedEvent.organizer}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo Financeiro</p>
                   <div className="space-y-2">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-500 font-medium tracking-tight">Valor Base</span>
                       <span className="font-bold text-slate-700">Kz{selectedDetailedEvent.basePrice?.toLocaleString() || selectedDetailedEvent.price?.toLocaleString()}</span>
                     </div>
                     {selectedDetailedEvent.penaltyFee > 0 && (
                       <div className="flex justify-between items-center text-sm">
                         <span className="text-rose-500 font-medium tracking-tight">Multa Administrativa</span>
                         <span className="font-bold text-rose-600">+ Kz{selectedDetailedEvent.penaltyFee.toLocaleString()}</span>
                       </div>
                     )}
                     <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                       <span className="text-slate-900 font-black tracking-tight">Total Geral</span>
                       <span className="text-lg font-black text-slate-900">Kz{selectedDetailedEvent.price.toLocaleString()}</span>
                     </div>
                   </div>

                   <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-emerald-700 font-bold">Total Pago</span>
                       <span className="font-black text-emerald-800 text-sm">Kz{selectedDetailedEvent.paidAmount?.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-500 font-bold">Saldo Devedor</span>
                       <span className="font-black text-rose-600 text-sm">Kz{(selectedDetailedEvent.price - (selectedDetailedEvent.paidAmount || 0)).toLocaleString()}</span>
                     </div>
                     <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, ((selectedDetailedEvent.paidAmount || 0) / selectedDetailedEvent.price) * 100)}%` }}
                          className="h-full bg-emerald-500"
                        />
                     </div>
                   </div>
                </div>

                {selectedDetailedEvent.taxConfig && (
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={14} className="text-slate-400" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informação Fiscal</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600">{selectedDetailedEvent.taxConfig.description}</span>
                      <span className="text-xs font-black text-slate-900">{selectedDetailedEvent.taxConfig.rate}%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 flex gap-3 text-center">
                 <button 
                  onClick={() => setSelectedDetailedEvent(null)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl shadow-sm hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                >
                  Fechar
                </button>
                <button 
                  onClick={() => {
                    setEventToInvoice(selectedDetailedEvent);
                    setShowInvoice(true);
                  }}
                  className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
                >
                  Imprimir Fatura
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvoice && eventToInvoice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
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
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Fatura de Evento</h2>
                  <p className="text-slate-500 font-medium tracking-widest">#{Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}</p>
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
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organizador / Cliente</p>
                    <p className="text-lg font-black text-slate-900">{eventToInvoice.organizer || 'Venda Direta'}</p>
                    <p className="text-sm text-slate-500">Evento: {eventToInvoice.name}</p>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase text-[10px] tracking-widest">Descrição</th>
                        <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">Valor Base</th>
                        <th className="px-6 py-4 text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr>
                        <td className="px-6 py-6">
                          <p className="font-bold text-slate-900">{eventToInvoice.name} ({eventToInvoice.location})</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {format(new Date(eventToInvoice.date), 'dd/MM/yyyy')}
                            {eventToInvoice.startTime && ` ${eventToInvoice.startTime} - ${eventToInvoice.endTime}`}
                          </p>
                          {eventToInvoice.penaltyFee > 0 && (
                            <p className="text-[10px] font-bold text-rose-500 mt-1 uppercase tracking-widest">Multa de Reserva: Kz{eventToInvoice.penaltyFee.toLocaleString()}</p>
                          )}
                          {eventToInvoice.taxConfig?.rate === 0 && (
                             <p className="text-[10px] text-slate-400 mt-1 italic">
                               Isento: {eventToInvoice.taxConfig.exemptionCode} - {eventToInvoice.taxConfig.exemptionReason}
                             </p>
                           )}
                        </td>
                        <td className="px-6 py-6 text-right font-medium text-slate-600">
                           Kz{((eventToInvoice.price) / (1 + (eventToInvoice.taxConfig?.rate || 14) / 100)).toFixed(2)}
                        </td>
                        <td className="px-6 py-6 text-right font-black text-slate-900">
                           Kz{(eventToInvoice.price).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-slate-900 text-white">
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-right font-bold uppercase text-[10px] tracking-widest opacity-70">Total Pago</td>
                        <td className="px-6 py-4 text-right text-lg font-black">
                           Kz{eventToInvoice.paidAmount.toLocaleString()}
                        </td>
                      </tr>
                      {eventToInvoice.price > eventToInvoice.paidAmount && (
                         <tr className="bg-rose-900">
                           <td colSpan={2} className="px-6 py-4 text-right font-bold uppercase text-[10px] tracking-widest opacity-70 border-t border-rose-800">Saldo Devedor</td>
                           <td className="px-6 py-4 text-right text-lg font-black border-t border-rose-800">
                              Kz{(eventToInvoice.price - eventToInvoice.paidAmount).toLocaleString()}
                           </td>
                         </tr>
                      )}
                    </tfoot>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                   <div className="flex gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDownloadInvoice}
                      className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                      <Download size={18} />
                      Download
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePrintInvoice}
                      className="px-6 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-sm flex items-center gap-2 border border-indigo-100"
                    >
                      <Printer size={18} />
                      Imprimir
                    </motion.button>
                  </div>
                  <div className="flex gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCancelEventFromInvoice(eventToInvoice.id)}
                      className="px-6 py-3 bg-rose-100 text-rose-700 rounded-xl font-bold text-sm"
                    >
                      Cancelar o Evento
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowInvoice(false)}
                      className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl"
                    >
                      Concluir
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
