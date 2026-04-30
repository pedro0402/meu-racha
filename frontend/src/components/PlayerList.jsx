export default function PlayerList({ jogadores, max, suplentesHabilitados = false }) {
  const titulares = jogadores.filter((j) => !j.suplente);
  const suplentes = jogadores.filter((j) => j.suplente);
  const totalTitulares = titulares.length;
  const titularesCompletos = totalTitulares >= max;
  const slots = Array.from({ length: max }, (_, i) => titulares[i] || null);

  const getPosicaoLabel = (posicao) => {
    if (posicao === 'goleiro') return '🧤 Goleiro';
    return '⚽ Jogador';
  };

  return (
    <div>
      <div className="card">
        <h3>Lista</h3>
        <p className="muted list-summary">
          {suplentesHabilitados
            ? `${totalTitulares} titulares, ${suplentes.length} suplente(s).`
            : `${totalTitulares} titulares.`}
        </p>
        <p className="muted list-summary">
          {Math.max(max - totalTitulares, 0)} vagas restantes.
        </p>
        <ol className="player-list">
          {slots.map((jogador, idx) => (
            <li key={idx} className={jogador ? 'filled' : 'empty'}>
              <span className="num">{String(idx + 1).padStart(2, '0')}</span>
              <span className="nome">
                {jogador ? (
                  <>
                    {jogador.nome}
                    <span className="posicao" style={{ marginLeft: '8px', fontSize: '0.85em', color: '#666' }}>
                      {getPosicaoLabel(jogador.posicao)}
                    </span>
                  </>
                ) : (
                  <em>vaga aberta</em>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {suplentesHabilitados && (titularesCompletos || suplentes.length > 0) && (
        <div className="card">
          <h3>Suplentes</h3>
          <p className="muted">
            {suplentes.length > 0
              ? `${suplentes.length} suplente(s) na fila.`
              : titularesCompletos
                ? 'Titulares completos. Novas entradas aparecem aqui como suplente.'
                : 'Nenhum suplente na fila.'}
          </p>
          <ol className="player-list">
            {suplentes.map((jogador, idx) => (
              <li key={jogador.id} className="filled">
                <span className="num">{String(idx + 1).padStart(2, '0')}</span>
                <span className="nome">
                  {jogador.nome}
                  <span className="posicao" style={{ marginLeft: '8px', fontSize: '0.85em', color: '#666' }}>
                    {getPosicaoLabel(jogador.posicao)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
