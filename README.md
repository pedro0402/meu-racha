# ⚽ MeuRacha

Aplicação para gerenciar listas de jogadores de **rachas semanais**, substituindo
a clássica lista no WhatsApp por uma experiência justa, em tempo real e
automatizada.

## 🚀 Visão geral

- **Dono do racha** cria um racha (nome, e-mail, telefone) e **escolhe quando
  a lista abre**. Recebe um link exclusivo para compartilhar.
- **Jogadores** acessam o link, digitam o nome e entram na lista.
- A lista é **ordenada por ordem de chegada**, com **limite de 18 jogadores**.
- O horário de abertura é definido pelo dono do racha e **validado no servidor**
  (o relógio do cliente é ignorado).
- Tudo é atualizado **em tempo real** via WebSocket (Socket.IO).
- Quando atinge 18 jogadores, o sistema **gera um PDF** e **envia por e-mail**
  ao dono do racha.

## 🧱 Stack

| Camada      | Tecnologia                      |
| ----------- | ------------------------------- |
| Frontend    | React + Vite + React Router     |
| Tempo real  | Socket.IO (cliente + servidor)  |
| Backend     | Node.js + Express               |
| Banco       | SQLite (better-sqlite3) — fácil migração para PostgreSQL |
| PDF         | pdfkit                          |
| E-mail      | nodemailer (com fallback Ethereal em dev) |

## 📂 Estrutura

```
MeuRacha/
├── backend/        # API REST + Socket.IO + PDF + e-mail
└── frontend/       # SPA em React (Vite)
```

## ▶️ Como rodar

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:3001`

### 2. Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

## 🧪 Testando o fluxo de fechamento

A regra de horário **é definida por racha**: o dono escolhe data e hora ao criar.
Para testar agora, basta criar um racha com `data_abertura` no passado (ou daqui
a 1 minuto, para ver o countdown agindo).

As variáveis `DIA_PERMITIDO` / `HORA_MINIMA` em `backend/.env` continuam servindo
apenas como **fallback** para rachas legados que foram criados sem `data_abertura`.

Quando 18 jogadores entrarem na lista, o backend:

1. Reserva atomicamente a geração do PDF (`pdf_gerado = 1`),
2. Gera o PDF em `backend/pdfs/racha-<id>.pdf`,
3. Envia por e-mail (em dev, imprime no console um link de preview do Ethereal),
4. Emite o evento `racha:fechado` para todos conectados ao racha.

## 🔒 Garantias técnicas implementadas

| Problema                       | Solução |
| ------------------------------ | ------- |
| Concorrência (limite 18)       | Transação `better-sqlite3` (count + insert atômico) |
| Duplicidade de nomes           | Coluna `nome_norm` + `UNIQUE(racha_id, nome_norm)` |
| Manipulação de horário no front| Validação no backend usando `Intl.DateTimeFormat` no fuso oficial; comparação contra a `data_abertura` do racha |
| Atualização em tempo real      | Salas Socket.IO por `rachaId` (broadcast direcionado) |
| Geração duplicada de PDF       | `UPDATE rachas SET pdf_gerado=1 WHERE id=? AND pdf_gerado=0` (atômico) |

Veja também os READMEs específicos em `backend/` e `frontend/`.

## 🧪 Testes

A aplicação tem suíte completa em três camadas (unitários, integração e E2E).
Veja [`TESTING.md`](./TESTING.md) para detalhes. Resumo rápido:

```bash
# Backend (Jest + supertest)
cd backend && npm install && npm test

# Frontend (Vitest + Testing Library)
cd frontend && npm install && npm test

# E2E (Playwright)
cd e2e && npm install && npx playwright install chromium && npm test
```
