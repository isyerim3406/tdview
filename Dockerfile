# Base image
FROM node:22-slim

# Çalışma dizini
WORKDIR /usr/src/app

# package.json ve package-lock.json kopyala
COPY package*.json ./

# Dependencies yükle
RUN npm install

# Projeyi kopyala
COPY . .

# Chromium ve gerekli kütüphaneler
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libgbm1 \
    libpango1.0-0 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer’in Chromium yolunu Render’da kullan
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# 3000 portunu aç
EXPOSE 3000

# Başlat
CMD ["node", "login.js"]
