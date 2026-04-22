# Frontend — MeuRacha

SPA em React + Vite.

## Scripts

```bash
npm install
npm run dev      # dev server em http://localhost:5173
npm run build    # gera ./dist
npm run preview  # serve o build
```

## Variáveis (.env)

```
VITE_API_URL=http://localhost:3001
```

## Arquitetura

```
frontend/src
├── App.jsx
├── main.jsx
├── pages/
│   ├── HomePage.jsx          # landing
│   ├── CreateRachaPage.jsx   # cria racha e mostra shareUrl
│   └── RachaPage.jsx         # lista em tempo real
├── components/
│   ├── JoinForm.jsx          # entra no racha
│   └── PlayerList.jsx        # 18 slots numerados
├── hooks/
│   └── useRacha.js           # carrega racha + assina Socket.IO
├── services/
│   ├── api.js                # wrapper REST
│   └── socket.js             # singleton do Socket.IO
└── styles/global.css
```

## Fluxo

1. `HomePage` → botão para `/criar`.
2. `CreateRachaPage` envia `POST /api/rachas` e mostra o `shareUrl`.
3. `RachaPage` (`/racha/:id`):
   - Carrega o estado atual via `GET /api/rachas/:id`.
   - Conecta no Socket.IO e entra na sala `racha:<id>`.
   - Atualiza a lista quando recebe `jogadores:atualizados`.
   - Mostra estado especial quando `racha:fechado` é emitido.
