# PDF diff tool

PDF comparison tool OCR, auto-align, and pixel+text diff.

This repository is owned by Ashutosh Nanaware. Use responsibly for aviation PDF analysis. Redistribution requires attribution.

## Features
- OCR support (Tesseract) for scanned pages
- Auto alignment/resizing using OpenCV or ImageMagick fallback
- Pixel + text diff with vector overlays in the final PDF
- JSON/CSV summary and artifacts ZIP
- Advanced for AIP/IAC aviation PDF comparison

## Quick Start
1. Install system dependencies: Poppler, Tesseract, ImageMagick, OpenCV dev libraries
2. Run `npm install`
3. Start server: `npm start`
4. Open http://localhost:3000
