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

export function HRView({ companyConfig, employees, onUpdateEmployees, calculateIRT }: { 
  companyConfig: CompanyConfig, 
  employees: Employee[], 
  onUpdateEmployees: (emps: Employee[]) => void,
  calculateIRT: (salary: number) => number
}) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<any[]>(storage.get('payroll_records') || []);
  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee & { photo?: string; cv?: string; bi?: string }>>({});
  const [isEditingPayroll, setIsEditingPayroll] = useState(false);
  const [payrollFormData, setPayrollFormData] = useState<NonNullable<Employee['payrollConfig']>>({
    foodAllowance: 0,
    transportAllowance: 0,
    socialSecurityRate: 0.03,
    irtRate: 0,
    otherBonus: 0,
    otherDeductions: 0
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'photo' | 'cv' | 'bi') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmployee: Employee = {
      id: editingEmployee?.id || Date.now().toString(),
      name: formData.name || '',
      role: formData.role || 'receptionist',
      salary: Number(formData.salary) || 0,
      phone: formData.phone || '',
      status: formData.status || 'active',
      documentId: formData.documentId || '',
      inssNumber: formData.inssNumber || '',
      contractDetails: formData.contractDetails || '',
      qualifications: formData.qualifications || '',
      familyDetails: formData.familyDetails || '',
      bonus: Number(formData.bonus) || 0,
      supplementsAndAllowancesValue: Number(formData.supplementsAndAllowancesValue) || 0,
      supplementsAndAllowances: formData.supplementsAndAllowances || '',
      createdAt: editingEmployee?.createdAt || new Date().toISOString(),
      payrollConfig: editingEmployee?.payrollConfig || {
        foodAllowance: 150,
        transportAllowance: 100,
        socialSecurityRate: 0.03,
        irtRate: 0.10,
        otherBonus: 0,
        otherDeductions: 0
      },
      // In a real app, these would be URLs to storage
      ...(formData as any)
    };

    if (editingEmployee) {
      onUpdateEmployees(employees.map(emp => emp.id === editingEmployee.id ? newEmployee : emp));
    } else {
      onUpdateEmployees([...employees, newEmployee]);
    }

    setIsHiringModalOpen(false);
    setEditingEmployee(null);
    setFormData({});
  };

  const handleSavePayrollConfig = () => {
    if (!selectedEmployee) return;
    const updatedEmployees = employees.map(emp => 
      emp.id === selectedEmployee.id 
        ? { ...emp, payrollConfig: payrollFormData } 
        : emp
    );
    onUpdateEmployees(updatedEmployees);
    setSelectedEmployee({ ...selectedEmployee, payrollConfig: payrollFormData });
    setIsEditingPayroll(false);
  };

  const calculatePayroll = (emp: Employee) => {
    const config = emp.payrollConfig || {
      foodAllowance: 0,
      transportAllowance: 0,
      socialSecurityRate: 0.03,
      irtRate: 0,
      otherBonus: 0,
      otherDeductions: 0
    };

    const base = emp.salary;
    const bonus = (config.otherBonus || 0) + (emp.bonus || 0);
    const supplements = emp.supplementsAndAllowancesValue || 0;
    const ss = base * config.socialSecurityRate;
    
    // IRT calculation - Prefer progressive table calculation over fixed rate if rate is 0 or not configured
    const irt = calculateIRT(base);
    
    const deductions = (config.otherDeductions || 0) + ss + irt;
    const totalVencimento = base + config.foodAllowance + config.transportAllowance + bonus + supplements;
    const net = totalVencimento - deductions;

    return {
      base,
      food: config.foodAllowance,
      transport: config.transportAllowance,
      bonus,
      supplements,
      ss,
      irt,
      otherDeductions: config.otherDeductions || 0,
      net
    };
  };

  const handleDeleteEmployee = (id: string) => {
    if (window.confirm('Tem certeza que deseja demitir este funcionário?')) {
      onUpdateEmployees(employees.filter(emp => emp.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-2 h-8 bg-cyan-500 rounded-full"></div>
          Equipa Pérola
        </h3>
        <motion.button 
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(8, 145, 178, 1)', boxShadow: "0 20px 25px -5px rgba(6, 182, 212, 0.2)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setEditingEmployee(null);
            setFormData({});
            setIsHiringModalOpen(true);
          }}
          className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-bold shadow-lg shadow-cyan-200 transition-all"
        >
          Admitir Funcionário
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map((emp) => (
          <div key={emp.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm">
                  <img 
                    src={(emp as any).photo || `https://picsum.photos/seed/${emp.name}/100/100`} 
                    alt={emp.name} 
                    referrerPolicy="no-referrer" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{emp.name}</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">{emp.role}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingEmployee(emp);
                    setFormData(emp);
                    setIsHiringModalOpen(true);
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteEmployee(emp.id!)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Salário Base</span>
                <span className="font-black text-slate-900">{companyConfig.currency}{emp.salary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-500 font-medium">IRT (Estimado)</span>
                <span className="font-black text-rose-600">-{companyConfig.currency}{calculateIRT(emp.salary).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Estado</span>
                <span className={`font-black uppercase text-[10px] tracking-widest ${emp.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {emp.status === 'active' ? 'No Turno' : 'Folga'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(238, 242, 255, 1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedEmployee(emp)}
                className="py-2 text-indigo-600 font-bold text-[10px] uppercase tracking-widest border border-indigo-100 rounded-lg transition-all"
              >
                Folha Pagamento
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(241, 245, 249, 1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEditingEmployee(emp);
                  setFormData(emp);
                  setIsHiringModalOpen(true);
                }}
                className="py-2 text-slate-600 font-bold text-[10px] uppercase tracking-widest border border-slate-100 rounded-lg transition-all"
              >
                Ver Ficha
              </motion.button>
            </div>
          </div>
        ))}
      </div>

      {/* Hiring / Edit Modal */}
      <AnimatePresence>
        {isHiringModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                  {editingEmployee ? 'Editar Ficha de Funcionário' : 'Admissão de Novo Funcionário'}
                </h2>
                <button onClick={() => setIsHiringModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <form onSubmit={handleSaveEmployee} className="p-8 overflow-y-auto max-h-[80vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Basic Info */}
                  <div className="space-y-6">
                    <div className="flex flex-col items-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 relative group">
                      <div className="w-24 h-24 rounded-full bg-white shadow-inner overflow-hidden mb-4 border-2 border-white">
                        {formData.photo ? (
                          <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <User size={40} />
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer bg-white px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 shadow-sm border border-indigo-50 hover:bg-indigo-50 transition-all">
                        Carregar Foto de Perfil
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'photo')} />
                      </label>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</label>
                        <input 
                          type="text" 
                          required
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          placeholder="Ex: Ricardo Sousa"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Número do BI</label>
                          <input 
                            type="text" 
                            value={formData.documentId || ''}
                            onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                            placeholder="BI nº"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nº de Inscrição INSS</label>
                          <input 
                            type="text" 
                            value={formData.inssNumber || ''}
                            onChange={(e) => setFormData({ ...formData, inssNumber: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                            placeholder="Inscrição nº"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cargo</label>
                          <select 
                            value={formData.role || 'receptionist'}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          >
                            <option value="receptionist">Recepcionista</option>
                            <option value="cleaner">Limpeza</option>
                            <option value="barman">Barman</option>
                            <option value="manager">Gerente</option>
                            <option value="maintenance">Manutenção</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salário Base</label>
                          <input 
                            type="number" 
                            required
                            value={formData.salary || ''}
                            onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                            placeholder="Ex: 80000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Definição de Bónus</label>
                        <input 
                          type="number" 
                          value={formData.bonus || ''}
                          onChange={(e) => setFormData({ ...formData, bonus: Number(e.target.value) })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          placeholder="Valor do bónus"
                        />
                      </div>

                      {formData.salary && (
                        <div className="p-4 bg-slate-900 rounded-xl space-y-3">
                          <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">
                             <span>Simulação de Deduções</span>
                             <span className="text-indigo-400">Tabela IRT 2020</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Segurança Social (3%)</span>
                              <span className="text-rose-400 font-bold">-{companyConfig.currency}{(formData.salary * 0.03).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">IRT</span>
                              <span className="text-rose-400 font-bold">-{companyConfig.currency}{calculateIRT(formData.salary).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1 border-t border-slate-800 pt-2 font-bold">
                              <span className="text-white">Estimativa Líquida</span>
                              <span className="text-emerald-400">{companyConfig.currency}{(formData.salary + (Number(formData.bonus) || 0) + (Number(formData.supplementsAndAllowancesValue) || 0) - (formData.salary * 0.03) - calculateIRT(formData.salary)).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Telefone</label>
                        <input 
                          type="tel" 
                          required
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          placeholder="+244 9XX XXX XXX"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Documents */}
                  <div className="space-y-6">
                    <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                      <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                        <FileText size={14} />
                        Documentação Obrigatória
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                              <IdCard size={18} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">Bilhete de Identidade (BI)</p>
                              <p className="text-[10px] text-slate-400">{formData.bi ? 'Documento Carregado' : 'Pendente'}</p>
                            </div>
                          </div>
                          <label className="cursor-pointer p-2 hover:bg-indigo-50 rounded-lg transition-all text-indigo-600">
                            <PlusCircle size={20} />
                            <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'bi')} />
                          </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                              <FileText size={18} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">Curriculum Vitae (CV)</p>
                              <p className="text-[10px] text-slate-400">{formData.cv ? 'Documento Carregado' : 'Pendente'}</p>
                            </div>
                          </div>
                          <label className="cursor-pointer p-2 hover:bg-indigo-50 rounded-lg transition-all text-indigo-600">
                            <PlusCircle size={20} />
                            <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'cv')} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Users size={14} />
                        Dados Complementares
                      </h4>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dados Contratuais</label>
                        <input 
                          type="text" 
                          value={formData.contractDetails || ''}
                          onChange={(e) => setFormData({ ...formData, contractDetails: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          placeholder="Tipo de contrato, data início, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Habilitações</label>
                        <input 
                          type="text" 
                          value={formData.qualifications || ''}
                          onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          placeholder="Escolaridade, cursos, etc."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Agregado Familiar</label>
                        <input 
                          type="text" 
                          value={formData.familyDetails || ''}
                          onChange={(e) => setFormData({ ...formData, familyDetails: e.target.value })}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                          placeholder="Detalhes da família"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Suplementos e Abonos</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input 
                            type="number" 
                            value={formData.supplementsAndAllowancesValue || ''}
                            onChange={(e) => setFormData({ ...formData, supplementsAndAllowancesValue: Number(e.target.value) })}
                            className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                            placeholder="Valor total"
                          />
                          <textarea 
                            rows={1}
                            value={formData.supplementsAndAllowances || ''}
                            onChange={(e) => setFormData({ ...formData, supplementsAndAllowances: e.target.value })}
                            className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all resize-none"
                            placeholder="Descrição/Notas"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Estado do Contrato</label>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, status: 'active' })}
                          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${formData.status === 'active' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          Ativo / No Turno
                        </button>
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, status: 'inactive' })}
                          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${formData.status === 'inactive' ? 'bg-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          Folga / Ausente
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsHiringModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-cyan-600 text-white font-black rounded-2xl shadow-xl shadow-cyan-100 hover:bg-cyan-700 transition-all uppercase tracking-widest text-xs"
                  >
                    {editingEmployee ? 'Atualizar Ficha' : 'Confirmar Admissão'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payroll Modal */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Folha de Pagamento</h2>
                  <p className="text-slate-500 text-sm">Referente a {format(new Date(), 'MMMM yyyy', { locale: ptBR })}</p>
                </div>
                <div className="flex gap-2">
                  {!isEditingPayroll && (
                    <button 
                      onClick={() => {
                        setIsEditingPayroll(true);
                        setPayrollFormData(selectedEmployee.payrollConfig || {
                          foodAllowance: 0,
                          transportAllowance: 0,
                          socialSecurityRate: 0.03,
                          irtRate: 0,
                          otherBonus: 0,
                          otherDeductions: 0
                        });
                      }}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2 text-xs font-bold"
                    >
                      <Edit2 size={14} />
                      Editar Valores
                    </button>
                  )}
                  <button onClick={() => { setSelectedEmployee(null); setIsEditingPayroll(false); }} className="p-2 hover:bg-white rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                {isEditingPayroll ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subpídio Alimentação</label>
                        <input 
                          type="number" 
                          value={payrollFormData.foodAllowance}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, foodAllowance: Number(e.target.value) })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subpídio Transporte</label>
                        <input 
                          type="number" 
                          value={payrollFormData.transportAllowance}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, transportAllowance: Number(e.target.value) })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Taxa Seg. Social (%)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={payrollFormData.socialSecurityRate * 100}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, socialSecurityRate: Number(e.target.value) / 100 })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">IRT (Automático)</label>
                        <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500">
                          Progressivo (Tabela AGT)
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outros Bónus</label>
                        <input 
                          type="number" 
                          value={payrollFormData.otherBonus || 0}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, otherBonus: Number(e.target.value) })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outras Deduções</label>
                        <input 
                          type="number" 
                          value={payrollFormData.otherDeductions || 0}
                          onChange={(e) => setPayrollFormData({ ...payrollFormData, otherDeductions: Number(e.target.value) })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setIsEditingPayroll(false)}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSavePayrollConfig}
                        className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-100"
                      >
                        Guardar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Company & Employee Info */}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</p>
                        <p className="font-bold text-slate-900">{companyConfig.name}</p>
                        <p className="text-sm text-slate-500">NIF: {companyConfig.nif}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Funcionário</p>
                        <p className="font-bold text-slate-900">{selectedEmployee.name}</p>
                        <p className="text-sm text-slate-500">{selectedEmployee.role}</p>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-3 text-left font-bold text-slate-500 uppercase text-[10px]">Descrição</th>
                            <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase text-[10px]">Vencimento</th>
                            <th className="px-6 py-3 text-right font-bold text-slate-500 uppercase text-[10px]">Desconto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(() => {
                            const p = calculatePayroll(selectedEmployee);
                            return (
                              <>
                                <tr>
                                  <td className="px-6 py-4 font-medium">Vencimento Base</td>
                                  <td className="px-6 py-4 text-right font-bold">{companyConfig.currency}{p.base.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right text-slate-400">-</td>
                                </tr>
                                <tr>
                                  <td className="px-6 py-4 font-medium">Subpídio de Alimentação</td>
                                  <td className="px-6 py-4 text-right font-bold">{companyConfig.currency}{p.food.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right text-slate-400">-</td>
                                </tr>
                                <tr>
                                  <td className="px-6 py-4 font-medium">Subsídio de Transporte</td>
                                  <td className="px-6 py-4 text-right font-bold">{companyConfig.currency}{p.transport.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right text-slate-400">-</td>
                                </tr>
                                {selectedEmployee.supplementsAndAllowances && (
                                  <tr>
                                    <td className="px-6 py-4 font-medium italic text-indigo-600">
                                      <div className="flex flex-col">
                                        <span>Suplementos e Abonos</span>
                                        <span className="text-[10px] text-slate-500 font-normal">{selectedEmployee.supplementsAndAllowances}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{companyConfig.currency}{p.supplements.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-400">-</td>
                                  </tr>
                                )}
                                {p.bonus > 0 && (
                                  <tr>
                                    <td className="px-6 py-4 font-medium">Bónus Extra</td>
                                    <td className="px-6 py-4 text-right font-bold">{companyConfig.currency}{p.bonus.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-400">-</td>
                                  </tr>
                                )}
                                <tr>
                                  <td className="px-6 py-4 font-medium text-rose-600">Segurança Social ({((selectedEmployee.payrollConfig?.socialSecurityRate || 0.03) * 100).toFixed(0)}%)</td>
                                  <td className="px-6 py-4 text-right text-slate-400">-</td>
                                  <td className="px-6 py-4 text-right font-bold text-rose-600">{companyConfig.currency}{p.ss.toLocaleString()}</td>
                                </tr>
                                <tr>
                                  <td className="px-6 py-4 font-medium text-rose-600">
                                    <div className="flex flex-col">
                                      <span>IRT (Imposto sobre Rendimento)</span>
                                      <span className="text-[9px] opacity-70 uppercase tracking-tighter font-black">Cálculo Progressivo s/ Salário Base</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right text-slate-400">-</td>
                                  <td className="px-6 py-4 text-right font-bold text-rose-600">{companyConfig.currency}{p.irt.toLocaleString()}</td>
                                </tr>
                                {p.otherDeductions > 0 && (
                                  <tr>
                                    <td className="px-6 py-4 font-medium text-rose-600">Outras Deduções</td>
                                    <td className="px-6 py-4 text-right text-slate-400">-</td>
                                    <td className="px-6 py-4 text-right font-bold text-rose-600">{companyConfig.currency}{p.otherDeductions.toLocaleString()}</td>
                                  </tr>
                                )}
                              </>
                            );
                          })()}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold">
                          <tr>
                            <td className="px-6 py-4">Total Líquido</td>
                            <td colSpan={2} className="px-6 py-4 text-right text-indigo-600 text-lg">
                              {companyConfig.currency}{calculatePayroll(selectedEmployee).net.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="flex justify-end gap-4">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const p = calculatePayroll(selectedEmployee);
                          const monthStr = format(new Date(), 'yyyy-MM');
                          const newRecord = {
                            id: `${selectedEmployee.id}-${monthStr}`,
                            employeeId: selectedEmployee.id,
                            employeeName: selectedEmployee.name,
                            month: monthStr,
                            baseSalary: p.base,
                            foodAllowance: p.food,
                            transportAllowance: p.transport,
                            bonus: p.bonus,
                            socialSecurity: p.ss,
                            irt: p.irt,
                            otherDeductions: p.otherDeductions,
                            netSalary: p.net,
                            status: 'paid',
                            paymentDate: new Date().toISOString()
                          };
                          
                          const updated = [...payrollRecords];
                          const idx = updated.findIndex((r: any) => r.id === newRecord.id);
                          if (idx > -1) {
                            updated[idx] = newRecord;
                          } else {
                            updated.push(newRecord);
                          }
                          setPayrollRecords(updated);
                          storage.set('payroll_records', updated);
                          
                          alert('Folha de pagamento processada e registada com sucesso no Supabase!');
                          window.print();
                        }}
                        className="px-6 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200"
                      >
                        <Printer size={16} />
                        Processar e Imprimir Recibo
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedEmployee(null)}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100"
                      >
                        Fechar
                      </motion.button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
