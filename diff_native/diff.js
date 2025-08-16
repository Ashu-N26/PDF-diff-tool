// diff_native/diff.js
const fs = require("fs");
const { Diff } = require("diff");
const PDFDocument = require("pdfkit");

/**
 * Generate a PDF with highlighted changes
 * @param {string} oldText - Extracted text from the old PDF
 * @param {string} newText - Extracted text from the new PDF
 * @param {string} outputFile - Output PDF path
 */
function generateDiffPDF(oldText, newText, outputFile) {
  const doc = new PDFDocument({ autoFirstPage: true });
  doc.pipe(fs.createWriteStream(outputFile));

  const diffs = Diff.diffWords(oldText, newText);

  diffs.forEach((part) => {
    if (part.added) {
      // Highlight new text in red background
      const width = doc.widthOfString(part.value);
      const height = 14; // text height
      const x = doc.x;
      const y = doc.y;

      doc.rect(x, y, width, height)
        .fillOpacity(0.6)
        .fill("red")
        .fillOpacity(1);

      doc.fillColor("white").text(part.value, x, y, { continued: true });
    } else if (!part.removed) {
      // Normal unchanged text
      doc.fillColor("black").text(part.value, { continued: true });
    }
    // Removed parts are ignored (not shown in final PDF)
  });

  doc.end();
  console.log(`✅ Diff PDF created: ${outputFile}`);
}

// Example usage (uncomment when testing standalone)
// const oldText = fs.readFileSync("old.txt", "utf8");
// const newText = fs.readFileSync("new.txt", "utf8");
// generateDiffPDF(oldText, newText, "result.pdf");

module.exports = { generateDiffPDF };


