jest.mock('../../src/services/pdfService', () => ({
  gerarPdfRacha: jest.fn().mockResolvedValue('/tmp/fake.pdf'),
}));
jest.mock('../../src/services/emailService', () => ({
  enviarPdfRacha: jest.fn().mockResolvedValue({ messageId: 'fake' }),
}));

const { createApp } = require('../../src/app');
const db = require('../../src/db/database');
const rachaService = require('../../src/services/rachaService');
const { io: ioClient } = require('socket.io-client');
const request = require('supertest');

let server;
let httpAddress;

beforeAll((done) => {
  const app = createApp();
  server = app.server;
  // Sobe em porta dinâmica
  server.listen(0, () => {
    const { port } = server.address();
    httpAddress = `http://localhost:${port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  db._resetForTests();
});

function novoCliente() {
  return ioClient(httpAddress, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

function esperaEvento(socket, evento, ms = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout esperando ${evento}`)), ms);
    socket.once(evento, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

describe('Socket.IO', () => {
  test('cliente recebe lista atual ao entrar na sala do racha', async () => {
    const racha = rachaService.criarRacha({
      nome_dono: 'Pedro', email: 'p@x.com', telefone: '11', data_abertura: '2020-01-01T00:00',
    });
    rachaService.adicionarJogador(racha.id, 'Existente');

    const socket = novoCliente();
    await new Promise((r) => socket.on('connect', r));

    socket.emit('racha:entrar', { rachaId: racha.id });
    const payload = await esperaEvento(socket, 'jogadores:atualizados');

    expect(payload.jogadores).toHaveLength(1);
    expect(payload.jogadores[0].nome).toBe('Existente');

    socket.disconnect();
  });

  test('outro cliente recebe broadcast quando alguém entra via REST', async () => {
    const racha = rachaService.criarRacha({
      nome_dono: 'Pedro', email: 'p@x.com', telefone: '11', data_abertura: '2020-01-01T00:00',
    });

    const observador = novoCliente();
    await new Promise((r) => observador.on('connect', r));
    observador.emit('racha:entrar', { rachaId: racha.id });
    await esperaEvento(observador, 'jogadores:atualizados'); // estado inicial

    const promiseUpdate = esperaEvento(observador, 'jogadores:atualizados');

    await request(httpAddress)
      .post(`/api/rachas/${racha.id}/jogadores`)
      .send({ nome: 'Novo Jogador' });

    const payload = await promiseUpdate;
    expect(payload.jogadores.map((j) => j.nome)).toContain('Novo Jogador');

    observador.disconnect();
  });

  test('emite racha:fechado para a sala quando atinge limite', async () => {
    const racha = rachaService.criarRacha({
      nome_dono: 'Pedro', email: 'p@x.com', telefone: '11', data_abertura: '2020-01-01T00:00', max_jogadores: 3,
    });
    for (let i = 0; i < 2; i++) {
      rachaService.adicionarJogador(racha.id, `J${i}`);
    }

    const observador = novoCliente();
    await new Promise((r) => observador.on('connect', r));
    observador.emit('racha:entrar', { rachaId: racha.id });
    await esperaEvento(observador, 'jogadores:atualizados');

    const promiseFechado = esperaEvento(observador, 'racha:fechado');

    await request(httpAddress)
      .post(`/api/rachas/${racha.id}/jogadores`)
      .send({ nome: 'Ultimo' });

    const payload = await promiseFechado;
    expect(payload.rachaId).toBe(racha.id);
    expect(payload.total).toBe(3);

    observador.disconnect();
  });

  test('racha inexistente recebe racha:erro', async () => {
    const socket = novoCliente();
    await new Promise((r) => socket.on('connect', r));

    socket.emit('racha:entrar', { rachaId: 'naoexiste' });
    const payload = await esperaEvento(socket, 'racha:erro');
    expect(payload.message).toMatch(/Racha n[ãa]o encontrado/);

    socket.disconnect();
  });
});
