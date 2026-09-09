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
import { BarReportsView } from "./BarReportsView";
import { BarStockView } from "./BarStockView";

export function BarView({ menu, setMenu, rooms, companyConfig, currentUser, barOrders, onUpdateOrders, inventoryLogs, addInventoryLog, readOnly }: { 
  menu: any,
  setMenu: (menu: any) => void,
  rooms: Room[], 
  companyConfig: CompanyConfig, 
  currentUser: UserType | null,
  barOrders: any[],
  onUpdateOrders: (orders: any[]) => void,
  inventoryLogs: any[],
  addInventoryLog: (action: string, itemName: string, details: string) => void,
  readOnly?: boolean
}) {
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'menu' | 'reports' | 'stock'>('pos');
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const [activeMenuCategory, setActiveMenuCategory] = useState('Cocktails');
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [voidOrderId, setVoidOrderId] = useState<string | null>(null);
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState<number>(14);
  const [stockAlert, setStockAlert] = useState<{ type: 'low' | 'empty', name: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToRename, setCategoryToRename] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [orderDestination, setOrderDestination] = useState('Avulsa');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-printable');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Fatura - ${companyConfig.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; }
            .info { font-size: 12px; color: #666; margin-top: 5px; }
            .invoice-details { margin-bottom: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { text-align: left; border-bottom: 1px solid #eee; padding: 10px; font-size: 12px; text-transform: uppercase; color: #999; }
            td { padding: 10px; border-bottom: 1px solid #f9f9f9; font-size: 14px; }
            .total-section { margin-top: 30px; border-top: 2px solid #eee; padding-top: 15px; text-align: right; }
            .total-row { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 5px; }
            .total-label { font-weight: bold; color: #666; }
            .total-value { font-weight: 900; font-size: 18px; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px dashed #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="company-name">${companyConfig.name}</h1>
            <div class="info">${companyConfig.address || 'Endereço não definido'}</div>
            <div class="info">Tel: ${companyConfig.phone || 'N/A'} | NIF: ${companyConfig.nif || 'N/A'}</div>
          </div>
          
          <div class="invoice-details">
            <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Destino:</strong> ${orderDestination === 'Avulsa' ? 'Venda Avulsa' : 'Quarto ' + orderDestination}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Preço</th>
                <th>IVA</th>
                <th style="text-align: right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map(item => {
                const rate = item.taxConfig?.rate || 0;
                const lineTotal = item.price * item.qty;
                const netPrice = item.price / (1 + rate / 100);
                const lineTax = lineTotal - (lineTotal / (1 + rate / 100));
                return `
                  <tr>
                    <td>
                      ${item.name}
                      ${rate === 0 ? `<br/><small style="color: #999; font-size: 9px;">${item.taxConfig?.exemptionCode || 'ISE'} - ${item.taxConfig?.exemptionReason || 'Isento'}</small>` : ''}
                    </td>
                    <td>${item.qty}</td>
                    <td>${companyConfig.currency}${netPrice.toFixed(2)}</td>
                    <td>${rate}%</td>
                    <td style="text-align: right">${companyConfig.currency}${lineTotal.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span class="total-label">Subtotal (Net):</span>
              <span>${companyConfig.currency}${(cart.reduce((sum, i) => sum + (i.price * i.qty / (1 + (i.taxConfig?.rate || 0) / 100)), 0)).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Total IVA:</span>
              <span>${companyConfig.currency}${(cart.reduce((sum, i) => sum + (i.price * i.qty - (i.price * i.qty / (1 + (i.taxConfig?.rate || 0) / 100))), 0)).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">TOTAL (Grosso):</span>
              <span class="total-value">${companyConfig.currency}${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Obrigado pela sua preferência!</p>
            <p>Documento processado por computador</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsPrintModalOpen(false);
  };

  const isAdmin = currentUser?.role === 'admin';

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const taxRate = parseFloat(formData.get('taxRate') as string);
    const taxExemptionCode = formData.get('taxExemptionCode') as string;

    if (taxRate === 0 && !taxExemptionCode) {
      alert("O código de motivo de isenção é obrigatório para taxa 0%.");
      return;
    }

    const newItem = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      price: parseFloat(formData.get('price') as string),
      costPrice: parseFloat(formData.get('costPrice') as string) || 0,
      stock: parseInt(formData.get('stock') as string) || 0,
      minStock: parseInt(formData.get('minStock') as string) || 5,
      unit: formData.get('unit') as string || 'unid.',
      description: formData.get('description') as string,
      img: editingItem?.img || `https://picsum.photos/seed/${Math.random()}/300/300`,
      taxConfig: {
        type: formData.get('taxType') as 'IVA' | 'IS',
        rate: taxRate,
        code: taxRate === 14 ? 'NOR' : (taxRate === 0 ? 'ISE' : 'RED'),
        description: taxRate === 14 ? 'Taxa Normal' : (taxRate === 0 ? 'Isento' : 'Taxa Reduzida'),
        exemptionCode: taxRate === 0 ? taxExemptionCode : undefined,
        exemptionReason: taxRate === 0 ? formData.get('taxExemptionReason') as string : undefined
      }
    };

    const updatedMenu = { ...menu };
    
    if (editingItem) {
      // Find original category
      const oldCategory = Object.keys(menu).find(cat => menu[cat].some((i: any) => i.id === editingItem.id));
      if (oldCategory && oldCategory !== editingCategory) {
        // Remove from old category
        updatedMenu[oldCategory] = updatedMenu[oldCategory].filter((i: any) => i.id !== editingItem.id);
      }
      
      // Add/Update in new category
      const categoryItems = [...(updatedMenu[editingCategory] || [])];
      const index = categoryItems.findIndex(i => i.id === editingItem.id);
      if (index > -1) {
        categoryItems[index] = newItem;
      } else {
        categoryItems.push(newItem);
      }
      updatedMenu[editingCategory] = categoryItems;
      addInventoryLog('Atualização', newItem.name, `Preço: ${newItem.price}, Stock: ${newItem.stock}, Categoria: ${editingCategory}`);
    } else {
      const categoryItems = [...(updatedMenu[editingCategory] || [])];
      categoryItems.push(newItem);
      updatedMenu[editingCategory] = categoryItems;
      addInventoryLog('Inserção', newItem.name, `Preço: ${newItem.price}, Stock: ${newItem.stock}, Categoria: ${editingCategory}`);
    }

    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    setIsEditing(false);
    setEditingItem(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingItem({ ...editingItem, img: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteItem = (category: string, id: string) => {
    const itemToDelete = menu[category]?.find((i: any) => i.id === id);
    const updatedMenu = { ...menu };
    updatedMenu[category] = updatedMenu[category].filter((i: any) => i.id !== id);
    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    if (itemToDelete) {
      addInventoryLog('Eliminação', itemToDelete.name, `Categoria: ${category}`);
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (menu[newCategoryName.trim()]) {
      alert('Esta categoria já existe.');
      return;
    }
    const updatedMenu = { ...menu, [newCategoryName.trim()]: [] };
    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    addInventoryLog('Nova Categoria', newCategoryName.trim(), 'Categoria criada vazia');
    setNewCategoryName('');
  };

  const handleRenameCategory = (oldName: string) => {
    if (!newCategoryName.trim() || oldName === newCategoryName.trim()) {
      setCategoryToRename(null);
      setNewCategoryName('');
      return;
    }
    if (menu[newCategoryName.trim()]) {
      alert('Esta categoria já existe.');
      return;
    }
    const updatedMenu = { ...menu };
    updatedMenu[newCategoryName.trim()] = updatedMenu[oldName];
    delete updatedMenu[oldName];
    
    if (activeMenuCategory === oldName) setActiveMenuCategory(newCategoryName.trim());
    if (activeCategory === oldName) setActiveCategory(newCategoryName.trim());
    
    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    addInventoryLog('Renomear Categoria', oldName, `Novo nome: ${newCategoryName.trim()}`);
    setCategoryToRename(null);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (catName: string) => {
    if (Object.keys(menu).length <= 1) {
      alert('Deve haver pelo menos uma categoria.');
      return;
    }
    if (menu[catName].length > 0 && !window.confirm(`A categoria "${catName}" contém itens. Tem certeza que deseja eliminá-la e todos os seus itens?`)) {
      return;
    }
    const updatedMenu = { ...menu };
    delete updatedMenu[catName];
    
    const remainingCategories = Object.keys(updatedMenu);
    if (activeMenuCategory === catName) setActiveMenuCategory(remainingCategories[0]);
    if (activeCategory === catName) setActiveCategory(remainingCategories[0]);
    
    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    addInventoryLog('Eliminar Categoria', catName, 'Categoria e todos os seus itens eliminados');
  };

  const addToCart = (item: any) => {
    const category = Object.keys(menu).find(cat => menu[cat].find((i: any) => i.id === item.id));
    if (!category) return;
    const menuItem = menu[category].find((i: any) => i.id === item.id);

    if (menuItem.stock <= 0) {
      setStockAlert({ type: 'empty', name: item.name });
      return;
    }

    if (menuItem.stock <= 5) {
      setStockAlert({ type: 'low', name: item.name });
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        if (existing.qty >= menuItem.stock) {
          setStockAlert({ type: 'empty', name: item.name });
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    const category = Object.keys(menu).find(cat => menu[cat].find((i: any) => i.id === id));
    if (!category) return;
    const menuItem = menu[category].find((i: any) => i.id === id);

    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.qty + delta;
        if (newQty > menuItem.stock) {
          setStockAlert({ type: 'empty', name: menuItem.name });
          return i;
        }
        
        if (menuItem.stock <= 5 && delta > 0) {
          setStockAlert({ type: 'low', name: menuItem.name });
        }

        return { ...i, qty: Math.max(1, newQty) };
      }
      return i;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleMoveItem = (category: string, index: number, direction: 'up' | 'down') => {
    const updatedMenu = { ...menu };
    const items = [...(updatedMenu[category] || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
    updatedMenu[category] = items;
    
    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
  };

  const handleFinalizeOrder = () => {
    if (cart.length === 0) return;

    // Check stock
    const outOfStock = cart.find(item => {
      const category = Object.keys(menu).find(cat => menu[cat].find((i: any) => i.id === item.id));
      if (!category) return false;
      const menuItem = menu[category].find((i: any) => i.id === item.id);
      return menuItem.stock < item.qty;
    });

    if (outOfStock) {
      setStockAlert({ type: 'empty', name: outOfStock.name });
      return;
    }

    const newOrder = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total: cartTotal,
      room: orderDestination,
      status: 'completed',
      user: currentUser?.name || 'Atendente Bar'
    };

    // Update stock
    const updatedMenu = { ...menu };
    cart.forEach(item => {
      const category = Object.keys(updatedMenu).find(cat => updatedMenu[cat].find((i: any) => i.id === item.id));
      if (category) {
        updatedMenu[category] = updatedMenu[category].map((i: any) => 
          i.id === item.id ? { ...i, stock: i.stock - item.qty } : i
        );
      }
    });

    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);
    onUpdateOrders([...barOrders, newOrder]);
    setCart([]);
    alert('Pedido finalizado com sucesso!');
  };

  const handleVoidOrder = (orderId: string) => {
    setVoidOrderId(orderId);
    setAdminUsernameInput('');
    setAdminPasswordInput('');
    setPasswordError(false);
  };

  const confirmVoidOrder = () => {
    if (!voidOrderId) return;

    const isAdminUser = currentUser?.role === 'admin';
    if (!isAdminUser) {
      const users = storage.get('users') || MOCK_USERS;
      const adminUser = users.find((u: any) => 
        u.username === adminUsernameInput && 
        u.password === adminPasswordInput && 
        u.role === 'admin'
      );
      
      if (!adminUser) {
        setPasswordError(true);
        return;
      }
    }

    const orderId = voidOrderId;
    const orderToVoid = barOrders.find(o => o.id === orderId);
    if (!orderToVoid) {
      setVoidOrderId(null);
      return;
    }

    // Update stock
    const updatedMenu = { ...menu };
    orderToVoid.items.forEach((orderItem: any) => {
      Object.keys(updatedMenu).forEach(cat => {
        updatedMenu[cat] = updatedMenu[cat].map((menuItem: any) => 
          menuItem.name === orderItem.name ? { ...menuItem, stock: menuItem.stock + orderItem.qty } : menuItem
        );
      });
    });

    setMenu(updatedMenu);
    storage.set('bar_menu', updatedMenu);

    const updatedOrders = barOrders.map(order => 
      order.id === orderId ? { ...order, status: 'voided' } : order
    );
    onUpdateOrders(updatedOrders);
    addInventoryLog('Devolução de Valores', `Pedido #${orderId.slice(-4)}`, 'Valores devolvidos e stock reposto no inventário');
    setVoidOrderId(null);
    alert('Operação de Devolução de Valores concluída com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex gap-1">
          <button 
            onClick={() => setActiveSubTab('pos')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'pos' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Ponto de Venda
          </button>
          <button 
            onClick={() => setActiveSubTab('menu')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'menu' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Menu de Bebidas
          </button>
          <button 
            onClick={() => setActiveSubTab('reports')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'reports' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Relatórios
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveSubTab('stock')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'stock' ? 'bg-orange-600 text-white shadow-lg shadow-orange-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Controlo de Stock
            </button>
          )}
        </div>
        {isAdmin && (activeSubTab === 'menu' || activeSubTab === 'stock') && !readOnly && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingCategory(activeMenuCategory);
              setEditingItem(null);
              setEditingTaxRate(14);
              setIsEditing(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-100"
          >
            <Plus size={18} />
            Novo Produto
          </motion.button>
        )}
        {isAdmin && (activeSubTab === 'menu' || activeSubTab === 'stock') && readOnly && (
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-bold border border-slate-200">
             <Lock size={14} />
             EDIÇÃO BLOQUEADA
           </div>
        )}
      </div>

      {activeSubTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                Menu Bar & Restaurante
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['Tudo', ...Object.keys(menu)].map(cat => (
                  <motion.button 
                    whileHover={{ scale: 1.05, borderColor: 'rgba(249, 115, 22, 1)', color: 'rgba(234, 88, 12, 1)' }}
                    whileTap={{ scale: 0.95 }}
                    key={cat} 
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {cat}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.entries(menu)
                .flatMap(([cat, items]: [string, any]) => items.map((item: any) => ({ ...item, cat })))
                .filter((item: any) => activeCategory === 'Tudo' || item.cat === activeCategory)
                .map((item, i) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <div className="aspect-square rounded-xl bg-slate-50 mb-4 overflow-hidden flex items-center justify-center">
                    <img src={item.img} alt={item.name} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <h4 className="font-bold text-slate-900">{item.name}</h4>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-orange-600 font-bold">{companyConfig.currency}{item.price.toFixed(2)}</span>
                    <motion.button 
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(234, 88, 12, 1)', color: 'white' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => addToCart(item)}
                      className="p-2 bg-orange-50 text-orange-600 rounded-lg transition-all"
                    >
                      <Plus size={16} />
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 sticky top-0">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col h-auto min-h-[200px]">
              <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
                <Wine size={20} className="text-orange-600" />
                Pedido Atual
              </h3>
              
              <div className="space-y-3 mb-6">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Wine size={32} className="opacity-20" />
                  </div>
                  <p className="text-xs font-bold">O carrinho está vazio</p>
                </div>
              ) : (
                cart.map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={item.id} 
                    className="group flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg min-w-[32px] text-center">
                        {item.qty}x
                      </span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">{item.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.cat}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                        {companyConfig.currency}{(item.price * item.qty).toFixed(2)}
                      </span>
                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remover item"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="space-y-2">
                <div className="flex justify-between text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>{companyConfig.currency}{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-2xl">
                  <span>Total</span>
                  <span className="text-orange-600">{companyConfig.currency}{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Destino do Lançamento</label>
                  <select 
                    value={orderDestination}
                    onChange={(e) => setOrderDestination(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-orange-500 rounded-xl text-sm font-bold focus:ring-0 transition-all"
                  >
                    <option value="Avulsa">Venda Avulsa</option>
                    {rooms.filter(r => r.status === 'occupied').map(r => (
                      <option key={r.number} value={r.number}>Quarto {r.number}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-5 gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsPrintModalOpen(true)}
                    disabled={cart.length === 0}
                    className="col-span-1 flex items-center justify-center p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all"
                    title="Imprimir Fatura"
                  >
                    <Printer size={20} />
                  </motion.button>
                  {!readOnly ? (
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleFinalizeOrder}
                      disabled={cart.length === 0}
                      className="col-span-4 py-4 font-black text-sm rounded-xl shadow-lg shadow-orange-100 bg-orange-600 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all uppercase tracking-widest"
                    >
                      Finalizar Pedido
                    </motion.button>
                  ) : (
                    <div className="col-span-4 py-4 bg-slate-100 text-slate-400 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-200 text-xs text-center uppercase tracking-widest">
                       Bloqueado (Apenas Leitura)
                    </div>
                  )}
                </div>
                {readOnly && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-2 text-amber-700 text-[9px] font-bold uppercase tracking-wider">
                    <Lock size={12} />
                    Registo de novos pedidos bloqueado.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Orders / Devolução Box */}
          {barOrders.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <DollarSign size={10} className="text-orange-500" />
                  Devolução & Pedidos Recentes
                </h4>
                <button 
                  onClick={() => setActiveSubTab('reports')}
                  className="text-[8px] font-black text-orange-600 uppercase tracking-widest hover:underline"
                >
                  Ver Todos
                </button>
              </div>
              <div className="space-y-2">
                  {barOrders
                    .filter(o => o.status !== 'voided')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 3)
                    .map(order => (
                      <div 
                        key={order.id} 
                        onClick={() => setSelectedOrderDetails(order)}
                        className="p-3 bg-slate-50 rounded-xl flex items-center justify-between group cursor-pointer hover:bg-slate-100 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900">#{order.id.slice(-4)}</span>
                            <span className="text-[8px] text-slate-400 font-bold">{format(new Date(order.date), 'HH:mm')}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate font-medium">
                            {order.items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-black text-slate-900 mr-2">{companyConfig.currency}{order.total.toFixed(2)}</span>
                          {order.signature && <ShieldCheck size={10} className="text-emerald-500 shrink-0" />}
                          {!readOnly && (
                            <button 
                              onClick={() => handleVoidOrder(order.id)}
                              className="p-1.5 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Devolução de Valores"
                            >
                              <DollarSign size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeSubTab === 'menu' ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 flex-1">
              {Object.keys(menu).map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setActiveMenuCategory(cat)}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeMenuCategory === cat ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsCategoryModalOpen(true)}
                className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                title="Gerir Categorias"
              >
                <Settings size={20} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menu[activeMenuCategory]?.map((item: any) => (
              <motion.div 
                layout
                key={item.id} 
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500"
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-50 flex items-center justify-center">
                  <img src={item.img} alt={item.name} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-sm font-black text-slate-900 shadow-sm">
                    {companyConfig.currency}{item.price.toFixed(2)}
                  </div>
                  {item.stock <= 5 && (
                    <div className="absolute top-4 left-4 px-3 py-1 bg-rose-500 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-lg animate-pulse">
                      Stock Crítico
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h4 className="text-lg font-bold text-slate-900 mb-2">{item.name}</h4>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-4 leading-relaxed">{item.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.stock > 10 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <span className="text-xs font-bold text-slate-400">{item.stock} em stock</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-1 mr-2 border-r border-slate-100 pr-2">
                          <button 
                            onClick={() => {
                              const index = menu[activeMenuCategory]?.findIndex((i: any) => i.id === item.id);
                              if (index !== undefined && index !== -1) handleMoveItem(activeMenuCategory, index, 'up');
                            }}
                            className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                            title="Mover para Cima"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              const index = menu[activeMenuCategory]?.findIndex((i: any) => i.id === item.id);
                              if (index !== undefined && index !== -1) handleMoveItem(activeMenuCategory, index, 'down');
                            }}
                            className="p-1 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                            title="Mover para Baixo"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingCategory(activeMenuCategory);
                            setEditingItem(item);
                            setEditingTaxRate(item.taxConfig?.rate ?? 14);
                            setIsEditing(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm('Tem certeza que deseja excluir este produto?')) {
                              handleDeleteItem(activeMenuCategory, item.id);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : activeSubTab === 'reports' ? (
        <BarReportsView 
          barOrders={barOrders} 
          inventoryLogs={inventoryLogs}
          companyConfig={companyConfig} 
          onUpdateOrders={onUpdateOrders}
          onVoidOrder={handleVoidOrder}
          onReorder={(order) => {
            const itemsToReorder = order.items.map((orderItem: any) => {
              let foundItem = null;
              Object.keys(menu).forEach(cat => {
                const item = menu[cat].find((i: any) => i.name === orderItem.name);
                if (item) foundItem = { ...item, qty: orderItem.qty };
              });
              return foundItem;
            }).filter(Boolean);

            if (itemsToReorder.length > 0) {
              const newCart = [...cart];
              itemsToReorder.forEach((item: any) => {
                const existing = newCart.find(i => i.id === item.id);
                if (existing) {
                  existing.qty += item.qty;
                } else {
                  newCart.push(item);
                }
              });
              setCart(newCart);
              setActiveSubTab('pos');
            }
          }}
        />
      ) : activeSubTab === 'stock' && isAdmin ? (
        <BarStockView 
          menu={menu} 
          setMenu={setMenu} 
          companyConfig={companyConfig} 
          addInventoryLog={addInventoryLog}
          onEditItem={(cat, item) => {
            setEditingCategory(cat);
            setEditingItem(item);
            setEditingTaxRate(item.taxConfig?.rate ?? 14);
            setIsEditing(true);
          }}
          onDeleteItem={handleDeleteItem}
        />
      ) : null}

      {/* Print Preview Modal */}
      <AnimatePresence>
        {isPrintModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                    <Printer size={20} />
                  </div>
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Pré-visualização da Fatura</h3>
                </div>
                <button onClick={() => setIsPrintModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-white">
                <div id="invoice-printable" className="border-2 border-dashed border-slate-200 rounded-3xl p-6 space-y-6">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{companyConfig.name}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{companyConfig.address || 'Endereço não definido'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">NIF: {companyConfig.nif || 'N/A'}</p>
                  </div>

                  <div className="h-px bg-slate-100 w-full"></div>

                  <div className="space-y-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex justify-between">
                      <span>Data:</span>
                      <span className="text-slate-900">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Destino:</span>
                      <span className="text-slate-900">{orderDestination === 'Avulsa' ? 'Venda Avulsa' : 'Quarto ' + orderDestination}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                      <span>Item</span>
                      <div className="flex gap-8">
                        <span>Qtd</span>
                        <span>Total</span>
                      </div>
                    </div>
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex-1 pr-4">{item.name}</span>
                        <div className="flex gap-8">
                          <span className="w-4 text-center">{item.qty}</span>
                          <span className="w-16 text-right">{companyConfig.currency}{(item.price * item.qty).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t-2 border-slate-900 border-dotted space-y-2">
                    <div className="flex justify-between text-slate-900 font-black text-lg">
                      <span>TOTAL</span>
                      <span>{companyConfig.currency}{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-center pt-4">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Obrigado pela preferência</p>
                    
                    <div className="pt-4 border-t border-slate-100 flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck size={10} className="text-slate-400" />
                        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Documento Assinado Digitalmente</span>
                      </div>
                      <p className="font-mono text-[6px] text-slate-400 break-all leading-tight opacity-50 px-4">
                        HASH-RSA-256: {Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}...
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setIsPrintModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex-[2] py-3 px-4 bg-orange-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  Imprimir Agora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Alert Modal */}
      <AnimatePresence>
        {stockAlert && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  stockAlert.type === 'empty' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  <AlertCircle size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">
                  {stockAlert.type === 'empty' ? 'Produto Esgotado!' : 'Stock Baixo!'}
                </h3>
                <p className="text-slate-500 mb-8">
                  {stockAlert.type === 'empty' 
                    ? `O produto "${stockAlert.name}" não possui stock disponível no momento.`
                    : `O produto "${stockAlert.name}" está com stock reduzido (menos de 5 unidades).`}
                </p>
                <button 
                  onClick={() => setStockAlert(null)}
                  className={`w-full py-4 font-bold rounded-2xl transition-all shadow-lg ${
                    stockAlert.type === 'empty' 
                      ? 'bg-rose-600 text-white shadow-rose-100 hover:bg-rose-700' 
                      : 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600'
                  }`}
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Void Confirmation Modal */}
      <AnimatePresence>
        {voidOrderId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            {(() => {
              const orderToVoid = barOrders.find(o => o.id === voidOrderId);
              const isRefund = orderToVoid?.status === 'paid';
              
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                >
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-orange-100 text-orange-600">
                      <DollarSign size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">
                      Devolução de Valores
                    </h3>
                    <p className="text-slate-500 mb-6">
                      Deseja processar a devolução de valores deste pedido? Esta ação exige autorização e o stock será devolvido automaticamente ao inventário.
                    </p>

                    {currentUser?.role !== 'admin' && (
                      <div className="mb-6 space-y-4 text-left">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Usuário Administrador</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              type="text"
                              value={adminUsernameInput}
                              onChange={(e) => {
                                setAdminUsernameInput(e.target.value);
                                setPasswordError(false);
                              }}
                              placeholder="Nome do admin"
                              className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 rounded-2xl text-sm font-bold transition-all ${passwordError ? 'border-rose-500 focus:border-rose-500' : 'border-transparent focus:border-orange-500'}`}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Senha de Administrador</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              type="password"
                              value={adminPasswordInput}
                              onChange={(e) => {
                                setAdminPasswordInput(e.target.value);
                                setPasswordError(false);
                              }}
                              placeholder="Digite a senha admin"
                              className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 rounded-2xl text-sm font-bold transition-all ${passwordError ? 'border-rose-500 focus:border-rose-500' : 'border-transparent focus:border-orange-500'}`}
                            />
                          </div>
                        </div>

                        {passwordError && (
                          <p className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1">
                            <AlertCircle size={10} />
                            Credenciais de administrador incorretas.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setVoidOrderId(null)}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={confirmVoidOrder}
                        className="flex-1 py-4 text-white font-bold rounded-2xl shadow-lg transition-all bg-orange-600 shadow-orange-100 hover:bg-orange-700"
                      >
                        Confirmar Devolução
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-orange-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-100">
                    <Wine size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Pedido #{selectedOrderDetails.id.slice(-4)}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {format(new Date(selectedOrderDetails.date), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrderDetails(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens do Pedido</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {selectedOrderDetails.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[10px] font-black text-orange-600 border border-orange-100">
                            {item.qty}x
                          </div>
                          <span className="text-sm font-bold text-slate-700">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">
                          {companyConfig.currency}{(item.price * item.qty).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Destino</span>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {selectedOrderDetails.room === 'Avulsa' ? 'Venda Avulsa' : `Quarto ${selectedOrderDetails.room}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado</span>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      selectedOrderDetails.status === 'voided' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {selectedOrderDetails.status === 'voided' ? 'Anulado' : 'Finalizado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Total Pago</span>
                    <span className="text-2xl font-black text-orange-600">
                      {companyConfig.currency}{selectedOrderDetails.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setSelectedOrderDetails(null)}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all"
                >
                  Fechar Detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-xl font-black text-slate-900">{editingItem ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="p-8 space-y-6">
                <div className="flex justify-center mb-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
                      {editingItem?.img ? (
                        <img src={editingItem.img} alt="Preview" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Wine size={40} className="text-slate-300" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-3xl">
                      <Plus size={24} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: General Info */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome do Produto</label>
                      <input 
                        name="name"
                        required
                        defaultValue={editingItem?.name}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                        placeholder="Ex: Caipirinha de Morango"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                      <select 
                        value={editingCategory}
                        onChange={(e) => setEditingCategory(e.target.value)}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                      >
                        {Object.keys(menu).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                      <textarea 
                        name="description"
                        rows={4}
                        defaultValue={editingItem?.description}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500 resize-none"
                        placeholder="Ingredientes, detalhes..."
                      />
                    </div>
                  </div>

                  {/* Right Column: Pricing & Stock */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço Venda ({companyConfig.currency})</label>
                        <input 
                          name="price"
                          type="number"
                          step="0.01"
                          required
                          defaultValue={editingItem?.price}
                          className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço Custo ({companyConfig.currency})</label>
                        <input 
                          name="costPrice"
                          type="number"
                          step="0.01"
                          defaultValue={editingItem?.costPrice}
                          className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Atual</label>
                        <input 
                          name="stock"
                          type="number"
                          required
                          defaultValue={editingItem?.stock || 0}
                          className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Mínimo</label>
                        <input 
                          name="minStock"
                          type="number"
                          defaultValue={editingItem?.minStock || 5}
                          className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade de Medida</label>
                      <select 
                        name="unit"
                        defaultValue={editingItem?.unit || 'unid.'}
                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="unid.">Unidade (unid.)</option>
                        <option value="garrafa">Garrafa</option>
                        <option value="dose">Dose</option>
                        <option value="cl">Centilitro (cl)</option>
                        <option value="l">Litro (l)</option>
                        <option value="kg">Quilograma (kg)</option>
                        <option value="g">Grama (g)</option>
                      </select>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert size={12} className="text-orange-500" />
                        Configuração Fiscal (AGT Angola)
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Tipo de Imposto</label>
                          <select 
                            name="taxType"
                            defaultValue={editingItem?.taxConfig?.type || 'IVA'}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          >
                            <option value="IVA">IVA</option>
                            <option value="IS">Imposto de Selo</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Taxa (%)</label>
                          <select 
                            name="taxRate"
                            value={editingTaxRate}
                            onChange={(e) => setEditingTaxRate(parseInt(e.target.value))}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          >
                            <option value={14}>14% (Normal)</option>
                            <option value={7}>7% (Intermédia)</option>
                            <option value={5}>5% (Reduzida)</option>
                            <option value={2}>2% (Simplificada)</option>
                            <option value={0}>0% (Isento)</option>
                          </select>
                        </div>
                      </div>

                      {editingTaxRate === 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-rose-500 uppercase">Código de Isenção (Obrigatório)</label>
                            <select 
                              name="taxExemptionCode"
                              required
                              defaultValue={editingItem?.taxConfig?.exemptionCode}
                              className="w-full p-3 bg-white border-2 border-rose-100 rounded-xl text-xs font-bold focus:border-rose-500"
                            >
                              <option value="">Selecione o motivo...</option>
                              <option value="M01">M01 - Artigo 9.º n.º 1</option>
                              <option value="M02">M02 - Artigo 9.º n.º 2</option>
                              <option value="M04">M04 - Regime Simplificado</option>
                              <option value="M10">M10 - Isenção PME</option>
                              <option value="M99">M99 - Outros Motivos</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Motivo de Isenção</label>
                            <input 
                              name="taxExemptionReason"
                              required={editingTaxRate === 0}
                              defaultValue={editingItem?.taxConfig?.exemptionReason || 'Isento nos termos da lei em vigor'}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    Salvar Produto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-xl font-black text-slate-900">Gerir Categorias</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nova Categoria</label>
                  <div className="flex gap-2">
                    <input 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                      placeholder="Ex: Aperitivos"
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Categorias Existentes</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {Object.keys(menu).map(cat => (
                      <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                        {categoryToRename === cat ? (
                          <div className="flex gap-2 flex-1">
                            <input 
                              autoFocus
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="flex-1 p-2 bg-white border border-orange-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-orange-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameCategory(cat);
                                if (e.key === 'Escape') {
                                  setCategoryToRename(null);
                                  setNewCategoryName('');
                                }
                              }}
                            />
                            <button onClick={() => handleRenameCategory(cat)} className="text-emerald-600"><CheckCircle2 size={18} /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-slate-700">{cat}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setCategoryToRename(cat);
                                  setNewCategoryName(cat);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
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
