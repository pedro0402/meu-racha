// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Sobe backend e frontend automaticamente antes de rodar os testes.
 * O backend usa um banco SQLite separado para E2E e tem regra de horário relaxada.
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // backend usa banco compartilhado entre os testes
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm start',
      cwd: '../backend',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        PORT: '3001',
        FRONTEND_URL,
        DATABASE_PATH: './data/e2e.db',
        // Para os testes, deixamos o "fallback" sempre aberto.
        // Continuamos validando data_abertura quando o racha define uma.
        DIA_PERMITIDO: String(new Date().getDay()),
        HORA_MINIMA: '0',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      cwd: '../frontend',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        VITE_API_URL: BACKEND_URL,
      },
    },
  ],
});
