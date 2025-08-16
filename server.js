const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const diffNative = require("./diff_native/diff.js");   // ✅ Fixed path
const diffAdvanced = require("./compare_advanced.js"); // ✅ Fixed path
const { PDFDocument, rgb } = require("pdf-lib");

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup (for file uploads)
const upload = multer({ dest: "uploads/" });

// Landing page with upload form
app.get("/", (req, res) => {
  res.send(`
    <h2>PDF Diff Tool</h2>
    <form action="/compare" method="post" enctype="multipart/form-data">
      <p>Select two PDF files to compare:</p>
      <input type="file" name="pdf1" accept="application/pdf" required />
      <br><br>
      <input type="file" name="pdf2" accept="application/pdf" required />
      <br><br>
      <button type="submit">Compare</button>
    </form>
  `);
});

// Compare endpoint
app.post("/compare", upload.fields([{ name: "pdf1" }, { name: "pdf2" }]), async (req, res) => {
  try {
    const pdf1Path = req.files["pdf1"][0].path;
    const pdf2Path = req.files["pdf2"][0].path;

    let diffs;
    try {
      // Try advanced comparison first
      diffs = await diffAdvanced(pdf1Path, pdf2Path);
    } catch (err) {
      console.error("Advanced diff failed, falling back to native:", err.message);
      diffs = await diffNative(pdf1Path, pdf2Path);
    }

    // Load the new PDF and highlight changes
    const pdfBytes = fs.readFileSync(pdf2Path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    diffs.forEach(diff => {
      const { page, x, y, text } = diff;
      if (pages[page]) {
        const pageRef = pages[page];
        pageRef.drawText(text, {
          x,
          y,
          size: 12,
          color: rgb(1, 0, 0), // ✅ Red highlight for changed text
        });
      }
    });

    const resultPdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=result.pdf");
    res.send(Buffer.from(resultPdfBytes));

    // Cleanup uploads
    fs.unlinkSync(pdf1Path);
    fs.unlinkSync(pdf2Path);
  } catch (error) {
    console.error("Error processing PDFs:", error);
    res.status(500).send("Error processing PDFs: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});





