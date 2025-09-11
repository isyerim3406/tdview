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

const bot = TG_TOKEN && TG_CHAT_ID ? new TelegramBot(TG_TOKEN, { polling: false }) : null;

async function sendTelegramMessage(message, screenshotPath) {
    if (!bot) return console.warn('Telegram ayarları eksik!');
    
    try {
        if (screenshotPath && fs.existsSync(screenshotPath)) {
            await bot.sendPhoto(TG_CHAT_ID, screenshotPath, { caption: message });
        } else {
            await bot.sendMessage(TG_CHAT_ID, message);
        }
        console.log('Telegram mesajı gönderildi');
    } catch (err) {
        console.error('Telegram mesaj gönderilemedi:', err.message);
    }
}

async function loginAndScreenshot() {
    let browser;
    
    try {
        console.log('Browser başlatılıyor...');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--start-maximized'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();
        
        // User agent ayarla
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('TradingView\'e gidiliyor...');
        await page.goto(TV_URL, { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });

        // Sayfanın yüklenmesini bekle
        await page.waitForTimeout(5000);

        // Login formu kontrolü
        try {
            console.log('Login formu aranıyor...');
            
            // Farklı login selector'larını dene
            const loginSelectors = [
                "//span[contains(text(),'Log in') or contains(text(),'Sign in')]",
                "[data-name='header-user-menu-button']",
                ".tv-header__user-menu-button",
                ".js-header-user-menu-button"
            ];

            let loginClicked = false;
            
            for (const selector of loginSelectors) {
                try {
                    if (selector.startsWith('//')) {
                        // XPath selector
                        const elements = await page.$x(selector);
                        if (elements.length > 0) {
                            console.log('Login butonu bulundu (XPath)');
                            await elements[0].click();
                            loginClicked = true;
                            break;
                        }
                    } else {
                        // CSS selector
                        const element = await page.$(selector);
                        if (element) {
                            console.log('Login butonu bulundu (CSS)');
                            await element.click();
                            loginClicked = true;
                            break;
                        }
                    }
                } catch (err) {
                    continue;
                }
            }

            if (loginClicked) {
                console.log('Login formuna erişiliyor...');
                await page.waitForTimeout(3000);

                // Username ve password input'larını bekle
                try {
                    await page.waitForSelector('input[name="username"], input[type="email"], #id_username', { timeout: 15000 });
                    
                    const usernameSelector = await page.$('input[name="username"]') ? 'input[name="username"]' :
                                           await page.$('input[type="email"]') ? 'input[type="email"]' :
                                           '#id_username';
                    
                    const passwordSelector = await page.$('input[name="password"]') ? 'input[name="password"]' :
                                           'input[type="password"]';

                    console.log('Kullanıcı bilgileri giriliyor...');
                    await page.type(usernameSelector, USERNAME, { delay: 100 });
                    await page.type(passwordSelector, PASSWORD, { delay: 100 });

                    await page.waitForTimeout(1000);

                    // Submit butonu bul ve tıkla
                    const submitSelectors = [
                        'button[type="submit"]',
                        '.tv-button--primary',
                        '[data-name="sign-in-submit"]',
                        'button:contains("Sign in")'
                    ];

                    let submitted = false;
                    for (const selector of submitSelectors) {
                        try {
                            const submitBtn = await page.$(selector);
                            if (submitBtn) {
                                await submitBtn.click();
                                submitted = true;
                                break;
                            }
                        } catch (err) {
                            continue;
                        }
                    }

                    if (!submitted) {
                        // Enter tuşuna bas
                        await page.keyboard.press('Enter');
                    }

                    console.log('Login formu gönderildi, bekleniyor...');
                    
                    // Login başarı kontrolü
                    await page.waitForTimeout(5000);
                    
                    // Başarı göstergelerini kontrol et
                    const successSelectors = [
                        '#header-user-menu-button',
                        '[data-name="header-user-menu-button"]',
                        '.tv-header__user-menu-button--logged-in'
                    ];

                    let loginSuccess = false;
                    for (const selector of successSelectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 10000 });
                            loginSuccess = true;
                            break;
                        } catch (err) {
                            continue;
                        }
                    }

                    if (loginSuccess) {
                        console.log('Login başarılı!');
                    } else {
                        console.log('Login durumu belirsiz, devam ediliyor...');
                    }

                } catch (err) {
                    console.log('Login formu bulunamadı veya doldurulurken hata:', err.message);
                }
            } else {
                console.log('Login butonu bulunamadı veya zaten giriş yapılmış');
            }

        } catch (err) {
            console.log('Login işlemi sırasında hata:', err.message);
        }

        // Sayfanın tam yüklenmesini bekle
        await page.waitForTimeout(10000);

        // Screenshot al
        const screenshotPath = path.join(process.cwd(), 'tv_screenshot.png');
        console.log('Screenshot alınıyor...');
        
        await page.screenshot({ 
            path: screenshotPath, 
            fullPage: false,
            quality: 90,
            type: 'png'
        });

        console.log('Screenshot alındı:', screenshotPath);

        // Dosya boyutunu kontrol et
        const stats = fs.statSync(screenshotPath);
        console.log(`Screenshot boyutu: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        await sendTelegramMessage('TradingView ekran görüntüsü:', screenshotPath);

    } catch (error) {
        console.error('Ana hata:', error.message);
        console.error('Stack:', error.stack);
        await sendTelegramMessage(`Hata oluştu: ${error.message}`);
    } finally {
        if (browser) {
            console.log('Browser kapatılıyor...');
            await browser.close();
        }
    }
}

// Ana fonksiyon
async function main() {
    console.log('Script başlatıldı...');
    console.log('Çevre değişkenleri kontrol ediliyor...');
    
    if (!USERNAME || !PASSWORD) {
        console.error('TV_USER ve TV_PASS çevre değişkenleri gerekli!');
        process.exit(1);
    }
    
    if (!TG_TOKEN || !TG_CHAT_ID) {
        console.warn('Telegram ayarları eksik, mesaj gönderilmeyecek');
    }
    
    await loginAndScreenshot();
    console.log('İşlem tamamlandı');
}

// Hata yakalama
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Çalıştır
main().catch(console.error);
