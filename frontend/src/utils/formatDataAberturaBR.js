/**
 * Formata `data_abertura` do backend (`YYYY-MM-DDTHH:mm`, opcionalmente com segundos)
 * para exibição no padrão brasileiro: DD/MM/AAAA HH:mm
 */
export function formatDataAberturaBR(isoLocal) {
  if (!isoLocal || typeof isoLocal !== 'string') return '';
  const normalized = isoLocal.trim();
  const tIdx = normalized.indexOf('T');
  if (tIdx === -1) return normalized;
  const datePart = normalized.slice(0, tIdx);
  const timePart = normalized.slice(tIdx + 1);
  const parts = datePart.split('-');
  if (parts.length !== 3) return normalized.replace('T', ' ');
  const [y, m, d] = parts;
  const hm = timePart.slice(0, 5);
  return `${d}/${m}/${y} ${hm}`;
}
