export interface TaxConfig {
  type: 'IVA' | 'IS';
  rate: number;
  code: string; // e.g., 'NOR', 'ISE'
  description: string;
  exemptionCode?: string; // e.g., 'M02', 'M04' (mandatory if rate is 0)
  exemptionReason?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  img: string;
  stock: number;
  category?: string;
  taxConfig: TaxConfig;
}

export interface Room {
  id?: string;
  number: string;
  type: 'single' | 'double' | 'suite' | 'deluxe';
  price: number;
  status: 'available' | 'occupied' | 'maintenance' | 'dirty';
  createdAt?: string;
}

export interface Customer {
  id?: string;
  name: string;
  documentId: string; // BI/Passaporte
  phone: string;
  createdAt?: string;
}

export interface Booking {
  id?: string;
  customerId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalAmount: number;
  taxAmount?: number;
  taxConfig?: TaxConfig;
  withholdingRate?: number; // e.g., 6.5 for 6.5%
  withholdingAmount?: number;
  invoiceNumber?: string; // e.g., FT AGT2024/001
  invoiceSeries?: string; // e.g., AGT
  signature?: string;
  createdAt?: string;
}

export interface BarOrder {
  id?: string;
  items: string; // JSON string or comma separated
  total: number;
  taxAmount?: number;
  taxConfig?: TaxConfig;
  roomId?: string; // If linked to room
  isCash: boolean;
  status: 'pending' | 'delivered' | 'paid' | 'voided';
  signature?: string;
  createdAt?: string;
}

export interface Event {
  id?: string;
  name: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location: string;
  customerId?: string;
  price: number;
  paidAmount?: number;
  taxAmount?: number;
  taxConfig?: TaxConfig;
  withholdingRate?: number;
  withholdingAmount?: number;
  invoiceNumber?: string;
  invoiceSeries?: string;
  status?: string;
  basePrice?: number;
  penaltyFee?: number;
  signature?: string;
  createdAt?: string;
}

export interface Employee {
  id?: string;
  name: string;
  role: 'receptionist' | 'cleaner' | 'barman' | 'manager' | 'maintenance';
  salary: number;
  phone: string;
  status: 'active' | 'inactive';
  documentId?: string; // Número do BI
  inssNumber?: string; // Número do INSS
  contractDetails?: string; // Dados Contratuais
  qualifications?: string; // Habilitações
  familyDetails?: string; // Agregado Familiar
  bonus?: number; // Definição de bónus
  supplementsAndAllowancesValue?: number; // Valor de Suplementos e Abonos
  supplementsAndAllowances?: string; // Descrição de Suplementos e Abonos
  createdAt?: string;
  payrollConfig?: {
    foodAllowance: number;
    transportAllowance: number;
    socialSecurityRate: number; // e.g., 0.03 for 3%
    irtRate: number; // Imposto sobre o Rendimento do Trabalho
    otherBonus?: number;
    otherDeductions?: number;
  };
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  foodAllowance: number;
  transportAllowance: number;
  bonus: number;
  socialSecurity: number;
  irt: number;
  otherDeductions: number;
  netSalary: number;
  status: 'pending' | 'paid';
  paymentDate?: string;
}

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  category: 'rooms' | 'bar' | 'leisure' | 'general' | 'other';
  date: string;
  createdAt?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: 'admin' | 'receptionist' | 'manager' | 'rooms_user' | 'bar_user' | 'events_user' | 'hr_user';
  name: string;
  permissions?: {
    tabs: AppTab[];
    actions: string[]; // e.g., 'void_order', 'delete_employee', 'edit_prices'
  };
}

export type AppTab = 'dashboard' | 'reception' | 'bar' | 'leisure' | 'secretaria' | 'hr' | 'admin' | 'reports' | 'finances' | 'manuals';

export interface BillingSeries {
  id: string; // e.g., 'FT', 'FR', 'FP'
  name: string;
  prefix: string;
  nextNumber: number;
  isDefault?: boolean;
}

export interface CompanyConfig {
  name: string;
  nif: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  logo?: string;
  billingSeries?: BillingSeries[];
  defaultWithholdingRate?: number; // e.g., 6.5
}

export type DatabaseProviderType = 
  | 'none'
  | 'turso'
  | 'supabase'
  | 'neon'
  | 'vercel_postgres'
  | 'upstash'
  | 'vercel_kv'
  | 'postgres_custom'
  | 'custom_rest';

export interface DeveloperSettings {
  paymentStatus: 'paid' | 'pending' | 'overdue';
  licenseType: 'monthly' | 'yearly' | 'lifetime';
  expiryDate: string;
  devUsername?: string;
  devPassword?: string;
  limitations: {
    blockSystem: boolean;
    maxRooms?: number;
    maxUsers?: number;
    disableReports: boolean;
    disableRooms: boolean;
    disableBar: boolean;
    disableLeisure: boolean;
    readOnlyRooms?: boolean;
    readOnlyBar?: boolean;
    readOnlyLeisure?: boolean;
  };
  paymentMethods: {
    bankTransfer: string;
    multicaixaExpress: string;
    iban: string;
  };
  // Universal Database Storage Settings (Vercel-compatible)
  databaseProvider?: DatabaseProviderType;
  // Supabase
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  // Neon / Vercel Postgres / Generic Postgres
  dbConnectionString?: string;
  // Turso / LibSQL (Serverless SQLite)
  tursoUrl?: string;
  tursoAuthToken?: string;
  // Upstash Redis / Vercel KV
  upstashUrl?: string;
  upstashToken?: string;
  // Custom REST API / Webhook
  customApiUrl?: string;
  customApiKey?: string;
  // Lock state
  supabaseLocked?: boolean;
  dbLocked?: boolean;
}
