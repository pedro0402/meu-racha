import { describe, expect, test, beforeEach } from 'vitest';
import { computeVisitorHash, _resetVisitorIdForTests } from '../../src/utils/visitorHash.js';

beforeEach(() => {
  _resetVisitorIdForTests();
});

describe('computeVisitorHash', () => {
  test('produz hash hexadecimal de 64 caracteres', async () => {
    const h = await computeVisitorHash();
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  test('é estável entre chamadas no mesmo navegador', async () => {
    const a = await computeVisitorHash();
    const b = await computeVisitorHash();
    expect(a).toBe(b);
  });

  test('persiste o id em localStorage e reusa', async () => {
    await computeVisitorHash();
    const id = window.localStorage.getItem('meuracha:visitor-id');
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(10);

    const novoHash = await computeVisitorHash();
    expect(novoHash).toMatch(/^[a-f0-9]{64}$/);
    expect(window.localStorage.getItem('meuracha:visitor-id')).toBe(id);
  });

  test('navegadores diferentes (sem id compartilhado) geram hashes distintos', async () => {
    const hashA = await computeVisitorHash();

    _resetVisitorIdForTests();

    const hashB = await computeVisitorHash();
    expect(hashB).not.toBe(hashA);
  });
});
