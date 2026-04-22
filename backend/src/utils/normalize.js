/**
 * Normaliza nomes para comparação:
 * - remove acentos
 * - reduz múltiplos espaços
 * - trim
 * - lowercase
 *
 * Usado para evitar duplicidade do tipo "João" / "joao  " / "JOAO".
 */
function normalizeName(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

module.exports = { normalizeName };
