import { useParams } from 'react-router-dom';
import { useRacha } from '../hooks/useRacha';
import JoinForm from '../components/JoinForm.jsx';
import PlayerList from '../components/PlayerList.jsx';
import Countdown from '../components/Countdown.jsx';

export default function RachaPage() {
  const { id } = useParams();
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
            Lista fechada! O PDF foi enviado para o organizador.
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
      </div>

      <PlayerList
        jogadores={estado.jogadores}
        max={estado.maxJogadores}
        suplentesHabilitados={estado.suplentesHabilitados}
      />
    </div>
  );
}
