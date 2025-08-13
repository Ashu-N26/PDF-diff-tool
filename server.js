const express = require('express');
const multer = require('multer');
const path = require('path');
const { compareAdvanced } = require('./compare_advanced');
const rimraf = require('rimraf');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

const upload = multer({ dest: path.join(__dirname, 'uploads/'), limits: { fileSize: 200 * 1024 * 1024 } });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Upload two PDFs
app.post('/compare', upload.fields([{ name: 'oldPdf' }, { name: 'newPdf' }]), async (req, res) => {
  try {
    if (!req.files || !req.files.oldPdf || !req.files.newPdf) {
      return res.status(400).json({ error: 'Please upload both old and new PDFs' });
    }

    const oldPdfPath = req.files.oldPdf[0].path;
    const newPdfPath = req.files.newPdf[0].path;
    const sessionId = uuidv4();
    const outDir = path.join(__dirname, 'tmp', sessionId);

    const result = await compareAdvanced(oldPdfPath, newPdfPath, outDir, {
      highlightColor: [255, 0, 0], // red
      threshold: 0.08,
      dpi: 300
    });

    // Cleanup uploaded files (keep result for download)
    rimraf(req.files.oldPdf[0].path, () => {});
    rimraf(req.files.newPdf[0].path, () => {});

    res.json({ downloadUrl: `/download/${path.basename(result.finalPdf)}`, sessionId, summaryUrl: `/download/${path.basename(result.summaryZip)}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Comparison failed', details: err.message, stack: err.stack });
  }
});

// Serve generated file
app.get('/download/:file', (req, res) => {
  const file = path.join(__dirname, 'tmp', req.params.file);
  if (!require('fs').existsSync(file)) return res.status(404).send('Not found');
  res.download(file, (err) => {
    if (err) console.error('Download error:', err);
  });
});

app.listen(PORT, () => {
  console.log(`Advanced PDF Compare server listening on port ${PORT}`);
});
