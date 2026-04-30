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
    maxSuplentes: 0,
    titularesOcupados: 0,
    suplentesOcupados: 0,
    suplentesHabilitados: false,
    listaAberta: false,
    fechado: false,
    expirado: false,
    pdfDisponivel: false,
  });

  function buildState(data) {
    const titulares = data.jogadores.filter((j) => !j.suplente);
    const suplentes = data.jogadores.filter((j) => j.suplente);
    const suplentesHabilitados = Boolean(data.racha?.suplentes_habilitados);
    const maxSuplentes = Number(data.racha?.max_suplentes || 0);
    const titularesOcupados = titulares.length;
    const suplentesOcupados = suplentes.length;
    const titularesCompletos = titularesOcupados >= data.maxJogadores;
    const suplentesCompletos = !suplentesHabilitados || suplentesOcupados >= maxSuplentes;

    return {
      ...data,
      titularesOcupados,
      suplentesOcupados,
      maxSuplentes,
      suplentesHabilitados,
      fechado: suplentesHabilitados ? (titularesCompletos && suplentesCompletos) : titularesCompletos,
      pdfDisponivel: Boolean(data.pdfDisponivel),
    };
  }

  const carregar = useCallback(() => {
    return api
      .getRacha(rachaId)
      .then((data) => {
        const nextState = buildState(data);
        setEstado((s) => ({
          ...s,
          loading: false,
          error: null,
          racha: nextState.racha,
          jogadores: nextState.jogadores,
          maxJogadores: nextState.maxJogadores,
          maxSuplentes: nextState.maxSuplentes,
          titularesOcupados: nextState.titularesOcupados,
          suplentesOcupados: nextState.suplentesOcupados,
          suplentesHabilitados: nextState.suplentesHabilitados,
          listaAberta: nextState.listaAberta,
          fechado: nextState.fechado,
          pdfDisponivel: nextState.pdfDisponivel,
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
        titularesOcupados: jogadores.filter((j) => !j.suplente).length,
        suplentesOcupados: jogadores.filter((j) => j.suplente).length,
        fechado: s.suplentesHabilitados
          ? (
            jogadores.filter((j) => !j.suplente).length >= s.maxJogadores
            && jogadores.filter((j) => j.suplente).length >= s.maxSuplentes
          )
          : jogadores.filter((j) => !j.suplente).length >= s.maxJogadores,
      }));
    };
    const onFechado = (payload) => {
      if (!ativo) return;
      const tipo = payload?.tipo;
      setEstado((s) => {
        const temFilaSuplente =
          s.suplentesHabilitados && s.maxSuplentes > 0;
        // Backend emite primeiro ao completar titulares (`titulares`) e depois ao
        // completar suplentes (`final`). Só marcamos lista totalmente fechada na UI
        // no fechamento final ou quando não há fila de suplentes.
        const listaTotalmenteFechada =
          tipo === 'final' || !temFilaSuplente;

        return {
          ...s,
          fechado: listaTotalmenteFechada ? true : s.fechado,
          pdfDisponivel: true,
        };
      });
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
