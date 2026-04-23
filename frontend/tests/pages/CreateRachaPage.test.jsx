import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/services/api', () => ({
  api: {
    criarRacha: vi.fn(),
  },
}));

import { api } from '../../src/services/api';
import CreateRachaPage from '../../src/pages/CreateRachaPage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('<CreateRachaPage />', () => {
  test('inicia o campo de data no formato dd/MM/YYYY', async () => {
    api.criarRacha.mockResolvedValue({
      shareUrl: 'http://localhost:5173/racha/abc',
      racha: { id: 'abc', data_abertura: null, max_jogadores: 10 },
    });

    render(<CreateRachaPage />);

    const data = screen.getByLabelText(/data/i);
    expect(data.value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  test('formata telefone com máscara brasileira', async () => {
    api.criarRacha.mockResolvedValue({
      shareUrl: 'http://localhost:5173/racha/abc',
      racha: { id: 'abc', data_abertura: null, max_jogadores: 10 },
    });

    const user = userEvent.setup();
    render(<CreateRachaPage />);

    const telefone = screen.getByLabelText(/telefone/i);
    await user.type(telefone, '11988887777');

    expect(telefone).toHaveValue('(11) 98888-7777');
  });

  test('normaliza e-mail para minúsculas e sem espaços', async () => {
    api.criarRacha.mockResolvedValue({
      shareUrl: 'http://localhost:5173/racha/abc',
      racha: { id: 'abc', data_abertura: null, max_jogadores: 10 },
    });

    const user = userEvent.setup();
    render(<CreateRachaPage />);

    const email = screen.getByLabelText(/^e-mail/i);
    await user.type(email, 'Joao.Silva+TESTE@Exemplo.COM ');

    expect(email).toHaveValue('joao.silva+teste@exemplo.com');
  });

  test('envia max_jogadores definido no formulário', async () => {
    api.criarRacha.mockResolvedValue({
      shareUrl: 'http://localhost:5173/racha/abc',
      racha: { id: 'abc', data_abertura: null, max_jogadores: 10 },
    });

    const user = userEvent.setup();
    render(<CreateRachaPage />);

    await user.type(screen.getByLabelText(/seu nome/i), 'João');
    await user.type(screen.getByLabelText(/^e-mail/i), 'joao@example.com');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');

    const maxInput = screen.getByLabelText(/máximo de jogadores/i);
    await user.clear(maxInput);
    await user.type(maxInput, '10');

    await user.click(screen.getByRole('button', { name: /criar racha/i }));

    await waitFor(() => {
      expect(api.criarRacha).toHaveBeenCalledTimes(1);
    });

    expect(api.criarRacha).toHaveBeenCalledWith(
      expect.objectContaining({
        nome_dono: 'João',
        email: 'joao@example.com',
        telefone: '11988887777',
        max_jogadores: 10,
      }),
    );
  });

  test('converte a data visível em data_abertura ISO no submit', async () => {
    api.criarRacha.mockResolvedValue({
      shareUrl: 'http://localhost:5173/racha/abc',
      racha: { id: 'abc', data_abertura: null, max_jogadores: 10 },
    });

    const user = userEvent.setup();
    render(<CreateRachaPage />);

    await user.type(screen.getByLabelText(/seu nome/i), 'João');
    await user.type(screen.getByLabelText(/^e-mail/i), 'joao@example.com');
    await user.type(screen.getByLabelText(/telefone/i), '11988887777');
    await user.clear(screen.getByLabelText(/máximo de jogadores/i));
    await user.type(screen.getByLabelText(/máximo de jogadores/i), '10');

    const data = screen.getByLabelText(/data/i);
    await user.clear(data);
    await user.type(data, '31/12/2026');

    await user.click(screen.getByRole('button', { name: /criar racha/i }));

    await waitFor(() => {
      expect(api.criarRacha).toHaveBeenCalledTimes(1);
    });

    expect(api.criarRacha).toHaveBeenCalledWith(
      expect.objectContaining({
        data_abertura: '2026-12-31T12:00',
      }),
    );
  });
});
