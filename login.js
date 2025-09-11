import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs';
import fetch from 'node-fetch';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram helper
async function sendTelegramMessage(text, photoPath) {
    if (!process.env.TG_TOKEN || !process.env.TG_CHAT_ID) {
        console.warn('Telegram token veya chat ID eksik.');
        return;
    }

    // Text message
    if (text) {
        await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.TG_CHAT_ID,
                text,
                parse_mode: 'Markdown'
            })
        });
    }

    // Photo upload
    if (photoPath && fs.existsSync(photoPath)) {
        const formData = new FormData();
        formData.append('chat_id', process.env.TG_CHAT_ID);
        formData.append('photo', fs.createReadStream(photoPath));
        await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
    }
}

// Puppeteer login & screenshot
async function loginAndScreenshot() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    const url = process.env.TV_URL;
    if (!url) throw new Error("TV_URL .env içinde eksik!");

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Login adımları
        const loginSelector = 'button[data-name="header-user-menu-sign-in"]';
        await page.waitForSelector(loginSelector, { timeout: 10000 });
        await page.click(loginSelector);

        await page.waitForTimeout(1000);
        await page.type('input[name="username"]', process.env.TV_EMAIL, { delay: 50 });
        await page.type('input[name="password"]', process.env.TV_PASSWORD, { delay: 50 });

        const submitButton = 'button[type="submit"]';
        await page.click(submitButton);

        // Giriş sonrası yükleme
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForTimeout(5000); // ekstra bekleme

        // Screenshot
        const screenshotPath = 'tv_screenshot.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });

        await sendTelegramMessage("TradingView giriş başarılı. İşte güncel grafik:", screenshotPath);

        await browser.close();
        console.log('✅ Screenshot Telegram\'a gönderildi.');
    } catch (err) {
        console.error('❌ Hata oluştu:', err);
        await sendTelegramMessage(`TradingView login veya screenshot sırasında hata oluştu: ${err.message}`);
        await browser.close();
    }
}

// Express server (Render için)
app.get('/', (req, res) => {
    res.send('Bot çalışıyor!');
});

app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
    // Botu başlat
    loginAndScreenshot();
});
