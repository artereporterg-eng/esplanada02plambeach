<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a47c758b-65b8-4c4e-baa9-4ffece883e99

## Arquitetura de Conexão à Base de Dados

A aplicação opera em modo **Offline-First (Local)** por padrão, com suporte a conexão manual configurável:
- **API Route:** `/api` (processada como Serverless Function via Express).
- **Base de Dados:** Conexão sob demanda e manual configurada diretamente no painel de administração (Admin > Base de Dados).
- **Padronização:** Apenas variáveis padronizadas do ambiente (como `GEMINI_API_KEY`) são mantidas no ecossistema. Credenciais de bancos de dados são geridas pelo utilizador na interface.
- **Endpoints:**
  - `POST /api/db/test` - Testa a conectividade com os dados fornecidos na requisição.
  - `POST /api/db/init-schema` - Inicializa a estrutura relacional de tabelas.
  - `POST /api/db/sync-push` - Grava coleções com garantia de integridade.
  - `POST /api/db/sync-pull` - Recupera dados para sincronização.

### Como Executar e Hospedar:
1. Instale as dependências: `npm install`
2. Inicie o servidor de desenvolvimento: `npm run dev`
3. O sistema inicia em modo local e seguro sem conexões ativas a bancos de dados externos. As credenciais podem ser inseridas manualmente pelo painel quando necessário.

