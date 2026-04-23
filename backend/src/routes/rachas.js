const express = require('express');
const rachaService = require('../services/rachaService');
const { gerarPdfRacha } = require('../services/pdfService');
const { enviarPdfRacha } = require('../services/emailService');
const validateTime = require('../middleware/validateTime');
const {
  isListaAbertaParaRacha,
  isValidDataAbertura,
  nowAsLocalString,
} = require('../utils/time');
const config = require('../config');

function buildRouter(io) {
  const router = express.Router();

  // -------- Criar racha --------
  router.post('/', (req, res) => {
    const { nome_dono, email, telefone, data_abertura, max_jogadores } = req.body || {};
    if (!nome_dono || !email || !telefone) {
      return res.status(400).json({
        error: 'CAMPOS_OBRIGATORIOS',
        message: 'Informe nome_dono, email e telefone.',
      });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: 'EMAIL_INVALIDO' });
    }

    let maxJogadoresNorm = config.maxJogadores;
    if (max_jogadores !== undefined && max_jogadores !== null && max_jogadores !== '') {
      const parsed = Number(max_jogadores);
      if (!Number.isInteger(parsed) || parsed < 2 || parsed > 50) {
        return res.status(400).json({
          error: 'MAX_JOGADORES_INVALIDO',
          message: 'max_jogadores deve ser um inteiro entre 2 e 50.',
        });
      }
      maxJogadoresNorm = parsed;
    }

    let dataAberturaNorm = null;
    if (data_abertura !== undefined && data_abertura !== null && data_abertura !== '') {
      if (!isValidDataAbertura(data_abertura)) {
        return res.status(400).json({
          error: 'DATA_ABERTURA_INVALIDA',
          message: 'Use o formato YYYY-MM-DDTHH:mm.',
        });
      }
      dataAberturaNorm = data_abertura;
    }

    const racha = rachaService.criarRacha({
      nome_dono: nome_dono.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      data_abertura: dataAberturaNorm,
      max_jogadores: maxJogadoresNorm,
    });

    return res.status(201).json({
      racha,
      shareUrl: `${config.frontendUrl}/racha/${racha.id}`,
    });
  });

  // -------- Buscar racha + lista --------
  router.get('/:id', (req, res) => {
    const racha = rachaService.getRacha(req.params.id);
    if (!racha) return res.status(404).json({ error: 'RACHA_NAO_ENCONTRADO' });

    const jogadores = rachaService.listarJogadores(racha.id);
    return res.json({
      racha: { ...racha, email: undefined, telefone: undefined },
      jogadores,
      maxJogadores: racha.max_jogadores,
      listaAberta: isListaAbertaParaRacha(racha),
      timezone: config.timezone,
      agora: nowAsLocalString(),
    });
  });

  // -------- Entrar na lista --------
  router.post('/:id/jogadores', validateTime, async (req, res) => {
    const { nome } = req.body || {};
    if (typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ error: 'NOME_OBRIGATORIO' });
    }

    let resultado;
    try {
      resultado = rachaService.adicionarJogador(req.params.id, nome);
    } catch (e) {
      const map = {
        NOT_FOUND: [404, 'Racha não encontrado'],
        FULL: [409, 'Lista cheia'],
        DUPLICATE: [409, 'Esse nome já está na lista'],
        INVALID_NAME: [400, 'Nome inválido'],
      };
      const [status, msg] = map[e.code] || [500, 'Erro interno'];
      return res.status(status).json({ error: e.code || 'INTERNAL', message: msg });
    }

    // Notifica todos conectados àquele racha em tempo real.
    io.to(`racha:${req.params.id}`).emit('jogadores:atualizados', {
      jogadores: resultado.jogadores,
    });

    // Se atingiu o limite, dispara fluxo de fechamento (PDF + e-mail) em background.
    if (resultado.atingiuLimite) {
      fecharRacha(req.params.id, io).catch((err) => {
        console.error('[fecharRacha] erro:', err);
      });
    }

    return res.status(201).json({
      jogador: resultado.jogador,
      total: resultado.jogadores.length,
    });
  });

  return router;
}

/**
 * Fluxo de fechamento da lista.
 * - Reserva atomicamente o direito de gerar o PDF (evita duplicidade).
 * - Gera PDF.
 * - Envia por e-mail ao dono.
 * - Emite evento em tempo real.
 */
async function fecharRacha(rachaId, io) {
  const reservou = rachaService.tentarReservarGeracaoPdf(rachaId);
  if (!reservou) return;

  const racha = rachaService.getRacha(rachaId);
  const jogadores = rachaService.listarJogadores(rachaId);

  const pdfPath = await gerarPdfRacha({ racha, jogadores });

  try {
    await enviarPdfRacha({
      destinatario: racha.email,
      racha,
      pdfPath,
    });
  } catch (err) {
    console.error('[email] falha ao enviar PDF:', err.message);
  }

  io.to(`racha:${rachaId}`).emit('racha:fechado', {
    rachaId,
    total: jogadores.length,
  });
}

module.exports = buildRouter;
