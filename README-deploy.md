# Advanced PDF Compare - Deploy Notes

This advanced repository includes:
- OCR (Tesseract) fallback for scanned pages
- Auto alignment/resizing using OpenCV (opencv4nodejs) when available
- Pixel and text diffs; maps changed text to bounding boxes using tesseract TSV
- Final PDF has raster overlays and vector red rectangles for text changes
- Summary JSON/CSV and artifacts ZIP

## Local quick start
1. Install system deps:
   - Debian/Ubuntu:
     ```
     sudo apt-get update
     sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-eng imagemagick libopencv-dev build-essential pkg-config
     ```
   - macOS:
     ```
     brew install poppler tesseract imagemagick opencv
     ```

2. Install Node dependencies:
   ```
   npm install
   ```

3. Start server:
   ```
   npm start
   ```

4. Open http://localhost:3000

## Notes about OpenCV / opencv4nodejs
- `opencv4nodejs` requires native OpenCV development libraries and proper build environment.
- On Render, it's easier to use the provided Dockerfile which installs `libopencv-dev`.
- If opencv4nodejs fails to build, the tool falls back to ImageMagick-based resizing and pixelmatch diffs.

## Security & Production
- Limit upload sizes in `multer`.
- Run behind HTTPS.
- Consider offloading heavy processing to background workers (Redis + Bull) if many concurrent users.
