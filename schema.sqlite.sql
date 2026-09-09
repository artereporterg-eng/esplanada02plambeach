-- ====================================================================
-- ESQUEMA COMPLETO EM SQLITE / LIBSQL PARA TURSO & VERCEL
-- Sistema de Gestão Hoteleira - Pérola do Oceano / Nexos Soluções Digitais
-- ====================================================================

-- 1. Tabela de Armazenamento Universal e Sincronização em Tempo Real (Sync Rápido)
CREATE TABLE IF NOT EXISTS perola_storage (
  collection TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Tabela de Quartos
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single', 'double', 'suite', 'deluxe')),
  price REAL NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'dirty')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- 3. Tabela de Clientes / Hóspedes
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document_id TEXT UNIQUE NOT NULL, -- BI / Passaporte
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_document ON customers(document_id);

-- 4. Tabela de Reservas e Alojamento
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  room_id TEXT REFERENCES rooms(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  total_amount REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  tax_config TEXT, -- JSON com tipo e taxas de imposto (IVA)
  withholding_rate REAL DEFAULT 0,
  withholding_amount REAL DEFAULT 0,
  invoice_number TEXT,
  invoice_series TEXT,
  signature TEXT, -- Assinatura Digital / Conformidade AGT
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 5. Tabela de Pedidos do Bar e Restaurante
CREATE TABLE IF NOT EXISTS bar_orders (
  id TEXT PRIMARY KEY,
  items TEXT NOT NULL, -- JSON com itens do pedido
  total REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  tax_config TEXT,
  room_id TEXT REFERENCES rooms(id),
  is_cash INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'paid', 'voided')),
  signature TEXT, -- Assinatura Digital AGT
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bar_orders_status ON bar_orders(status);

-- 6. Tabela de Eventos e Lazer
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  end_date TEXT,
  start_time TEXT,
  end_time TEXT,
  location TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  price REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  tax_config TEXT,
  withholding_rate REAL DEFAULT 0,
  withholding_amount REAL DEFAULT 0,
  base_price REAL,
  penalty_fee REAL DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  invoice_number TEXT,
  invoice_series TEXT,
  signature TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- 7. Tabela de Funcionários e Recursos Humanos
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('receptionist', 'cleaner', 'barman', 'manager', 'maintenance')),
  salary REAL NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  document_id TEXT, -- BI
  inss_number TEXT, -- INSS
  contract_details TEXT,
  qualifications TEXT,
  family_details TEXT,
  bonus REAL DEFAULT 0,
  supplements_and_allowances_value REAL DEFAULT 0,
  supplements_and_allowances TEXT,
  payroll_config TEXT, -- JSON com configurações de IRT, subsídios, etc.
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- 8. Tabela de Folhas de Salário (Processamento Salarial)
CREATE TABLE IF NOT EXISTS payroll_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id),
  month TEXT NOT NULL, -- AAAA-MM
  base_salary REAL NOT NULL,
  food_allowance REAL DEFAULT 0,
  transport_allowance REAL DEFAULT 0,
  bonus REAL DEFAULT 0,
  supplements REAL DEFAULT 0,
  social_security REAL NOT NULL,
  irt REAL NOT NULL,
  other_deductions REAL DEFAULT 0,
  net_salary REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll_records(month);

-- 9. Tabela de Despesas Financeiras
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('rooms', 'bar', 'leisure', 'general', 'other')),
  date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- 10. Tabela de Itens de Menu / Estoque do Bar
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  img TEXT,
  stock INTEGER DEFAULT 0,
  category TEXT,
  tax_config TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 11. Tabela de Séries de Faturação
CREATE TABLE IF NOT EXISTS billing_series (
  id TEXT PRIMARY KEY, -- ex: 'FT'
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  next_number INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 12. Tabela de Dados da Empresa
CREATE TABLE IF NOT EXISTS company_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL,
  nif TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  currency TEXT DEFAULT 'Kz',
  logo TEXT,
  default_withholding_rate REAL DEFAULT 6.5,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 13. Tabela de Configurações do Desenvolvedor e Licença
CREATE TABLE IF NOT EXISTS developer_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  payment_status TEXT DEFAULT 'paid',
  license_type TEXT DEFAULT 'lifetime',
  expiry_date TEXT,
  limitations TEXT, -- JSON com limitações de módulos
  payment_methods TEXT, -- JSON com dados bancários
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 14. Tabela de Utilizadores e Controlo de Acesso
CREATE TABLE IF NOT EXISTS users_custom (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'receptionist', 'manager', 'rooms_user', 'bar_user', 'events_user', 'hr_user')),
  permissions TEXT, -- JSON com permissões granulares
  created_at TEXT DEFAULT (datetime('now'))
);
