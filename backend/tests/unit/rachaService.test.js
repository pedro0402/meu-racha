const db = require('../../src/db/database');
const rachaService = require('../../src/services/rachaService');

beforeEach(() => {
  db._resetForTests();
});

function novoRacha(overrides = {}) {
  return rachaService.criarRacha({
    nome_dono: 'João Organizador',
    email: 'joao@x.com',
    telefone: '11999999999',
    max_jogadores: 18,
    ...overrides,
  });
}

describe('criarRacha / getRacha', () => {
  test('cria racha e gera id', () => {
    const racha = novoRacha();
    expect(racha.id).toMatch(/^[a-z2-9]{10}$/);
    expect(racha.nome_dono).toBe('João Organizador');
    expect(racha.pdf_gerado).toBe(0);
    expect(racha.data_abertura).toBeNull();
    expect(racha.max_jogadores).toBe(18);
  });

  test('aceita data_abertura opcional', () => {
    const racha = novoRacha({ data_abertura: '2026-04-19T12:00' });
    expect(racha.data_abertura).toBe('2026-04-19T12:00');
  });

  test('aceita max_jogadores customizado', () => {
    const racha = novoRacha({ max_jogadores: 12 });
    expect(racha.max_jogadores).toBe(12);
  });

  test('getRacha retorna undefined quando não existe', () => {
    expect(rachaService.getRacha('inexistente')).toBeUndefined();
  });
});

describe('adicionarJogador', () => {
  test('adiciona jogador com sucesso', () => {
    const racha = novoRacha();
    const r = rachaService.adicionarJogador(racha.id, 'Pedro');
    expect(r.jogador.nome).toBe('Pedro');
    expect(r.jogadores).toHaveLength(1);
    expect(r.atingiuLimite).toBe(false);
  });

  test('mantém ordem de chegada', () => {
    const racha = novoRacha();
    rachaService.adicionarJogador(racha.id, 'Ana');
    rachaService.adicionarJogador(racha.id, 'Bia');
    rachaService.adicionarJogador(racha.id, 'Caio');

    const lista = rachaService.listarJogadores(racha.id);
    expect(lista.map((j) => j.nome)).toEqual(['Ana', 'Bia', 'Caio']);
  });

  test('rejeita duplicidade (case/acento insensitive)', () => {
    const racha = novoRacha();
    rachaService.adicionarJogador(racha.id, 'João');

    expect(() => rachaService.adicionarJogador(racha.id, 'joão  ')).toThrow(
      expect.objectContaining({ code: 'DUPLICATE' }),
    );
    expect(() => rachaService.adicionarJogador(racha.id, 'JOAO')).toThrow(
      expect.objectContaining({ code: 'DUPLICATE' }),
    );
  });

  test('permite o mesmo nome em rachas diferentes', () => {
    const r1 = novoRacha();
    const r2 = novoRacha();
    expect(() => rachaService.adicionarJogador(r1.id, 'Pedro')).not.toThrow();
    expect(() => rachaService.adicionarJogador(r2.id, 'Pedro')).not.toThrow();
  });

  test('rejeita nome inválido', () => {
    const racha = novoRacha();
    expect(() => rachaService.adicionarJogador(racha.id, 'a')).toThrow(
      expect.objectContaining({ code: 'INVALID_NAME' }),
    );
  });

  test('rejeita racha inexistente', () => {
    expect(() => rachaService.adicionarJogador('inexistente', 'Pedro')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  test('NUNCA ultrapassa o limite configurado (concorrência simulada)', () => {
    const racha = novoRacha({ max_jogadores: 5 });
    const tentativas = 50;
    let sucessos = 0;
    let falhas = 0;

    // Em better-sqlite3, todas as transações em uma mesma conexão são
    // serializadas. Cada chamada simula uma requisição que tenta entrar.
    for (let i = 0; i < tentativas; i++) {
      try {
        rachaService.adicionarJogador(racha.id, `Jogador ${i}`);
        sucessos++;
      } catch (e) {
        falhas++;
        expect(e.code).toBe('FULL');
      }
    }

    expect(sucessos).toBe(5);
    expect(falhas).toBe(tentativas - 5);
    expect(rachaService.contarJogadores(racha.id)).toBe(5);
  });

  test('marca atingiuLimite=true exatamente no último slot', () => {
    const racha = novoRacha({ max_jogadores: 3 });
    let ultimo;
    for (let i = 0; i < 3; i++) {
      ultimo = rachaService.adicionarJogador(racha.id, `Jogador ${i}`);
    }
    expect(ultimo.atingiuLimite).toBe(true);
  });
});

describe('tentarReservarGeracaoPdf', () => {
  test('só uma chamada consegue reservar', () => {
    const racha = novoRacha();

    expect(rachaService.tentarReservarGeracaoPdf(racha.id)).toBe(true);
    expect(rachaService.tentarReservarGeracaoPdf(racha.id)).toBe(false);
    expect(rachaService.tentarReservarGeracaoPdf(racha.id)).toBe(false);
  });

  test('retorna false para racha inexistente', () => {
    expect(rachaService.tentarReservarGeracaoPdf('inexistente')).toBe(false);
  });
});
