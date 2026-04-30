const fs = require('fs');
const os = require('os');
const path = require('path');

const mockResolve4 = jest.fn();

jest.mock('dns', () => ({
  promises: {
    resolve4: (...args) => mockResolve4(...args),
  },
}));

const mockSmtp = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'user@test.com',
  pass: 'app-secret',
  from: 'MeuRacha <noreply@test.com>',
  forceIpv4: true,
};

jest.mock('../../src/config', () => ({
  smtp: mockSmtp,
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.mock('nodemailer', () => ({
  createTransport: (...args) => mockCreateTransport(...args),
  createTestAccount: jest.fn().mockResolvedValue({ user: 'ethereal-u', pass: 'ethereal-p' }),
  getTestMessageUrl: jest.fn(),
}));

const emailService = require('../../src/services/emailService');

describe('hostParaConexaoSmtp', () => {
  beforeEach(() => {
    mockSmtp.forceIpv4 = true;
    mockResolve4.mockReset();
  });

  test('com forceIpv4 desligado devolve o hostname sem resolver DNS', async () => {
    mockSmtp.forceIpv4 = false;
    const { hostParaConexaoSmtp } = emailService;
    await expect(hostParaConexaoSmtp('smtp.gmail.com')).resolves.toEqual({
      host: 'smtp.gmail.com',
      tlsServername: null,
    });
    expect(mockResolve4).not.toHaveBeenCalled();
  });

  test('com host já sendo IP não chama resolve4', async () => {
    const { hostParaConexaoSmtp } = emailService;
    await expect(hostParaConexaoSmtp('192.0.2.10')).resolves.toEqual({
      host: '192.0.2.10',
      tlsServername: null,
    });
    expect(mockResolve4).not.toHaveBeenCalled();
  });

  test('com forceIpv4 e A records usa IPv4 e define tlsServername', async () => {
    mockResolve4.mockResolvedValue(['192.0.2.1', '192.0.2.2']);
    const { hostParaConexaoSmtp } = emailService;
    const result = await hostParaConexaoSmtp('smtp.gmail.com');
    expect(mockResolve4).toHaveBeenCalledWith('smtp.gmail.com');
    expect(result.tlsServername).toBe('smtp.gmail.com');
    expect(['192.0.2.1', '192.0.2.2']).toContain(result.host);
  });

  test('se resolve4 falha, mantém hostname (fallback nodemailer)', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    const { hostParaConexaoSmtp } = emailService;
    await expect(hostParaConexaoSmtp('smtp.gmail.com')).resolves.toEqual({
      host: 'smtp.gmail.com',
      tlsServername: null,
    });
  });

  test('se resolve4 retorna lista vazia, mantém hostname', async () => {
    mockResolve4.mockResolvedValue([]);
    const { hostParaConexaoSmtp } = emailService;
    await expect(hostParaConexaoSmtp('smtp.gmail.com')).resolves.toEqual({
      host: 'smtp.gmail.com',
      tlsServername: null,
    });
  });
});

describe('enviarPdfRacha + transporter SMTP', () => {
  let pdfPath;
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    emailService.resetTransporterCache();
    mockCreateTransport.mockClear();
    mockSendMail.mockClear();
    mockResolve4.mockReset();
    mockResolve4.mockResolvedValue(['192.0.2.55']);
    mockSmtp.forceIpv4 = true;
    mockSmtp.host = 'smtp.gmail.com';
    mockSmtp.user = 'user@test.com';
    mockSmtp.pass = 'app-secret';
    pdfPath = path.join(os.tmpdir(), `meuracha-test-${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, '%PDF-1.4 test');
  });

  afterEach(() => {
    logSpy.mockRestore();
    try {
      fs.unlinkSync(pdfPath);
    } catch (_e) {
      /* ok */
    }
  });

  test('createTransport usa IP IPv4 e tls.servername para SNI', async () => {
    await emailService.enviarPdfRacha({
      destinatario: 'dest@example.com',
      racha: { id: 'abc', nome_dono: 'Dono', max_jogadores: 18 },
      pdfPath,
      tipo: 'final',
    });

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '192.0.2.55',
        port: 587,
        secure: false,
        tls: { servername: 'smtp.gmail.com' },
        auth: { user: 'user@test.com', pass: 'app-secret' },
      }),
    );
    expect(mockSendMail).toHaveBeenCalled();
  });

  test('porta 465 usa secure true', async () => {
    mockSmtp.port = 465;
    await emailService.enviarPdfRacha({
      destinatario: 'dest@example.com',
      racha: { id: 'x', nome_dono: 'N', max_jogadores: 10 },
      pdfPath,
    });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 465,
        secure: true,
        host: '192.0.2.55',
        tls: { servername: 'smtp.gmail.com' },
      }),
    );
    mockSmtp.port = 587;
  });
});
