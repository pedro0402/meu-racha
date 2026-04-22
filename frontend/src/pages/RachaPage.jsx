import { useParams } from 'react-router-dom';
import { useRacha } from '../hooks/useRacha';
import JoinForm from '../components/JoinForm.jsx';
import PlayerList from '../components/PlayerList.jsx';
import Countdown from '../components/Countdown.jsx';

export default function RachaPage() {
  const { id } = useParams();
  const [estado, { refresh }] = useRacha(id);

  if (estado.loading) return <div className="card">Carregando...</div>;
  if (estado.error)
    return <div className="card alert alert-error">{estado.error}</div>;

  const total = estado.jogadores.length;
  const { data_abertura } = estado.racha;

  return (
    <div className="grid">
      <div className="card">
        <h2>Racha do {estado.racha.nome_dono}</h2>
        <p className="muted">
          {total} de {estado.maxJogadores} jogadores
        </p>

        {estado.fechado ? (
          <div className="alert alert-success">
            Lista fechada! O PDF foi enviado para o organizador. ⚽
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
      />
    </div>
  );
}
