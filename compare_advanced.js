const fs = require("fs");
const { PDFDocument, rgb } = require("pdf-lib");
const pdfParse = require("pdf-parse");

async function compareAdvanced(pdfPath1, pdfPath2) {
  const pdf1Buffer = fs.readFileSync(pdfPath1);
  const pdf2Buffer = fs.readFileSync(pdfPath2);

  const pdf1Text = (await pdfParse(pdf1Buffer)).text;
  const pdf2Text = (await pdfParse(pdf2Buffer)).text;

  const pdfDoc = await PDFDocument.create();
  const [doc1, doc2] = await Promise.all([
    PDFDocument.load(pdf1Buffer),
    PDFDocument.load(pdf2Buffer),
  ]);

  const page1 = await pdfDoc.copyPages(doc1, [0]);
  const page2 = await pdfDoc.copyPages(doc2, [0]);

  pdfDoc.addPage(page1[0]);
  pdfDoc.addPage(page2[0]);

  const comparisonPage = pdfDoc.addPage([600, 800]);
  comparisonPage.drawText("Differences Detected:", {
    x: 50,
    y: 750,
    size: 18,
    color: rgb(1, 0, 0),
  });

  let differences = [];
  const lines1 = pdf1Text.split("\n");
  const lines2 = pdf2Text.split("\n");

  lines1.forEach((line, i) => {
    if (line !== lines2[i]) {
      differences.push(`Line ${i + 1}: "${line}"  ⟶  "${lines2[i]}"`);
    }
  });

  differences.slice(0, 25).forEach((diff, i) => {
    comparisonPage.drawText(diff, {
      x: 50,
      y: 720 - i * 20,
      size: 10,
      color: rgb(0, 0, 0),
    });
  });

  const resultPath = `comparison_${Date.now()}.pdf`;
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(resultPath, pdfBytes);

  return resultPath;
}

module.exports = compareAdvanced;

