const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

app.post("/compare", upload.array("files", 2), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length !== 2) {
      return res.status(400).json({ error: "Please upload exactly 2 PDFs." });
    }

    const compareAdvanced = require("./compare_advanced");
    const resultPath = await compareAdvanced(files[0].path, files[1].path);

    res.download(resultPath, "comparison_result.pdf", (err) => {
      if (err) console.error("Download error:", err);
      fs.unlinkSync(files[0].path);
      fs.unlinkSync(files[1].path);
      fs.unlinkSync(resultPath);
    });
  } catch (err) {
    console.error("❌ Compare failed:", err);
    res.status(500).json({ error: "Comparison failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


