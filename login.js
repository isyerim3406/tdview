const puppeteer = require('puppeteer');
const fs = require('fs');
const express = require('express');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Minimal HTTP server (port 3000) =====
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('TradingView bot çalışıyor.'));
app.listen(PORT, () => console.log(`Server port ${PORT} üzerinde çalışıyor.`));

// ===== Puppeteer login bot =====
(async () => {
  try {
    const cookiesPath = './cookies.json';
    let cookies = null;
    if (fs.existsSync(cookiesPath)) cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

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
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    let loggedIn = false;
    if (cookies) {
      await page.setCookie(...cookies);
      await page.goto('https://www.tradingview.com/chart/', { waitUntil: 'networkidle0', timeout: 60000 });
      try {
        await page.waitForSelector(
          'button[data-name="user-menu-button"], button[data-name="header-user-menu-button"], .userMenu-U2jIw4km',
          { timeout: 10000 }
        );
        loggedIn = true;
        console.log('Cookie ile login başarılı.');
      } catch {
        console.log('Cookie geçersiz, login tekrar yapılacak...');
      }
    }

    if (!loggedIn) {
      console.log('Login adımları başlıyor...');
      await page.goto('https://www.tradingview.com/chart/', { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForSelector('.button-U2jIw4km', { visible: true, timeout: 60000 });
      await page.click('.button-U2jIw4km');
      await page.waitForSelector('.joinItem-U2jIw4km:nth-child(13)', { visible: true, timeout: 60000 });
      await page.click('.joinItem-U2jIw4km:nth-child(13)');
      await page.waitForSelector('.emailButton-nKAw8Hvt', { visible: true, timeout: 60000 });
      await page.click('.emailButton-nKAw8Hvt');

      const username = 'YNzHKOT0JW@jvovj.email';
      const password = '168425Ab+-/-';
      await page.waitForSelector('#id_username', { visible: true, timeout: 60000 });
      await page.type('#id_username', username);
      await page.waitForSelector('#id_password', { visible: true, timeout: 60000 });
      await page.type('#id_password', password);

      const signInButton = await page.evaluateHandle((text) => {
        const elements = [...document.querySelectorAll('button')];
        return elements.find(el => el.textContent.includes(text));
      }, 'Sign in');

      await signInButton.asElement().click();
      console.log('Giriş butonuna ilk tıklandı (validator bekleniyor)...');
      await sleep(10000);
      await signInButton.asElement().click();
      console.log('Giriş butonuna ikinci tıklandı...');
      await sleep(10000);

      await page.waitForSelector(
        'button[data-name="user-menu-button"], button[data-name="header-user-menu-button"], .userMenu-U2jIw4km',
        { visible: true, timeout: 60000 }
      );

      fs.writeFileSync(cookiesPath, JSON.stringify(await page.cookies(), null, 2));
      console.log('Login başarılı, cookie kaydedildi.');
    }

    await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('.chart-container', { visible: true, timeout: 60000 });
    console.log('Sayfa yüklendi, tüm işlemler tamamlandı.');

    await browser.close();
  } catch (err) {
    console.error('Hata:', err.message);
  }
})();
