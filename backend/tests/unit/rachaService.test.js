const db = require('../../src/db/database');
const crypto = require('crypto');
const entradaTokenService = require('../../src/services/entradaTokenService');
const rachaService = require('../../src/services/rachaService');

beforeEach(() => {
  db._resetForTests();
});

/** Uma inscrição com token + visitor_hash (como na API). */
async function entrar(rachaId, nome, posicao = 'jogador', visitorSeed = null) {
  const seed = visitorSeed ?? `${nome}-${Math.random()}`;
  const visitorHash = crypto.createHash('sha256').update(`unit-${seed}`).digest('hex');
  const { token } = await entradaTokenService.emitirTokenEntrada(rachaId);
  return rachaService.adicionarJogador(rachaId, nome, posicao, { entradaToken: token, visitorHash });
}

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
    expect(racha.pdf_gerado_titulares).toBe(0);
    expect(racha.pdf_gerado_final).toBe(0);
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
    const r = await entrar(racha.id, 'Pedro');
    expect(r.jogador.nome).toBe('Pedro');
    expect(r.jogador.posicao).toBe('jogador');
    expect(r.jogadores).toHaveLength(1);
    expect(r.atingiuLimiteTitulares).toBe(false);
    expect(r.atingiuLimiteSuplentes).toBe(false);
  });

  test('adiciona jogador como goleiro', async () => {
    const racha = await novoRacha();
    const r = await entrar(racha.id, 'Pedro', 'goleiro');
    expect(r.jogador.nome).toBe('Pedro');
    expect(r.jogador.posicao).toBe('goleiro');
    expect(r.jogadores).toHaveLength(1);
  });

  test('rejeita posição inválida', async () => {
    const racha = await novoRacha();
    await expect(entrar(racha.id, 'Pedro', 'defensor')).rejects.toMatchObject({ code: 'POSICAO_INVALIDA' });
  });

  test('mantém ordem de chegada', async () => {
    const racha = await novoRacha();
    await entrar(racha.id, 'Ana', 'jogador', 'a');
    await entrar(racha.id, 'Bia', 'jogador', 'b');
    await entrar(racha.id, 'Caio', 'jogador', 'c');

    const lista = await rachaService.listarJogadores(racha.id);
    expect(lista.map((j) => j.nome)).toEqual(['Ana', 'Bia', 'Caio']);
  });

  test('rejeita duplicidade (case/acento insensitive)', async () => {
    const racha = await novoRacha();
    await entrar(racha.id, 'João', 'jogador', 'x');

    await expect(entrar(racha.id, 'joão  ', 'jogador', 'y')).rejects.toMatchObject({ code: 'DUPLICATE' });
    await expect(entrar(racha.id, 'JOAO', 'jogador', 'z')).rejects.toMatchObject({ code: 'DUPLICATE' });
  });

  test('permite o mesmo nome em rachas diferentes', async () => {
    const r1 = await novoRacha();
    const r2 = await novoRacha();
    await expect(entrar(r1.id, 'Pedro', 'jogador', 'r1')).resolves.toBeTruthy();
    await expect(entrar(r2.id, 'Pedro', 'jogador', 'r2')).resolves.toBeTruthy();
  });

  test('rejeita nome inválido', async () => {
    const racha = await novoRacha();
    await expect(entrar(racha.id, 'a')).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  test('rejeita sem token de entrada', async () => {
    const racha = await novoRacha();
    const visitorHash = crypto.createHash('sha256').update('x').digest('hex');
    await expect(
      rachaService.adicionarJogador(racha.id, 'Pedro', 'jogador', { visitorHash }),
    ).rejects.toMatchObject({ code: 'TOKEN_OBRIGATORIO' });
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
        await entrar(racha.id, `Jogador ${i}`, 'jogador', `conc-${i}`);
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
      ultimo = await entrar(racha.id, `Jogador ${i}`, 'jogador', `lim-${i}`);
    }
    expect(ultimo.atingiuLimiteTitulares).toBe(true);
    expect(ultimo.atingiuLimiteSuplentes).toBe(false);
  });

  test('aceita suplentes quando habilitado e titulares já fecharam', async () => {
    const racha = await novoRacha({ max_jogadores: 2, suplentes_habilitados: true, max_suplentes: 2 });

    const primeiro = await entrar(racha.id, 'Titular 1', 'jogador', 't1');
    const segundo = await entrar(racha.id, 'Titular 2', 'jogador', 't2');
    const terceiro = await entrar(racha.id, 'Suplente 1', 'jogador', 's1');
    const quarto = await entrar(racha.id, 'Suplente 2', 'jogador', 's2');

    expect(primeiro.jogador.suplente).toBe(0);
    expect(segundo.jogador.suplente).toBe(0);
    expect(terceiro.jogador.suplente).toBe(1);
    expect(quarto.jogador.suplente).toBe(1);

    expect(segundo.atingiuLimiteTitulares).toBe(true);
    expect(terceiro.atingiuLimiteTitulares).toBe(true);
    expect(quarto.atingiuLimiteSuplentes).toBe(true);

    const lista = await rachaService.listarJogadores(racha.id);
    expect(lista.map((j) => j.suplente)).toEqual([0, 0, 1, 1]);
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
