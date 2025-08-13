const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const rimraf = require('rimraf');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const tesseract = require('node-tesseract-ocr');
const DMP = require('diff-match-patch');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const dmp = new DMP();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pdfToPngs(pdfPath, outDir, prefix = 'page', dpi = 300) {
  ensureDir(outDir);
  const outPrefix = path.join(outDir, prefix);
  // pdftoppm -r <dpi> -png input.pdf outPrefix
  const args = ['-r', String(dpi), '-png', pdfPath, outPrefix];
  const r = spawnSync('pdftoppm', args, { encoding: 'utf8' });
  if (r.error) {
    throw new Error('pdftoppm not found or failed. Install poppler-utils. ' + r.error.message);
  }
  const allPng = fs.readdirSync(outDir).filter(f => f.endsWith('.png')).map(f => path.join(outDir, f)).sort();
  return allPng;
}

// Extract text using pdfjs-dist; returns array of page texts
async function extractTextWithPdfJs(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  const pagesText = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str).join(' ');
    pagesText.push(strings);
  }
  return pagesText;
}

// OCR a page image to get text and TSV bounding boxes
async function ocrPageWithTesseract(imgPath, dpi=300) {
  // tsv config
  const config = {
    tessedit_create_tsv: '1',
    preserve_interword_spaces: '1'
  };
  // tsv output path
  const out = imgPath + '.tsv';
  try {
    // use CLI directly to ensure TSV output
    const args = ['-l', 'eng', imgPath, 'stdout', '--tessdata-dir', '/usr/share/tessdata'];
    // but node-tesseract-ocr supports simple text; we'll call tesseract CLI for TSV
    const spawn = require('child_process').spawnSync;
    const res = spawn('tesseract', [imgPath, imgPath, 'tsv', '-l', 'eng'], { encoding: 'utf8' });
    if (res.error) {
      throw res.error;
    }
    // read TSV
    const tsvPath = imgPath + '.tsv';
    if (!fs.existsSync(tsvPath)) return { text: '', tsv: '' };
    const tsv = fs.readFileSync(tsvPath, 'utf8');
    // simple text extraction: combine words column
    const lines = tsv.split('\n').slice(1);
    const words = [];
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split('\t');
      // TSV columns: level, page_num, block_num, par_num, line_num, word_num, left, top, width, height, conf, text
      const txt = parts[11] || '';
      if (txt && txt.trim()) words.push(txt.trim());
    }
    return { text: words.join(' '), tsv };
  } catch (err) {
    return { text: '', tsv: '' };
  }
}

// Try to align two images using opencv4nodejs if installed; otherwise return scale factor via simple resize
async function tryAlignImages(imgAPath, imgBPath, outAlignedBPath) {
  try {
    const cv = require('opencv4nodejs');
    const A = cv.imread(imgAPath);
    const B = cv.imread(imgBPath);
    // convert to gray
    const grayA = A.bgrToGray();
    const grayB = B.bgrToGray();
    // detect ORB keypoints and descriptors
    const orb = new cv.ORBDetector();
    const kpA = orb.detect(grayA);
    const kpB = orb.detect(grayB);
    const descA = orb.compute(grayA, kpA);
    const descB = orb.compute(grayB, kpB);
    if (!descA || !descB) throw new Error('No descriptors');
    // match using BFMatcher
    const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);
    const matches = bf.match(descA, descB);
    if (!matches || matches.length < 8) throw new Error('Not enough matches for homography');
    // prepare points
    const ptsA = matches.map(m => kpA[m.queryIdx].point);
    const ptsB = matches.map(m => kpB[m.trainIdx].point);
    const srcPts = ptsB.map(p => new cv.Point2(p.x, p.y));
    const dstPts = ptsA.map(p => new cv.Point2(p.x, p.y));
    const homography = cv.findHomography(srcPts, dstPts, cv.RANSAC).homography;
    const warped = B.warpPerspective(homography, new cv.Size(A.cols, A.rows));
    cv.imwrite(outAlignedBPath, warped);
    return { method: 'opencv', success: true };
  } catch (err) {
    // fallback: simple resize to match dimensions
    try {
      const A = PNG.sync.read(fs.readFileSync(imgAPath));
      const B = PNG.sync.read(fs.readFileSync(imgBPath));
      if (A.width === B.width && A.height === B.height) {
        // just copy
        fs.copyFileSync(imgBPath, outAlignedBPath);
        return { method: 'copy', success: true };
      }
      // resize B to match A dimensions using simple canvas via sharp if available, else use ImageMagick convert
      const spawn = require('child_process').spawnSync;
      const res = spawn('convert', [imgBPath, '-resize', `${A.width}x${A.height}!`, outAlignedBPath]);
      if (res.error) throw res.error;
      return { method: 'imagemagick', success: true };
    } catch (err2) {
      // final fallback: copy
      fs.copyFileSync(imgBPath, outAlignedBPath);
      return { method: 'fallback', success: false, error: err2.message || err.message };
    }
  }
}

function createDiffOverlay(imgAPath, imgBPath, outPath, options = {}) {
  const { threshold = 0.08, highlightColor = [255,0,0] } = options;
  const imgA = PNG.sync.read(fs.readFileSync(imgAPath));
  const imgB = PNG.sync.read(fs.readFileSync(imgBPath));

  // ensure same size
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    throw new Error('Page sizes differ after alignment/resizing.');
  }

  const { width, height } = imgA;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(imgA.data, imgB.data, diff.data, width, height, {
    threshold: threshold,
    includeAA: true
  });

  const overlay = new PNG({ width, height });
  for (let i = 0; i < diff.data.length; i += 4) {
    const isDifferent = diff.data[i] || diff.data[i+1] || diff.data[i+2] || diff.data[i+3];
    if (isDifferent) {
      overlay.data[i] = highlightColor[0];
      overlay.data[i+1] = highlightColor[1];
      overlay.data[i+2] = highlightColor[2];
      overlay.data[i+3] = 200;
    } else {
      overlay.data[i] = 0;
      overlay.data[i+1] = 0;
      overlay.data[i+2] = 0;
      overlay.data[i+3] = 0;
    }
  }

  fs.writeFileSync(outPath, PNG.sync.write(overlay));
  return diffPixels;
}

// Map changed text snippets to bounding boxes using tesseract TSV for the new page; returns array of {text, bbox}
function mapTextChangesToBBoxes(tsvContent, changes) {
  // Parse TSV into word entries with bbox
  const lines = tsvContent.split('\n').slice(1);
  const entries = [];
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 12) continue;
    const txt = parts[11].trim();
    if (!txt) continue;
    const left = parseInt(parts[6]), top = parseInt(parts[7]), width = parseInt(parts[8]), height = parseInt(parts[9]);
    entries.push({ text: txt, left, top, width, height });
  }
  // For each changed snippet, find matching words and compute bbox
  const results = [];
  for (const ch of changes) {
    const snippet = ch.text;
    if (!snippet || snippet.length < 1) continue;
    const words = snippet.split(/\s+/).map(w => w.replace(/[^\w\d.:-]/g,'')).filter(Boolean);
    if (!words.length) continue;
    // find first occurrence of sequence
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].text.replace(/[^\w\d.:-]/g,'') === words[0]) {
        // try match subsequent words
        let j = 0;
        while (j < words.length && (entries[i+j] && entries[i+j].text.replace(/[^\w\d.:-]/g,'') === words[j])) j++;
        if (j >= 1) {
          // compute bbox from entries[i]..entries[i+j-1]
          const slice = entries.slice(i, i+j);
          const left = Math.min(...slice.map(s=>s.left));
          const top = Math.min(...slice.map(s=>s.top));
          const right = Math.max(...slice.map(s=>s.left + s.width));
          const bottom = Math.max(...slice.map(s=>s.top + s.height));
          results.push({ text: snippet, bbox: [left, top, right-left, bottom-top] });
          break;
        }
      }
    }
  }
  return results;
}

// Compose final PDF with new page images and vector rectangle overlays (so highlights are crisp)
async function composeFinalPdfWithOverlays(pageImages, overlayImages, textBoxesPerPage, outPdfPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const outStream = fs.createWriteStream(outPdfPath);
    doc.pipe(outStream);

    for (let i = 0; i < pageImages.length; i++) {
      const imgPath = pageImages[i];
      const overlayPath = overlayImages[i];
      const imgBuf = fs.readFileSync(imgPath);
      const imgObj = doc.openImage(imgBuf);
      doc.addPage({ size: [imgObj.width, imgObj.height] });
      doc.image(imgPath, 0, 0, { width: imgObj.width, height: imgObj.height });

      // draw raster overlay if exists (semi-transparent)
      if (fs.existsSync(overlayPath)) {
        doc.image(overlayPath, 0, 0, { width: imgObj.width, height: imgObj.height });
      }

      // draw vector rectangles for text changes (from tesseract TSV coords which are in pixels relative to image)
      const boxes = textBoxesPerPage[i] || [];
      doc.save();
      doc.fillOpacity(0.15);
      for (const b of boxes) {
        const [left, top, w, h] = b.bbox;
        // PDFKit coordinate system: (0,0) is bottom-left. Our bbox top is from top; convert:
        const y = imgObj.height - top - h;
        doc.rect(left, y, w, h).fill('red');
      }
      doc.restore();
    }

    // add summary page
    doc.addPage();
    doc.fontSize(14).text('Comparison Summary', { underline: true });
    doc.moveDown();
    doc.text(`Generated on: ${new Date().toISOString()}`);
    doc.end();

    outStream.on('finish', () => resolve(outPdfPath));
    outStream.on('error', reject);
  });
}

// Main entry
async function compareAdvanced(oldPdf, newPdf, outDir, options = {}) {
  ensureDir(outDir);
  const dpi = options.dpi || 300;
  const tempOld = path.join(outDir, 'old_pages');
  const tempNew = path.join(outDir, 'new_pages');
  ensureDir(tempOld); ensureDir(tempNew);

  // 1) Render pages to PNG at requested DPI
  const oldPngs = pdfToPngs(oldPdf, tempOld, 'old', dpi);
  const newPngs = pdfToPngs(newPdf, tempNew, 'new', dpi);

  // 2) Extract text via pdfjs; fallback to tesseract if no text present per page
  let oldTexts = [];
  let newTexts = [];
  try {
    oldTexts = await extractTextWithPdfJs(oldPdf);
    newTexts = await extractTextWithPdfJs(newPdf);
  } catch (err) {
    // fallback: empty arrays
    oldTexts = []; newTexts = [];
  }

  const pageCount = Math.max(oldPngs.length, newPngs.length);
  const overlays = [];
  const alignedNewPages = [];
  const textBoxesPerPage = [];
  const summary = [];

  for (let i = 0; i < pageCount; i++) {
    const oldPage = oldPngs[i] || oldPngs[oldPngs.length-1];
    const newPage = newPngs[i] || newPngs[newPngs.length-1];
    const alignedNew = path.join(outDir, `aligned-new-${i+1}.png`);
    // attempt alignment/resizing
    await tryAlignImages(oldPage, newPage, alignedNew);
    alignedNewPages.push(alignedNew);

    // pixel diff overlay
    const overlayPath = path.join(outDir, `overlay-${i+1}.png`);
    try {
      const dp = createDiffOverlay(oldPage, alignedNew, overlayPath, options);
      overlays.push(overlayPath);
    } catch (err) {
      // create empty overlay
      const empty = new PNG({ width: 1, height: 1 });
      fs.writeFileSync(overlayPath, PNG.sync.write(empty));
      overlays.push(overlayPath);
    }

    // text diff
    const oldText = (oldTexts[i] || '') ;
    let newText = (newTexts[i] || '');
    let tsv = '';
    if (!newText || newText.trim().length < 10) {
      // OCR the new aligned page to get TSV + text
      const o = await ocrPageWithTesseract(alignedNew, dpi);
      newText = o.text || newText;
      tsv = o.tsv || '';
    } else {
      // try get TSV via OCR as well to map boxes
      const o = await ocrPageWithTesseract(alignedNew, dpi);
      tsv = o.tsv || '';
    }

    // run diff-match-patch on page text
    const diffs = dmp.diff_main(oldText || '', newText || '');
    dmp.diff_cleanupSemantic(diffs);
    // collect changed segments
    const changes = [];
    for (const part of diffs) {
      const [op, txt] = part; // op: -1 delete, 0 equal, 1 insert
      if (op === 1 || op === -1) {
        changes.push({ op, text: txt.slice(0,500) });
      }
    }

    // map insertions/modifications to bboxes using TSV
    const mapped = mapTextChangesToBBoxes(tsv, changes.filter(c=>c.op===1).map(c=>({text:c.text})));
    textBoxesPerPage.push(mapped);

    // summary entry
    summary.push({
      page: i+1,
      pixelDiffCount: (fs.existsSync(overlayPath) ? 'generated' : 'none'),
      textChanges: changes.length,
      mappedBoxes: mapped.length
    });
  }

  // compose final PDF with overlays and text boxes
  const finalPdfPath = path.join(path.dirname(outDir), `${path.basename(outDir)}-advanced-comparison.pdf`);
  await composeFinalPdfWithOverlays(alignedNewPages, overlays, textBoxesPerPage, finalPdfPath);

  // write summary JSON and CSV
  const summaryJson = path.join(path.dirname(outDir), `${path.basename(outDir)}-summary.json`);
  fs.writeFileSync(summaryJson, JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2));
  const csvPath = path.join(path.dirname(outDir), `${path.basename(outDir)}-summary.csv`);
  const csvWriter = createCsvWriter({ path: csvPath, header: [
    {id:'page', title:'page'},
    {id:'pixelDiffCount', title:'pixelDiffCount'},
    {id:'textChanges', title:'textChanges'},
    {id:'mappedBoxes', title:'mappedBoxes'}
  ]});
  await csvWriter.writeRecords(summary);

  // zip summary and overlays for download
  const arch = require('archiver');
  const outZip = path.join(path.dirname(outDir), `${path.basename(outDir)}-artifacts.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZip);
    const archive = arch('zip', { zlib: { level: 9 }});
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(finalPdfPath, { name: path.basename(finalPdfPath) });
    archive.file(summaryJson, { name: path.basename(summaryJson) });
    archive.file(csvPath, { name: path.basename(csvPath) });
    // include overlays small sample
    overlays.forEach((ov, idx) => {
      if (fs.existsSync(ov)) archive.file(ov, { name: `overlays/overlay-${idx+1}.png` });
    });
    archive.finalize();
  });

  return { finalPdf: finalPdfPath, summaryJson, summaryCsv: csvPath, summaryZip: outZip };
}

module.exports = { compareAdvanced };
