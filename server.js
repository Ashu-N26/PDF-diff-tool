const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const diffNative = require("./diff_native/diff");
const diffAdvanced = require("./diff_advanced/diff");

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup (for file uploads)
const upload = multer({ dest: "uploads/" });

// Serve static assets (if needed later)
app.use(express.static(path.join(__dirname, "public")));

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

    // Return results as simple HTML
    res.send(`
      <h2>Comparison Results</h2>
      ${
        diffs.length === 0
          ? "<p>No differences found ✅</p>"
          : `<ul>${diffs
              .map(
                d => `<li><b>Line ${d.line}:</b> 
                       <span style="color:red;">${d.old}</span> → 
                       <span style="color:green;">${d.new}</span></li>`
              )
              .join("")}</ul>`
      }
      <br>
      <a hre



