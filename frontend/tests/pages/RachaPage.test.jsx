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

vi.mock('../../src/services/api', () => ({
  api: {
    downloadListaPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

import RachaPage from '../../src/pages/RachaPage';
import { api } from '../../src/services/api';

beforeEach(() => {
  mockRefresh.mockReset();
  mockUseRacha.mockReset();
  api.downloadListaPdf.mockClear();
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

  test('mostra a entrada como suplente quando titulares estão completos e suplentes seguem abertos', () => {
    mockUseRacha.mockReturnValue([
      {
        loading: false,
        error: null,
        expirado: false,
        racha: { nome_dono: 'Pedro', suplentes_habilitados: true, max_suplentes: 2 },
        jogadores: [
          { id: 1, nome: 'A', suplente: false },
          { id: 2, nome: 'B', suplente: false },
        ],
        maxJogadores: 2,
        maxSuplentes: 2,
        titularesOcupados: 2,
        suplentesOcupados: 0,
        suplentesHabilitados: true,
        listaAberta: true,
        fechado: false,
      },
      { refresh: mockRefresh },
    ]);

    render(<RachaPage />);

    expect(screen.getByRole('heading', { name: /racha do pedro/i })).toBeInTheDocument();
    expect(screen.getByText(/suplentes abertos/i)).toBeInTheDocument();
    expect(
      screen.getByText(/novas entradas serão registradas como suplente/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: /entrar no racha/i })).toBeInTheDocument();
  });

  test('mostra baixar PDF e WhatsApp quando pdfDisponivel', async () => {
    const user = userEvent.setup();
    mockUseRacha.mockReturnValue([
      {
        loading: false,
        error: null,
        expirado: false,
        racha: { nome_dono: 'Pedro', suplentes_habilitados: false, max_suplentes: 0 },
        jogadores: [],
        maxJogadores: 18,
        maxSuplentes: 0,
        titularesOcupados: 0,
        suplentesOcupados: 0,
        suplentesHabilitados: false,
        listaAberta: false,
        fechado: true,
        pdfDisponivel: true,
      },
      { refresh: mockRefresh },
    ]);

    render(<RachaPage />);

    expect(screen.getByRole('button', { name: /baixar pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /baixar pdf/i }));
    expect(api.downloadListaPdf).toHaveBeenCalledWith('abc');
  });
});