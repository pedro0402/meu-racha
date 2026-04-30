const { isValidVisitorHash, normalizeVisitorHash } = require('../../src/utils/visitorHash');

describe('visitorHash util', () => {
  test('normaliza para minúsculas', () => {
    expect(normalizeVisitorHash('AB'.repeat(32))).toBe('ab'.repeat(32));
  });

  test('aceita SHA-256 hex (64 chars)', () => {
    expect(isValidVisitorHash('ab'.repeat(32))).toBe(true);
  });

  test('rejeita tamanho ou caracteres inválidos', () => {
    expect(isValidVisitorHash('gg'.repeat(32))).toBe(false);
    expect(isValidVisitorHash('ab'.repeat(31))).toBe(false);
  });
});
