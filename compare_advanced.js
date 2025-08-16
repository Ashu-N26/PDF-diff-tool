const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

async function compareAdvanced(file1, file2) {
  const pdf1 = await PDFDocument.load(fs.readFileSync(file1));
  const pdf2 = await PDFDocument.load(fs.readFileSync(file2));

  const outPdf = await PDFDocument.create();
  const [page1] = await outPdf.copyPages(pdf1, [0]);
  const [page2] = await outPdf.copyPages(pdf2, [0]);

  // Overlay second PDF page
  outPdf.addPage(page1);
  outPdf.addPage(page2);

  const outPath = 'output_diff.pdf';
  fs.writeFileSync(outPath, await outPdf.save());
  return outPath;
}
module.exports = { compareAdvanced };
