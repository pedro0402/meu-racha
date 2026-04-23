// Mockamos PDF e e-mail para que o fechamento da lista não tente
// escrever em disco nem mandar SMTP nos testes.
jest.mock('../../src/services/pdfService', () => ({
  gerarPdfRacha: jest.fn().mockResolvedValue('/tmp/fake.pdf'),
}));
jest.mock('../../src/services/emailService', () => ({
  enviarPdfRacha: jest.fn().mockResolvedValue({ messageId: 'fake' }),
}));

const request = require('supertest');
const { createApp } = require('../../src/app');
const db = require('../../src/db/database');
const { gerarPdfRacha } = require('../../src/services/pdfService');
const { enviarPdfRacha } = require('../../src/services/emailService');

let app;

beforeAll(() => {
  ({ app } = createApp());
});

/**
 * Falsificamos APENAS o relógio (Date / Date.now / hrtime), deixando
 * setImmediate / setTimeout / queueMicrotask reais — assim supertest e o
 * fluxo assíncrono de fechamento do racha continuam funcionando.
 */
function fixarHora(iso) {
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
    now: new Date(iso),
  });
}

beforeEach(() => {
  db._resetForTests();
  jest.clearAllMocks();
  fixarHora('2026-04-19T15:00:00Z'); // domingo 12:00 em SP
});

afterAll(() => {
  jest.useRealTimers();
});

function corpoCriacao(extra = {}) {
  return {
    nome_dono: 'Pedro',
    email: 'pedro@x.com',
    telefone: '11999999999',
    max_jogadores: 18,
    ...extra,
  };
}

describe('POST /api/rachas', () => {
  test('cria racha e devolve shareUrl', async () => {
    const res = await request(app).post('/api/rachas').send(corpoCriacao());

    expect(res.status).toBe(201);
    expect(res.body.racha.id).toMatch(/^[a-z2-9]{10}$/);
    expect(res.body.shareUrl).toContain(`/racha/${res.body.racha.id}`);
  });

  test('responde com CORS para origens locais de desenvolvimento', async () => {
    const origin = 'http://localhost:5173';
    const res = await request(app)
      .post('/api/rachas')
      .set('Origin', origin)
      .send(corpoCriacao());

    expect(res.status).toBe(201);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  test('400 quando faltam campos', async () => {
    const res = await request(app).post('/api/rachas').send({ nome_dono: 'só' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CAMPOS_OBRIGATORIOS');
  });

  test('400 quando email é inválido', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ email: 'naoeh-email' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('EMAIL_INVALIDO');
  });

  test('400 quando nome_dono excede o limite', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ nome_dono: 'A'.repeat(121) }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NOME_DONO_INVALIDO');
  });

  test('400 quando email excede o limite', async () => {
    const local = 'a'.repeat(250);
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ email: `${local}@x.com` }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('EMAIL_INVALIDO');
  });

  test('400 quando telefone excede o limite', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ telefone: '1'.repeat(21) }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TELEFONE_INVALIDO');
  });

  test('trata payload com caracteres SQL como texto literal', async () => {
    const payload = corpoCriacao({
      nome_dono: "Pedro');--",
      email: 'pedro.injection@example.com',
      telefone: "11) 99999-9999",
    });

    const res = await request(app).post('/api/rachas').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.racha.nome_dono).toBe("Pedro');--");

    const segundo = await request(app).post('/api/rachas').send(corpoCriacao({
      nome_dono: 'Segundo racha',
    }));
    expect(segundo.status).toBe(201);
  });

  test('400 quando data_abertura tem formato inválido', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ data_abertura: '19/04/2026 12:00' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('DATA_ABERTURA_INVALIDA');
  });

  test('400 quando data_abertura está no passado', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ data_abertura: '2026-04-18T12:00' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('DATA_ABERTURA_PASSADA');
    expect(res.body.message).toBe('Escolha hoje ou uma data futura para abrir a lista.');
  });

  test('aceita data_abertura válida', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ data_abertura: '2026-04-19T12:00' }));
    expect(res.status).toBe(201);
    expect(res.body.racha.data_abertura).toBe('2026-04-19T12:00');
  });

  test('aceita data_abertura futura', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ data_abertura: '2026-04-20T12:00' }));
    expect(res.status).toBe(201);
    expect(res.body.racha.data_abertura).toBe('2026-04-20T12:00');
  });

  test('aceita max_jogadores customizado', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ max_jogadores: 10 }));
    expect(res.status).toBe(201);
    expect(res.body.racha.max_jogadores).toBe(10);
  });

  test('400 quando max_jogadores é inválido', async () => {
    const res = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ max_jogadores: 1 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MAX_JOGADORES_INVALIDO');
  });
});

describe('GET /api/rachas/:id', () => {
  test('retorna 404 se não existe', async () => {
    const res = await request(app).get('/api/rachas/naoexiste');
    expect(res.status).toBe(404);
  });

  test('NÃO expõe email/telefone do dono', async () => {
    const criado = await request(app).post('/api/rachas').send(corpoCriacao());
    const res = await request(app).get(`/api/rachas/${criado.body.racha.id}`);
    expect(res.status).toBe(200);
    expect(res.body.racha.email).toBeUndefined();
    expect(res.body.racha.telefone).toBeUndefined();
    expect(res.body.maxJogadores).toBe(18);
    expect(res.body.timezone).toBe('America/Sao_Paulo');
  });

  test('retorna maxJogadores com valor customizado do racha', async () => {
    const criado = await request(app)
      .post('/api/rachas')
      .send(corpoCriacao({ max_jogadores: 7 }));

    const res = await request(app).get(`/api/rachas/${criado.body.racha.id}`);
    expect(res.status).toBe(200);
    expect(res.body.maxJogadores).toBe(7);
  });
});

describe('POST /api/rachas/:id/jogadores', () => {
  async function criarRacha(extra = {}) {
    const r = await request(app).post('/api/rachas').send(corpoCriacao(extra));
    return r.body.racha.id;
  }

  test('insere jogador e devolve total', async () => {
    const id = await criarRacha();
    const res = await request(app)
      .post(`/api/rachas/${id}/jogadores`)
      .send({ nome: 'Pedro' });

    expect(res.status).toBe(201);
    expect(res.body.jogador.nome).toBe('Pedro');
    expect(res.body.total).toBe(1);
  });

  test('400 sem nome', async () => {
    const id = await criarRacha();
    const res = await request(app).post(`/api/rachas/${id}/jogadores`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NOME_OBRIGATORIO');
  });

  test('409 quando o nome é duplicado', async () => {
    const id = await criarRacha();
    await request(app).post(`/api/rachas/${id}/jogadores`).send({ nome: 'Pedro' });

    const res = await request(app)
      .post(`/api/rachas/${id}/jogadores`)
      .send({ nome: 'PEDRO' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DUPLICATE');
  });

  test('409 quando lista está cheia', async () => {
    const id = await criarRacha({ max_jogadores: 3 });
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/rachas/${id}/jogadores`)
        .send({ nome: `J${i}` });
    }
    const res = await request(app)
      .post(`/api/rachas/${id}/jogadores`)
      .send({ nome: 'Atrasado' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('FULL');
  });

  test('403 LISTA_FECHADA quando data_abertura está no futuro', async () => {
    const id = await criarRacha({ data_abertura: '2030-01-01T12:00' });
    const res = await request(app)
      .post(`/api/rachas/${id}/jogadores`)
      .send({ nome: 'Pedro' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LISTA_FECHADA');
  });

  test('403 LISTA_FECHADA com regra padrão fora de domingo 12h', async () => {
    fixarHora('2026-04-20T15:00:00Z'); // segunda 12h SP
    const id = await criarRacha(); // sem data_abertura → usa fallback
    const res = await request(app)
      .post(`/api/rachas/${id}/jogadores`)
      .send({ nome: 'Pedro' });
    expect(res.status).toBe(403);
  });

  test('ao atingir o limite configurado, dispara geração de PDF e e-mail UMA ÚNICA VEZ', async () => {
    const id = await criarRacha({ max_jogadores: 4 });
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post(`/api/rachas/${id}/jogadores`)
        .send({ nome: `J${i}` });
    }

    // O fluxo de fechamento é assíncrono (background). Aguardamos os mocks.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(gerarPdfRacha).toHaveBeenCalledTimes(1);
    expect(enviarPdfRacha).toHaveBeenCalledTimes(1);
    expect(enviarPdfRacha).toHaveBeenCalledWith(
      expect.objectContaining({ destinatario: 'pedro@x.com' }),
    );
  });
});
