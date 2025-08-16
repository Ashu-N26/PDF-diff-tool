const express = require('express');
const multer = require('multer');
const path = require('path');
const { compareAdvanced } = require('./compare_advanced');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/compare', upload.array('pdfs', 2), async (req, res) => {
  try {
    const [file1, file2] = req.files;
    const outputPath = await compareAdvanced(file1.path, file2.path);
    res.download(outputPath, 'diff_output.pdf');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error comparing PDFs');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
