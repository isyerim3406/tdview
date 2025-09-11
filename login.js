import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import TelegramBot from 'node-telegram-bot-api';

// --- Ortam değişkenlerinden ayarlar ---
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const tradingviewUsername = process.env.TRADINGVIEW_USERNAME;
const tradingviewPassword = process.env.TRADINGVIEW_PASSWORD;

// TradingView URL'leri
const loginUrl = "https://tr.tradingview.com/#signin";
const chartUrl = "https://tr.tradingview.com/chart/?symbol=NASDAQ%3ATSLA";

// Sinyal alanı ve renkler
const signalArea = { x1: 1773, y1: 139, x2: 1795, y2: 164 };
const SIGNAL_COLORS = {
    "ALIM SİNYALİ GELDİ!": { r: 76, g: 175, b: 80 },
    "SATIM SİNYALİ GELDİ!": { r: 255, g: 82, b: 82 }
};
const COLOR_TOLERANCE = 20;

// Telegram bot
const bot = new TelegramBot(telegramBotToken);

async function loginToTradingView(page) {
    if (!tradingviewUsername || !tradingviewPassword) {
        console.error("TradingView kullanıcı adı veya şifre ayarlanmamış!");
        return false;
    }

    console.log("TradingView'e giriş yapılıyor...");
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(5000);

    try {
        // "Giriş Yap" butonuna tıkla
        const loginButton = await page.$x("//button[contains(text(), 'Giriş Yap')]");
        if (loginButton.length) await loginButton[0].click();
        await page.waitForTimeout(2000);

        // Form alanlarını doldur
        await page.type('#username', tradingviewUsername);
        await page.type('#password', tradingviewPassword);
        await page.waitForTimeout(1000);

        const signinButton = await page.$x("//button[contains(text(), 'Giriş yap')]");
        if (signinButton.length) await signinButton[0].click();
        await page.waitForTimeout(10000); // girişin tamamlanması

        console.log("Giriş başarılı.");
        return true;
    } catch (err) {
        console.error("Giriş hatası:", err);
        return false;
    }
}

async function checkSignal(page) {
    try {
        const screenshotPath = 'chart.png';
        await page.screenshot({ path: screenshotPath });

        const img = await Jimp.read(screenshotPath);
        const cropped = img.clone().crop(
            signalArea.x1,
            signalArea.y1,
            signalArea.x2 - signalArea.x1,
            signalArea.y2 - signalArea.y1
        );

        // Ortalama renk hesapla
        let rSum = 0, gSum = 0, bSum = 0;
        const w = cropped.bitmap.width;
        const h = cropped.bitmap.height;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const color = Jimp.intToRGBA(cropped.getPixelColor(x, y));
                rSum += color.r;
                gSum += color.g;
                bSum += color.b;
            }
        }
        const totalPixels = w * h;
        const avgColor = {
            r: Math.round(rSum / totalPixels),
            g: Math.round(gSum / totalPixels),
            b: Math.round(bSum / totalPixels)
        };

        console.log("Tespit edilen renk:", avgColor);

        for (const [message, targetColor] of Object.entries(SIGNAL_COLORS)) {
            if (
                Math.abs(avgColor.r - targetColor.r) <= COLOR_TOLERANCE &&
                Math.abs(avgColor.g - targetColor.g) <= COLOR_TOLERANCE &&
                Math.abs(avgColor.b - targetColor.b) <= COLOR_TOLERANCE
            ) {
                console.log("Sinyal tespit edildi:", message);
                await bot.sendMessage(chatId, `TradingView Sinyal:\n${message}`);
                return;
            }
        }

        console.log("Henüz sinyal yok.");
    } catch (err) {
        console.error("Sinyal kontrol hatası:", err);
    }
}

async function main() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const loggedIn = await loginToTradingView(page);
    if (!loggedIn) return;

    console.log(`Grafik sayfasına yönlendiriliyor: ${chartUrl}`);
    await page.goto(chartUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(15000);

    // Sürekli kontrol döngüsü
    setInterval(async () => {
        await checkSignal(page);
    }, 60000); // her 60 saniye
}

main().catch(err => console.error("Genel hata:", err));
