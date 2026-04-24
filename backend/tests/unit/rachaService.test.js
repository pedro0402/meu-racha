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
  test('cria racha e gera id', async () => {
    const racha = await novoRacha();
    expect(racha.id).toMatch(/^[a-z2-9]{10}$/);
    expect(racha.nome_dono).toBe('João Organizador');
    expect(racha.pdf_gerado).toBe(0);
    expect(racha.data_abertura).toBeNull();
    expect(racha.max_jogadores).toBe(18);
  });

  test('aceita data_abertura opcional', async () => {
    const racha = await novoRacha({ data_abertura: '2026-04-19T12:00' });
    expect(racha.data_abertura).toBe('2026-04-19T12:00');
  });

  test('aceita max_jogadores customizado', async () => {
    const racha = await novoRacha({ max_jogadores: 12 });
    expect(racha.max_jogadores).toBe(12);
  });

  test('getRacha retorna null quando não existe', async () => {
    await expect(rachaService.getRacha('inexistente')).resolves.toBeNull();
  });
});

describe('adicionarJogador', () => {
  test('adiciona jogador com sucesso', async () => {
    const racha = await novoRacha();
    const r = await rachaService.adicionarJogador(racha.id, 'Pedro');
    expect(r.jogador.nome).toBe('Pedro');
    expect(r.jogadores).toHaveLength(1);
    expect(r.atingiuLimite).toBe(false);
  });

  test('mantém ordem de chegada', async () => {
    const racha = await novoRacha();
    await rachaService.adicionarJogador(racha.id, 'Ana');
    await rachaService.adicionarJogador(racha.id, 'Bia');
    await rachaService.adicionarJogador(racha.id, 'Caio');

    const lista = await rachaService.listarJogadores(racha.id);
    expect(lista.map((j) => j.nome)).toEqual(['Ana', 'Bia', 'Caio']);
  });

  test('rejeita duplicidade (case/acento insensitive)', async () => {
    const racha = await novoRacha();
    await rachaService.adicionarJogador(racha.id, 'João');

    await expect(rachaService.adicionarJogador(racha.id, 'joão  ')).rejects.toMatchObject({ code: 'DUPLICATE' });
    await expect(rachaService.adicionarJogador(racha.id, 'JOAO')).rejects.toMatchObject({ code: 'DUPLICATE' });
  });

  test('permite o mesmo nome em rachas diferentes', async () => {
    const r1 = await novoRacha();
    const r2 = await novoRacha();
    await expect(rachaService.adicionarJogador(r1.id, 'Pedro')).resolves.toBeTruthy();
    await expect(rachaService.adicionarJogador(r2.id, 'Pedro')).resolves.toBeTruthy();
  });

  test('rejeita nome inválido', async () => {
    const racha = await novoRacha();
    await expect(rachaService.adicionarJogador(racha.id, 'a')).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  test('rejeita racha inexistente', async () => {
    await expect(rachaService.adicionarJogador('inexistente', 'Pedro')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('NUNCA ultrapassa o limite configurado (concorrência simulada)', async () => {
    const racha = await novoRacha({ max_jogadores: 5 });
    const tentativas = 50;
    let sucessos = 0;
    let falhas = 0;

    // Em better-sqlite3, todas as transações em uma mesma conexão são
    // serializadas. Cada chamada simula uma requisição que tenta entrar.
    for (let i = 0; i < tentativas; i++) {
      try {
        await rachaService.adicionarJogador(racha.id, `Jogador ${i}`);
        sucessos++;
      } catch (e) {
        falhas++;
        expect(e.code).toBe('FULL');
      }
    }

    expect(sucessos).toBe(5);
    expect(falhas).toBe(tentativas - 5);
    await expect(rachaService.contarJogadores(racha.id)).resolves.toBe(5);
  });

  test('marca atingiuLimite=true exatamente no último slot', async () => {
    const racha = await novoRacha({ max_jogadores: 3 });
    let ultimo;
    for (let i = 0; i < 3; i++) {
      ultimo = await rachaService.adicionarJogador(racha.id, `Jogador ${i}`);
    }
    expect(ultimo.atingiuLimite).toBe(true);
  });
});

describe('tentarReservarGeracaoPdf', () => {
  test('só uma chamada consegue reservar', async () => {
    const racha = await novoRacha();

    await expect(rachaService.tentarReservarGeracaoPdf(racha.id)).resolves.toBe(true);
    await expect(rachaService.tentarReservarGeracaoPdf(racha.id)).resolves.toBe(false);
    await expect(rachaService.tentarReservarGeracaoPdf(racha.id)).resolves.toBe(false);
  });

  test('retorna false para racha inexistente', async () => {
    await expect(rachaService.tentarReservarGeracaoPdf('inexistente')).resolves.toBe(false);
  });
});
