import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockRefresh = vi.fn();
const mockUseRacha = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'abc' }),
}));

vi.mock('../../src/hooks/useRacha', () => ({
  useRacha: (...args) => mockUseRacha(...args),
}));

import RachaPage from '../../src/pages/RachaPage';

beforeEach(() => {
  mockRefresh.mockReset();
  mockUseRacha.mockReset();
});

describe('<RachaPage />', () => {
  test('mostra loading com skeleton enquanto carrega', () => {
    mockUseRacha.mockReturnValue([
      {
        loading: true,
        error: null,
        expirado: false,
        racha: null,
        jogadores: [],
        maxJogadores: 18,
        listaAberta: false,
        fechado: false,
      },
      { refresh: mockRefresh },
    ]);

    render(<RachaPage />);

    expect(screen.getByRole('heading', { name: /carregando lista/i })).toBeInTheDocument();
  });

  test('mostra erro e permite tentar novamente', async () => {
    const user = userEvent.setup();
    mockUseRacha.mockReturnValue([
      {
        loading: false,
        error: 'Falha de rede',
        expirado: false,
        racha: null,
        jogadores: [],
        maxJogadores: 18,
        listaAberta: false,
        fechado: false,
      },
      { refresh: mockRefresh },
    ]);

    render(<RachaPage />);

    expect(screen.getByRole('heading', { name: /não foi possível carregar este racha/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test('mostra aviso quando a lista expirou', () => {
    mockUseRacha.mockReturnValue([
      {
        loading: false,
        error: null,
        expirado: true,
        racha: { nome_dono: 'Pedro' },
        jogadores: [],
        maxJogadores: 18,
        listaAberta: false,
        fechado: true,
      },
      { refresh: mockRefresh },
    ]);

    render(<RachaPage />);

    expect(screen.getByRole('heading', { name: /lista expirada/i })).toBeInTheDocument();
    expect(
      screen.getByText(/a lista deste racha expirou e não está mais disponível/i),
    ).toBeInTheDocument();
  });
});