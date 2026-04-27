export default function PlayerList({ jogadores, max }) {
  const titulares = jogadores.filter((j) => !j.suplente);
  const suplentes = jogadores.filter((j) => j.suplente);
  const totalTitulares = titulares.length;
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
          {totalTitulares} titulares, {suplentes.length} suplente(s).
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

      {suplentes.length > 0 && (
        <div className="card">
          <h3>Suplentes</h3>
          <p className="muted">{suplentes.length} suplente(s) na fila.</p>
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
