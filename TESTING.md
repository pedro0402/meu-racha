# 🧪 Estratégia de testes

A aplicação tem **três camadas** de testes complementares. Cada camada testa
algo que as outras não conseguem, com bom custo-benefício.

| Camada            | Onde fica       | Ferramentas                   | O que cobre |
| ----------------- | --------------- | ----------------------------- | ----------- |
| Unitários         | `backend/tests/unit/` e `frontend/tests/` | Jest, Vitest, Testing Library | Funções puras, regras de negócio, componentes isolados |
| Integração (API)  | `backend/tests/integration/` | Jest + supertest + socket.io-client | Rotas Express + WebSockets contra um banco em memória |
| E2E (ponta a ponta) | `e2e/tests/` | Playwright                    | Fluxos reais no navegador, com backend + frontend rodando |

## 1. Backend (unit + integração)

```bash
cd backend
npm install
npm test                # roda todos os testes
npm run test:watch      # modo watch
npm run test:coverage   # com cobertura
```

- Banco SQLite **em memória** (`DATABASE_PATH=:memory:`) → sem efeitos colaterais.
- `pdfService` e `emailService` são **mockados** nos testes de integração para não
  escrever PDFs nem enviar e-mails.
- Tempo é **falsificado** (`jest.useFakeTimers().setSystemTime(...)`) para validar
  a regra de horário sem depender do dia em que os testes rodam.
- Testes de Socket.IO sobem o servidor em **porta dinâmica** (porta 0) e usam
  `socket.io-client` para verificar broadcasts entre clientes.

### Cenários cobertos

- Normalização de nomes (acento, case, espaços).
- Validação de formato `data_abertura`.
- Validação de horário (`isListaAbertaPadrao`, `isListaAbertaParaRacha`).
- Criar racha, listar, contar, etc.
- Inserção de jogadores: ordem de chegada, duplicidade, nome inválido,
  racha inexistente.
- **Concorrência**: 50 chamadas tentando inserir, apenas 18 passam.
- Reserva atômica de geração de PDF (`tentarReservarGeracaoPdf`).
- Endpoints REST (sucesso e todos os erros possíveis).
- Socket.IO: estado inicial ao entrar na sala, broadcast de
  `jogadores:atualizados`, `racha:fechado`, `racha:erro`.
- PDF e e-mail são chamados **exatamente uma vez** ao atingir 18.

## 2. Frontend (unit)

```bash
cd frontend
npm install
npm test           # roda todos
npm run test:watch # modo watch
```

### Cenários cobertos

- `<PlayerList />`: 18 slots, vagas abertas, marcação `filled/empty`.
- `<Countdown />`: contagem regressiva, decremento por segundo,
  `onElapsed` é chamado **uma única vez** ao zerar.
- `<JoinForm />`: envio do formulário, mensagem de erro, validação de campo
  obrigatório.
- `useRacha` (hook): carregamento inicial, atualização via socket,
  detecção de lista cheia, `refresh()`.

API e Socket.IO são **mockados** com `vi.mock(...)` — os testes verificam o
comportamento do React isoladamente.

## 3. E2E (Playwright)

Sobe automaticamente backend (porta 3001) + frontend (porta 5173) e roda os
cenários em um navegador Chromium real.

### Pré-requisitos (uma vez)

```bash
cd e2e
npm install
npx playwright install chromium
```

### Rodar

```bash
npm test              # headless
npm run test:headed   # com janela do navegador
npm run test:ui       # modo interativo (excelente para debug)
npm run report        # abre o último relatório HTML
```

> Importante: o backend de E2E usa um banco separado em `backend/data/e2e.db`
> e relaxa a regra padrão de horário (`HORA_MINIMA=0`, `DIA_PERMITIDO=hoje`)
> via `playwright.config.js`. Os testes que precisam testar bloqueio por
> horário criam rachas com `data_abertura` no futuro (controle por racha,
> que continua valendo).

### Cenários cobertos

- **Criar racha pela UI** + recebimento do link compartilhável.
- **Entrar na lista** pela UI e ver a lista atualizada.
- **Rejeição de duplicidade** (mostrando mensagem de erro).
- **Tempo real entre dois clientes**: dois `BrowserContext` independentes
  (cookies/storage isolados) recebem eventos do Socket.IO um do outro.
- **Bloqueio antes da abertura**: countdown visível + 403 do backend
  ao tentar entrar via API (defesa em profundidade).
- **Fechamento ao atingir 18**: lista atualiza em tempo real para "fechada"
  e backend retorna 409 em novas tentativas.

## Pirâmide de testes

```
       ▲
       │   E2E (poucos, cobrem fluxos críticos)
       │
       │   Integração (médio, cobrem REST + WebSocket)
       │
       │   Unitários (muitos, cobrem regras puras)
       └──────────────────────────────────────────────►
```

Mantenha essa proporção: unitários são baratos e rápidos, integração valida
contratos entre camadas, E2E valida que o usuário real consegue completar
o fluxo. Adicione novos testes na camada mais barata possível que ainda
cubra de verdade o que você quer garantir.
