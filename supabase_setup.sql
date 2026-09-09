-- SQL Script to create the auto-migration function in Supabase
-- This script sets up the full database schema for the Nexos Soluções Digitais Hotel Management System.
-- Run this in the Supabase SQL Editor (SQL Editor -> New Query -> Paste -> Run)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION gerir_tabelas_automatico()
RETURNS text AS $$
BEGIN
  -- 1. Rooms Table
  CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('single', 'double', 'suite', 'deluxe')),
    price DECIMAL NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'dirty')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 2. Customers Table
  CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    document_id TEXT UNIQUE NOT NULL, -- BI / Passaporte
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 3. Bookings Table
  CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    room_id UUID REFERENCES rooms(id),
    check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    total_amount DECIMAL NOT NULL,
    tax_amount DECIMAL DEFAULT 0,
    tax_config JSONB, -- Stores TaxConfig interface
    withholding_rate DECIMAL DEFAULT 0,
    withholding_amount DECIMAL DEFAULT 0,
    invoice_number TEXT,
    invoice_series TEXT,
    signature TEXT, -- AGT Compliance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 4. Bar Orders Table
  CREATE TABLE IF NOT EXISTS bar_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    items TEXT NOT NULL, -- Detailed string or JSON of ordered items
    total DECIMAL NOT NULL,
    tax_amount DECIMAL DEFAULT 0,
    tax_config JSONB,
    room_id UUID REFERENCES rooms(id),
    is_cash BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'paid', 'voided')),
    signature TEXT, -- AGT Compliance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 5. Events Table
  CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    start_time TEXT,
    end_time TEXT,
    location TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    price DECIMAL NOT NULL,
    paid_amount DECIMAL DEFAULT 0,
    tax_amount DECIMAL DEFAULT 0,
    tax_config JSONB,
    withholding_rate DECIMAL DEFAULT 0,
    withholding_amount DECIMAL DEFAULT 0,
    base_price DECIMAL,
    penalty_fee DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'scheduled',
    invoice_number TEXT,
    invoice_series TEXT,
    signature TEXT, -- AGT Compliance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 6. Employees Table
  CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('receptionist', 'cleaner', 'barman', 'manager', 'maintenance')),
    salary DECIMAL NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    document_id TEXT, -- Número do BI
    inss_number TEXT, -- Número do INSS
    contract_details TEXT, -- Dados Contratuais
    qualifications TEXT, -- Habilitações
    family_details TEXT, -- Agregado Familiar
    bonus DECIMAL DEFAULT 0, -- Definição de bónus
    supplements_and_allowances_value DECIMAL DEFAULT 0, -- Valor de Suplementos e Abonos
    supplements_and_allowances TEXT, -- Descrição de Suplementos e Abonos
    payroll_config JSONB, -- Stores payroll configuration (allowances, irt, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 7. Payroll Records Table
  CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    month TEXT NOT NULL, -- YYYY-MM
    base_salary DECIMAL NOT NULL,
    food_allowance DECIMAL DEFAULT 0,
    transport_allowance DECIMAL DEFAULT 0,
    bonus DECIMAL DEFAULT 0,
    supplements DECIMAL DEFAULT 0,
    social_security DECIMAL NOT NULL,
    irt DECIMAL NOT NULL,
    other_deductions DECIMAL DEFAULT 0,
    net_salary DECIMAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 8. Expenses Table
  CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('rooms', 'bar', 'leisure', 'general', 'other')),
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 9. Menu Items (Bar Inventory)
  CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price DECIMAL NOT NULL,
    description TEXT,
    img TEXT,
    stock INTEGER DEFAULT 0,
    category TEXT,
    tax_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 10. Billing Series
  CREATE TABLE IF NOT EXISTS billing_series (
    id TEXT PRIMARY KEY, -- e.g., 'FT'
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    next_number INTEGER DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 11. Company Configuration
  CREATE TABLE IF NOT EXISTS company_config (
    id INTEGER PRIMARY KEY DEFAULT 1, -- Only one record
    name TEXT NOT NULL,
    nif TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    currency TEXT DEFAULT 'Kz',
    logo TEXT,
    default_withholding_rate DECIMAL DEFAULT 6.5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 12. Developer Settings (System Locks & License)
  CREATE TABLE IF NOT EXISTS developer_settings (
    id INTEGER PRIMARY KEY DEFAULT 1, -- Only one record
    payment_status TEXT DEFAULT 'paid',
    license_type TEXT DEFAULT 'lifetime',
    expiry_date TIMESTAMP WITH TIME ZONE,
    limitations JSONB, -- JSON of system restrictions
    payment_methods JSONB, -- JSON of bank info for developer
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- 13. System Users (Custom Profiles)
  CREATE TABLE IF NOT EXISTS users_custom (
    id UUID PRIMARY KEY, -- Optional link to Supabase Auth (or generated UUID)
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'receptionist', 'manager', 'rooms_user', 'bar_user', 'events_user', 'hr_user')),
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Ensure we can do offline-first user sync by dropping foreign key if it was previously created
  ALTER TABLE IF EXISTS users_custom DROP CONSTRAINT IF EXISTS users_custom_id_fkey;

  -- ====================================================================
  -- DESATIVAR ROW LEVEL SECURITY (RLS) E LIBERAR ACESSO TOTAL DE LEITURA/ESCRITA
  -- ====================================================================
  ALTER TABLE IF EXISTS rooms DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS bar_orders DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS events DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS payroll_records DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS menu_items DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS billing_series DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS company_config DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS developer_settings DISABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS users_custom DISABLE ROW LEVEL SECURITY;

  -- Conceder permissões totais para anon, authenticated e service_role
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

  RETURN 'Todas as tabelas Nexos Soluções Digitais foram configuradas com sucesso e com acesso total liberado.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar a função imediatamente para aplicar a configuração
SELECT gerir_tabelas_automatico();

