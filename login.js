import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

// --- Ortam değişkenleri ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TRADINGVIEW_USERNAME = process.env.TRADINGVIEW_USERNAME;
const TRADINGVIEW_PASSWORD = process.env.TRADINGVIEW_PASSWORD;

// --- TradingView URL'leri ---
const login_url = "https://tr.tradingview.com/#signin";
const chart_url = "https://tr.tradingview.com/chart/?symbol=NASDAQ%3ATSLA";

// --- Pencere boyutu ---
const WINDOW_WIDTH = 1920;
const WINDOW_HEIGHT = 1080;

// --- Sinyal alanı koordinatları (sol-x, üst-y, sağ-x, alt-y) ---
let signal_area_coords = { x1: 1773, y1: 139, x2: 1795, y2: 164 }; // burayı değiştir

// --- Referans renkler ---
const SIGNAL_COLORS = {
    "ALIM SİNYALİ GELDİ!": { r: 76, g: 175, b: 80 },  // Yeşil
    "SATIM SİNYALİ GELDİ!": { r: 255, g: 82, b: 82 }  // Kırmızı
};
const COLOR_TOLERANCE = 20;

// --- Telegram bot ---
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

// --- Chrome başlat ---
async function getBrowser() {
    return await puppeteer.launch({
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT }
    });
}

// --- TradingView login ---
async function loginToTradingView(page) {
    console.log("TradingView'e giriş yapılıyor...");
    await page.goto(login_url, { waitUntil: 'networkidle2', timeout: 120000 });

    await page.waitForSelector('button:contains("Giriş Yap")', { timeout: 30000 });
    const loginButton = await page.$x("//button[contains(text(), 'Giriş Yap')]");
    if (loginButton.length) await loginButton[0].click();

    await page.waitForTimeout(2000);

    await page.type('#username', TRADINGVIEW_USERNAME, { delay: 50 });
    await page.type('#password', TRADINGVIEW_PASSWORD, { delay: 50 });

    const signinButton = await page.$x("//button[contains(text(), 'Giriş yap')]");
    if (signinButton.length) await signinButton[0].click();

    await page.waitForTimeout(10000); // girişin tamamlanması için bekle
    console.log("Login tamamlandı.");
}

// --- Ekran görüntüsü al ve kırp ---
async function captureAndCrop(page) {
    const screenshotBuffer = await page.screenshot();
    const img = await Jimp.read(screenshotBuffer);

    const cropped = img.clone().crop(
        signal_area_coords.x1,
        signal_area_coords.y1,
        signal_area_coords.x2 - signal_area_coords.x1,
        signal_area_coords.y2 - signal_area_coords.y1
    );
    return cropped;
}

// --- Ortalama renk hesapla ---
function getAverageColor(img) {
    let rSum = 0, gSum = 0, bSum = 0;
    const w = img.bitmap.width;
    const h = img.bitmap.height;

    img.scan(0, 0, w, h, function(x, y, idx) {
        rSum += this.bitmap.data[idx + 0];
        gSum += this.bitmap.data[idx + 1];
        bSum += this.bitmap.data[idx + 2];
    });

    const totalPixels = w * h;
    return {
        r: Math.round(rSum / totalPixels),
        g: Math.round(gSum / totalPixels),
        b: Math.round(bSum / totalPixels)
    };
}

// --- Renk karşılaştır ---
function matchColor(avgColor) {
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

// --- Ana döngü ---
async function main() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error("Telegram bilgileri eksik!");
        return;
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await loginToTradingView(page);

        console.log(`Grafik sayfasına gidiliyor: ${chart_url}`);
        await page.goto(chart_url, { waitUntil: 'networkidle2', timeout: 120000 });
        await page.waitForTimeout(15000); // grafik yüklenmesi için bekle

        while (true) {
            const croppedImg = await captureAndCrop(page);
            const avgColor = getAverageColor(croppedImg);
            console.log("Tespit edilen ortalama renk:", avgColor);

            const signal = matchColor(avgColor);
            if (signal) {
                console.log("Sinyal tespit edildi:", signal);
                await bot.sendMessage(TELEGRAM_CHAT_ID, `TradingView Sinyal:\n${signal}`);
            } else {
                console.log("Henüz sinyal yok.");
            }

            await page.waitForTimeout(60000); // 60 saniye bekle
        }
    } catch (err) {
        console.error("Hata oluştu:", err);
    } finally {
        await browser.close();
    }
}

main();
