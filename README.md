# GitHub Activity Dashboard (PWA + Electron + Vercel)

Dashboard para acompanhar **PRs** e **Issues** abertas via GitHub GraphQL, com acesso protegido por **PIN** e **token do GitHub mantido apenas no backend**.

## Visão geral

- **Frontend**: Vite + React.
- **Backend**:
  - **Produção**: Vercel Functions em `api/*` (ex.: `api/github.js`).
  - **Dev local**: Express em `server.js` (porta `3001`) + proxy do Vite.
- **Auth do app**: o cliente envia `x-app-pin`; o backend valida contra `APP_PIN`.
- **Token GitHub**: `GITHUB_TOKEN` só existe no backend (Vercel/.env local). **Nunca vai para o frontend**.
- **PWA**: `vite-plugin-pwa` com `icon-192.png` e `icon-512.png`.
- **Desktop**: Electron empacota o build do Vite e aponta para o backend (Vercel) em produção.

## Segurança (como funciona)

Fluxo do request:

1. O usuário digita o **PIN** no app (não é persistido).
2. O app chama `POST /api/github` com:
   - Header `x-app-pin: <PIN>`
   - Body `{ "query": "..." }`
3. O backend valida o PIN e faz o proxy para `https://api.github.com/graphql` usando `process.env.GITHUB_TOKEN`.

Extras:
- `api/github.js` aplica **rate limit** simples por IP (configurável por env).

## Variáveis de ambiente

Crie um arquivo `.env` local (ou use a Vercel em produção). Exemplo em `.env.example`.

- **Obrigatórias (backend)**:
  - `GITHUB_TOKEN`: PAT do GitHub com escopos compatíveis com suas queries.
  - `APP_PIN`: PIN exigido pelo backend.

- **Opcionais**:
  - `VITE_API_BASE`: origem do backend (sem barra final). Em Vercel pode ficar vazio.
  - `ELECTRON_API_BASE`: origem do backend usada pelo Electron empacotado (sem barra final).
  - `RATE_LIMIT_WINDOW_MS`: janela do rate limit (default `60000`).
  - `RATE_LIMIT_MAX`: máximo de requests por janela (default `30`).

## Rodar em desenvolvimento (web)

Pré-requisitos:
- Node.js
- pnpm

Instalar dependências:

```bash
pnpm install
```

Rodar Vite + Express:

```bash
pnpm dev:full
```

Isso sobe:
- Vite em `http://localhost:5173`
- Express em `http://localhost:3001`

O Vite faz proxy de `/api/*` para `http://localhost:3001`.

## Deploy na Vercel (produção)

1. Importe o repositório na Vercel.
2. Em **Settings → Environment Variables**, crie:
   - `GITHUB_TOKEN`
   - `APP_PIN`
   - (opcional) `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
3. Faça o deploy.

Notas:
- `vercel.json` define `outputDirectory: dist` e rewrite para SPA.
- As rotas serverless ficam em `api/*` (ex.: `/api/health`, `/api/github`).

## PWA (celular)

Depois do deploy (ou rodando local), abra o site no celular e use “Adicionar à tela inicial”.

Ícones:
- `public/icon-192.png`
- `public/icon-512.png`

## Electron (desktop)

### Dev (janela Electron apontando para o Vite)

```bash
pnpm electron:dev
```

### Build (empacotar)

Para o app empacotado funcionar com backend remoto (Vercel), defina:
- `ELECTRON_API_BASE=https://seu-projeto.vercel.app`

E então rode:

```bash
pnpm electron:build
```

O Electron injeta `?apiBase=...` ao carregar o `dist/index.html`, para que o frontend chame o backend corretamente mesmo em `file://`.

Saída do build: `electron-release/`

## Endpoints úteis

- `GET /api/health`: health check.
- `POST /api/github`: proxy do GitHub GraphQL (exige `x-app-pin`).

