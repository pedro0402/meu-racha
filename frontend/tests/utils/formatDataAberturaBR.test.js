import { describe, expect, test } from 'vitest';
import { formatDataAberturaBR } from '../../src/utils/formatDataAberturaBR.js';

describe('formatDataAberturaBR', () => {
  test('formata data e hora sem segundos', () => {
    expect(formatDataAberturaBR('2026-04-30T16:42')).toBe('30/04/2026 16:42');
  });

  test('ignora segundos na exibição', () => {
    expect(formatDataAberturaBR('2026-01-05T09:01:00')).toBe('05/01/2026 09:01');
  });

  test('retorna string vazia para entrada inválida', () => {
    expect(formatDataAberturaBR('')).toBe('');
    expect(formatDataAberturaBR(null)).toBe('');
  });
});
