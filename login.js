// login.js

// -------------------------------------
// 1️⃣ ENVIRONMENT VARIABLES
// -------------------------------------
import 'dotenv/config'; // .env veya Render ENV'den değişkenleri alır

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TRADINGVIEW_USERNAME = process.env.TRADINGVIEW_USERNAME;
const TRADINGVIEW_PASSWORD = process.env.TRADINGVIEW_PASSWORD;
const SIGNAL_AREA_COORDS = process.env.SIGNAL_AREA_COORDS
  ? process.env.SIGNAL_AREA_COORDS.split(',').map(Number)
  : [1773, 139, 1795, 164]; // default koordinatlar

const CHART_URL = process.env.CHART_URL || 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P';
const WINDOW_WIDTH = 1920;
const WINDOW_HEIGHT = 1080;
const COLOR_TOLERANCE = 20;

// RGB renkler
const SIGNAL_COLORS = {
  "ALIM SİNYALİ GELDİ!": [76, 175, 80],  // yeşil
  "SATIM SİNYALİ GELDİ!": [255, 82, 82]  // kırmızı
};

// -------------------------------------
// 2️⃣ IMPORTS
// -------------------------------------
import puppeteer from 'puppeteer';
import TelegramBot from 'node-telegram-bot-api';
import Jimp from 'jimp';

// -------------------------------------
// 3️⃣ FONKSİYONLAR
// -------------------------------------
async function getBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });
}

async function loginToTradingView(page) {
  if (!TRADINGVIEW_USERNAME || !TRADINGVIEW_PASSWORD) {
    console.error("TradingView username veya password ayarlı değil!");
    return false;
  }

  console.log("TradingView'e giriş yapılıyor...");
  await page.goto('https://tr.tradingview.com/#signin', { waitUntil: 'networkidle2', timeout: 60000 });

  // Giriş formunu doldur
  await page.type('#username', TRADINGVIEW_USERNAME);
  await page.type('#password', TRADINGVIEW_PASSWORD);
  await page.click("button[type='submit']");

  await page.waitForTimeout(10000); // girişin tamamlanması
  console.log("Login tamamlandı.");
  return true;
}

async function takeAndCropScreenshot(page, path, coords) {
  await page.screenshot({ path });
  const img = await Jimp.read(path);
  const cropped = img.crop(coords[0], coords[1], coords[2] - coords[0], coords[3] - coords[1]);
  await cropped.writeAsync(path);
  console.log(`Screenshot kırpıldı: ${path}`);
  return cropped;
}

function analyzePixelArea(img) {
  const { data, bitmap } = img;
  let r = 0, g = 0, b = 0, count = 0;

  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      const idx = (bitmap.width * y + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }

  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

// -------------------------------------
// 4️⃣ ANA FONKSİYON
// -------------------------------------
async function main() {
  if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
    console.error("Telegram bilgileri eksik!");
    return;
  }

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT });

  // Login
  const loggedIn = await loginToTradingView(page);
  if (!loggedIn) return;

  // Grafik sayfasına git
  console.log(`Grafik sayfasına gidiliyor: ${CHART_URL}`);
  await page.goto(CHART_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForTimeout(15000); // grafik yüklenmesi için

  // Döngü ile kontrol
  while (true) {
    const screenshotPath = 'signal.png';
    const img = await takeAndCropScreenshot(page, screenshotPath, SIGNAL_AREA_COORDS);
    const avgColor = analyzePixelArea(img);
    console.log(`Tespit edilen renk: [${avgColor}]`);

    let signalMessage = null;
    for (let [msg, color] of Object.entries(SIGNAL_COLORS)) {
      if (
        Math.abs(avgColor[0] - color[0]) <= COLOR_TOLERANCE &&
        Math.abs(avgColor[1] - color[1]) <= COLOR_TOLERANCE &&
        Math.abs(avgColor[2] - color[2]) <= COLOR_TOLERANCE
      ) {
        signalMessage = msg;
        break;
      }
    }

    if (signalMessage) {
      console.log(`Sinyal bulundu: ${signalMessage}`);
      await bot.sendMessage(CHAT_ID, `TradingView Sinyal:\n${signalMessage}`);
    } else {
      console.log("Henüz sinyal yok.");
    }

    await page.waitForTimeout(60000); // 60 saniye bekle
  }
}

// -------------------------------------
// 5️⃣ ÇALIŞTIR
// -------------------------------------
main().catch(console.error);
