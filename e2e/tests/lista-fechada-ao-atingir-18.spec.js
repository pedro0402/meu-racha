// @ts-check
const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

test('ao atingir 18 jogadores, a lista fecha em tempo real', async ({
  page,
  request,
}) => {
  const res = await request.post(`${BACKEND_URL}/api/rachas`, {
    data: {
      nome_dono: 'Cheia',
      email: 'cheia@example.com',
      telefone: '11999999999',
      data_abertura: '2020-01-01T00:00',
    },
  });
  const { racha } = await res.json();

  await page.goto(`/racha/${racha.id}`);
  await expect(page.getByText(/0 de 18 jogadores/)).toBeVisible();

  // Insere 18 jogadores via API (mais rápido que pela UI)
  for (let i = 0; i < 18; i++) {
    const r = await request.post(
      `${BACKEND_URL}/api/rachas/${racha.id}/jogadores`,
      { data: { nome: `Jogador ${i + 1}` } },
    );
    expect(r.ok()).toBeTruthy();
  }

  // O frontend deve atualizar via Socket.IO sem precisar de reload
  await expect(page.getByText(/18 de 18 jogadores/)).toBeVisible();
  await expect(page.getByText(/Lista fechada/i)).toBeVisible();

  // E recusar novas entradas
  const extra = await request.post(
    `${BACKEND_URL}/api/rachas/${racha.id}/jogadores`,
    { data: { nome: 'Atrasado' } },
  );
  expect(extra.status()).toBe(409);
});
