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

export function SecretariaView({ companyConfig, rooms, bookings, barOrders, leisureEvents, expenses, onUpdateRooms, onUpdateExpenses, initialTab = 'rooms' }: { 
  companyConfig: CompanyConfig, 
  rooms: Room[], 
  bookings: any[], 
  barOrders: any[], 
  leisureEvents: any[], 
  expenses: Expense[],
  onUpdateRooms: (rooms: Room[]) => void, 
  onUpdateExpenses: (expenses: Expense[]) => void,
  initialTab?: 'rooms' | 'finances' 
}) {
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'finances'>(initialTab);
  const [financeSubTab, setFinanceSubTab] = useState<'summary' | 'cashflow' | 'expenses'>('summary');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomType, setNewRoomType] = useState<'single' | 'double' | 'suite'>('single');
  const [newRoomPrice, setNewRoomPrice] = useState<number>(0);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber || newRoomPrice <= 0) return;
    
    // Check if room already exists
    if (rooms.some(r => r.number === newRoomNumber)) {
      alert('Este número de quarto já existe.');
      return;
    }

    const newRoom: Room = {
      number: newRoomNumber,
      type: newRoomType,
      status: 'available',
      price: newRoomPrice
    };

    onUpdateRooms([...rooms, newRoom]);
    setNewRoomNumber('');
    setNewRoomPrice(0);
  };

  const handleUpdateRoom = (roomNumber: string, updates: Partial<Room>) => {
    const updatedRooms = rooms.map(r => r.number === roomNumber ? { ...r, ...updates } : r);
    onUpdateRooms(updatedRooms);
  };

  const handleDeleteRoom = (roomNumber: string) => {
    if (confirm(`Tem certeza que deseja remover o quarto ${roomNumber}?`)) {
      onUpdateRooms(rooms.filter(r => r.number !== roomNumber));
    }
  };

  const calculateFinances = () => {
    const roomRevenue = bookings.reduce((acc, b) => acc + (b.totalAmount || b.totalPrice || 0), 0);
    const barRevenue = barOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const leisureRevenue = leisureEvents.reduce((acc, e) => acc + (e.paidAmount || 0), 0);
    
    // Taxes calculation
    const totalIVA = bookings.reduce((acc, b) => {
      const t = b.totalAmount || b.totalPrice || 0;
      const r = b.taxConfig?.rate || 14;
      return acc + (t - (t / (1 + r / 100)));
    }, 0) + barOrders.reduce((acc, o) => acc + (o.total - (o.total / 1.14)), 0) + 
    leisureEvents.reduce((acc, e) => {
      const t = e.paidAmount || 0;
      const r = e.taxConfig?.rate || 14;
      return acc + (t - (t / (1 + r / 100)));
    }, 0);

    const totalIRT = (bookings.reduce((acc, b) => acc + (b.withholdingAmount || 0), 0) + 
                     leisureEvents.reduce((acc, e) => acc + (e.withholdingAmount || 0), 0));

    const roomExpenses = expenses.filter(e => e.category === 'rooms').reduce((acc, e) => acc + e.amount, 0);
    const barExpenses = expenses.filter(e => e.category === 'bar').reduce((acc, e) => acc + e.amount, 0);
    const leisureExpenses = expenses.filter(e => e.category === 'leisure').reduce((acc, e) => acc + e.amount, 0);
    const otherExpenses = expenses.filter(e => e.category === 'general' || e.category === 'other').reduce((acc, e) => acc + e.amount, 0);

    const totalRevenue = roomRevenue + barRevenue + leisureRevenue;
    const totalSpecificExpenses = roomExpenses + barExpenses + leisureExpenses + otherExpenses;

    return {
      rooms: { revenue: roomRevenue, expenses: roomExpenses, profit: roomRevenue - roomExpenses },
      bar: { revenue: barRevenue, expenses: barExpenses, profit: barRevenue - barExpenses },
      leisure: { revenue: leisureRevenue, expenses: leisureExpenses, profit: leisureRevenue - leisureExpenses },
      taxes: { iva: totalIVA, irt: totalIRT },
      general: { expenses: otherExpenses },
      total: {
        revenue: totalRevenue,
        expenses: totalSpecificExpenses,
        profit: totalRevenue - totalSpecificExpenses
      }
    };
  };

  const finances = calculateFinances();

  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());

  const generateSAFT = () => {
    // Basic SAF-T (AO) XML Generation Logic
    const saftHeader = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="urn:OECD:StandardAuditFile-Tax:AO:1.01_01">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${companyConfig.nif}</CompanyID>
    <TaxRegistrationNumber>${companyConfig.nif}</TaxRegistrationNumber>
    <BusinessName>${companyConfig.name}</BusinessName>
    <CompanyAddress>
      <AddressDetail>${companyConfig.address}</AddressDetail>
      <City>Luanda</City>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${exportYear}</FiscalYear>
    <StartDate>${exportYear}-${exportMonth.toString().padStart(2, '0')}-01</StartDate>
    <EndDate>${exportYear}-${exportMonth.toString().padStart(2, '0')}-31</EndDate>
    <CurrencyCode>${companyConfig.currency === 'Kz' ? 'AOA' : 'USD'}</CurrencyCode>
    <DateCreated>${new Date().toISOString().split('T')[0]}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${companyConfig.nif}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>AIS-HOTEL-PRO</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <MasterFiles>
    <Customer>
      <CustomerID>999999999</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>999999999</CustomerTaxID>
      <CompanyName>Consumidor Final</CompanyName>
      <BillingAddress>
        <AddressDetail>AO</AddressDetail>
        <City>Luanda</City>
        <Country>AO</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${bookings.length + barOrders.length + leisureEvents.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${finances.total.revenue.toFixed(2)}</TotalCredit>
      ${[...bookings, ...barOrders, ...leisureEvents].map((doc, idx) => `
      <Invoice>
        <InvoiceNo>FT ${exportYear}/${idx + 1}</InvoiceNo>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${new Date().toISOString()}</InvoiceStatusDate>
          <SourceID>admin</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>0</Hash>
        <HashControl>1</HashControl>
        <Period>${exportMonth}</Period>
        <InvoiceDate>${new Date().toISOString().split('T')[0]}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <SourceID>admin</SourceID>
        <CustomerID>999999999</CustomerID>
        <Line>
          <LineNumber>1</LineNumber>
          <ProductCode>SERV</ProductCode>
          <ProductDescription>${doc.roomNumber || doc.items?.[0]?.name || doc.activity || 'Venda Diversa'}</ProductDescription>
          <Quantity>1</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${(doc.totalPrice || doc.total || doc.basePrice || 0).toFixed(2)}</UnitPrice>
          <TaxPointDate>${new Date().toISOString().split('T')[0]}</TaxPointDate>
          <Description>${doc.roomNumber || doc.activity || 'Serviço'}</Description>
          <CreditAmount>${(doc.totalPrice || doc.total || doc.basePrice || 0).toFixed(2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>NOR</TaxCode>
            <TaxPercentage>14.00</TaxPercentage>
          </Tax>
          <SettlementAmount>0.00</SettlementAmount>
        </Line>
        <DocumentTotals>
          <TaxPayable>${((doc.totalPrice || doc.total || doc.basePrice || 0) * 0.14).toFixed(2)}</TaxPayable>
          <NetTotal>${(doc.totalPrice || doc.total || doc.basePrice || 0).toFixed(2)}</NetTotal>
          <GrossTotal>${((doc.totalPrice || doc.total || doc.basePrice || 0) * 1.14).toFixed(2)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`).join('')}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;

    const blob = new Blob([saftHeader], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SAFT_AO_${companyConfig.name.replace(/\s+/g, '_')}_${exportYear}_${exportMonth.toString().padStart(2, '0')}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getMonthlyTaxSummary = () => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subDays(new Date(), i * 30);
      return format(d, 'MMM yyyy', { locale: ptBR });
    });

    return months.map(month => {
      const mBookings = bookings.filter(b => (b.in || b.checkIn) && format(new Date(b.in || b.checkIn), 'MMM yyyy', { locale: ptBR }) === month);
      const mEvents = leisureEvents.filter(e => e.date && format(new Date(e.date), 'MMM yyyy', { locale: ptBR }) === month);
      const mOrders = barOrders.filter(o => format(new Date(o.createdAt || new Date()), 'MMM yyyy', { locale: ptBR }) === month);

      const iva = mBookings.reduce((sum, b) => {
        const t = b.totalAmount || b.totalPrice || 0;
        const r = b.taxConfig?.rate || 14;
        return sum + (t - (t / (1 + r / 100)));
      }, 0) + mEvents.reduce((sum, e) => {
        const t = e.paidAmount || 0;
        const r = e.taxConfig?.rate || 14;
        return sum + (t - (t / (1 + r / 100)));
      }, 0) + mOrders.reduce((sum, o) => sum + (o.total - (o.total / 1.14)), 0);

      const irt = mBookings.reduce((sum, b) => sum + (b.withholdingAmount || 0), 0) +
                  mEvents.reduce((sum, e) => sum + (e.withholdingAmount || 0), 0);

      return { month, iva, irt };
    });
  };

  const handleExportFinanceReport = () => {
    const data = getMonthlyTaxSummary();
    // Header
    const headers = ['Mes de Referencia', 'IVA Liquidado (14%)', 'IRT Retido', 'Compromisso Fiscal (Total)'];
    
    // Rows
    const rows = data.map(item => [
      item.month,
      item.iva.toFixed(2),
      item.irt.toFixed(2),
      (item.iva + item.irt).toFixed(2)
    ]);

    // Construct CSV
    const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Impostos_${companyConfig.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPeriodsWithData = () => {
    const dates: Date[] = [];
    bookings.forEach(b => {
      const d = b.in || b.checkIn;
      if (d) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) dates.push(parsed);
      }
    });
    barOrders.forEach(o => {
      const d = o.date || o.createdAt;
      if (d) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) dates.push(parsed);
      }
    });
    leisureEvents.forEach(e => {
      const d = e.date;
      if (d) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) dates.push(parsed);
      }
    });
    expenses.forEach(ex => {
      const d = ex.date || ex.createdAt;
      if (d) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) dates.push(parsed);
      }
    });

    // Default with current month and last few months just in case
    for (let index = 0; index < 6; index++) {
      dates.push(subDays(new Date(), index * 30));
    }

    const formatted = dates.map(d => format(d, 'yyyy-MM', { locale: ptBR })); // e.g. "2026-06"
    const unique = Array.from(new Set(formatted));
    // Sort chronologically descending
    unique.sort((a, b) => b.localeCompare(a));
    return unique; // Returns list of "yyyy-MM"
  };

  const formatPeriodLabel = (period: string) => {
    if (period === 'all') return 'Todos os Períodos';
    const [year, month] = period.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    return format(d, 'MMMM yyyy', { locale: ptBR });
  };

  const calculateCashFlow = (period: string) => {
    // Helpers to check if date matches period
    const matches = (dateStr: string | undefined | null) => {
      if (!dateStr) return false;
      if (period === 'all') return true;
      // Convert date string to yyyy-MM
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return format(d, 'yyyy-MM') === period;
      } catch (err) {
        return false;
      }
    };

    // Filter data
    const periodBookings = bookings.filter(b => matches(b.in || b.checkIn));
    const periodBarOrders = barOrders.filter(o => matches(o.date || o.createdAt));
    const periodLeisureEvents = leisureEvents.filter(e => matches(e.date));
    const periodExpenses = expenses.filter(ex => matches(ex.date || ex.createdAt));

    // Calculate detailed inflows
    const roomsTotal = periodBookings.reduce((sum, b) => sum + (b.totalAmount || b.totalPrice || 0), 0);
    const barTotal = periodBarOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const leisureTotal = periodLeisureEvents.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    const totalInflow = roomsTotal + barTotal + leisureTotal;

    // Calculate taxes
    const totalIVA = periodBookings.reduce((sum, b) => {
      const t = b.totalAmount || b.totalPrice || 0;
      const r = b.taxConfig?.rate || 14;
      return sum + (t - (t / (1 + r / 100)));
    }, 0) + periodBarOrders.reduce((sum, o) => sum + (o.total - (o.total / 1.14)), 0) + 
    periodLeisureEvents.reduce((sum, e) => {
      const t = e.paidAmount || 0;
      const r = e.taxConfig?.rate || 14;
      return sum + (t - (t / (1 + r / 100)));
    }, 0);

    const totalIRT = (periodBookings.reduce((sum, b) => sum + (b.withholdingAmount || 0), 0) + 
                     periodLeisureEvents.reduce((sum, e) => sum + (e.withholdingAmount || 0), 0));

    // Calculate outflows
    const roomExpenses = periodExpenses.filter(ex => ex.category === 'rooms').reduce((sum, ex) => sum + ex.amount, 0);
    const barExpenses = periodExpenses.filter(ex => ex.category === 'bar').reduce((sum, ex) => sum + ex.amount, 0);
    const leisureExpenses = periodExpenses.filter(ex => ex.category === 'leisure').reduce((sum, ex) => sum + ex.amount, 0);
    const otherExpenses = periodExpenses.filter(ex => ex.category === 'general' || ex.category === 'other').reduce((sum, ex) => sum + ex.amount, 0);
    const totalOutflow = roomExpenses + barExpenses + leisureExpenses + otherExpenses;

    const grossProfit = totalInflow - totalOutflow;
    const realProfit = totalInflow - totalOutflow - totalIVA - totalIRT;

    // Chronological list
    const listInflows = [
      ...periodBookings.map(b => ({
        date: b.in || b.checkIn,
        type: 'Entrada',
        category: 'Alojamento (Quartos)',
        description: `Reserva de ${b.name} - Quarto ${b.room}`,
        amount: b.totalAmount || b.totalPrice || 0,
      })),
      ...periodBarOrders.map(o => ({
        date: o.date || o.createdAt || new Date().toISOString(),
        type: 'Entrada',
        category: 'Bar & Restaurante',
        description: `Ordem #${o.id || Math.floor(Math.random() * 10000)} ${o.room ? `(Quarto ${o.room})` : '(Balcão)'}`,
        amount: o.total || 0,
      })),
      ...periodLeisureEvents.map(e => ({
        date: e.date,
        type: 'Entrada',
        category: 'Lazer & Eventos',
        description: `Venda de Evento: ${e.name}`,
        amount: e.paidAmount || 0,
      })),
    ];

    const listOutflows = [
      ...periodExpenses.map(ex => ({
        date: ex.date || ex.createdAt || new Date().toISOString(),
        type: 'Saída',
        category: ex.category === 'rooms' ? 'Gestão de Quartos' :
                  ex.category === 'bar' ? 'Serviço de Bar' :
                  ex.category === 'leisure' ? 'Serviço de Lazer' : 'Despesas Gerais / Outros',
        description: ex.description,
        amount: ex.amount,
      }))
    ];

    const allMovements = [
      ...listInflows,
      ...listOutflows
    ];

    allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      roomsTotal,
      barTotal,
      leisureTotal,
      totalInflow,
      roomExpenses,
      barExpenses,
      leisureExpenses,
      otherExpenses,
      totalOutflow,
      totalIVA,
      totalIRT,
      grossProfit,
      realProfit,
      allMovements
    };
  };

  const handleExportCashFlowReport = (period: string) => {
    const cf = calculateCashFlow(period);
    const headers = ['Data', 'Tipo', 'Categoria de Fluxo', 'Descricao', 'Valor Liquido'];
    const rows = cf.allMovements.map(m => [
      format(new Date(m.date), 'dd/MM/yyyy HH:mm'),
      m.type,
      m.category,
      m.description,
      m.amount.toFixed(2)
    ]);
    
    // Construct CSV
    const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fluxo_Caixa_${formatPeriodLabel(period).replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCashFlow = () => {
    const cf = calculateCashFlow(selectedPeriod);
    const costPercentageOfRevenue = cf.totalInflow > 0 
      ? Math.min(100, Math.round(((cf.totalOutflow + cf.totalIVA + cf.totalIRT) / cf.totalInflow) * 100))
      : 0;

    return (
      <div className="space-y-8 animate-in fade-in duration-500 font-sans">
        {/* Dynamic Month/Period Selector Header */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" />
              Controlo de Fluxo de Caixa
            </h4>
            <p className="text-xs text-slate-500 font-medium">Visualização consolidada de receitas (entradas) vs despesas (saídas) para apuramento do lucro real líquido.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Período Mensal:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-700 outline-none pr-4 cursor-pointer"
              >
                <option value="all">Todo o Histórico (Global)</option>
                {getPeriodsWithData().map(p => (
                  <option key={p} value={p}>{formatPeriodLabel(p)}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleExportCashFlowReport(selectedPeriod)}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold rounded-2xl transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm"
            >
              <Download size={14} />
              Exportar Fluxo
            </button>
          </div>
        </div>

        {/* Dashboard Cards Grid (Entradas vs Saídas & Lucro Real) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Card: Total Entradas */}
          <div className="bg-emerald-50/40 p-6 rounded-[2rem] border border-emerald-100/50 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Entradas (Faturação)</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100/60 flex items-center justify-center text-emerald-600">
                <ArrowUp className="text-emerald-600" size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h5 className="text-3xl font-black text-emerald-950">
                {companyConfig.currency}{cf.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h5>
              <div className="flex gap-2 text-[9px] font-bold text-emerald-500 uppercase tracking-wider mt-2">
                <span>Quartos: {companyConfig.currency}{cf.roomsTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>•</span>
                <span>Bar: {companyConfig.currency}{cf.barTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Card: Total Saídas */}
          <div className="bg-rose-50/40 p-6 rounded-[2rem] border border-rose-100/50 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Saídas (Despesas)</span>
              <div className="w-8 h-8 rounded-full bg-rose-100/60 flex items-center justify-center text-rose-500">
                <ArrowDown className="text-rose-500" size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h5 className="text-3xl font-black text-rose-950">
                {companyConfig.currency}{cf.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h5>
              <p className="text-[10px] text-rose-400 font-bold uppercase mt-2">
                Gastos totais registados
              </p>
            </div>
          </div>

          {/* Card: Impostos Liquidadores (IVA/IRT) */}
          <div className="bg-violet-50/40 p-6 rounded-[2rem] border border-violet-100/50 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Retenções & IVA</span>
              <div className="w-8 h-8 rounded-full bg-violet-100/60 flex items-center justify-center text-violet-600">
                <FileText size={16} />
              </div>
            </div>
            <div className="mt-4">
              <h5 className="text-3xl font-black text-violet-950">
                {companyConfig.currency}{(cf.totalIVA + cf.totalIRT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h5>
              <div className="flex gap-2 text-[9px] font-bold text-violet-550 uppercase tracking-wider mt-2">
                <span>IVA: {companyConfig.currency}{cf.totalIVA.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span>•</span>
                <span>IRT: {companyConfig.currency}{cf.totalIRT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Card: Lucro Real Líquido */}
          <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col justify-between ${
            cf.realProfit >= 0 ? 'bg-indigo-50/50 border-indigo-100 text-indigo-900' : 'bg-amber-50/50 border-amber-100 text-amber-900'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest">Lucro Real Líquido</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                cf.realProfit >= 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
              }`}>
                $
              </div>
            </div>
            <div className="mt-4">
              <h5 className="text-3xl font-black">
                {companyConfig.currency}{cf.realProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h5>
              <p className="text-[10px] font-bold uppercase mt-2">
                {cf.realProfit >= 0 ? 'Apurado positivo de caixa' : 'Apurado negativo de caixa'}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Bar showing revenue usage */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h5 className="text-md font-bold text-slate-800">Compromisso e Consumo de Receita</h5>
              <p className="text-xs text-slate-500 font-medium">Percentagem da facturação bruta que foi consumida por despesas e tributação.</p>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-xs font-black text-slate-800">{costPercentageOfRevenue}% Absorvido</span>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${Math.min(100, Math.round((cf.totalOutflow / (cf.totalInflow || 1)) * 100))}%` }} 
              className="bg-rose-500 h-full transition-all duration-550"
              title="Despesas Operacionais"
            ></div>
            <div 
              style={{ width: `${Math.min(100, Math.round(((cf.totalIVA + cf.totalIRT) / (cf.totalInflow || 1)) * 100))}%` }} 
              className="bg-violet-500 h-full transition-all duration-550"
              title="Encargos Fiscais"
            ></div>
          </div>
          <div className="flex flex-wrap gap-6 mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-rose-500"></div>
              <span>Despesas ({cf.totalInflow > 0 ? Math.round((cf.totalOutflow / cf.totalInflow) * 100) : 0}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-violet-500"></div>
              <span>Impostos & Retenções ({cf.totalInflow > 0 ? Math.round(((cf.totalIVA + cf.totalIRT) / cf.totalInflow) * 100) : 0}%)</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto text-emerald-500">
              <div className="w-2.5 h-2.5 rounded bg-emerald-500"></div>
              <span>Sobra (Lucro Real): {100 - costPercentageOfRevenue}%</span>
            </div>
          </div>
        </div>

        {/* Grouped Breakdown of Inflows and Outflows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Table of Inflow Categories */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
              <div>
                <h5 className="font-black text-slate-900 text-sm">Resumo de Receitas (Entradas)</h5>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Decomposição das faturas liquidadas</p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                Total: {companyConfig.currency}{cf.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Quartos & Alojamento</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Faturamento de hospedagem</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.roomsTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-500 font-bold">{cf.totalInflow > 0 ? Math.round((cf.roomsTotal / cf.totalInflow) * 100) : 0}% das Receitas</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Bar & Restauração</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ordens de serviço de bar</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.barTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-500 font-bold">{cf.totalInflow > 0 ? Math.round((cf.barTotal / cf.totalInflow) * 100) : 0}% das Receitas</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Lazer & Eventos</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ingressos de lazer e eventos</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.leisureTotal.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-500 font-bold">{cf.totalInflow > 0 ? Math.round((cf.leisureTotal / cf.totalInflow) * 100) : 0}% das Receitas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table of Outflow Categories */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
              <div>
                <h5 className="font-black text-slate-900 text-sm">Resumo de Despesas (Saídas)</h5>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Decomposição de gastos elegíveis</p>
              </div>
              <span className="px-3 py-1 bg-rose-50 text-rose-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                Total: {companyConfig.currency}{cf.totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Custos de Quartos</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Serviço de limpeza e amenities</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.roomExpenses.toLocaleString()}</p>
                  <p className="text-[10px] text-rose-500 font-bold">{cf.totalOutflow > 0 ? Math.round((cf.roomExpenses / cf.totalOutflow) * 100) : 0}% das Saídas</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Serviços de Bar</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Abastecimento de stock e compras</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.barExpenses.toLocaleString()}</p>
                  <p className="text-[10px] text-rose-500 font-bold">{cf.totalOutflow > 0 ? Math.round((cf.barExpenses / cf.totalOutflow) * 100) : 0}% das Saídas</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Lazer & Outros Eventos</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Gastos com equipamentos de lazer</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.leisureExpenses.toLocaleString()}</p>
                  <p className="text-[10px] text-rose-500 font-bold">{cf.totalOutflow > 0 ? Math.round((cf.leisureExpenses / cf.totalOutflow) * 100) : 0}% das Saídas</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Despesas Gerais & Secretaria</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Electricidade, salários e gerais</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{companyConfig.currency}{cf.otherExpenses.toLocaleString()}</p>
                  <p className="text-[10px] text-rose-500 font-bold">{cf.totalOutflow > 0 ? Math.round((cf.otherExpenses / cf.totalOutflow) * 100) : 0}% das Saídas</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chronological Movements Ledger (Tabela Consolidada) */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h5 className="text-md font-bold text-slate-900">Extrato Cronológico de Movimentações</h5>
              <p className="text-xs text-slate-500">Registo sequenciado e autêntico de cada fluxo financeiro apurado</p>
            </div>
            <span className="px-3.5 py-1.5 bg-slate-950 text-white text-[10px] font-black rounded-xl font-mono shadow-sm">
              Total Itens: {cf.allMovements.length}
            </span>
          </div>

          {cf.allMovements.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <AlertCircle size={48} className="mx-auto mb-4 text-slate-350" />
              <p className="font-bold text-sm">Sem movimentações financeiras para o período seleccionado.</p>
              <p className="text-xs mt-1">Crie despesas ou execute faturas de quartos, ordens de bar e lazer para alimentar o fluxo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-50/30 border-b border-slate-100">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cf.allMovements.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/20 transition-all font-sans">
                      <td className="px-8 py-4 text-xs text-slate-500 font-medium">
                        {format(new Date(item.date), 'dd/MM/yyyy')}
                        <span className="text-[10px] font-mono block text-slate-450">{format(new Date(item.date), 'HH:mm')}</span>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 border rounded-lg text-[9px] font-black uppercase tracking-wider ${
                          item.type === 'Entrada' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                        }`}>
                          {item.type === 'Entrada' ? <Plus size={10} /> : <Minus size={10} />}
                          {item.type}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-xs text-slate-800 font-bold">
                        {item.category}
                      </td>
                      <td className="px-8 py-4 text-xs text-slate-500 truncate max-w-[280px]" title={item.description}>
                        {item.description}
                      </td>
                      <td className={`px-8 py-4 text-right text-sm font-black tabular-nums ${
                        item.type === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {item.type === 'Entrada' ? '+' : '-'}{companyConfig.currency}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getProfitabilityData = () => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = subDays(new Date(), i * 30);
      return format(d, 'MMM yyyy', { locale: ptBR });
    }).reverse();

    return last6Months.map(month => {
      const monthBookings = bookings.filter(b => {
        const inDate = b.in || b.checkIn;
        if (!inDate) return false;
        const d = new Date(inDate);
        return !isNaN(d.getTime()) && format(d, 'MMM yyyy', { locale: ptBR }) === month;
      });
      const monthBarOrders = barOrders.filter(o => {
        const d = new Date(o.createdAt || new Date());
        return !isNaN(d.getTime()) && format(d, 'MMM yyyy', { locale: ptBR }) === month;
      });
      const monthLeisureEvents = leisureEvents.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && format(d, 'MMM yyyy', { locale: ptBR }) === month;
      });

      const rRevenue = monthBookings.reduce((acc, b) => acc + (b.totalPrice || 0), 0);
      const bRevenue = monthBarOrders.reduce((acc, o) => acc + (o.total || 0), 0);
      const lRevenue = monthLeisureEvents.reduce((acc, e) => acc + (e.paidAmount || 0), 0);

      const rProfit = rRevenue * 0.8; 
      const bProfit = bRevenue * 0.6;
      const lProfit = lRevenue * 0.85;

      return {
        name: month,
        Quartos: rProfit,
        Bar: bProfit,
        Lazer: lProfit
      };
    });
  };

  const profitabilityData = getProfitabilityData();

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseCategory, setExpenseCategory] = useState<'rooms' | 'bar' | 'leisure' | 'general' | 'other'>('general');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || expenseAmount <= 0) return;

    const newExpense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      description: expenseDesc,
      amount: expenseAmount,
      category: expenseCategory,
      date: expenseDate,
      createdAt: new Date().toISOString()
    };

    onUpdateExpenses([...expenses, newExpense]);
    setExpenseDesc('');
    setExpenseAmount(0);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Tem certeza que deseja remover este gasto?')) {
      onUpdateExpenses(expenses.filter(e => e.id !== id));
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
          Secretaria & Gestão
        </h3>
      </div>

      {activeSubTab === 'finances' ? (
        <div className="space-y-8">
          <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto">
            <button 
              onClick={() => setFinanceSubTab('summary')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${financeSubTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Resumo Financeiro
            </button>
            <button 
              onClick={() => setFinanceSubTab('cashflow')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${financeSubTab === 'cashflow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Fluxo de Caixa
            </button>
            <button 
              onClick={() => setFinanceSubTab('expenses')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${financeSubTab === 'expenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Gestão de Gastos
            </button>
          </div>

          {financeSubTab === 'summary' && (
            <>
              {/* Quadrant: Separate Financials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Quartos & Alojamento', data: finances.rooms, icon: <BedDouble className="text-blue-600" />, color: 'bg-blue-50' },
              { title: 'Bar & Restauração', data: finances.bar, icon: <GlassWater className="text-amber-600" />, color: 'bg-amber-50' },
              { title: 'Lazer & Eventos', data: finances.leisure, icon: <Palmtree className="text-rose-600" />, color: 'bg-rose-50' },
            ].map((area, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className={`p-4 ${area.color} flex items-center gap-3 border-b border-slate-100`}>
                  <div className="bg-white p-2 rounded-lg shadow-sm">{area.icon}</div>
                  <p className="font-bold text-slate-800">{area.title}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Faturação</p>
                    <p className="text-sm font-black text-emerald-600">{companyConfig.currency}{area.data.revenue.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gastos</p>
                    <p className="text-sm font-black text-rose-600">{companyConfig.currency}{area.data.expenses.toLocaleString()}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-widest">Lucro Líquido</p>
                    <p className="text-lg font-black text-slate-900">{companyConfig.currency}{area.data.profit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* SAF-T (AO) Export Section */}
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-cyan-500/20 transition-all duration-700"></div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileDown className="text-cyan-400" />
                    Exportação SAF-T (AO)
                  </h4>
                  <p className="text-slate-400 text-xs font-medium">Configure e gere o ficheiro padrão de auditoria fiscal angolana.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    <select 
                      value={exportMonth}
                      onChange={(e) => setExportMonth(Number(e.target.value))}
                      className="bg-transparent text-white text-xs font-bold outline-none px-2 cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-slate-800 text-white">
                          {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                        </option>
                      ))}
                    </select>
                    <select 
                      value={exportYear}
                      onChange={(e) => setExportYear(Number(e.target.value))}
                      className="bg-transparent text-white text-xs font-bold outline-none px-2 cursor-pointer border-l border-slate-700"
                    >
                      {[2023, 2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button 
                    onClick={generateSAFT}
                    className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                  >
                    Gerar Ficheiro XML
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Total Billing Block */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-bold">Resumo Financeiro Consolidado</h4>
                  <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Consolidado de todas as áreas (Geral)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-emerald-400">Faturação Bruta</p>
                  <p className="text-3xl font-black">{companyConfig.currency}{finances.total.revenue.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-rose-400">Total IVA (14%)</p>
                  <p className="text-3xl font-black text-rose-400">{companyConfig.currency}{finances.taxes.iva.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-violet-400">Retenção IRT</p>
                  <p className="text-3xl font-black text-violet-400">{companyConfig.currency}{finances.taxes.irt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-emerald-500">Resultado Líquido</p>
                  <div className="flex flex-col">
                    <p className="text-[10px] text-slate-400 font-bold mb-1">
                      {companyConfig.currency}{(finances.total.revenue - finances.taxes.iva - finances.taxes.irt).toLocaleString()} - {companyConfig.currency}{finances.total.expenses.toLocaleString()}
                    </p>
                    <p className="text-3xl font-black text-emerald-500">{companyConfig.currency}{(finances.total.profit - finances.taxes.iva - finances.taxes.irt).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Tax Breakdown - Professional Extrato Layout */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Extrato Consolidado de Impostos</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Resumo mensal de obrigações fiscais</p>
                </div>
              </div>
              <button 
                onClick={handleExportFinanceReport}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest flex items-center gap-2"
              >
                <Download size={14} />
                Exportar Relatório
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                    <th className="px-8 py-4 font-bold">Mês de Referência</th>
                    <th className="px-8 py-4 font-bold text-rose-500">IVA Liquidado (14%)</th>
                    <th className="px-8 py-4 font-bold text-violet-500">IRT Retido</th>
                    <th className="px-8 py-4 text-right pr-12 font-bold text-slate-800">Compromisso Fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {getMonthlyTaxSummary().map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                          <span className="font-bold text-slate-700 uppercase tracking-tight">{item.month}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-black text-rose-600 tabular-nums">
                          {companyConfig.currency}{item.iva.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-black text-violet-600 tabular-nums">
                          {companyConfig.currency}{item.irt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right pr-12">
                        <div className="inline-flex flex-col items-end">
                          <span className="font-black text-slate-900 tabular-nums">
                            {companyConfig.currency}{(item.iva + item.irt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Automático</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Profitability Chart */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold text-slate-900">Lucratividade por Área</h4>
                <p className="text-xs text-slate-500 font-medium">Lucro líquido (Receita - Gastos Estimados) nos últimos 6 meses</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Quartos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Bar</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Lazer</span>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitabilityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(value) => `${companyConfig.currency}${value.toLocaleString()}`}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Bar dataKey="Quartos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="Bar" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="Lazer" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expenses by Area Chart */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-bold text-slate-900">Despesas por Área</h4>
                <p className="text-xs text-slate-500 font-medium">Total de gastos acumulados por centro de custo</p>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Quartos', valor: finances.rooms.expenses },
                  { name: 'Bar', valor: finances.bar.expenses },
                  { name: 'Lazer', valor: finances.leisure.expenses },
                  { name: 'Geral', valor: finances.general.expenses }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(value) => `${companyConfig.currency}${value.toLocaleString()}`}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Bar dataKey="valor" fill="#64748b" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
          )}

          {financeSubTab === 'cashflow' && renderCashFlow()}

          {financeSubTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <PlusCircle size={20} className="text-emerald-500" />
                  Inserir Novo Gasto
                </h4>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                    <input 
                      type="text" 
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      placeholder="Ex: Pagamento EDP / Compras Bar"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</label>
                      <input 
                        type="number" 
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(Number(e.target.value))}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área / Categoria</label>
                      <select 
                        value={expenseCategory}
                        onChange={(e) => setExpenseCategory(e.target.value as any)}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                      >
                        <option value="rooms">Quartos</option>
                        <option value="bar">Bar</option>
                        <option value="leisure">Lazer</option>
                        <option value="general">Geral</option>
                        <option value="other">Outro</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Gasto</label>
                    <input 
                      type="date" 
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                    />
                  </div>
                  <button className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all mt-4">
                    Registar Gasto
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                  <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Histórico de Gastos</h4>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    TOTAL: {companyConfig.currency}{expenses.reduce((acc, e) => acc + e.amount, 0).toLocaleString()}
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100">
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Descrição</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4 text-right">Valor</th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {expenses.slice().reverse().map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                            {format(new Date(exp.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-900">{exp.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight ${
                              exp.category === 'rooms' ? 'bg-blue-50 text-blue-600' :
                              exp.category === 'bar' ? 'bg-amber-50 text-amber-600' :
                              exp.category === 'leisure' ? 'bg-rose-50 text-rose-600' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {exp.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black text-rose-600">
                              {companyConfig.currency}{exp.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteExpense(exp.id!)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Financial Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Receita Total', value: finances.total.revenue.toLocaleString(), color: 'text-emerald-600', icon: <DollarSign size={20} /> },
              { label: 'Despesas', value: finances.total.expenses.toLocaleString(), color: 'text-rose-600', icon: <AlertCircle size={20} /> },
              { label: 'Saldo Líquido', value: finances.total.profit.toLocaleString(), color: 'text-indigo-600', icon: <CheckCircle2 size={20} /> },
              { label: 'Pendente', value: '120,000', color: 'text-orange-600', icon: <Clock size={20} /> },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <div className={`${stat.color} opacity-80`}>{stat.icon}</div>
                </div>
                <p className={`text-xl font-black ${stat.color}`}>{companyConfig.currency}{stat.value}</p>
              </div>
            ))}
          </div>

      {/* Room Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <PlusCircle size={20} className="text-emerald-500" />
            Adicionar Quarto
          </h3>
          <form onSubmit={handleAddRoom} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número do Quarto</label>
              <input 
                type="text" 
                value={newRoomNumber}
                onChange={(e) => setNewRoomNumber(e.target.value)}
                placeholder="Ex: 305"
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tipo</label>
              <select 
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value as any)}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="suite">Suite</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preço por Hora ({companyConfig.currency})</label>
              <input 
                type="number" 
                value={newRoomPrice}
                onChange={(e) => setNewRoomPrice(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-100"
            >
              Criar Quarto
            </motion.button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Inventário de Quartos</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{rooms.length} Quartos Totais</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Quarto</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Preço/H</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rooms.map((room) => (
                  <tr key={room.number} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{room.number}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-600 capitalize">{room.type}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {companyConfig.currency}{room.price}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleUpdateRoom(room.number, { status: room.status === 'maintenance' ? 'available' : 'maintenance' })}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            room.status === 'maintenance' 
                              ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                              : room.status === 'occupied'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {room.status === 'maintenance' ? 'Em Manutenção' : room.status === 'occupied' ? 'Ocupado' : 'Operacional'}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button 
                        onClick={() => setEditingRoom(room)}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteRoom(room.number)}
                        className="text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Room Modal */}
      <AnimatePresence>
        {editingRoom && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6">Editar Quarto {editingRoom.number}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tipo</label>
                  <select 
                    value={editingRoom.type}
                    onChange={(e) => setEditingRoom({ ...editingRoom, type: e.target.value as any })}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                  >
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                    <option value="suite">Suite</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Preço por Hora</label>
                  <input 
                    type="number" 
                    value={editingRoom.price}
                    onChange={(e) => setEditingRoom({ ...editingRoom, price: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setEditingRoom(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      handleUpdateRoom(editingRoom.number, { type: editingRoom.type, price: editingRoom.price });
                      setEditingRoom(null);
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}
