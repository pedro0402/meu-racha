import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'abc' }),
}));

vi.mock('../../src/hooks/useRacha', () => ({
  useRacha: () => [
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
    { refresh: vi.fn() },
  ],
}));

import RachaPage from '../../src/pages/RachaPage';

describe('<RachaPage />', () => {
  test('mostra aviso quando a lista expirou', () => {
    render(<RachaPage />);

    expect(screen.getByRole('heading', { name: /lista expirada/i })).toBeInTheDocument();
    expect(
      screen.getByText(/a lista deste racha expirou e não está mais disponível/i),
    ).toBeInTheDocument();
  });
});