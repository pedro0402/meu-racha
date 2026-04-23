import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

/**
 * Carrega o racha via REST e mantém a lista de jogadores sincronizada
 * via Socket.IO (eventos jogadores:atualizados / racha:fechado).
 *
 * Também expõe `refresh()` para reconsultar o servidor (usado pelo
 * countdown quando o horário de abertura é atingido).
 */
export function useRacha(rachaId) {
  const [estado, setEstado] = useState({
    loading: true,
    error: null,
    racha: null,
    jogadores: [],
    maxJogadores: 18,
    listaAberta: false,
    fechado: false,
    expirado: false,
  });

  const carregar = useCallback(() => {
    return api
      .getRacha(rachaId)
      .then((data) => {
        setEstado((s) => ({
          ...s,
          loading: false,
          error: null,
          racha: data.racha,
          jogadores: data.jogadores,
          maxJogadores: data.maxJogadores,
          listaAberta: data.listaAberta,
          fechado: data.jogadores.length >= data.maxJogadores,
        }));
      })
      .catch((err) => {
        if (err.status === 410) {
          setEstado((s) => ({
            ...s,
            loading: false,
            error: null,
            racha: err.data?.racha || s.racha,
            jogadores: [],
            maxJogadores: s.maxJogadores,
            listaAberta: false,
            fechado: true,
            expirado: true,
          }));
          return;
        }

        setEstado((s) => ({ ...s, loading: false, error: err.message }));
      });
  }, [rachaId]);

  useEffect(() => {
    let ativo = true;
    carregar();

    const socket = getSocket();
    socket.emit('racha:entrar', { rachaId });

    const onUpdate = ({ jogadores }) => {
      if (!ativo) return;
      setEstado((s) => ({
        ...s,
        jogadores,
        fechado: jogadores.length >= s.maxJogadores,
      }));
    };
    const onFechado = () => {
      if (!ativo) return;
      setEstado((s) => ({ ...s, fechado: true }));
    };

    socket.on('jogadores:atualizados', onUpdate);
    socket.on('racha:fechado', onFechado);

    return () => {
      ativo = false;
      socket.emit('racha:sair', { rachaId });
      socket.off('jogadores:atualizados', onUpdate);
      socket.off('racha:fechado', onFechado);
    };
  }, [rachaId, carregar]);

  return [estado, { refresh: carregar }];
}
