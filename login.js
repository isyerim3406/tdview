// login.js
import puppeteer from 'puppeteer';
import 'dotenv/config';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const TV_URL = process.env.TV_URL || 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P';
const TV_USER = process.env.TV_USER;
const TV_PASS = process.env.TV_PASS;
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

// Telegram helper
async function sendTelegramMessage(text, imagePath) {
    if (!TG_TOKEN || !TG_CHAT_ID) {
        console.warn('Telegram token veya chat ID eksik. Mesaj gönderilemiyor.');
        return;
    }

    if (imagePath) {
        const formData = new FormData();
        formData.append('chat_id', TG_CHAT_ID);
        formData.append('photo', fs.createReadStream(imagePath));

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
    } else {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text })
        });
    }
}

// Puppeteer setup
async function captureScreenshot() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        defaultViewport: null
    });

    const page = await browser.newPage();

    try {
        console.log('TradingView’e gidiliyor...');
        await page.goto(TV_URL, { waitUntil: 'networkidle2', timeout: 120000 });

        // Giriş işlemi
        if (TV_USER && TV_PASS) {
            console.log('Login yapılıyor...');
            await page.click('button[data-name="header-user-menu-button"]');
            await page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await page.type('input[name="username"]', TV_USER, { delay: 50 });
            await page.type('input[name="password"]', TV_PASS, { delay: 50 });
            await page.click('button[type="submit"]');
            await page.waitForTimeout(5000);
            console.log('Login tamamlandı.');
        }

        // Tam ekran screenshot
        await page.setViewport({ width: 1920, height: 1080 });
        await page.waitForTimeout(3000);
        const screenshotPath = path.join(process.cwd(), 'tv_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Screenshot alındı.');

        // Telegram’a gönder
        await sendTelegramMessage('TradingView güncel görüntüsü:', screenshotPath);

    } catch (err) {
        console.error('Hata oluştu:', err);
        await sendTelegramMessage(`Bot hata verdi: ${err.message}`);
    } finally {
        await browser.close();
    }
}

// 60 saniyede bir screenshot al
setInterval(captureScreenshot, 60 * 1000);
captureScreenshot(); // İlk çalıştırma

// Express server (Render için port binding)
app.get('/', (req, res) => res.send('Bot çalışıyor!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
