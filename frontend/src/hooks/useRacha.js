import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

/** SQLite 0/1, Postgres boolean */
function isSuplentePlayer(j) {
  return Boolean(j && (j.suplente === true || j.suplente === 1));
}

/** Mesma regra do backend: algum fechamento já marcou PDF no banco. */
function rachaPdfRegistradoNoBanco(racha) {
  if (!racha) return false;
  return Boolean(racha.pdf_gerado_titulares) || Boolean(racha.pdf_gerado_final);
}

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
    const titulares = data.jogadores.filter((j) => !isSuplentePlayer(j));
    const suplentes = data.jogadores.filter((j) => isSuplentePlayer(j));
    const suplentesHabilitados = Boolean(data.racha?.suplentes_habilitados);
    const maxSuplentes = Number(data.racha?.max_suplentes || 0);
    const titularesOcupados = titulares.length;
    const suplentesOcupados = suplentes.length;
    const titularesCompletos = titularesOcupados >= data.maxJogadores;
    const suplentesCompletos = !suplentesHabilitados || suplentesOcupados >= maxSuplentes;

    const pdfNoDisco = Boolean(data.pdfDisponivel);
    const pdfNoBanco = rachaPdfRegistradoNoBanco(data.racha);

    return {
      ...data,
      titularesOcupados,
      suplentesOcupados,
      maxSuplentes,
      suplentesHabilitados,
      fechado: suplentesHabilitados ? (titularesCompletos && suplentesCompletos) : titularesCompletos,
      // API exige arquivo no disco; em multi-instância ou após restart o arquivo pode
      // não existir nesse nó, mas o banco já marca PDF gerado — ainda mostramos os botões.
      pdfDisponivel: pdfNoDisco || pdfNoBanco,
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
    const resyncTimer = { id: null };

    function scheduleResyncCarregar() {
      if (resyncTimer.id) clearTimeout(resyncTimer.id);
      resyncTimer.id = setTimeout(() => {
        resyncTimer.id = null;
        if (ativo) void carregar();
      }, 450);
    }

    carregar();

    const socket = getSocket();
    socket.emit('racha:entrar', { rachaId });

    const onUpdate = ({ jogadores }) => {
      if (!ativo) return;
      setEstado((s) => {
        const titularesCount = jogadores.filter((j) => !isSuplentePlayer(j)).length;
        const suplentesCount = jogadores.filter((j) => isSuplentePlayer(j)).length;

        if (titularesCount >= s.maxJogadores) {
          queueMicrotask(() => {
            if (ativo) scheduleResyncCarregar();
          });
        }

        return {
          ...s,
          jogadores,
          titularesOcupados: titularesCount,
          suplentesOcupados: suplentesCount,
          fechado: s.suplentesHabilitados
            ? titularesCount >= s.maxJogadores && suplentesCount >= s.maxSuplentes
            : titularesCount >= s.maxJogadores,
          pdfDisponivel: s.pdfDisponivel || rachaPdfRegistradoNoBanco(s.racha),
        };
      });
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
      scheduleResyncCarregar();
    };

    socket.on('jogadores:atualizados', onUpdate);
    socket.on('racha:fechado', onFechado);

    return () => {
      ativo = false;
      if (resyncTimer.id) clearTimeout(resyncTimer.id);
      socket.emit('racha:sair', { rachaId });
      socket.off('jogadores:atualizados', onUpdate);
      socket.off('racha:fechado', onFechado);
    };
  }, [rachaId, carregar]);

  return [estado, { refresh: carregar }];
}
