// @ts-check
const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function dataLocalDaqui(segundos) {
  const d = new Date(Date.now() + segundos * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

test('lista mostra countdown e bloqueia entrada antes da abertura', async ({
  page,
  request,
}) => {
  // Abertura "no futuro" (1 hora à frente).
  const dataAbertura = dataLocalDaqui(60 * 60);

  const res = await request.post(`${BACKEND_URL}/api/rachas`, {
    data: {
      nome_dono: 'Bloq',
      email: 'bloq@example.com',
      telefone: '11999999999',
      data_abertura: dataAbertura,
    },
  });
  const { racha } = await res.json();

  await page.goto(`/racha/${racha.id}`);

  // Não deve haver formulário de entrada
  await expect(page.getByPlaceholder(/digite seu nome/i)).toHaveCount(0);
  // Mostra o countdown
  await expect(page.getByText(/A lista abre em/i)).toBeVisible();

  // Backend deve recusar a entrada também (defesa em profundidade)
  const tentativa = await request.post(
    `${BACKEND_URL}/api/rachas/${racha.id}/jogadores`,
    { data: { nome: 'Tentativa' } },
  );
  expect(tentativa.status()).toBe(403);
  const body = await tentativa.json();
  expect(body.error).toBe('LISTA_FECHADA');
});
