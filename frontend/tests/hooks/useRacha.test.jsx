import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../src/services/api', () => ({
  api: { getRacha: vi.fn() },
}));

const handlers = new Map();
const fakeSocket = {
  emit: vi.fn(),
  on: vi.fn((evt, cb) => handlers.set(evt, cb)),
  off: vi.fn((evt) => handlers.delete(evt)),
};
vi.mock('../../src/services/socket', () => ({
  getSocket: () => fakeSocket,
}));

import { api } from '../../src/services/api';
import { useRacha } from '../../src/hooks/useRacha';

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
});

describe('useRacha', () => {
  test('carrega o racha e expõe o estado inicial', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', nome_dono: 'Pedro', data_abertura: null, suplentes_habilitados: false, max_suplentes: 0 },
      jogadores: [{ id: 1, nome: 'A' }],
      maxJogadores: 18,
      listaAberta: true,
    });

    const { result } = renderHook(() => useRacha('abc'));

    await waitFor(() => {
      expect(result.current[0].loading).toBe(false);
    });
    expect(result.current[0].racha.nome_dono).toBe('Pedro');
    expect(result.current[0].jogadores).toHaveLength(1);
    expect(result.current[0].listaAberta).toBe(true);
    expect(fakeSocket.emit).toHaveBeenCalledWith('racha:entrar', { rachaId: 'abc' });
  });

  test('atualiza jogadores ao receber evento jogadores:atualizados', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', nome_dono: 'Pedro', suplentes_habilitados: false, max_suplentes: 0 },
      jogadores: [],
      maxJogadores: 18,
      listaAberta: true,
    });

    const { result } = renderHook(() => useRacha('abc'));
    await waitFor(() => expect(result.current[0].loading).toBe(false));

    act(() => {
      handlers.get('jogadores:atualizados')({
        jogadores: [{ id: 1, nome: 'Novo' }],
      });
    });

    expect(result.current[0].jogadores).toHaveLength(1);
    expect(result.current[0].jogadores[0].nome).toBe('Novo');
  });

  test('mantém a lista aberta quando titulares fecham mas suplentes ainda estão disponíveis', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', nome_dono: 'Pedro', suplentes_habilitados: true, max_suplentes: 2 },
      jogadores: [
        { id: 1, nome: 'A', suplente: false },
        { id: 2, nome: 'B', suplente: false },
      ],
      maxJogadores: 2,
      listaAberta: true,
    });

    const { result } = renderHook(() => useRacha('abc'));
    await waitFor(() => expect(result.current[0].loading).toBe(false));

    expect(result.current[0].fechado).toBe(false);
    expect(result.current[0].suplentesHabilitados).toBe(true);
    expect(result.current[0].titularesOcupados).toBe(2);
  });

  test('refresh re-busca o racha', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', suplentes_habilitados: false, max_suplentes: 0 },
      jogadores: [],
      maxJogadores: 18,
      listaAberta: false,
    });
    const { result } = renderHook(() => useRacha('abc'));
    await waitFor(() => expect(result.current[0].loading).toBe(false));

    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', suplentes_habilitados: false, max_suplentes: 0 },
      jogadores: [],
      maxJogadores: 18,
      listaAberta: true,
    });

    await act(async () => {
      await result.current[1].refresh();
    });

    expect(result.current[0].listaAberta).toBe(true);
  });

  test('marca expirado=true quando a API responde 410', async () => {
    const erro = new Error('A lista deste racha expirou e não está mais disponível.');
    erro.status = 410;
    erro.data = {
      racha: { id: 'abc', nome_dono: 'Pedro', expira_em: '2026-04-19T12:00' },
    };
    api.getRacha.mockRejectedValue(erro);

    const { result } = renderHook(() => useRacha('abc'));

    await waitFor(() => {
      expect(result.current[0].loading).toBe(false);
    });

    expect(result.current[0].expirado).toBe(true);
    expect(result.current[0].error).toBeNull();
    expect(result.current[0].racha.nome_dono).toBe('Pedro');
  });

  test('racha:fechado com tipo titulares mantém lista aberta se ainda houver vaga de suplente', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', nome_dono: 'Pedro', suplentes_habilitados: true, max_suplentes: 2 },
      jogadores: [
        { id: 1, nome: 'A', suplente: false },
        { id: 2, nome: 'B', suplente: false },
      ],
      maxJogadores: 2,
      listaAberta: true,
      pdfDisponivel: false,
    });

    const { result } = renderHook(() => useRacha('abc'));
    await waitFor(() => expect(result.current[0].loading).toBe(false));

    expect(result.current[0].fechado).toBe(false);

    act(() => {
      handlers.get('racha:fechado')({ tipo: 'titulares', rachaId: 'abc' });
    });

    expect(result.current[0].fechado).toBe(false);
    expect(result.current[0].pdfDisponivel).toBe(true);
  });

  test('racha:fechado com tipo final encerra a lista e habilita PDF', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', nome_dono: 'Pedro', suplentes_habilitados: true, max_suplentes: 2 },
      jogadores: [
        { id: 1, nome: 'A', suplente: false },
        { id: 2, nome: 'B', suplente: false },
        { id: 3, nome: 'C', suplente: true },
        { id: 4, nome: 'D', suplente: true },
      ],
      maxJogadores: 2,
      listaAberta: true,
      pdfDisponivel: false,
    });

    const { result } = renderHook(() => useRacha('abc'));
    await waitFor(() => expect(result.current[0].loading).toBe(false));

    act(() => {
      handlers.get('racha:fechado')({ tipo: 'final', rachaId: 'abc' });
    });

    expect(result.current[0].pdfDisponivel).toBe(true);
    expect(result.current[0].fechado).toBe(true);
  });

  test('racha:fechado habilita pdfDisponivel', async () => {
    api.getRacha.mockResolvedValue({
      racha: { id: 'abc', nome_dono: 'Pedro', suplentes_habilitados: false, max_suplentes: 0 },
      jogadores: [],
      maxJogadores: 18,
      listaAberta: true,
      pdfDisponivel: false,
    });

    const { result } = renderHook(() => useRacha('abc'));
    await waitFor(() => expect(result.current[0].loading).toBe(false));

    expect(result.current[0].pdfDisponivel).toBe(false);

    act(() => {
      handlers.get('racha:fechado')();
    });

    expect(result.current[0].pdfDisponivel).toBe(true);
    expect(result.current[0].fechado).toBe(true);
  });
});
