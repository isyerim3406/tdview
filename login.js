import express from 'express';
import puppeteer from 'puppeteer';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';

const app = express();
const PORT = process.env.PORT || 10000;

const TV_URL = 'https://www.tradingview.com/chart/';
const USERNAME = process.env.TV_USER;
const PASSWORD = process.env.TV_PASS;
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

const bot = TG_TOKEN && TG_CHAT_ID ? new TelegramBot(TG_TOKEN, { polling: false }) : null;

let isRunning = false;

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
    if (isRunning) {
        console.log('Zaten bir işlem devam ediyor...');
        return { success: false, message: 'Zaten bir işlem devam ediyor' };
    }

    isRunning = true;
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
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-features=VizDisplayCompositor'
            ],
            defaultViewport: { width: 1366, height: 768 },
            timeout: 60000
        });

        const page = await browser.newPage();
        
        // Daha agresif timeout ve retry stratejisi
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(45000);
        
        // User agent ayarla
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('TradingView\'e gidiliyor...');
        
        // Retry mekanizması ile navigasyon
        let navigationSuccess = false;
        let lastError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Navigasyon denemesi ${attempt}/3...`);
                
                await Promise.race([
                    page.goto(TV_URL, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Custom timeout')), 25000)
                    )
                ]);
                
                navigationSuccess = true;
                console.log('Navigasyon başarılı');
                break;
                
            } catch (error) {
                lastError = error;
                console.log(`Navigasyon denemesi ${attempt} başarısız: ${error.message}`);
                
                if (attempt < 3) {
                    console.log('2 saniye bekleniyor...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        if (!navigationSuccess) {
            throw new Error(`Navigasyon başarısız: ${lastError?.message || 'Bilinmeyen hata'}`);
        }

        // Sayfa yüklenmesini bekle
        await new Promise(resolve => setTimeout(resolve, 8000));
        console.log('Sayfa yükleme bekleme tamamlandı');

        // Basit login kontrolü (hata almadan devam et)
        try {
            console.log('Login durumu kontrol ediliyor...');
            
            const loginButton = await page.$x("//span[contains(text(),'Log in') or contains(text(),'Sign in')]");
            if (loginButton.length > 0) {
                console.log('Login gerekli, form doldurulmaya çalışılacak...');
                
                try {
                    await loginButton[0].click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Username girme
                    const usernameField = await page.$('input[name="username"], input[type="email"]');
                    if (usernameField && USERNAME) {
                        await usernameField.type(USERNAME, { delay: 100 });
                        console.log('Username girildi');
                    }
                    
                    // Password girme  
                    const passwordField = await page.$('input[name="password"], input[type="password"]');
                    if (passwordField && PASSWORD) {
                        await passwordField.type(PASSWORD, { delay: 100 });
                        console.log('Password girildi');
                    }
                    
                    // Submit
                    const submitBtn = await page.$('button[type="submit"]');
                    if (submitBtn) {
                        await submitBtn.click();
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        console.log('Login formu gönderildi');
                    }
                } catch (loginError) {
                    console.log('Login işleminde sorun:', loginError.message);
                    // Login hatası olsa bile screenshot almaya devam et
                }
            } else {
                console.log('Login gerekli değil veya form bulunamadı');
            }
        } catch (loginCheckError) {
            console.log('Login kontrol hatası (devam ediliyor):', loginCheckError.message);
        }

        // Final bekleme
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Screenshot al
        const screenshotPath = path.join(process.cwd(), `tv_screenshot_${Date.now()}.png`);
        console.log('Screenshot alınıyor...');
        
        await page.screenshot({ 
            path: screenshotPath, 
            fullPage: false,
            quality: 85,
            type: 'png'
        });

        console.log('Screenshot alındı:', screenshotPath);

        // Dosya boyutunu kontrol et
        if (fs.existsSync(screenshotPath)) {
            const stats = fs.statSync(screenshotPath);
            console.log(`Screenshot boyutu: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            await sendTelegramMessage('TradingView ekran görüntüsü alındı', screenshotPath);
            
            // Eski screenshot'ları temizle
            setTimeout(() => {
                try {
                    fs.unlinkSync(screenshotPath);
                } catch (e) {
                    console.log('Screenshot temizleme hatası:', e.message);
                }
            }, 30000);
            
            return { success: true, message: 'Screenshot başarıyla alındı', path: screenshotPath };
        } else {
            throw new Error('Screenshot dosyası oluşturulamadı');
        }

    } catch (error) {
        console.error('Ana hata:', error.message);
        await sendTelegramMessage(`Hata oluştu: ${error.message}`);
        return { success: false, message: error.message };
    } finally {
        if (browser) {
            console.log('Browser kapatılıyor...');
            try {
                await browser.close();
            } catch (e) {
                console.log('Browser kapatma hatası:', e.message);
            }
        }
        isRunning = false;
    }
}

// Express routes
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        status: 'TradingView Screenshot Service Active',
        isRunning,
        endpoints: {
            '/screenshot': 'POST - Take screenshot',
            '/status': 'GET - Service status',
            '/health': 'GET - Health check'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/status', (req, res) => {
    res.json({ 
        isRunning,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

app.post('/screenshot', async (req, res) => {
    try {
        const result = await loginAndScreenshot();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Otomatik screenshot (isteğe bağlı)
app.post('/auto-screenshot', async (req, res) => {
    const { interval = 3600000 } = req.body; // Default 1 saat
    
    if (global.autoScreenshotInterval) {
        clearInterval(global.autoScreenshotInterval);
    }
    
    global.autoScreenshotInterval = setInterval(async () => {
        console.log('Otomatik screenshot başlatılıyor...');
        await loginAndScreenshot();
    }, interval);
    
    res.json({ 
        success: true, 
        message: `Otomatik screenshot ${interval/1000/60} dakikada bir alınacak` 
    });
});

// Hata yakalama
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Server başlat
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
    
    // İlk screenshot'ı 10 saniye sonra al
    setTimeout(async () => {
        console.log('İlk screenshot alınıyor...');
        await loginAndScreenshot();
    }, 10000);
});

export default app;
