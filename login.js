// login.js
import puppeteer from "puppeteer";
import Jimp from "jimp";
import TelegramBot from "telegram";
import fs from "fs";

// --- Ortam değişkenlerinden al ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TRADINGVIEW_USERNAME = process.env.TRADINGVIEW_USERNAME;
const TRADINGVIEW_PASSWORD = process.env.TRADINGVIEW_PASSWORD;

// TradingView URL
const CHART_URL = "https://tr.tradingview.com/chart/?symbol=NASDAQ%3ATSLA";

// Sabit pencere boyutu
const WINDOW_WIDTH = 1920;
const WINDOW_HEIGHT = 1080;

// Sinyal alanı koordinatları (sol-x, üst-y, sağ-x, alt-y)
const SIGNAL_AREA = { x1: 1773, y1: 139, x2: 1795, y2: 164 };

// Renkler ve tolerans
const SIGNAL_COLORS = {
  "ALIM SİNYALİ GELDİ!": { r: 76, g: 175, b: 80 },    // yeşil
  "SATIM SİNYALİ GELDİ!": { r: 255, g: 82, b: 82 }    // kırmızı
};
const COLOR_TOLERANCE = 20;

// Telegram bot
const bot = new TelegramBot({ token: TELEGRAM_BOT_TOKEN });

// Ortalama renk hesaplama
async function getAverageColor(imagePath) {
  const image = await Jimp.read(imagePath);
  let rSum = 0, gSum = 0, bSum = 0;
  const w = image.bitmap.width;
  const h = image.bitmap.height;

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
      rSum += pixel.r;
      gSum += pixel.g;
      bSum += pixel.b;
    }
  }
  const totalPixels = w * h;
  return {
    r: Math.round(rSum / totalPixels),
    g: Math.round(gSum / totalPixels),
    b: Math.round(bSum / totalPixels)
  };
}

// Renk karşılaştırma
function matchColor(avg, target) {
  return (
    Math.abs(avg.r - target.r) <= COLOR_TOLERANCE &&
    Math.abs(avg.g - target.g) <= COLOR_TOLERANCE &&
    Math.abs(avg.b - target.b) <= COLOR_TOLERANCE
  );
}

// Ana fonksiyon
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT });

  // --- Login zaten yapıldıysa, direkt chart sayfasına gidilebilir ---
  await page.goto(CHART_URL, { waitUntil: "networkidle2" });
  console.log("Grafik sayfası yüklendi.");

  // Sonsuz döngü ile her 60 saniyede sinyal kontrolü
  while (true) {
    const screenshotPath = "signal_area.png";

    // Belirtilen alanın screenshot'unu al
    const clip = {
      x: SIGNAL_AREA.x1,
      y: SIGNAL_AREA.y1,
      width: SIGNAL_AREA.x2 - SIGNAL_AREA.x1,
      height: SIGNAL_AREA.y2 - SIGNAL_AREA.y1
    };
    await page.screenshot({ path: screenshotPath, clip });

    // Ortalama rengi bul
    const avgColor = await getAverageColor(screenshotPath);
    console.log("Ortalama renk:", avgColor);

    // Sinyal tespiti
    let detectedSignal = null;
    for (const [message, color] of Object.entries(SIGNAL_COLORS)) {
      if (matchColor(avgColor, color)) {
        detectedSignal = message;
        break;
      }
    }

    if (detectedSignal) {
      console.log("Sinyal tespit edildi:", detectedSignal);
      // Telegram mesaj gönder
      try {
        await bot.sendMessage({
          chat_id: TELEGRAM_CHAT_ID,
          text: `TradingView Sinyal:\n${detectedSignal}`
        });
      } catch (err) {
        console.error("Telegram gönderim hatası:", err);
      }
    } else {
      console.log("Henüz sinyal yok.");
    }

    // 60 saniye bekle
    await new Promise(r => setTimeout(r, 60000));
  }

})();
