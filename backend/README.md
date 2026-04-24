# Backend — MeuRacha

API REST + Socket.IO para gerenciamento de listas de racha.

## Scripts

```bash
npm install
npm run dev   # nodemon (recarrega ao editar)
npm start     # produção
```

## Variáveis de ambiente (.env)

Veja `.env.example`. As principais:

| Variável        | Descrição                                                 |
| --------------- | --------------------------------------------------------- |
| `PORT`          | Porta HTTP (default 3001)                                 |
| `FRONTEND_URL`  | Origem permitida no CORS e usada para gerar `shareUrl`    |
| `DATABASE_URL`  | Connection string Postgres (Supabase). Vazio = SQLite local |
| `DATABASE_SSL`  | SSL do Postgres (`require` em nuvem; vazio em dev local)  |
| `MAX_JOGADORES` | Limite de jogadores por racha (default 18)                |
| `DIA_PERMITIDO` | Dia da semana permitido (0=domingo)                       |
| `HORA_MINIMA`   | Hora mínima para abrir a lista (formato 24h)              |
| `TIMEZONE`      | Fuso considerado autoritativo                             |
| `SMTP_*`        | Configuração SMTP. Vazio em dev → usa Ethereal (preview)  |

Schema SQL inicial para Supabase/Postgres: `src/db/sql/init_postgres.sql`.

## Arquitetura

```
backend/src
├── config/             # carregamento de .env e defaults
├── db/database.js      # conexão SQLite + migração inline + statements
├── middleware/         # validateTime (regra de horário)
├── routes/             # rotas Express (rachas)
├── services/
│   ├── rachaService.js # transações, regras de negócio, anti-race
│   ├── pdfService.js   # geração do PDF (pdfkit)
│   └── emailService.js # nodemailer (com fallback Ethereal)
├── sockets/            # registro dos handlers Socket.IO
├── utils/              # normalize de nome, util de horário
└── server.js           # boot da aplicação
```

## Endpoints

### `POST /api/rachas`
Cria um racha. O campo `data_abertura` é opcional, mas recomendado: define
quando a lista do racha pode ser preenchida.

```json
{
  "nome_dono": "João",
  "email": "joao@x.com",
  "telefone": "11999...",
  "data_abertura": "2026-04-19T12:00"
}
```

Formato: `YYYY-MM-DDTHH:mm` (mesmo do `<input type="datetime-local">`),
interpretado no fuso definido por `TIMEZONE`.

Resposta `201`:

```json
{
  "racha": { "id": "abc123", "nome_dono": "João", ... },
  "shareUrl": "http://localhost:5173/racha/abc123"
}
```

### `GET /api/rachas/:id`
Retorna o racha + lista atual de jogadores. **Não retorna e-mail/telefone.**

### `POST /api/rachas/:id/jogadores`
Adiciona um jogador na lista.

```json
{ "nome": "Pedro" }
```

Erros:

| HTTP | code             | descrição                                       |
| ---- | ---------------- | ----------------------------------------------- |
| 400  | `NOME_OBRIGATORIO`        | sem campo `nome`                              |
| 400  | `INVALID_NAME`            | nome muito curto                              |
| 400  | `DATA_ABERTURA_INVALIDA`  | (no `POST /api/rachas`) formato inválido      |
| 403  | `LISTA_FECHADA`           | antes da `data_abertura` do racha             |
| 404  | `NOT_FOUND` / `RACHA_NAO_ENCONTRADO` | racha inexistente                  |
| 409  | `FULL`                    | lista já atingiu o limite                     |
| 409  | `DUPLICATE`               | esse nome já está no racha                    |

## Eventos Socket.IO

Cliente → servidor:

| Evento           | Payload              |
| ---------------- | -------------------- |
| `racha:entrar`   | `{ rachaId }`        |
| `racha:sair`     | `{ rachaId }`        |

Servidor → cliente (dentro da sala `racha:<id>`):

| Evento                | Payload                       |
| --------------------- | ----------------------------- |
| `jogadores:atualizados` | `{ jogadores: [...] }`       |
| `racha:fechado`       | `{ rachaId, total }`          |
| `racha:erro`          | `{ message }`                 |

## Migração para PostgreSQL

Para migrar:

1. Trocar `better-sqlite3` por `pg` (ou Prisma/Knex).
2. Substituir `db.transaction(fn)` por `BEGIN/COMMIT` + `SELECT ... FOR UPDATE`
   ou aproveitar a constraint `UNIQUE` + um índice parcial para impor o limite
   de 18 (ex.: trigger ou checagem `(SELECT COUNT(*) FROM jogadores WHERE racha_id = $1) < 18`
   dentro da mesma transação).
3. Manter o `UNIQUE(racha_id, nome_norm)` para evitar duplicidade.
