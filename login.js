// login.js
import 'dotenv/config'; // .env değişkenlerini yükler
import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import TelegramBot from 'node-telegram-bot-api';

// --- Ortam değişkenleri ---
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const tradingviewUsername = process.env.TRADINGVIEW_USERNAME;
const tradingviewPassword = process.env.TRADINGVIEW_PASSWORD;
const chartUrl = process.env.TRADINGVIEW_CHART_URL;

// Signal area koordinatlarını .env üzerinden al
// Örnek: "1773,139,1795,164"
const coordsEnv = process.env.SIGNAL_AREA_COORDS || "1773,139,1795,164";
const signalAreaCoords = coordsEnv.split(',').map(Number);

// Sabit pencere boyutu
const WINDOW_WIDTH = 1920;
const WINDOW_HEIGHT = 1080;

// Sinyal renkleri
const SIGNAL_COLORS = {
    "ALIM SİNYALİ GELDİ!": [76, 175, 80],  // Yeşil
    "SATIM SİNYALİ GELDİ!": [255, 82, 82]  // Kırmızı
};
const COLOR_TOLERANCE = 20;

// Telegram bot
const bot = new TelegramBot(telegramBotToken);

async function loginAndGoToChart(page) {
    console.log("TradingView'e giriş yapılıyor...");
    await page.goto('https://tr.tradingview.com/#signin', { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForTimeout(2000);

    try {
        // Giriş butonları ve form alanları
        const loginButton = await page.$x("//button[contains(text(), 'Giriş Yap')]");
        if (loginButton.length > 0) await loginButton[0].click();
        await page.waitForTimeout(2000);

        await page.type('#username', tradingviewUsername);
        await page.type('#password', tradingviewPassword);

        const signinButton = await page.$x("//button[contains(text(), 'Giriş yap')]");
        if (signinButton.length > 0) await signinButton[0].click();

        await page.waitForTimeout(10000); // Girişin tamamlanması için
        console.log("Giriş başarılı.");

        // Grafiğe git
        await page.goto(chartUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForTimeout(15000); // Grafik yüklenmesi
        console.log("Grafik yüklendi.");
    } catch (err) {
        console.error("Giriş veya grafik yükleme sırasında hata:", err);
    }
}

async function takeAndAnalyzeScreenshot(page) {
    const screenshotPath = 'tradingview_screenshot.png';
    await page.screenshot({ path: screenshotPath });

    const image = await Jimp.read(screenshotPath);
    const cropped = image.clone().crop(signalAreaCoords[0], signalAreaCoords[1], 
                                       signalAreaCoords[2] - signalAreaCoords[0],
                                       signalAreaCoords[3] - signalAreaCoords[1]);

    // Ortalama renk
    let rSum = 0, gSum = 0, bSum = 0;
    cropped.scan(0, 0, cropped.bitmap.width, cropped.bitmap.height, function(x, y, idx) {
        rSum += this.bitmap.data[idx + 0];
        gSum += this.bitmap.data[idx + 1];
        bSum += this.bitmap.data[idx + 2];
    });
    const pixelCount = cropped.bitmap.width * cropped.bitmap.height;
    const avgColor = [Math.round(rSum/pixelCount), Math.round(gSum/pixelCount), Math.round(bSum/pixelCount)];
    return avgColor;
}

async function checkSignal(page) {
    const avgColor = await takeAndAnalyzeScreenshot(page);
    console.log("Tespit edilen ortalama renk:", avgColor);

    for (const [message, color] of Object.entries(SIGNAL_COLORS)) {
        if (Math.abs(avgColor[0] - color[0]) <= COLOR_TOLERANCE &&
            Math.abs(avgColor[1] - color[1]) <= COLOR_TOLERANCE &&
            Math.abs(avgColor[2] - color[2]) <= COLOR_TOLERANCE) {
            console.log("Sinyal tespit edildi:", message);
            await bot.sendMessage(chatId, `TradingView Sinyal:\n${message}`);
            return;
        }
    }
    console.log("Henüz bir sinyal tespit edilmedi.");
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT }
    });

    const page = await browser.newPage();
    await loginAndGoToChart(page);

    // Döngüyle her 60 saniyede kontrol
    while (true) {
        try {
            await checkSignal(page);
        } catch (err) {
            console.error("Sinyal kontrol hatası:", err);
        }
        await page.waitForTimeout(60000);
    }
})();
