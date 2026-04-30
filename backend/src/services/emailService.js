const dns = require('dns').promises;
const net = require('net');
const nodemailer = require('nodemailer');
const config = require('../config');

let cachedTransporter = null;

/**
 * Resolve hostname para IPv4 e define SNI (servername) para TLS/STARTTLS.
 * Nodemailer escolhe aleatoriamente entre A e AAAA; em provedores sem rota IPv6
 * (ex.: Render → Gmail) o AAAA pode falhar com ENETUNREACH.
 */
async function hostParaConexaoSmtp(hostname) {
  if (!config.smtp.forceIpv4 || net.isIP(hostname)) {
    return { host: hostname, tlsServername: null };
  }
  try {
    const addrs = await dns.resolve4(hostname);
    if (addrs.length > 0) {
      const pick = addrs[Math.floor(Math.random() * addrs.length)];
      return { host: pick, tlsServername: hostname };
    }
  } catch (_err) {
    /* fallback: nodemailer resolve como antes */
  }
  return { host: hostname, tlsServername: null };
}

/**
 * Verdadeiro só quando há credenciais SMTP completas (host + user + pass).
 * Sem isso, qualquer Gmail/SMTP recusa a conexão, então preferimos
 * cair para o Ethereal (preview) em vez de quebrar o fluxo.
 */
function smtpEstaConfiguradoComSenha() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

/**
 * Cria (ou reusa) um transporter SMTP.
 * - Com SMTP_HOST + SMTP_USER + SMTP_PASS preenchidos: usa SMTP real (ex.: Gmail).
 * - Sem SMTP_PASS: usa o Ethereal (envia para um inbox falso e imprime preview).
 */
async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (smtpEstaConfiguradoComSenha()) {
    const { host, tlsServername } = await hostParaConexaoSmtp(config.smtp.host);
    const tls =
      tlsServername != null ? { servername: tlsServername } : undefined;
    cachedTransporter = nodemailer.createTransport({
      host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      ...(tls ? { tls } : {}),
    });
    const hostLog =
      host !== config.smtp.host ? `${config.smtp.host} → ${host}` : config.smtp.host;
    console.log(`[email] Usando SMTP real: ${hostLog} (${config.smtp.user})`);
  } else {
    if (config.smtp.host && !config.smtp.pass) {
      console.warn(
        '[email] SMTP_HOST está definido mas SMTP_PASS está vazio.\n' +
        '         Caindo para Ethereal (preview). Configure uma "Senha de App"\n' +
        '         do Gmail em SMTP_PASS para enviar de verdade.',
      );
    }
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('[email] Usando conta Ethereal de teste:', testAccount.user);
  }

  return cachedTransporter;
}

async function enviarPdfRacha({ destinatario, racha, pdfPath, tipo = 'final' }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: destinatario,
    subject: tipo === 'titulares'
      ? `Lista do racha "${racha.nome_dono}" - titulares fechados`
      : `Lista do racha "${racha.nome_dono}" fechada (final)`,
    text:
      `Olá ${racha.nome_dono},\n\n` +
      (tipo === 'titulares'
        ? `A lista de titulares do seu racha foi preenchida com ${racha.max_jogadores} jogadores.\n` +
          `Enviamos o PDF com os titulares; se você habilitou suplentes, eles serão enviados quando a lista de suplentes for completada.\n\n`
        : `A lista final do seu racha foi fechada.\n`)
      + `O PDF com a lista está em anexo.\n\n` +
      `Bom jogo!`,
    attachments: [
      {
        filename: `racha-${racha.id}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
    ],
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('[email] Preview do e-mail:', previewUrl);
  }

  return info;
}

module.exports = {
  enviarPdfRacha,
  hostParaConexaoSmtp,
  /** Limpa transporter em cache (útil em testes). */
  resetTransporterCache: () => {
    cachedTransporter = null;
  },
};
