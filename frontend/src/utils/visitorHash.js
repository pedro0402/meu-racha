/**
 * Hash estável e anônimo do ambiente do navegador (SHA-256 hex).
 * Usado para limitar uma inscrição por aparelho por lista, sem login.
 */
export async function computeVisitorHash() {
  const raw = [
    typeof navigator !== 'undefined' ? navigator.language : '',
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '',
    typeof screen !== 'undefined' ? String(screen.width) : '',
    typeof screen !== 'undefined' ? String(screen.height) : '',
    typeof navigator !== 'undefined' ? navigator.platform || '' : '',
    'meuracha-visitor-v1',
  ].join('|');

  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
