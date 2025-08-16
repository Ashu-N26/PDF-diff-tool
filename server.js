const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const diffNative = require("./diff_native/diff");
const diffAdvanced = require("./diff_advanced/diff");
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

    // Cleanup uploaded files
    fs.unlinkSync(pdf1Path);
    fs.unlinkSync(pdf2Path);

    if (diffs.length === 0) {
      return res.send(`<h2>No differences found ✅</h2><a href="/">🔙 Compare another</a>`);
    }

    // Create PDF with highlights
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([800, 1000]);
    const { height } = page.getSize();

    let y = height - 50;
    page.drawText("PDF Diff Results", { x: 50, y, size: 18 });
    y -= 40;

    diffs.forEach(d => {
      if (y < 50) {
        page.addPage();
        y = height - 50;
      }
      page.drawText(`Line ${d.line}:`, { x: 50, y, size: 12, color: rgb(0, 0, 0) });
      y -= 20;
      page.drawText(`- ${d.old}`, { x: 70, y, size: 12, color: rgb(1, 0, 0) }); // red = old
      y -= 20;
      page.drawText(`+ ${d.new}`, { x: 70, y, size: 12, color: rgb(0, 0.6, 0) }); // green = new
      y -= 30;
    });

    const pdfBytes = await pdfDoc.save();
    const resultPath = path.join(__dirname, "result.pdf");
    fs.writeFileSync(resultPath, pdfBytes);

    // Send results as HTML with download link
    res.send(`
      <h2>Comparison Results</h2>
      <ul>
        ${diffs.map(d => `<li><b>Line ${d.line}:</b> <span style="color:red;">${d.old}</span> → <span style="color:green;">${d.new}</span></li>`).join("")}
      </ul>
      <br>
      <a href="/download">⬇️ Download Highlighted PDF</a><br><br>
      <a href="/">🔙 Compare another</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error comparing PDFs: " + err.message);
  }
});

// Download endpoint
app.get("/download", (req, res) => {
  const filePath = path.join(__dirname, "result.pdf");
  res.download(filePath, "diff_results.pdf");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});




