// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS (important for browser-based PDF upload)
app.use(cors());

// Middleware to parse JSON
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '/')));

// File storage config
const upload = multer({ dest: 'uploads/' });

// Compare PDFs (placeholder logic — replace with your advanced diff code)
function comparePDFs(oldPDF, newPDF, outputPDF, callback) {
    // Example using diff-pdf (you can replace with your OCR+layout diff logic)
    const cmd = `diff-pdf --output-diff=${outputPDF} ${oldPDF} ${newPDF}`;
    exec(cmd, (err) => {
        callback(err);
    });
}

// API to handle PDF uploads and comparison
app.post('/compare', upload.fields([{ name: 'oldPDF' }, { name: 'newPDF' }]), (req, res) => {
    try {
        const oldPDF = req.files['oldPDF'][0].path;
        const newPDF = req.files['newPDF'][0].path;
        const outputPDF = path.join(__dirname, 'output', `diff-${Date.now()}.pdf`);

        if (!fs.existsSync('output')) {
            fs.mkdirSync('output');
        }

        comparePDFs(oldPDF, newPDF, outputPDF, (err) => {
            // Clean up uploaded files
            fs.unlinkSync(oldPDF);
            fs.unlinkSync(newPDF);

            if (err) {
                console.error('Error comparing PDFs:', err);
                return res.status(500).json({ error: 'PDF comparison failed' });
            }

            res.download(outputPDF, (downloadErr) => {
                if (downloadErr) {
                    console.error('Download error:', downloadErr);
                }
                // Optional: delete diff after download
                setTimeout(() => {
                    if (fs.existsSync(outputPDF)) fs.unlinkSync(outputPDF);
                }, 5000);
            });
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Unexpected server error' });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

