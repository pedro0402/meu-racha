import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useRacha } from '../hooks/useRacha';
import { api } from '../services/api';
import JoinForm from '../components/JoinForm.jsx';
import PlayerList from '../components/PlayerList.jsx';
import Countdown from '../components/Countdown.jsx';

export default function RachaPage() {
  const { id } = useParams();
  const [pdfErro, setPdfErro] = useState(null);
  const [pdfBaixando, setPdfBaixando] = useState(false);
  const [estado, { refresh }] = useRacha(id);

  if (estado.loading) {
    return (
      <div className="card loading-card" aria-busy="true" aria-live="polite">
        <h2>Carregando lista...</h2>
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
    );
  }

  if (estado.error)
    return (
      <div className="card alert alert-error" role="alert">
        <h2>Não foi possível carregar este racha</h2>
        <p>{estado.error}</p>
        <button type="button" className="btn" onClick={refresh}>
          Tentar novamente
        </button>
      </div>
    );

  if (estado.expirado) {
    return (
      <div className="card alert alert-warn">
        <h2>Lista expirada</h2>
        <p>A lista deste racha expirou e não está mais disponível.</p>
      </div>
    );
  }

  const totalTitulares = estado.titularesOcupados;
  const totalSuplentes = estado.suplentesOcupados;
  const vagas = Math.max(estado.maxJogadores - estado.titularesOcupados, 0);
  const percentual = Math.min(100, Math.round((estado.titularesOcupados / estado.maxJogadores) * 100));
  const { data_abertura } = estado.racha;
  const suplentesDisponiveis = estado.suplentesHabilitados && estado.titularesOcupados >= estado.maxJogadores && estado.suplentesOcupados < estado.maxSuplentes;

  const linkCompartilhavel = typeof window !== 'undefined' ? window.location.href : '';

  async function handleBaixarPdf() {
    setPdfErro(null);
    setPdfBaixando(true);
    try {
      await api.downloadListaPdf(id);
    } catch (e) {
      setPdfErro(e.message || 'Não foi possível baixar o PDF.');
    } finally {
      setPdfBaixando(false);
    }
  }

  function handleWhatsApp() {
    const msg = `Lista do racha (${estado.racha.nome_dono}): ${linkCompartilhavel}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  }

  let statusLabel = 'Lista fechada';
  let statusClass = 'status-pill status-closed';

  if (estado.fechado) {
    statusLabel = 'Lista completa';
    statusClass = 'status-pill status-full';
  } else if (estado.listaAberta) {
    statusLabel = suplentesDisponiveis ? 'Suplentes abertos' : 'Lista aberta';
    statusClass = 'status-pill status-open';
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="card-head">
          <h2>Racha do {estado.racha.nome_dono}</h2>
          <span className={statusClass}>{statusLabel}</span>
        </div>

        <div className="occupancy-box" aria-label="ocupacao da lista">
          <div className="occupancy-meta">
            <strong>{totalTitulares} / {estado.maxJogadores} titulares</strong>
            <span>{percentual}% preenchida</span>
          </div>
          <div className="occupancy-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentual}>
            <span style={{ width: `${percentual}%` }} />
          </div>
          <p className="muted occupancy-note">
            {vagas > 0
              ? `${vagas} vaga(s) ainda disponível(is).`
              : suplentesDisponiveis
                ? 'Titulares completos. Novas entradas serão registradas como suplente.'
                : 'Sem vagas disponíveis.'}
          </p>
          {totalSuplentes > 0 && (
            <p className="muted occupancy-note">
              {totalSuplentes} suplente(s) na lista.
            </p>
          )}
        </div>

        {estado.fechado ? (
          <div className="alert alert-success">
            <strong>Lista fechada.</strong> Use os botões abaixo para baixar o PDF ou mandar o link no WhatsApp.
          </div>
        ) : !estado.listaAberta ? (
          <div className="alert alert-warn">
            {data_abertura ? (
              <>
                A lista abre em <Countdown
                  targetLocalISO={data_abertura}
                  onElapsed={refresh}
                />
                <br />
                <small>Horário de abertura: {data_abertura.replace('T', ' ')}</small>
              </>
            ) : (
              <>A lista ainda está fechada.</>
            )}
          </div>
        ) : (
          <JoinForm rachaId={id} />
        )}

        {estado.pdfDisponivel && (
          <div className="share-panel">
            <p className="share-panel-title">Baixar e compartilhar</p>
            <p className="muted share-panel-desc">
              Baixe o PDF da lista ou envie o link desta página pelo WhatsApp para o grupo.
            </p>
            <div className="share-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={pdfBaixando}
                onClick={handleBaixarPdf}
              >
                {pdfBaixando ? 'Baixando…' : 'Baixar PDF'}
              </button>
              <button type="button" className="btn btn-whatsapp" onClick={handleWhatsApp}>
                Enviar link no WhatsApp
              </button>
            </div>
            {pdfErro ? (
              <p className="share-panel-erro" role="alert">
                {pdfErro}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <PlayerList
        jogadores={estado.jogadores}
        max={estado.maxJogadores}
        suplentesHabilitados={estado.suplentesHabilitados}
      />
    </div>
  );
}
