import "dotenv/config";
import express, { Request, Response } from "express";
import { createClient as createLibsqlClient, Client as LibsqlClient } from "@libsql/client/web";
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Helper to get database connection info from environment neutrally
export const getDatabaseEnv = () => {
  const pgUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const tursoUrl = (process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL || process.env.TURSO_URL || process.env.LIBSQL_URL || "").trim();
  const tursoToken = (process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN || "").trim();
  const upstashUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const upstashToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

  let activeProvider = "none";
  if (pgUrl) activeProvider = "neon";
  else if (supabaseUrl) activeProvider = "supabase";
  else if (tursoUrl) activeProvider = "turso";
  else if (upstashUrl) activeProvider = "upstash";

  return {
    pgUrl,
    supabaseUrl,
    supabaseKey,
    tursoUrl,
    tursoToken,
    upstashUrl,
    upstashToken,
    activeProvider
  };
};

// In-memory cache for LibSQL/SQLite clients if used
const libsqlClients = new Map<string, LibsqlClient>();

function getTursoClient(url: string, authToken?: string): LibsqlClient {
  const cleanUrl = url.trim().replace(/['"]+/g, '');
  const cleanToken = (authToken || '').trim().replace(/['"]+/g, '');
  const cacheKey = `${cleanUrl}::${cleanToken}`;
  
  if (!libsqlClients.has(cacheKey)) {
    try {
      const client = createLibsqlClient({
        url: cleanUrl,
        authToken: cleanToken || undefined
      });
      libsqlClients.set(cacheKey, client);
    } catch (err: any) {
      console.error("[LibSQL Client Init Error]:", err);
      throw new Error(`Falha ao inicializar cliente de base de dados: ${err?.message || err}`);
    }
  }
  return libsqlClients.get(cacheKey)!;
}

// 1. Healthcheck
app.get("/api/health", (_req: Request, res: Response) => {
  const { activeProvider } = getDatabaseEnv();
  res.json({
    status: "ok",
    runtime: "standardized-environment",
    activeProvider,
    timestamp: new Date().toISOString()
  });
});

// 2. Detect environment variables for external databases
app.get("/api/db/env-detect", (_req: Request, res: Response) => {
  const env = getDatabaseEnv();
  res.json({
    success: true,
    detected: {
      neonOrPostgres: env.pgUrl,
      supabaseUrl: env.supabaseUrl,
      supabaseAnonKey: env.supabaseKey,
      tursoUrl: env.tursoUrl,
      tursoAuthToken: env.tursoToken,
      upstashUrl: env.upstashUrl,
      upstashToken: env.upstashToken,
      activeProvider: env.activeProvider
    }
  });
});

// 2.5. Disconnect / Remove all database connections
app.post("/api/db/disconnect", (_req: Request, res: Response) => {
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    libsqlClients.clear();
    res.json({ success: true, message: "Conexão a base de dados externa removida. Sistema a operar em modo local." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Erro ao desconectar base de dados." });
  }
});

// 3. Test connection for Turso and other providers
app.post("/api/db/test", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { provider = "none", config } = req.body;

    if (provider === "none" || !provider) {
      return res.json({
        success: false,
        provider: "none",
        message: "Nenhuma base de dados conectada. O sistema está a operar em modo puramente local (Offline-First)."
      });
    }

    // TURSO / LIBSQL SQLite
    if (provider === "turso") {
      const env = getDatabaseEnv();
      const url = (config?.tursoUrl || env.tursoUrl || "").trim().replace(/['"]+/g, '');
      const authToken = (config?.tursoAuthToken || env.tursoToken || "").trim().replace(/['"]+/g, '');

      if (!url) {
        return res.json({
          success: false,
          provider: "turso",
          error: "URL da base de dados não configurada."
        });
      }

      try {
        const client = getTursoClient(url, authToken);
        const result = await client.execute("SELECT 1 as connected, datetime('now') as server_time, sqlite_version() as sqlite_version;");
        const latencyMs = Date.now() - startTime;
        
        return res.json({
          success: true,
          provider: "turso",
          latencyMs,
          message: `Conectado com sucesso ao Turso SQLite (${latencyMs}ms). SQLite v${result.rows?.[0]?.sqlite_version || '3.x'}`,
          details: result.rows?.[0]
        });
      } catch (tursoErr: any) {
        return res.json({
          success: false,
          provider: "turso",
          error: `Erro ao conectar ao Turso: ${tursoErr?.message || tursoErr}`
        });
      }
    }

    // NEON / VERCEL POSTGRES
    if (provider === "neon" || provider === "vercel_postgres" || provider === "postgres_custom") {
      let connectionString = (config?.connectionString || "").trim();
      connectionString = connectionString.replace(/^psql\s+['"]?/i, '').replace(/['"]$/g, '').trim();

      if (!connectionString) {
        return res.json({ success: false, provider, error: "String de conexão PostgreSQL não fornecida." });
      }

      try {
        const sql = neon(connectionString);
        const result = await sql`SELECT 1 as connected, NOW() as current_time;`;
        const latencyMs = Date.now() - startTime;
        return res.json({
          success: true,
          provider,
          latencyMs,
          message: `Conectado com sucesso ao PostgreSQL (${latencyMs}ms).`,
          details: result[0]
        });
      } catch (pgErr: any) {
        return res.json({ success: false, provider, error: `Erro ao ligar ao PostgreSQL: ${pgErr?.message || pgErr}` });
      }
    }

    // SUPABASE
    if (provider === "supabase") {
      let url = (config?.supabaseUrl || "").trim().replace(/\/+$/, "").replace(/['"]+/g, '');
      url = url.replace(/\/rest\/v1\/?$/, '');
      const key = (config?.supabaseAnonKey || "").trim().replace(/['"]+/g, '');

      if (!url || !key) {
        return res.json({ success: false, error: "URL e Chave Anónima do Supabase são obrigatórios." });
      }
      const targetUrl = `${url.startsWith("http") ? url : "https://" + url}/rest/v1/`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(targetUrl, {
          method: "GET",
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const latencyMs = Date.now() - startTime;
          return res.json({ success: true, provider, latencyMs, message: `Conectado ao Supabase (${latencyMs}ms).` });
        } else {
          return res.json({ success: false, provider, error: `Supabase respondeu com código ${response.status}` });
        }
      } catch (supErr: any) {
        return res.json({ success: false, provider, error: `Erro ao alcançar Supabase: ${supErr?.message || supErr}` });
      }
    }

    // UPSTASH / VERCEL KV
    if (provider === "upstash" || provider === "vercel_kv") {
      let url = (config?.upstashUrl || "").trim().replace(/\/+$/, "").replace(/['"]+/g, '');
      const token = (config?.upstashToken || "").trim().replace(/['"]+/g, '');
      if (!url || !token) return res.json({ success: false, error: "URL e Token do Upstash são obrigatórios." });
      if (!url.startsWith("http")) url = "https://" + url;

      try {
        const response = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const latencyMs = Date.now() - startTime;
          return res.json({ success: true, provider, latencyMs, message: `Conectado ao Vercel KV (${latencyMs}ms).` });
        }
        return res.json({ success: false, provider, error: `Upstash respondeu com código ${response.status}` });
      } catch (kvErr: any) {
        return res.json({ success: false, provider, error: `Erro ao ligar ao Upstash: ${kvErr?.message || kvErr}` });
      }
    }

    return res.json({ success: false, error: `Provedor desconhecido: ${provider}` });
  } catch (error: any) {
    return res.json({ success: false, error: error?.message || "Erro interno ao testar conexão." });
  }
});

// 4. Initialize Database Schema (Creates all tables on PostgreSQL or SQLite)
app.post("/api/db/init-schema", async (req: Request, res: Response) => {
  try {
    const { provider = "neon", config } = req.body;

    // PostgreSQL Schema Initialization
    if (provider === "neon" || provider === "vercel_postgres" || provider === "postgres_custom" || config?.connectionString) {
      const env = getDatabaseEnv();
      let connectionString = (config?.connectionString || env.pgUrl || "").trim();
      connectionString = connectionString.replace(/^psql\s+['"]?/i, '').replace(/['"]$/g, '').trim();

      if (!connectionString) {
        return res.status(400).json({ success: false, error: "String de conexão PostgreSQL não fornecida." });
      }

      const sql = neon(connectionString);
      await sql`
        CREATE TABLE IF NOT EXISTS perola_storage (
          collection VARCHAR(100) PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS rooms (
          id VARCHAR(100) PRIMARY KEY,
          number VARCHAR(50) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          price NUMERIC(15, 2) NOT NULL,
          status VARCHAR(50) DEFAULT 'available',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          document_id VARCHAR(100) UNIQUE NOT NULL,
          phone VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(100) PRIMARY KEY,
          customer_id VARCHAR(100),
          room_id VARCHAR(100),
          check_in VARCHAR(50) NOT NULL,
          check_out VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          payment_status VARCHAR(50) DEFAULT 'pending',
          total_amount NUMERIC(15, 2) NOT NULL,
          tax_amount NUMERIC(15, 2) DEFAULT 0,
          tax_config TEXT,
          withholding_rate NUMERIC(6, 2) DEFAULT 0,
          withholding_amount NUMERIC(15, 2) DEFAULT 0,
          invoice_number VARCHAR(100),
          invoice_series VARCHAR(50),
          signature TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS menu_items (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price NUMERIC(15, 2) NOT NULL,
          description TEXT,
          img TEXT,
          stock INTEGER DEFAULT 0,
          category VARCHAR(100),
          tax_config TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS bar_orders (
          id VARCHAR(100) PRIMARY KEY,
          items TEXT NOT NULL,
          total NUMERIC(15, 2) NOT NULL,
          tax_amount NUMERIC(15, 2) DEFAULT 0,
          tax_config TEXT,
          room_id VARCHAR(100),
          is_cash BOOLEAN DEFAULT TRUE,
          status VARCHAR(50) DEFAULT 'pending',
          signature TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          date VARCHAR(50) NOT NULL,
          end_date VARCHAR(50),
          start_time VARCHAR(50),
          end_time VARCHAR(50),
          location VARCHAR(255) NOT NULL,
          customer_id VARCHAR(100),
          price NUMERIC(15, 2) NOT NULL,
          paid_amount NUMERIC(15, 2) DEFAULT 0,
          tax_amount NUMERIC(15, 2) DEFAULT 0,
          tax_config TEXT,
          withholding_rate NUMERIC(6, 2) DEFAULT 0,
          withholding_amount NUMERIC(15, 2) DEFAULT 0,
          base_price NUMERIC(15, 2),
          penalty_fee NUMERIC(15, 2) DEFAULT 0,
          status VARCHAR(50) DEFAULT 'scheduled',
          invoice_number VARCHAR(100),
          invoice_series VARCHAR(50),
          signature TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS employees (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(100) NOT NULL,
          salary NUMERIC(15, 2) NOT NULL,
          phone VARCHAR(50),
          status VARCHAR(50) DEFAULT 'active',
          document_id VARCHAR(100),
          inss_number VARCHAR(100),
          contract_details TEXT,
          qualifications TEXT,
          family_details TEXT,
          bonus NUMERIC(15, 2) DEFAULT 0,
          supplements_and_allowances_value NUMERIC(15, 2) DEFAULT 0,
          supplements_and_allowances TEXT,
          payroll_config TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS payroll_records (
          id VARCHAR(100) PRIMARY KEY,
          employee_id VARCHAR(100) NOT NULL,
          month VARCHAR(20) NOT NULL,
          base_salary NUMERIC(15, 2) NOT NULL,
          food_allowance NUMERIC(15, 2) DEFAULT 0,
          transport_allowance NUMERIC(15, 2) DEFAULT 0,
          bonus NUMERIC(15, 2) DEFAULT 0,
          supplements NUMERIC(15, 2) DEFAULT 0,
          social_security NUMERIC(15, 2) NOT NULL,
          irt NUMERIC(15, 2) NOT NULL,
          other_deductions NUMERIC(15, 2) DEFAULT 0,
          net_salary NUMERIC(15, 2) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          payment_date VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS expenses (
          id VARCHAR(100) PRIMARY KEY,
          description TEXT NOT NULL,
          amount NUMERIC(15, 2) NOT NULL,
          category VARCHAR(100) NOT NULL,
          date VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS billing_series (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          prefix VARCHAR(50) NOT NULL,
          next_number INTEGER DEFAULT 1,
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS company_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          name VARCHAR(255) NOT NULL,
          nif VARCHAR(50) NOT NULL,
          phone VARCHAR(50),
          email VARCHAR(100),
          address TEXT,
          currency VARCHAR(20) DEFAULT 'Kz',
          logo TEXT,
          default_withholding_rate NUMERIC(6, 2) DEFAULT 6.5,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS developer_settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          payment_status VARCHAR(50) DEFAULT 'paid',
          license_type VARCHAR(50) DEFAULT 'lifetime',
          expiry_date VARCHAR(50),
          limitations TEXT,
          payment_methods TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS users_custom (
          id VARCHAR(100) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          permissions TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      return res.json({
        success: true,
        message: "Estrutura relacional do PostgreSQL inicializada com sucesso!"
      });
    }

    // SQLite / LibSQL Schema Initialization
    const env = getDatabaseEnv();
    const url = (config?.tursoUrl || env.tursoUrl || "").trim().replace(/['"]+/g, '');
    const authToken = (config?.tursoAuthToken || env.tursoToken || "").trim().replace(/['"]+/g, '');

    if (!url) {
      return res.status(400).json({ success: false, error: "URL da base de dados não fornecida." });
    }

    const client = getTursoClient(url, authToken);

    // Execute SQLite statements sequentially
    const ddlStatements = [
      `CREATE TABLE IF NOT EXISTS perola_storage (
        collection TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        price REAL NOT NULL,
        status TEXT DEFAULT 'available',
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        document_id TEXT UNIQUE NOT NULL,
        phone TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        room_id TEXT,
        check_in TEXT NOT NULL,
        check_out TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'pending',
        total_amount REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        tax_config TEXT,
        withholding_rate REAL DEFAULT 0,
        withholding_amount REAL DEFAULT 0,
        invoice_number TEXT,
        invoice_series TEXT,
        signature TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS bar_orders (
        id TEXT PRIMARY KEY,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        tax_config TEXT,
        room_id TEXT,
        is_cash INTEGER DEFAULT 1,
        status TEXT DEFAULT 'pending',
        signature TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        end_date TEXT,
        start_time TEXT,
        end_time TEXT,
        location TEXT NOT NULL,
        customer_id TEXT,
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
      );`,
      `CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        salary REAL NOT NULL,
        phone TEXT,
        status TEXT DEFAULT 'active',
        document_id TEXT,
        inss_number TEXT,
        contract_details TEXT,
        qualifications TEXT,
        family_details TEXT,
        bonus REAL DEFAULT 0,
        supplements_and_allowances_value REAL DEFAULT 0,
        supplements_and_allowances TEXT,
        payroll_config TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS payroll_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT,
        month TEXT NOT NULL,
        base_salary REAL NOT NULL,
        food_allowance REAL DEFAULT 0,
        transport_allowance REAL DEFAULT 0,
        bonus REAL DEFAULT 0,
        supplements REAL DEFAULT 0,
        social_security REAL NOT NULL,
        irt REAL NOT NULL,
        other_deductions REAL DEFAULT 0,
        net_salary REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_date TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        img TEXT,
        stock INTEGER DEFAULT 0,
        category TEXT,
        tax_config TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS billing_series (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        next_number INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS company_config (
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
      );`,
      `CREATE TABLE IF NOT EXISTS developer_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        payment_status TEXT DEFAULT 'paid',
        license_type TEXT DEFAULT 'lifetime',
        expiry_date TEXT,
        limitations TEXT,
        payment_methods TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS users_custom (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        permissions TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );`
    ];

    for (const sql of ddlStatements) {
      await client.execute(sql);
    }

    res.json({
      success: true,
      message: "Estrutura relacional do Turso SQLite inicializada com sucesso!"
    });
  } catch (err: any) {
    console.error("Erro ao inicializar esquema Turso:", err);
    res.status(500).json({ success: false, error: err?.message || "Erro ao criar tabelas no Turso." });
  }
});

// 5. Sync Push (Writes collection payload into Turso or chosen DB)
app.post("/api/db/sync-push", async (req: Request, res: Response) => {
  try {
    const { provider = "none", config, collection, data } = req.body;
    if (provider === "none" || !provider) {
      return res.json({ success: true, message: "Modo local: dados guardados localmente." });
    }
    if (!collection || data === undefined) {
      return res.status(400).json({ success: false, error: "Parâmetros 'collection' e 'data' são obrigatórios." });
    }

    // NEON / VERCEL POSTGRES / POSTGRESQL EXTERNO
    if (provider === "neon" || provider === "vercel_postgres" || provider === "postgres_custom") {
      const env = getDatabaseEnv();
      const connectionString = config?.connectionString || env.pgUrl;
      if (!connectionString) return res.json({ success: false, error: "Sem string de conexão PostgreSQL." });

      const sql = neon(connectionString);
      await sql`
        CREATE TABLE IF NOT EXISTS perola_storage (
          collection VARCHAR(100) PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      const jsonPayload = JSON.stringify(data);
      await sql`
        INSERT INTO perola_storage (collection, payload, updated_at)
        VALUES (${collection}, ${jsonPayload}::jsonb, NOW())
        ON CONFLICT (collection) 
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `;
      return res.json({ success: true, message: `Coleção '${collection}' sincronizada no PostgreSQL.` });
    }

    // TURSO / LIBSQL SQLITE
    if (provider === "turso") {
      const env = getDatabaseEnv();
      const url = config?.tursoUrl || env.tursoUrl;
      const authToken = config?.tursoAuthToken || env.tursoToken;
      if (!url) return res.json({ success: false, error: "URL da base de dados não configurada." });

      const client = getTursoClient(url, authToken);

      // Ensure storage table exists
      await client.execute(`
        CREATE TABLE IF NOT EXISTS perola_storage (
          collection TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      const jsonPayload = JSON.stringify(data);
      await client.execute({
        sql: `
          INSERT INTO perola_storage (collection, payload, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT (collection) 
          DO UPDATE SET payload = excluded.payload, updated_at = datetime('now');
        `,
        args: [collection, jsonPayload]
      });

      return res.json({ success: true, message: `Coleção '${collection}' sincronizada.` });
    }

    // UPSTASH / KV
    if (provider === "upstash" || provider === "vercel_kv") {
      let url = (config?.upstashUrl || "").trim().replace(/\/+$/, "");
      const token = config?.upstashToken;
      if (!url || !token) return res.json({ success: false, error: "Credenciais do Upstash não configuradas." });
      if (!url.startsWith("http")) url = "https://" + url;

      const response = await fetch(`${url}/set/perola_${collection}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return res.json({ success: response.ok, message: `Coleção '${collection}' guardada no Vercel KV.` });
    }

    return res.json({ success: false, error: `Provedor ${provider} não suportado para push direto.` });
  } catch (err: any) {
    console.error("Erro no sync-push:", err);
    return res.json({ success: false, error: err?.message || "Erro ao guardar dados na base de dados." });
  }
});

// 6. Sync Pull (Reads collections from Turso or chosen DB)
app.post("/api/db/sync-pull", async (req: Request, res: Response) => {
  try {
    const { provider = "none", config, collection } = req.body;
    if (provider === "none" || !provider) {
      return res.json({ success: true, data: {}, message: "Modo local: nenhuma base de dados remota conectada." });
    }

    // NEON / VERCEL POSTGRES / POSTGRESQL EXTERNO
    if (provider === "neon" || provider === "vercel_postgres" || provider === "postgres_custom") {
      const env = getDatabaseEnv();
      const connectionString = config?.connectionString || env.pgUrl;
      if (!connectionString) return res.json({ success: false, error: "Sem string de conexão PostgreSQL." });

      const sql = neon(connectionString);
      const rows = await sql`
        SELECT collection, payload FROM perola_storage
        ${collection ? sql`WHERE collection = ${collection}` : sql``};
      `.catch(() => []);

      const result: Record<string, any> = {};
      for (const row of rows) {
        result[row.collection] = row.payload;
      }
      return res.json({
        success: true,
        data: collection ? result[collection] || null : result,
        count: rows.length
      });
    }

    // TURSO / LIBSQL SQLITE
    if (provider === "turso") {
      const env = getDatabaseEnv();
      const url = config?.tursoUrl || env.tursoUrl;
      const authToken = config?.tursoAuthToken || env.tursoToken;
      if (!url) return res.json({ success: false, error: "Sem URL da base de dados." });

      const client = getTursoClient(url, authToken);

      const queryResult = collection
        ? await client.execute({ sql: "SELECT collection, payload FROM perola_storage WHERE collection = ?;", args: [collection] }).catch(() => ({ rows: [] }))
        : await client.execute("SELECT collection, payload FROM perola_storage;").catch(() => ({ rows: [] }));

      const result: Record<string, any> = {};
      for (const row of queryResult.rows || []) {
        try {
          result[String(row.collection)] = JSON.parse(String(row.payload));
        } catch {
          result[String(row.collection)] = row.payload;
        }
      }

      return res.json({
        success: true,
        data: collection ? result[collection] || null : result,
        count: (queryResult.rows || []).length
      });
    }

    // UPSTASH / KV
    if (provider === "upstash" || provider === "vercel_kv") {
      const env = getDatabaseEnv();
      let url = (config?.upstashUrl || env.upstashUrl || "").trim().replace(/\/+$/, "");
      const token = config?.upstashToken || env.upstashToken;
      if (!url || !token) return res.json({ success: false, error: "Credenciais do Upstash em falta." });
      if (!url.startsWith("http")) url = "https://" + url;

      if (collection) {
        const response = await fetch(`${url}/get/perola_${collection}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          let parsed = data?.result;
          if (typeof parsed === "string") {
            try { parsed = JSON.parse(parsed); } catch {}
          }
          return res.json({ success: true, data: parsed });
        }
      }
      return res.json({ success: true, data: null });
    }

    return res.json({ success: false, error: `Provedor ${provider} não suportado.` });
  } catch (err: any) {
    console.error("Erro no sync-pull:", err);
    return res.json({ success: false, error: err?.message || "Erro ao ler dados da base de dados." });
  }
});

// 7. Generic Direct SQL query endpoint (Supports PostgreSQL and SQLite)
app.post("/api/db/query", async (req: Request, res: Response) => {
  try {
    const { provider = "neon", sql: sqlQuery, args = [], config } = req.body;
    if (!sqlQuery || typeof sqlQuery !== "string") {
      return res.status(400).json({ success: false, error: "Parâmetro 'sql' é obrigatório." });
    }

    // PostgreSQL Query
    if (provider === "neon" || provider === "vercel_postgres" || provider === "postgres_custom" || config?.connectionString) {
      const env = getDatabaseEnv();
      const connectionString = config?.connectionString || env.pgUrl;
      if (!connectionString) {
        return res.status(400).json({ success: false, error: "String de conexão PostgreSQL não configurada." });
      }

      const sql = neon(connectionString);
      const rows = await (sql as any)(sqlQuery, args);
      return res.json({
        success: true,
        rows,
        rowsAffected: Array.isArray(rows) ? rows.length : 0
      });
    }

    // SQLite / LibSQL Query
    if (provider === "turso" || config?.tursoUrl) {
      const env = getDatabaseEnv();
      const url = config?.tursoUrl || env.tursoUrl;
      const authToken = config?.tursoAuthToken || env.tursoToken;

      if (!url) {
        return res.status(400).json({ success: false, error: "URL da base de dados não configurada." });
      }

      const client = getTursoClient(url, authToken);
      const result = await client.execute({ sql: sqlQuery, args });

      return res.json({
        success: true,
        columns: result.columns,
        rows: result.rows,
        rowsAffected: result.rowsAffected
      });
    }

    return res.status(400).json({ success: false, error: `Provedor '${provider}' não suporta execução de queries diretas.` });
  } catch (err: any) {
    res.json({ success: false, error: err?.message || "Erro ao executar query na base de dados." });
  }
});

// 8. Save environment config
app.post("/api/save-env", (_req: Request, res: Response) => {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envLocalPath = path.join(process.cwd(), ".env.local");
    try {
      if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
      if (fs.existsSync(envLocalPath)) fs.unlinkSync(envLocalPath);
    } catch (_) {}

    res.json({ success: true, message: "Configuração atualizada com sucesso." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Erro ao atualizar configuração." });
  }
});

// 9. Legacy compatibility check
app.post("/api/proxy-supabase-check", async (req: Request, res: Response) => {
  try {
    const { url, anonKey } = req.body;
    if (!url || !anonKey) return res.status(400).json({ success: false, error: "url e anonKey são obrigatórios." });

    let cleanUrl = url.trim().replace(/\/+$/, "");
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) cleanUrl = "https://" + cleanUrl;

    const targetUrl = `${cleanUrl}/rest/v1/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.json({ success: response.ok });
  } catch {
    return res.json({ success: false, error: "Falha na verificação." });
  }
});

export default app;
