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

export function ManualsView({ companyConfig }: { companyConfig: CompanyConfig }) {
  const manuals = [
    {
      id: '1',
      title: 'Manual de Utilização do Software',
      description: 'Guia completo sobre como gerir quartos, bar, eventos e relatórios financeiros.',
      version: '1.0',
      lastUpdated: '2024-04-30',
      type: 'PDF',
      size: '1.2 MB'
    },
    {
      id: '2',
      title: 'Guia de Configuração de Impressoras',
      description: 'Como configurar as impressoras térmicas para o bar e recepção.',
      version: '1.0',
      lastUpdated: '2024-04-30',
      type: 'PDF',
      size: '0.8 MB'
    },
    {
      id: '3',
      title: 'Manual de Conformidade Técnica AGT',
      description: 'Especificações técnicas, regras de certificação e padrões de auditoria fiscal (SAF-T AO).',
      version: '1.0',
      lastUpdated: '2024-04-30',
      type: 'PDF',
      size: '1.5 MB'
    }
  ];

  const handleDownload = (manual: any) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(companyConfig.name, 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text(manual.title, 105, 30, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(20, 35, 190, 35);
    
    // Info
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Versão: ${manual.version} | Data: ${manual.lastUpdated}`, 105, 42, { align: 'center' });

    // Content
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85); // slate-700
    
    let y = 60;
    
    const getChapters = (id: string) => {
      switch(id) {
        case '1':
          return [
            { title: '1. Introdução', content: 'Este manual descreve as funcionalidades básicas do sistema AIS-HOTEL-PRO, abrangendo Recepção, Bar, Lazer e Gestão Financeira.' },
            { title: '2. Gestão de Quartos (Recepção)', content: 'Na aba "Recepção", você pode visualizar o estado de todos os quartos. Verde indica disponível, vermelho ocupado e amarelo reservado. Clique em um quarto para gerir o check-in ou check-out.' },
            { title: '3. Operações de Bar', content: 'A aba "Bar" permite o lançamento de pedidos. Selecione a categoria (Bebidas, Snacks, etc.), adicione itens ao carrinho e escolha entre pagamento imediato ou lançamento na conta do quarto.' },
            { title: '4. Eventos e Lazer', content: 'Gerencie atividades extras como tours, massagens ou aluguel de equipamentos na aba "Lazer".' },
            { title: '5. Relatórios e SAF-T', content: 'Acesse a aba "Finanças" para visualizar o resumo financeiro, despesas e exportar o ficheiro SAF-T (AO) para fins fiscais.' },
            { title: '6. Suporte Técnico', content: 'Caso encontre dificuldades, entre em contacto com a equipa de suporte via e-mail ou telefone indicado nas definições.' }
          ];
        case '2':
          return [
            { title: '1. Modelos Suportados', content: 'O sistema suporta impressoras térmicas de 58mm e 80mm com comandos ESC/POS.' },
            { title: '2. Configuração de Rede', content: 'Certifique-se de que a impressora está na mesma sub-rede que o dispositivo que acede ao software.' },
            { title: '3. Templates de Impressão', content: 'Pode personalizar o rodapé e o logotipo nos recibos através do menu de Definições de Administrador.' }
          ];
        case '3':
          return [
            { title: '1. Enquadramento Legal AGT', content: 'O software está em conformidade com o Decreto Presidencial n.º 312/18 e regulamentos subsequentes da AGT sobre sistemas de faturação.' },
            { title: '2. Algoritmos de Assinatura', content: 'Todas as faturas são assinadas digitalmente usando chaves privadas RSA (PKCS#1) de 1024 bits, garantindo a integridade dos dados e o não repúdio.' },
            { title: '3. Sequencialidade e Continuidade', content: 'O sistema impede a eliminação de documentos fiscais e garante que a numeração seja estritamente sequencial por série de faturação.' },
            { title: '4. Arquivo de Dados SAF-T (AO)', content: 'O ficheiro de auditoria SAF-T (AO) é gerado seguindo a estrutura XML definida pela AGT, incluindo tabelas de clientes, produtos, impostos e documentos comerciais.' },
            { title: '5. Tratamento de IVA', content: 'Configuração automática de regimes de IVA (Geral, Isenção ou Simplificado) com os respetivos códigos de motivo de isenção oficiais.' },
            { title: '6. Requisitos de Hardware', content: 'O hardware utilizado deve permitir o arquivo seguro de dados por um período mínimo de 10 anos, conforme exigido pela lei angolana.' }
          ];
        default: return [];
      }
    };

    const chapters = getChapters(manual.id);

    chapters.forEach(chapter => {
      if (y > 250) {
        doc.addPage();
        y = 30;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(chapter.title, 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      const splitContent = doc.splitTextToSize(chapter.content, 170);
      doc.text(splitContent, 20, y);
      y += splitContent.length * 7 + 10;
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`${manual.title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-2 h-8 bg-slate-600 rounded-full"></div>
          Manuais & Documentação
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manuals.map(manual => (
          <motion.div 
            key={manual.id}
            whileHover={{ y: -5 }}
            className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 mb-6">
                <BookOpen size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">{manual.title}</h4>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">{manual.description}</p>
              
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Versão</span>
                  <span className="text-xs font-bold text-slate-700">{manual.version}</span>
                </div>
                <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tamanho</span>
                  <span className="text-xs font-bold text-slate-700">{manual.size}</span>
                </div>
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDownload(manual)}
              className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 flex items-center justify-center gap-2 transition-all hover:bg-slate-800"
            >
              <Download size={18} />
              Download {manual.type}
            </motion.button>
          </motion.div>
        ))}

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-center items-center text-center space-y-4 border border-slate-800">
          <div className="w-20 h-20 bg-black/40 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/10 relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-magenta-500/20 blur-xl group-hover:scale-150 transition-transform duration-700"></div>
             <div className="relative z-10 font-black text-3xl tracking-tighter flex items-center justify-center">
                <span className="text-cyan-400">N</span>
                <span className="text-white/20 -mx-1">X</span>
                <span className="text-rose-500">S</span>
             </div>
          </div>
          <div>
            <h4 className="text-xl font-bold tracking-tight">Nexos Soluções Digitais</h4>
            <p className="text-slate-400 text-sm">Precisa de ajuda avançada ou treinamento personalizado?</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-[260px] pt-2">
            <a 
              href="tel:924730518" 
              className="px-6 py-3.5 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2 group/btn"
              title="Ligar para 924 730 518"
            >
              <Phone size={14} className="text-cyan-500 group-hover/btn:scale-110 transition-transform" />
              <span>924 730 518</span>
            </a>
            <a 
              href="tel:954134010" 
              className="px-6 py-3.5 bg-slate-900 text-white border border-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-slate-850 hover:border-slate-700 transition-all flex items-center justify-center gap-2 group/btn2"
              title="Ligar para 954 134 010"
            >
              <Phone size={14} className="text-rose-500 group-hover/btn2:scale-110 transition-transform" />
              <span>954 134 010</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
