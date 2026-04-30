const express = require('express');
const rachaService = require('../services/rachaService');
const entradaTokenService = require('../services/entradaTokenService');
const { gerarPdfRacha, getPdfPathForRacha, arquivoPdfExiste } = require('../services/pdfService');
const fs = require('fs');
const validateTime = require('../middleware/validateTime');
const {
  isListaAbertaParaRacha,
  isValidDataAbertura,
  isRachaExpirada,
  nowAsLocalString,
} = require('../utils/time');
const config = require('../config');

const LIMITES_CRIACAO = {
  nome_dono: 120,
  email: 254,
  telefone: 20,
};

function getShareBaseUrl() {
  return config.frontendUrl || 'http://localhost:5173';
}

/** SQLite 0/1, Postgres boolean — indica se algum fechamento já gerou PDF. */
function pdfRegistradoNoBanco(racha) {
  if (!racha) return false;
  return Boolean(racha.pdf_gerado_titulares) || Boolean(racha.pdf_gerado_final);
}

function campoExcedeLimite(valor, limite) {
  return typeof valor === 'string' && valor.trim().length > limite;
}

function buildRouter(io) {
  const router = express.Router();

  // -------- Criar racha --------
  router.post('/', async (req, res) => {
    try {
      const {
        nome_dono,
        email,
        telefone,
        data_abertura,
        max_jogadores,
        suplentes_habilitados,
        max_suplentes,
      } = req.body || {};
      const emailNorm =
        typeof email === 'string' && email.trim() ? email.trim() : '';

      if (!nome_dono || !telefone || !emailNorm) {
        return res.status(400).json({
          error: 'CAMPOS_OBRIGATORIOS',
          message: 'Informe nome_dono, email e telefone.',
        });
      }

      if (campoExcedeLimite(nome_dono, LIMITES_CRIACAO.nome_dono)) {
        return res.status(400).json({
          error: 'NOME_DONO_INVALIDO',
          message: 'nome_dono deve ter no máximo 120 caracteres.',
        });
      }

      if (campoExcedeLimite(emailNorm, LIMITES_CRIACAO.email)) {
        return res.status(400).json({
          error: 'EMAIL_INVALIDO',
          message: 'email deve ter no máximo 254 caracteres.',
        });
      }

      if (campoExcedeLimite(telefone, LIMITES_CRIACAO.telefone)) {
        return res.status(400).json({
          error: 'TELEFONE_INVALIDO',
          message: 'telefone deve ter no máximo 20 caracteres.',
        });
      }

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);
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
        if (data_abertura < nowAsLocalString()) {
          return res.status(400).json({
            error: 'DATA_ABERTURA_PASSADA',
            message: 'Escolha hoje ou uma data futura para abrir a lista.',
          });
        }
        dataAberturaNorm = data_abertura;
      }

      const racha = await rachaService.criarRacha({
        nome_dono: nome_dono.trim(),
        email: emailNorm,
        telefone: telefone.trim(),
        data_abertura: dataAberturaNorm,
        max_jogadores: maxJogadoresNorm,
        suplentes_habilitados: Boolean(suplentes_habilitados),
        max_suplentes: Number.isInteger(Number(max_suplentes)) ? Number(max_suplentes) : 0,
      });

      return res.status(201).json({
        racha,
        shareUrl: `${getShareBaseUrl()}/racha/${racha.id}`,
      });
    } catch (err) {
      console.error('[POST /api/rachas] erro:', err);
      return res.status(500).json({ error: 'INTERNAL', message: 'Erro interno' });
    }
  });

  // -------- Download do PDF (mesma regra de acesso do GET racha: quem tem o id) --------
  router.get('/:id/pdf', async (req, res) => {
    try {
      const racha = await rachaService.getRacha(req.params.id);
      if (!racha) return res.status(404).json({ error: 'RACHA_NAO_ENCONTRADO' });
      if (isRachaExpirada(racha)) {
        return res.status(410).json({
          error: 'LISTA_EXPIRADA',
          message: 'A lista deste racha expirou.',
        });
      }
      if (!pdfRegistradoNoBanco(racha)) {
        return res.status(404).json({
          error: 'PDF_INDISPONIVEL',
          message: 'O PDF ainda não foi gerado (lista ainda não fechou).',
        });
      }
      if (!arquivoPdfExiste(racha.id)) {
        return res.status(404).json({
          error: 'PDF_INDISPONIVEL',
          message: 'Arquivo PDF não encontrado no servidor.',
        });
      }
      const pdfPath = getPdfPathForRacha(racha.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="lista-racha-${racha.id}.pdf"`,
      );
      fs.createReadStream(pdfPath).pipe(res);
    } catch (err) {
      console.error('[GET /api/rachas/:id/pdf] erro:', err);
      return res.status(500).json({ error: 'INTERNAL', message: 'Erro interno' });
    }
  });

  // -------- Token descartável para entrar na lista (uso único; pareado com visitor_hash no POST) --------
  router.get('/:id/token-entrada', async (req, res) => {
    try {
      const racha = await rachaService.getRacha(req.params.id);
      const bloqueio = validateTime.avaliarEntradaNaLista(racha);
      if (bloqueio) return res.status(bloqueio.status).json(bloqueio.payload);

      const { token, expiraEm } = await entradaTokenService.emitirTokenEntrada(req.params.id);
      return res.json({ token, expiraEm });
    } catch (err) {
      console.error('[GET /api/rachas/:id/token-entrada] erro:', err);
      return res.status(500).json({ error: 'INTERNAL', message: 'Erro interno' });
    }
  });

  // -------- Buscar racha + lista --------
  router.get('/:id', async (req, res) => {
    try {
      const racha = await rachaService.getRacha(req.params.id);
      if (!racha) return res.status(404).json({ error: 'RACHA_NAO_ENCONTRADO' });
      if (isRachaExpirada(racha)) {
        return res.status(410).json({
          error: 'LISTA_EXPIRADA',
          message: 'A lista deste racha expirou e não está mais disponível.',
          racha: { ...racha, email: undefined, telefone: undefined },
          timezone: config.timezone,
          agora: nowAsLocalString(),
        });
      }

      const jogadores = await rachaService.listarJogadores(racha.id);
      const pdfDisponivel = pdfRegistradoNoBanco(racha) && arquivoPdfExiste(racha.id);
      return res.json({
        racha: { ...racha, email: undefined, telefone: undefined },
        jogadores,
        maxJogadores: racha.max_jogadores,
        listaAberta: isListaAbertaParaRacha(racha),
        pdfDisponivel,
        timezone: config.timezone,
        agora: nowAsLocalString(),
      });
    } catch (err) {
      console.error('[GET /api/rachas/:id] erro:', err);
      return res.status(500).json({ error: 'INTERNAL', message: 'Erro interno' });
    }
  });

  // -------- Entrar na lista --------
  router.post('/:id/jogadores', validateTime, async (req, res) => {
    const { nome, posicao, entrada_token: entradaTokenBody, visitor_hash: visitorHashBody } = req.body || {};
    if (typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ error: 'NOME_OBRIGATORIO' });
    }

    const posicaoNorm = posicao ? String(posicao).toLowerCase() : 'jogador';
    if (!['goleiro', 'jogador'].includes(posicaoNorm)) {
      return res.status(400).json({
        error: 'POSICAO_INVALIDA',
        message: 'Posição deve ser "goleiro" ou "jogador".',
      });
    }

    let resultado;
    try {
      resultado = await rachaService.adicionarJogador(req.params.id, nome, posicaoNorm, {
        entradaToken: entradaTokenBody,
        visitorHash: visitorHashBody,
      });
    } catch (e) {
      const map = {
        NOT_FOUND: [404, 'Racha não encontrado'],
        FULL: [409, 'Lista cheia'],
        DUPLICATE: [409, 'Esse nome já está na lista'],
        INVALID_NAME: [400, 'Nome inválido'],
        POSICAO_INVALIDA: [400, 'Posição inválida'],
        TOKEN_OBRIGATORIO: [400, 'Token de entrada ausente. Atualize a página.'],
        VISITOR_HASH_INVALIDO: [400, 'Identificador de visitante inválido. Atualize a página.'],
        TOKEN_INVALIDO: [403, 'Token de entrada inválido. Atualize a página.'],
        TOKEN_EXPIRADO: [403, 'O token de entrada expirou. Atualize a página e tente de novo.'],
        TOKEN_JA_USADO: [409, 'Este token já foi usado. Atualize a página.'],
        VISITOR_JA_INSCRITO: [
          409,
          'Já há uma inscrição nesta lista a partir deste aparelho.',
        ],
      };
      const [status, msg] = map[e.code] || [500, 'Erro interno'];
      return res.status(status).json({ error: e.code || 'INTERNAL', message: msg });
    }

    // Notifica todos conectados àquele racha em tempo real.
    io.to(`racha:${req.params.id}`).emit('jogadores:atualizados', {
      jogadores: resultado.jogadores,
    });

    // Se atingiu o limite de titulares, dispara fechamento de titulares.
    if (resultado.atingiuLimiteTitulares) {
      fecharRacha(req.params.id, io, 'titulares').catch((err) => {
        console.error('[fecharRacha] erro:', err);
      });
    }

    // Se atingiu o limite de suplentes, dispara fechamento final (titulares + suplentes).
    if (resultado.atingiuLimiteSuplentes) {
      fecharRacha(req.params.id, io, 'final').catch((err) => {
        console.error('[fecharRacha final] erro:', err);
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
 * - Emite evento em tempo real.
 */
async function fecharRacha(rachaId, io, tipo = 'final') {
  const reservou = await rachaService.tentarReservarGeracaoPdf(rachaId, tipo);
  if (!reservou) return;

  const racha = await rachaService.getRacha(rachaId);
  const jogadores = await rachaService.listarJogadores(rachaId);

  await gerarPdfRacha({ racha, jogadores });

  io.to(`racha:${rachaId}`).emit('racha:fechado', {
    rachaId,
    total: jogadores.length,
    tipo,
  });
}

module.exports = buildRouter;
