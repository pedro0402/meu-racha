const { normalizeName } = require('../../src/utils/normalize');

describe('normalizeName', () => {
  test('remove acentos', () => {
    expect(normalizeName('João')).toBe('joao');
    expect(normalizeName('Antônio')).toBe('antonio');
    expect(normalizeName('Çá')).toBe('ca');
  });

  test('faz trim e colapsa espaços', () => {
    expect(normalizeName('  João   da   Silva  ')).toBe('joao da silva');
  });

  test('aplica lowercase', () => {
    expect(normalizeName('JOÃO')).toBe('joao');
    expect(normalizeName('Pedro')).toBe('pedro');
  });

  test('considera variações como equivalentes', () => {
    expect(normalizeName('João')).toBe(normalizeName('  joão '));
    expect(normalizeName('JOAO')).toBe(normalizeName('joão'));
  });

  test('retorna string vazia para entradas inválidas', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(123)).toBe('');
    expect(normalizeName('')).toBe('');
  });
});
