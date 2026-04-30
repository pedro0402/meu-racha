/**
 * Hash anônimo enviado pelo navegador (SHA-256 hex, 64 caracteres).
 * Usado para limitar uma inscrição por “visitante” por racha, sem login.
 */

function normalizeVisitorHash(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidVisitorHash(value) {
  const n = normalizeVisitorHash(value);
  return /^[a-f0-9]{64}$/.test(n);
}

module.exports = {
  normalizeVisitorHash,
  isValidVisitorHash,
};
