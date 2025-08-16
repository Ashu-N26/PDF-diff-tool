// diff_native/diff.js
// Basic text comparison (line-by-line) as a fallback if advanced diff fails

const fs = require("fs");
const pdfParse = require("pdf-parse");

async function diffNative(pdfPath1, pdfPath2) {
  try {
    // Load both PDFs
    const pdf1Buffer = fs.readFileSync(pdfPath1);
    const pdf2Buffer = fs.readFileSync(pdfPath2);

    // Extract text
    const pdf1Text = (await pdfParse(pdf1Buffer)).text;
    const pdf2Text = (await pdfParse(pdf2Buffer)).text;

    const diffs = [];
    const lines1 = pdf1Text.split("\n");
    const lines2 = pdf2Text.split("\n");

    const maxLen = Math.max(lines1.length, lines2.length);

    // Compare line by line
    for (let i = 0; i < maxLen; i++) {
      if (lines1[i] !== lines2[i]) {
        diffs.push({
          line: i + 1,
          old: lines1[i] || "",
          new: lines2[i] || ""
        });
      }
    }

    return diffs;
  } catch (err) {
    console.error("Error in diffNative:", err);
    return [{ error: "Native diff failed", details: err.message }];
  }
}

module.exports = diffNative;

