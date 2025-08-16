const fs = require("fs");
const { PDFDocument, rgb } = require("pdf-lib");
const diffNative = require("./diff_native/diff");

async function compareAdvanced(pdfPath1, pdfPath2) {
  const pdfDoc = await PDFDocument.create();
  const [doc1, doc2] = await Promise.all([
    PDFDocument.load(fs.readFileSync(pdfPath1)),
    PDFDocument.load(fs.readFileSync(pdfPath2)),
  ]);

  // Copy first pages from both PDFs
  const [page1] = await pdfDoc.copyPages(doc1, [0]);
  const [page2] = await pdfDoc.copyPages(doc2, [0]);
  pdfDoc.addPage(page1);
  pdfDoc.addPage(page2);

  // Add summary page
  const summaryPage = pdfDoc.addPage([600, 800]);
  summaryPage.drawText("🔎 Differences Detected", {
    x: 50, y: 750, size: 18, color: rgb(1, 0, 0),
  });

  const diffs = await diffNative(pdfPath1, pdfPath2);
  diffs.slice(0, 25).forEach((diff, i) => {
    summaryPage.drawText(
      `Line ${diff.line}: "${diff.old}" ⟶ "${diff.new}"`,
      { x: 50, y: 720 - i * 20, size: 10, color: rgb(0, 0, 0) }
    );
  });

  const resultPath = `comparison_${Date.now()}.pdf`;
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(resultPath, pdfBytes);
  return resultPath;
}

module.exports = compareAdvanced;


