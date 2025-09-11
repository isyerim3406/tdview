// login.js
import 'dotenv/config';
import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import TelegramBot from 'node-telegram-bot-api';

// ENV değişkenleri
const TV_EMAIL = process.env.TV_EMAIL;
const TV_PASSWORD = process.env.TV_PASSWORD;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SIGNAL_AREA_COORDS = process.env.SIGNAL_AREA_COORDS;

// Koordinatları ENV’den sayılara çevir
const coords = SIGNAL_AREA_COORDS.split(',').map(Number);

// Telegram bot başlat
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

async function getBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });
}

async function loginToTradingView(page) {
  console.log("TradingView'e giriş yapılıyor...");

  await page.goto('https://www.tradingview.com/#signin', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  await page.type('input[name="username"]', TV_EMAIL, { delay: 50 });
  await page.type('input[name="password"]', TV_PASSWORD, { delay: 50 });

  await page.keyboard.press('Enter');

  // Dashboard yüklenmesini bekle
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function checkSignalArea(page) {
  console.log("Grafik açılıyor...");

  await page.goto('https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Screenshot al
  const screenshotPath = '/tmp/chart.png';
  await page.screenshot({ path: screenshotPath });

  const image = await Jimp.read(screenshotPath);

  // Pixel oku
  const [x, y] = coords;
  const pixelColor = image.getPixelColor(x, y);
  const { r, g, b } = Jimp.intToRGBA(pixelColor);

  console.log(`Seçilen piksel [${x},${y}] RGB: (${r},${g},${b})`);

  return { r, g, b };
}

async function sendToTelegram(message) {
  await bot.sendMessage(TELEGRAM_CHAT_ID, message);
}

async function main() {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await loginToTradingView(page);
    const color = await checkSignalArea(page);

    await sendToTelegram(`ETHUSDT.P için sinyal: RGB(${color.r},${color.g},${color.b})`);
  } catch (err) {
    console.error("Hata:", err);
    await sendToTelegram(`Hata oluştu: ${err.message}`);
  } finally {
    await browser.close();
  }
}

main();
