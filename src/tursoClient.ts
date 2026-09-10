// Importe especificamente da subpasta /web
import { createClient, type Client } from '@libsql/client/web';

// Resolução de credenciais do Turso para Web via import.meta.env ou configuração local
const getTursoUrl = (): string => {
  const envUrl = import.meta.env.VITE_TURSO_DATABASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim();
  }
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('active_database_config') : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.tursoUrl && typeof parsed.tursoUrl === 'string' && parsed.tursoUrl.trim() !== '') {
        return parsed.tursoUrl.trim();
      }
    }
  } catch {
    // fallback seguro
  }
  // URL de contingência para evitar erro 'URL_INVALID' durante o carregamento inicial caso ainda não esteja configurado
  return 'https://database.turso.io';
};

const getTursoAuthToken = (): string => {
  const envToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;
  if (envToken && typeof envToken === 'string') {
    return envToken.trim();
  }
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('active_database_config') : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.tursoAuthToken && typeof parsed.tursoAuthToken === 'string') {
        return parsed.tursoAuthToken.trim();
      }
    }
  } catch {
    // fallback seguro
  }
  return '';
};

/**
 * Cliente Turso LibSQL otimizado explicitamente para ambiente Web (Browser).
 * Usa HTTP / WebSockets sem módulos nativos do Node.js (fs, net, crypto nativo).
 */
export const tursoClient: Client = createClient({
  url: getTursoUrl(),
  authToken: getTursoAuthToken(),
});

/**
 * Cria ou reconfigura um cliente Turso Web sob demanda com credenciais específicas
 */
export const createTursoWebClient = (url?: string, authToken?: string): Client => {
  return createClient({
    url: url || getTursoUrl(),
    authToken: authToken !== undefined ? authToken : getTursoAuthToken(),
  });
};

export { createClient };
export default tursoClient;
