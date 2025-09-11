import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import TelegramBot from 'node-telegram-bot-api';

// ----------------------
// Telegram ve TradingView ortam değişkenleri
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const tradingviewUsername = process.env.TRADINGVIEW_USERNAME;
const tradingviewPassword = process.env.TRADINGVIEW_PASSWORD;

// TradingView URL
const loginUrl = "https://tr.tradingview.com/#signin";
const chartUrl = "https://tr.tradingview.com/chart/?symbol=NASDAQ%3ATSLA";

// Sinyal alan koordinatları (değiştir)
const signalAreaCoords = { x1: 1773, y1: 139, x2: 1795, y2: 164 };

// Sinyal renkleri ve tolerans
const SIGNAL_COLORS = {
    "ALIM SİNYALİ GELDİ!": { r: 76, g: 175, b: 80 },
    "SATIM SİNYALİ GELDİ!": { r: 255, g: 82, b: 82 }
};
const COLOR_TOLERANCE = 20;

// Telegram Bot
const bot = new TelegramBot(telegramBotToken, { polling: false });

// Ortalalama renk hesaplama
async function getAverageColor(imagePath, coords) {
    const image = await Jimp.read(imagePath);
    const cropped = image.crop(coords.x1, coords.y1, coords.x2 - coords.x1, coords.y2 - coords.y1);

    let rSum = 0, gSum = 0, bSum = 0;
    const width = cropped.bitmap.width;
    const height = cropped.bitmap.height;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const pixel = Jimp.intToRGBA(cropped.getPixelColor(x, y));
            rSum += pixel.r;
            gSum += pixel.g;
            bSum += pixel.b;
        }
    }

    const total = width * height;
    return { r: Math.round(rSum / total), g: Math.round(gSum / total), b: Math.round(bSum / total) };
}

// Sinyal tespiti
function detectSignal(avgColor) {
    for (const [message, color] of Object.entries(SIGNAL_COLORS)) {
        if (
            Math.abs(avgColor.r - color.r) <= COLOR_TOLERANCE &&
            Math.abs(avgColor.g - color.g) <= COLOR_TOLERANCE &&
            Math.abs(avgColor.b - color.b) <= COLOR_TOLERANCE
        ) {
            return message;
        }
    }
    return null;
}

// Telegram'a mesaj gönder
function sendSignalMessage(message) {
    bot.sendMessage(telegramChatId, `TradingView Sinyal:\n${message}`);
}

// ----------------------
// Ana fonksiyon
(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Login
    console.log("Login adımları başlıyor...");
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.type('#username', tradingviewUsername);
    await page.type('#password', tradingviewPassword);
    await page.click('button:has-text("Giriş yap")');
    await page.waitForTimeout(10000); // Girişin tamamlanması

    console.log("Sayfa yüklendi. Grafik sayfasına yönlendiriliyor...");
    await page.goto(chartUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(15000); // Grafik yüklenmesi

    while (true) {
        const screenshotPath = 'chart.png';
        await page.screenshot({ path: screenshotPath });

        const avgColor = await getAverageColor(screenshotPath, signalAreaCoords);
        console.log(`Tespit edilen ortalama renk:`, avgColor);

        const signal = detectSignal(avgColor);
        if (signal) {
            console.log(`Sinyal tespit edildi: ${signal}`);
            sendSignalMessage(signal);
        } else {
            console.log("Henüz bir sinyal tespit edilmedi.");
        }

        await page.waitForTimeout(60000); // 60 saniye bekle
    }
})();
