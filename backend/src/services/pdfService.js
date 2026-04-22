const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const pdfsDir = path.join(__dirname, '..', '..', 'pdfs');
if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });

/**
 * Gera um PDF da lista final do racha.
 * Retorna uma Promise com o caminho do arquivo gerado.
 */
function gerarPdfRacha({ racha, jogadores }) {
  return new Promise((resolve, reject) => {
    const fileName = `racha-${racha.id}.pdf`;
    const filePath = path.join(pdfsDir, fileName);

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

    // Lista numerada
    doc.fontSize(13);
    jogadores.forEach((jogador, index) => {
      doc.text(`${String(index + 1).padStart(2, '0')}. ${jogador.nome}`);
      doc.moveDown(0.3);
    });

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666')
      .text(`Lista fechada com ${jogadores.length} jogadores.`, { align: 'center' });

    doc.end();
  });
}

module.exports = { gerarPdfRacha };
