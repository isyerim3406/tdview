# 1. Node.js tabanlı image
FROM node:22-slim

# 2. Chromium ve Puppeteer için gerekli paketler
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libxkbcommon0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. Çalışma dizini
WORKDIR /app

# 4. Paket dosyalarını kopyala ve npm install
COPY package*.json ./
RUN npm install

# 5. Proje dosyalarını kopyala
COPY . .

# 6. Puppeteer Chromium’u indir
RUN npx puppeteer install

# 7. Uygulamayı başlat
CMD ["node", "login.js"]
