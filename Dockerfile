FROM node:20-bullseye

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
  poppler-utils \
  tesseract-ocr \
  tesseract-ocr-eng \
  imagemagick \
  libopencv-dev \
  build-essential \
  python3 \
  pkg-config \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || true

COPY . .

# optional native build (may fail if OpenCV headers not located)
RUN npm run build-native || true

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
