import 'dotenv/config'; // .env dosyasındaki değişkenleri yükler
import puppeteer from 'puppeteer-core';
import Jimp from 'jimp';
import TelegramBot from 'node-telegram-bot-api';

// --- Ortam değişkenleri ---
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const tradingviewUsername = process.env.TRADINGVIEW_USERNAME;
const tradingviewPassword = process.env.TRADINGVIEW_PASSWORD;
const chartUrl = process.env.TRADINGVIEW_CHART_URL; // Örn: "https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P"
const coords = process.env.SIGNAL_AREA_COORDS.split(',').map(Number); // "1773,139,1795,164" gibi

// Renkler ve tolerans
const SIGNAL_COLORS = {
    "ALIM SİNYALİ GELDİ!": [76, 175, 80],   // yeşil
    "SATIM SİNYALİ GELDİ!": [255, 82, 82]   // kırmızı
};
const COLOR_TOLERANCE = 20;

// --- Telegram bot ---
const bot = new TelegramBot(telegramBotToken, { polling: false });

// --- Puppeteer ayarları ---
const WINDOW_WIDTH = 1920;
const WINDOW_HEIGHT = 1080;

async function getBrowser() {
    return await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`
        ]
    });
}

// --- TradingView giriş ---
async function loginToTradingView(page) {
    console.log("TradingView'e giriş yapılıyor...");
    await page.goto('https://tr.tradingview.com/#signin', { waitUntil: 'networkidle2', timeout: 120000 });

    // Kullanıcı adı ve şifre
    await page.type('input#username', tradingviewUsername, { delay: 50 });
    await page.type('input#password', tradingviewPassword, { delay: 50 });

    // Giriş butonu
    const signinButton = await page.$x("//button[contains(text(), 'Giriş yap')]");
    if (signinButton.length) await signinButton[0].click();

    // Girişin tamamlanması için bekle
    await page.waitForTimeout(15000);
    console.log("Giriş tamamlandı.");
}

// --- Renk analizi ---
async function analyzeScreenshot(screenshotBuffer) {
    const image = await Jimp.read(screenshotBuffer);
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
    return [Math.round(rSum / totalPixels), Math.round(gSum / totalPixels), Math.round(bSum / totalPixels)];
}

// --- Sinyal kontrol ---
function detectSignal(avgColor) {
    for (const [message, color] of Object.entries(SIGNAL_COLORS)) {
        if (
            Math.abs(avgColor[0] - color[0]) <= COLOR_TOLERANCE &&
            Math.abs(avgColor[1] - color[1]) <= COLOR_TOLERANCE &&
            Math.abs(avgColor[2] - color[2]) <= COLOR_TOLERANCE
        ) {
            return message;
        }
    }
    return null;
}

// --- Ana döngü ---
async function main() {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT });

    try {
        await loginToTradingView(page);

        // Grafiğe git
        console.log(`Grafik sayfasına yönlendiriliyor: ${chartUrl}`);
        await page.goto(chartUrl, { waitUntil: 'networkidle2', timeout: 120000 });
        await page.waitForTimeout(5000);

        while (true) {
            // Screenshot
            const screenshotBuffer = await page.screenshot({
                clip: {
                    x: coords[0],
                    y: coords[1],
                    width: coords[2] - coords[0],
                    height: coords[3] - coords[1]
                }
            });

            const avgColor = await analyzeScreenshot(screenshotBuffer);
            console.log("Ortalama renk:", avgColor);

            const signal = detectSignal(avgColor);
            if (signal) {
                console.log("Sinyal tespit edildi:", signal);
                await bot.sendMessage(chatId, `TradingView Sinyal:\n${signal}`);
            } else {
                console.log("Henüz sinyal yok.");
            }

            // 60 saniye bekle
            await page.waitForTimeout(60000);
        }
    } catch (err) {
        console.error("Hata oluştu:", err);
    } finally {
        await browser.close();
    }
}

main();
