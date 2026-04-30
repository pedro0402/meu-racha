import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/services/api', () => ({
  api: {
    entrarNoRacha: vi.fn(),
    getTokenEntrada: vi.fn(),
  },
}));

vi.mock('../../src/utils/visitorHash', () => ({
  computeVisitorHash: vi.fn(() => Promise.resolve('ab'.repeat(32))),
}));

import { api } from '../../src/services/api';
import JoinForm from '../../src/components/JoinForm.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  api.getTokenEntrada.mockResolvedValue({
    token: 'tok-test',
    expiraEm: new Date(Date.now() + 600000).toISOString(),
  });
});

describe('<JoinForm />', () => {
  test('envia o nome e posição ao submeter e limpa os inputs após sucesso', async () => {
    api.entrarNoRacha.mockResolvedValue({ jogador: { nome: 'Pedro', posicao: 'jogador' }, total: 1 });
    const user = userEvent.setup();

    render(<JoinForm rachaId="abc123" />);
    const input = await screen.findByPlaceholderText(/digite seu nome/i);
    await user.type(input, 'Pedro');
    await user.click(screen.getByRole('button', { name: /entrar no racha/i }));

    await waitFor(() => {
      expect(api.entrarNoRacha).toHaveBeenCalledWith(
        'abc123',
        'Pedro',
        'jogador',
        'tok-test',
        'ab'.repeat(32),
      );
    });
    expect(input).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent(/entrada confirmada/i);
  });

  test('envia posição de goleiro quando selecionado', async () => {
    api.entrarNoRacha.mockResolvedValue({ jogador: { nome: 'Pedro', posicao: 'goleiro' }, total: 1 });
    const user = userEvent.setup();

    render(<JoinForm rachaId="abc123" />);
    const input = await screen.findByPlaceholderText(/digite seu nome/i);
    const selectPosicao = screen.getByDisplayValue(/jogador/i);
    
    await user.type(input, 'Pedro');
    await user.selectOptions(selectPosicao, 'goleiro');
    await user.click(screen.getByRole('button', { name: /entrar no racha/i }));

    await waitFor(() => {
      expect(api.entrarNoRacha).toHaveBeenCalledWith(
        'abc123',
        'Pedro',
        'goleiro',
        'tok-test',
        'ab'.repeat(32),
      );
    });
  });

  test('exibe a mensagem de erro retornada pela API', async () => {
    const err = new Error('Esse nome já está na lista');
    err.code = 'DUPLICATE';
    api.entrarNoRacha.mockRejectedValue(err);
    const user = userEvent.setup();

    render(<JoinForm rachaId="abc123" />);
    await user.type(await screen.findByPlaceholderText(/digite seu nome/i), 'Pedro');
    await user.click(screen.getByRole('button', { name: /entrar no racha/i }));

    await screen.findByText(/esse nome ja esta na lista/i);
    expect(api.getTokenEntrada).toHaveBeenCalledWith('abc123');
  });

  test('não envia se o nome estiver vazio', async () => {
    const user = userEvent.setup();
    render(<JoinForm rachaId="abc123" />);
    await screen.findByPlaceholderText(/digite seu nome/i);
    const botao = screen.getByRole('button', { name: /entrar no racha/i });
    expect(botao).toBeDisabled();
    await user.click(botao);
    expect(api.entrarNoRacha).not.toHaveBeenCalled();
  });
});
