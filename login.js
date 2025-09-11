import puppeteer from 'puppeteer';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';

const TV_URL = 'https://www.tradingview.com/chart/';
const USERNAME = process.env.TV_USER;
const PASSWORD = process.env.TV_PASS;
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

const bot = TG_TOKEN && TG_CHAT_ID ? new TelegramBot(TG_TOKEN) : null;

async function sendTelegramMessage(message, screenshotPath) {
    if (!bot) return console.warn('Telegram ayarları eksik!');
    try {
        if (screenshotPath) {
            await bot.sendPhoto(TG_CHAT_ID, screenshotPath, { caption: message });
        } else {
            await bot.sendMessage(TG_CHAT_ID, message);
        }
    } catch (err) {
        console.error('Telegram mesaj gönderilemedi:', err);
    }
}

async function loginAndScreenshot() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    try {
        console.log('TradingView’e gidiliyor...');
        await page.goto(TV_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Login formu varsa doldur
        const loginButton = await page.$x("//span[text()='Log in']");
        if (loginButton.length > 0) {
            await loginButton[0].click();
            await page.waitForSelector('input[name="username"]', { timeout: 15000 });
            await page.type('input[name="username"]', USERNAME, { delay: 50 });
            await page.type('input[name="password"]', PASSWORD, { delay: 50 });
            const submitBtn = await page.$('button[type="submit"]');
            await submitBtn.click();

            // Login sonrası ana elementin yüklenmesini bekle
            await page.waitForSelector('#header-user-menu-button', { timeout: 30000 });
            console.log('Login başarılı.');
        } else {
            console.log('Login gerekli değil veya zaten login olunmuş.');
        }

        // Screenshot al
        const screenshotPath = path.join(process.cwd(), 'tv_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Screenshot alındı:', screenshotPath);

        await sendTelegramMessage('TradingView login sonrası ekran görüntüsü:', screenshotPath);

    } catch (error) {
        console.error('Hata oluştu:', error);
        await sendTelegramMessage(`Login veya screenshot sırasında hata: ${error.message}`);
    } finally {
        await browser.close();
    }
}

// Çalıştır
loginAndScreenshot();
