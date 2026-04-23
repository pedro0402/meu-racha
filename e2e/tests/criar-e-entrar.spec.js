// @ts-check
const { test, expect } = require('@playwright/test');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Cria um racha via API e devolve o id e a URL compartilhável.
 * Usar a API direta em E2E é uma prática comum para preparar estado
 * sem encarecer o tempo do teste com cliques desnecessários.
 */
async function criarRachaViaApi(request, extra = {}) {
  const res = await request.post(`${BACKEND_URL}/api/rachas`, {
    data: {
      nome_dono: 'Pedro Organizador',
      email: 'pedro@example.com',
      telefone: '11999999999',
      data_abertura: '2020-01-01T00:00', // já no passado: lista aberta
      ...extra,
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe('Criar racha e entrar na lista', () => {
  test('fluxo do dono: criar racha pela UI', async ({ page }) => {
    await page.goto('/criar');

    await page.getByLabel(/seu nome/i).fill('João');
    await page.getByLabel(/^e-mail/i).fill('joao@example.com');
    await page.getByLabel(/telefone/i).fill('11988887777');
    await page.getByRole('button', { name: /criar racha/i }).click();

    await expect(page.getByText(/Racha criado/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /copiar/i })).toBeVisible();

    await page.getByRole('button', { name: /abrir lista/i }).click();
    await expect(page.getByRole('heading', { name: /Racha do João/i })).toBeVisible();
  });

  test('fluxo do jogador: entrar na lista pela UI', async ({ page, request }) => {
    const { racha } = await criarRachaViaApi(request, { max_jogadores: 12 });

    await page.goto(`/racha/${racha.id}`);
    await expect(page.getByText(/0 de 12 jogadores/)).toBeVisible();

    await page.getByPlaceholder(/digite seu nome/i).fill('Carlos');
    await page.getByRole('button', { name: /entrar no racha/i }).click();

    await expect(page.getByText('Carlos')).toBeVisible();
    await expect(page.getByText(/1 de 12 jogadores/)).toBeVisible();
  });

  test('rejeita nome duplicado', async ({ page, request }) => {
    const { racha } = await criarRachaViaApi(request);

    await page.goto(`/racha/${racha.id}`);
    await page.getByPlaceholder(/digite seu nome/i).fill('Mariana');
    await page.getByRole('button', { name: /entrar no racha/i }).click();
    await expect(page.getByText('Mariana', { exact: true })).toBeVisible();

    await page.getByPlaceholder(/digite seu nome/i).fill('MARIANA');
    await page.getByRole('button', { name: /entrar no racha/i }).click();
    await expect(page.getByText(/já está na lista/i)).toBeVisible();
  });
});
