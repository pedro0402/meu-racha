// @ts-check
const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function agoraEmSaoPaulo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

async function criarRachaBase(request) {
  const res = await request.post(`${BACKEND_URL}/api/rachas`, {
    data: {
      nome_dono: 'Smoke Owner',
      email: 'smoke@example.com',
      telefone: '11999999999',
      data_abertura: agoraEmSaoPaulo(),
      max_jogadores: 2,
      suplentes_habilitados: true,
      max_suplentes: 1,
    },
  });

  expect(res.ok()).toBeTruthy();
  return res.json();
}

test('smoke: entrar jogadores, fechar lista e validar estado final', async ({ page, request }) => {
  const { racha } = await criarRachaBase(request);

  await page.goto(`/racha/${racha.id}`);

  await expect(page.getByRole('heading', { name: /racha do smoke owner/i })).toBeVisible();
  await expect(page.getByText(/0\s*\/\s*2 titulares/i)).toBeVisible();

  await page.getByPlaceholder(/digite seu nome/i).fill('Alice');
  await page.getByRole('button', { name: /entrar no racha/i }).click();
  await expect(page.getByText(/entrada confirmada/i)).toBeVisible();
  await expect(page.getByText(/1\s*\/\s*2 titulares/i)).toBeVisible();

  await page.getByPlaceholder(/digite seu nome/i).fill('Bob');
  await page.getByRole('button', { name: /entrar no racha/i }).click();
  await expect(page.getByText(/2\s*\/\s*2 titulares/i)).toBeVisible();
  await expect(page.getByText(/suplentes abertos/i)).toBeVisible();

  await page.getByPlaceholder(/digite seu nome/i).fill('Carol');
  await page.getByRole('button', { name: /entrar no racha/i }).click();
  // Substitui verificação de mensagem transitória por espera do estado final
  await expect(page.getByText(/1 suplente\(s\) na lista\./i)).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText(/lista fechada! o pdf foi enviado para o organizador/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByPlaceholder(/digite seu nome/i)).toHaveCount(0);
  await expect(page.getByText(/1 suplente\(s\) na lista\./i)).toBeVisible();
});
