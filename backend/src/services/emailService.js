const nodemailer = require('nodemailer');
const config = require('../config');

let cachedTransporter = null;

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
    cachedTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    console.log(`[email] Usando SMTP real: ${config.smtp.host} (${config.smtp.user})`);
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

async function enviarPdfRacha({ destinatario, racha, pdfPath }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: config.smtp.from,
    to: destinatario,
    subject: `Lista do racha "${racha.nome_dono}" fechada!`,
    text:
      `Olá ${racha.nome_dono},\n\n` +
      `A lista do seu racha foi fechada com ${config.maxJogadores} jogadores.\n` +
      `O PDF com a lista final está em anexo.\n\n` +
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

module.exports = { enviarPdfRacha };
