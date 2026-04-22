export default function PlayerList({ jogadores, max }) {
  const slots = Array.from({ length: max }, (_, i) => jogadores[i] || null);

  return (
    <div className="card">
      <h3>Lista</h3>
      <ol className="player-list">
        {slots.map((jogador, idx) => (
          <li key={idx} className={jogador ? 'filled' : 'empty'}>
            <span className="num">{String(idx + 1).padStart(2, '0')}</span>
            <span className="nome">
              {jogador ? jogador.nome : <em>vaga aberta</em>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
