const {
  isListaAbertaPadrao,
  isListaAbertaParaRacha,
  isValidDataAbertura,
  nowAsLocalString,
} = require('../../src/utils/time');

/**
 * Helper: trava o "agora" do sistema em um instante específico (UTC),
 * sem mexer nos timers (setTimeout/setImmediate continuam reais).
 */
function setNowUTC(isoUtc) {
  jest.useFakeTimers({
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'performance',
    ],
    now: new Date(isoUtc),
  });
}

afterEach(() => {
  jest.useRealTimers();
});

describe('isValidDataAbertura', () => {
  test('aceita formato YYYY-MM-DDTHH:mm', () => {
    expect(isValidDataAbertura('2026-04-19T12:00')).toBe(true);
    expect(isValidDataAbertura('2026-12-31T23:59')).toBe(true);
  });

  test('rejeita outros formatos', () => {
    expect(isValidDataAbertura('2026-04-19 12:00')).toBe(false);
    expect(isValidDataAbertura('19/04/2026 12:00')).toBe(false);
    expect(isValidDataAbertura('2026-04-19T12:00:00')).toBe(false);
    expect(isValidDataAbertura('')).toBe(false);
    expect(isValidDataAbertura(null)).toBe(false);
    expect(isValidDataAbertura(123)).toBe(false);
  });
});

describe('isListaAbertaPadrao (regra fallback: domingo >= 12h em America/Sao_Paulo)', () => {
  // 19/04/2026 é um domingo. Em America/Sao_Paulo (UTC-3), 12:00 local = 15:00 UTC.

  test('domingo 11:59 local → fechada', () => {
    setNowUTC('2026-04-19T14:59:00Z'); // 11:59 em SP
    expect(isListaAbertaPadrao()).toBe(false);
  });

  test('domingo 12:00 local → aberta', () => {
    setNowUTC('2026-04-19T15:00:00Z'); // 12:00 em SP
    expect(isListaAbertaPadrao()).toBe(true);
  });

  test('domingo 23:00 local → aberta', () => {
    setNowUTC('2026-04-20T02:00:00Z'); // domingo 23:00 em SP
    expect(isListaAbertaPadrao()).toBe(true);
  });

  test('segunda-feira → fechada', () => {
    setNowUTC('2026-04-20T15:00:00Z'); // segunda 12:00 em SP
    expect(isListaAbertaPadrao()).toBe(false);
  });
});

describe('nowAsLocalString', () => {
  test('retorna a hora correta no fuso configurado', () => {
    setNowUTC('2026-04-19T15:30:00Z'); // 12:30 em SP
    expect(nowAsLocalString()).toBe('2026-04-19T12:30');
  });
});

describe('isListaAbertaParaRacha', () => {
  beforeEach(() => {
    setNowUTC('2026-04-19T15:00:00Z'); // 12:00 em SP, domingo
  });

  test('retorna false para racha indefinido', () => {
    expect(isListaAbertaParaRacha(null)).toBe(false);
    expect(isListaAbertaParaRacha(undefined)).toBe(false);
  });

  test('quando data_abertura está definida, ignora regra padrão', () => {
    expect(isListaAbertaParaRacha({ data_abertura: '2026-04-19T11:59' })).toBe(true);
    expect(isListaAbertaParaRacha({ data_abertura: '2026-04-19T12:01' })).toBe(false);
  });

  test('quando data_abertura é nula, usa regra padrão (domingo 12h)', () => {
    expect(isListaAbertaParaRacha({ data_abertura: null })).toBe(true);

    setNowUTC('2026-04-20T15:00:00Z'); // segunda
    expect(isListaAbertaParaRacha({ data_abertura: null })).toBe(false);
  });

  test('horários iguais consideram a lista aberta', () => {
    expect(isListaAbertaParaRacha({ data_abertura: '2026-04-19T12:00' })).toBe(true);
  });
});
