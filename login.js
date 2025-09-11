import 'dotenv/config';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import FormData from 'form-data';

// =========================================================================================
// CONFIG
// =========================================================================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TRADINGVIEW_URL = process.env.TRADINGVIEW_URL;

// =========================================================================================
// TELEGRAM
// =========================================================================================
async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram ayarları eksik!");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown"
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`Telegram API error: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("Telegram mesaj gönderme hatası:", err);
  }
}

async function sendTelegramPhoto(buffer, caption = "") {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
  const formData = new FormData();
  formData.append("chat_id", TELEGRAM_CHAT_ID);
  formData.append("caption", caption);
  formData.append("photo", buffer, { filename: "screenshot.png" });

  try {
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) {
      console.error(`Telegram Photo API error: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error("Telegram fotoğraf gönderme hatası:", err);
  }
}

// =========================================================================================
// TRADINGVIEW SCREENSHOT
// =========================================================================================
async function takeScreenshot(page) {
  return await page.screenshot({ fullPage: false });
}

// =========================================================================================
// MAIN
// =========================================================================================
async function main() {
  await sendTelegramMessage("✅ *TradingView Bot Başlatıldı!*\nHer 60 saniyede bir ekran görüntüsü gönderilecek.");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(TRADINGVIEW_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Her 60 saniyede bir screenshot al ve Telegram’a gönder
  setInterval(async () => {
    try {
      const img = await takeScreenshot(page);
      await sendTelegramPhoto(img, "📸 *Yeni Screenshot*");
      console.log("Screenshot gönderildi.");
    } catch (err) {
      console.error("Screenshot hatası:", err);
    }
  }, 60_000);
}

main().catch(console.error);
