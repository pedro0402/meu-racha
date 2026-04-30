const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const pdfsDir = path.join(__dirname, '..', '..', 'pdfs');
if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });

function getPdfPathForRacha(rachaId) {
  return path.join(pdfsDir, `racha-${rachaId}.pdf`);
}

function arquivoPdfExiste(rachaId) {
  return fs.existsSync(getPdfPathForRacha(rachaId));
}

function getPosicaoLabel(posicao) {
  return posicao === 'goleiro' ? 'Goleiro' : 'Jogador';
}

/**
 * Gera um PDF da lista final do racha.
 * Retorna uma Promise com o caminho do arquivo gerado.
 */
function gerarPdfRacha({ racha, jogadores }) {
  return new Promise((resolve, reject) => {
    const filePath = getPdfPathForRacha(racha.id);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    stream.on('error', reject);
    stream.on('finish', () => resolve(filePath));

    doc.pipe(stream);

    // Cabeçalho
    doc.fontSize(22).text('Lista do Racha', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Organizador: ${racha.nome_dono}`, { align: 'center' });

    const data = new Date(racha.data_criacao + 'Z').toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    doc.fontSize(11).text(`Data de criação: ${data}`, { align: 'center' });
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Titulares e Suplentes separados
    const titulares = jogadores.filter((j) => !j.suplente);
    const suplentes = jogadores.filter((j) => j.suplente);

    if (titulares.length > 0) {
      doc.fontSize(13).text('Titulares', { underline: true });
      doc.moveDown(0.3);
      titulares.forEach((jogador, index) => {
        const posicaoLabel = getPosicaoLabel(jogador.posicao);
        doc.text(`${String(index + 1).padStart(2, '0')}. ${jogador.nome} (${posicaoLabel})`);
        doc.moveDown(0.3);
      });
    }

    if (suplentes.length > 0) {
      doc.moveDown(0.6);
      doc.fontSize(13).text('Suplentes', { underline: true });
      doc.moveDown(0.3);
      suplentes.forEach((jogador, index) => {
        const posicaoLabel = getPosicaoLabel(jogador.posicao);
        doc.text(`${String(index + 1).padStart(2, '0')}. ${jogador.nome} (${posicaoLabel})`);
        doc.moveDown(0.3);
      });
    }

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666')
      .text(`Lista fechada com ${jogadores.length} jogadores.`, { align: 'center' });

    doc.end();
  });
}

module.exports = { gerarPdfRacha, getPdfPathForRacha, arquivoPdfExiste, pdfsDir };
