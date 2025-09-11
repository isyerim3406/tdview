import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000; // Render port uyumlu

const LOGIN_URL = 'https://www.tradingview.com/accounts/signin/'; // Giriş URL'in

app.get('/', async (req, res) => {
  res.send('Bot çalışıyor!');
});

(async () => {
  try {
    console.log('Login adımları başlıyor...');

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--remote-debugging-port=9222'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const page = await browser.newPage();

    // User-Agent ayarlayarak bot engellerini azalt
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');

    // Login sayfasına git
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 120000 });
    console.log('Sayfa yüklendi.');

    // Buraya login formunu doldurma ve submit kodunu ekle
    // Örnek:
    // await page.type('#username', process.env.TV_USER);
    // await page.type('#password', process.env.TV_PASS);
    // await page.click('#login-button');
    // await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });

    console.log('Login adımları tamamlandı.');

    // Browser’ı kapatma (istersen açık bırakabilirsin)
    // await browser.close();

  } catch (err) {
    console.error('Hata:', err);
  }
})();

app.listen(PORT, () => {
  console.log(`Server port ${PORT} üzerinde çalışıyor.`);
});
