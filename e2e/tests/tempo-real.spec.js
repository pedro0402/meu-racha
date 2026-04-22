// @ts-check
const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function criarRacha(request) {
  const res = await request.post(`${BACKEND_URL}/api/rachas`, {
    data: {
      nome_dono: 'Real Time',
      email: 'rt@example.com',
      telefone: '11999999999',
      data_abertura: '2020-01-01T00:00',
    },
  });
  return res.json();
}

test('clientes recebem atualizações em tempo real', async ({ browser, request }) => {
  const { racha } = await criarRacha(request);

  // Dois "usuários" em contextos isolados (cookies/storage separados).
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto(`/racha/${racha.id}`);
  await pageB.goto(`/racha/${racha.id}`);

  await expect(pageA.getByText(/0 de 18 jogadores/)).toBeVisible();
  await expect(pageB.getByText(/0 de 18 jogadores/)).toBeVisible();

  // A entra na lista
  await pageA.getByPlaceholder(/digite seu nome/i).fill('Alice');
  await pageA.getByRole('button', { name: /entrar no racha/i }).click();

  // B vê automaticamente sem reload
  await expect(pageB.getByText('Alice')).toBeVisible();
  await expect(pageB.getByText(/1 de 18 jogadores/)).toBeVisible();

  // B entra na lista
  await pageB.getByPlaceholder(/digite seu nome/i).fill('Bob');
  await pageB.getByRole('button', { name: /entrar no racha/i }).click();

  // A vê
  await expect(pageA.getByText('Bob')).toBeVisible();
  await expect(pageA.getByText(/2 de 18 jogadores/)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
