# Deploy (Free) - MeuRacha

Este guia publica o projeto com:

- Frontend: Vercel (free)
- Backend: Render Web Service (free)
- Banco: Supabase Postgres (ja pronto)

## 1. Pre-flight (5 minutos)

1. Garanta que o repositorio esta no GitHub com os commits mais recentes.
2. Verifique localmente:
   - Backend: `cd backend && npm test`
   - Frontend: `cd frontend && npm test && npm run build`
3. Tenha em maos:
   - `DATABASE_URL` (Supabase)
   - dados SMTP (se envio de PDF por email for real em producao)

## 2. Backend no Render

### 2.1 Criar servico

1. Acesse Render e clique em New + Web Service.
2. Conecte o repositorio `MeuRacha`.
3. Configure:
   - Name: `meuracha-backend` (ou similar)
   - Root Directory: `backend`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`

### 2.2 Variaveis de ambiente (Render)

Defina no painel do servico:

- `NODE_ENV=production`
- `PORT=10000` (opcional; Render injeta automaticamente)
- `DATABASE_URL=<sua-string-supabase>`
- `DATABASE_SSL=require`
- `FRONTEND_URL=https://SEU-FRONT.vercel.app`
- `MAX_JOGADORES=18`
- `TIMEZONE=America/Sao_Paulo`

Se quiser envio de PDF por email em producao:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### 2.3 Verificacao do backend

Depois do deploy, teste:

- `GET https://SEU-BACKEND.onrender.com/health`

Resposta esperada:

- `ok: true`
- `databaseMode: "postgres"`

## 3. Frontend no Vercel

### 3.1 Criar projeto

1. Acesse Vercel e clique em Add New + Project.
2. Importe o repositorio `MeuRacha`.
3. Configure:
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 3.2 Variavel de ambiente (Vercel)

- `VITE_API_URL=https://SEU-BACKEND.onrender.com`

Aplique para Production (e Preview, se quiser validar PRs).

### 3.3 Deploy

1. Execute o deploy.
2. Copie a URL final da Vercel.
3. Garanta que o fallback de SPA esteja ativo com [`frontend/vercel.json`](./frontend/vercel.json).
   Isso evita 404 ao abrir ou recarregar rotas como `/racha/:id` fora do app.

## 4. Fechar loop CORS

1. Volte no Render.
2. Atualize `FRONTEND_URL` com a URL final da Vercel.
3. Opcional (preview): inclua mais de uma origem separada por virgula:

`FRONTEND_URL=https://seu-front.vercel.app,https://seu-front-git-preview.vercel.app`

4. Redeploy no Render.

## 5. Smoke test de producao

1. Abra o frontend publicado.
2. Crie um racha.
3. Entre na lista em duas abas e confirme atualizacao em tempo real.
4. Valide bloqueio/abertura por horario.
5. Valide fechamento ao atingir limite (se necessario, crie com limite menor).

## 6. Problemas comuns

### CORS bloqueando

- Causa: `FRONTEND_URL` incorreta no backend.
- Correcao: ajuste a variavel no Render e redeploy.

### 404 ao abrir `/racha/:id` diretamente

- Causa: o frontend precisa reescrever rotas para `index.html` no host.
- Correcao: confirme o arquivo [`frontend/vercel.json`](./frontend/vercel.json) no projeto da Vercel.

### Socket sem atualizar em tempo real

- Confira `VITE_API_URL` no Vercel apontando para o backend correto.
- Em free tier, cold start pode gerar atraso inicial.

### Backend acordando lento

- Render free hiberna por inatividade.
- Primeiro request apos idle pode demorar.

### /health com `databaseMode: sqlite`

- `DATABASE_URL` nao foi aplicada no Render.
- Revise env vars e rode manual deploy.

## 7. Checklist final

- Front em HTTPS no Vercel
- Back em HTTPS no Render
- `VITE_API_URL` apontando para Render
- `FRONTEND_URL` apontando para Vercel
- `DATABASE_URL` e `DATABASE_SSL=require` ativos
- `GET /health` retornando `databaseMode: "postgres"`
