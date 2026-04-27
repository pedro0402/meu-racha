export default function PlayerList({ jogadores, max }) {
  const total = jogadores.length;
  const slots = Array.from({ length: max }, (_, i) => jogadores[i] || null);

  const getPosicaoLabel = (posicao) => {
    if (posicao === 'goleiro') return '🧤 Goleiro';
    return '⚽ Jogador';
  };

  return (
    <div className="card">
      <h3>Lista</h3>
      <p className="muted list-summary">
        {total} inscritos, {Math.max(max - total, 0)} vagas restantes.
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
  );
}
