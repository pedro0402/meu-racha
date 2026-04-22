import { useEffect, useState } from 'react';

/**
 * Countdown puramente visual.
 * IMPORTANTE: o servidor é a única autoridade sobre "lista aberta ou não".
 * Quando o cronômetro chega a zero, recarregamos o estado via callback
 * (que internamente refaz GET /api/rachas/:id).
 */
export default function Countdown({ targetLocalISO, onElapsed }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(targetLocalISO).getTime();
  const diff = target - agora;

  useEffect(() => {
    if (diff <= 0 && typeof onElapsed === 'function') {
      onElapsed();
    }
  }, [diff <= 0]); // dispara uma única vez quando muda de positivo para negativo

  if (diff <= 0) return <strong>Abrindo agora...</strong>;

  const totalSec = Math.floor(diff / 1000);
  const dias = Math.floor(totalSec / 86400);
  const horas = Math.floor((totalSec % 86400) / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const seg = totalSec % 60;

  const partes = [];
  if (dias) partes.push(`${dias}d`);
  if (dias || horas) partes.push(`${horas}h`);
  partes.push(`${min}m`);
  partes.push(`${seg}s`);

  return <strong>{partes.join(' ')}</strong>;
}
