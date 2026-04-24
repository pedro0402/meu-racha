# ⚽ MeuRacha

![MeuRacha](https://img.shields.io/badge/MeuRacha-MVP%20de%20rachas-brightgreen)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-3c873a)
![Tempo real](https://img.shields.io/badge/Tempo%20real-Socket.IO-010101)
![Banco](https://img.shields.io/badge/Banco-Supabase%20%2F%20Postgres-336791)

MeuRacha é um MVP para organizar listas de jogadores de racha de forma clara, justa e em tempo real. A ideia é substituir a lista bagunçada do WhatsApp por um fluxo simples: criar, compartilhar, entrar e acompanhar a lista ao vivo.

## Destaques

- Criação de racha com horário de abertura definido pelo organizador.
- Link compartilhável para entrada na lista.
- Atualização em tempo real via Socket.IO.
- Ordem de chegada preservada, com limite configurável de jogadores.
- Fechamento automático ao atingir o limite.
- Geração de PDF e envio por e-mail ao final.
- Banco em Supabase/Postgres com suporte ao fluxo de produção.

## Como funciona

1. O organizador cria o racha com nome, e-mail, telefone e horário de abertura.
2. O sistema gera um link exclusivo para compartilhar.
3. Os jogadores acessam a página do racha e entram na lista.
4. A ocupação é atualizada em tempo real para todos.
5. Ao atingir o limite, a lista fecha e o PDF é enviado por e-mail.

## Principais telas

- Home com proposta clara do produto.
- Página de criação com preview da abertura e link compartilhável.
- Página do racha com status visual, ocupação da lista e contagem regressiva.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express |
| Tempo real | Socket.IO |
| Banco | Supabase Postgres |
| PDF | pdfkit |
| E-mail | nodemailer |
| Testes | Jest, Vitest, Testing Library, Playwright |

## Estrutura do projeto

```text
MeuRacha/
├── backend/        API REST, Socket.IO, PDF e e-mail
├── frontend/       SPA em React com Vite
├── e2e/            testes ponta a ponta com Playwright
├── DEPLOY.md       guia de deploy gratuito
└── TESTING.md      estratégia de testes
```

## Rodando localmente

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API em `http://localhost:3001`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App em `http://localhost:5173`.

## Deploy

O projeto está preparado para hospedagem gratuita com:

- Frontend na Vercel
- Backend na Render
- Banco no Supabase

Veja o passo a passo em [`DEPLOY.md`](./DEPLOY.md).

## Testes

A suíte está dividida em três camadas:

- Unitários
- Integração
- E2E

Veja a visão completa em [`TESTING.md`](./TESTING.md).

Resumo rápido:

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test && npm run build

# E2E
cd e2e && npm test
```

## Documentação complementar

- [`backend/README.md`](./backend/README.md)
- [`frontend/README.md`](./frontend/README.md)
- [`DEPLOY.md`](./DEPLOY.md)
- [`TESTING.md`](./TESTING.md)

## O que o MVP já entrega

- Lista em tempo real.
- Bloqueio por horário configurado no servidor.
- Proteção contra nomes duplicados.
- Fechamento automático ao atingir o limite.
- Fluxo pronto para produção com Supabase, Vercel e Render.

## Próximos passos naturais

- Login do organizador.
- QR Code para compartilhamento.
- Lista de espera quando lotar.
- Histórico de rachas.
- Métricas simples de uso.

---

Se você quiser, pode começar lendo o fluxo em [`backend/README.md`](./backend/README.md) e [`frontend/README.md`](./frontend/README.md) para entender cada camada por dentro.
