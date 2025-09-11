const puppeteer = require('puppeteer');
const fs = require('fs');

// Cookie dosyası
const cookiesPath = './cookies.json';

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser', // Render sistem Chrome
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    let loggedIn = false;

    // Cookie varsa yükle
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
        console.log('Cookie yüklendi.');
        await page.goto('https://www.tradingview.com/chart/', { waitUntil: 'networkidle0' });
        try {
          await page.waitForSelector(
            'button[data-name="user-menu-button"], button[data-name="header-user-menu-button"], .userMenu-U2jIw4km',
            { timeout: 5000 }
          );
          console.log('Cookie ile login başarılı.');
          loggedIn = true;
        } catch {
          console.log('Cookie geçersiz, tekrar login yapılacak...');
        }
      }
    }

    if (!loggedIn) {
      console.log('Cookie geçersiz veya yok, login adımları çalışacak...');

      await page.goto('https://www.tradingview.com/chart/', { waitUntil: 'networkidle0' });

      await page.waitForSelector('.button-U2jIw4km');
      await page.click('.button-U2jIw4km');
      console.log('Menü butonuna tıklandı.');

      await page.waitForSelector('.joinItem-U2jIw4km:nth-child(13)');
      await page.click('.joinItem-U2jIw4km:nth-child(13)');
      console.log('Menüdeki "Sign in" butonuna tıklandı.');

      await page.waitForSelector('.emailButton-nKAw8Hvt');
      await page.click('.emailButton-nKAw8Hvt');
      console.log('E-posta ile giriş seçeneğine tıklandı.');

      const username = 'YNzHKOT0JW@jvovj.email';
      const password = '168425Ab+-/-';

      await page.waitForSelector('#id_username');
      await page.type('#id_username', username);
      console.log('Kullanıcı adı girildi.');

      await page.waitForSelector('#id_password');
      await page.type('#id_password', password);
      console.log('Şifre girildi.');

      // İlk giriş butonuna tıkla (validator için)
      const signInButton = await page.evaluateHandle((text) => {
        const elements = [...document.querySelectorAll('button')];
        return elements.find(el => el.textContent.includes(text));
      }, 'Sign in');

      if (!signInButton) throw new Error('Giriş butonu bulunamadı.');

      await signInButton.asElement().click();
      console.log('Giriş butonuna ilk kez tıklandı (validator bekleniyor).');

      console.log('10 saniye bekleniyor, validator çözülmeli...');
      await sleep(10000);

      await signInButton.asElement().click();
      console.log('Giriş butonuna ikinci kez tıklandı.');

      await sleep(10000);

      // Profil menüsünün görünmesini bekle
      await page.waitForSelector(
        'button[data-name="user-menu-button"], button[data-name="header-user-menu-button"], .userMenu-U2jIw4km',
        { visible: true, timeout: 60000 }
      );
      console.log('Login başarılı, profil butonu göründü.');

      // Cookie kaydet
      const cookies = await page.cookies();
      fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('Cookie kaydedildi.');
    }

    // Sayfa yenile
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.chart-container', { visible: true, timeout: 60000 });
    console.log('Sayfa yenilendi, grafik yüklendi.');

    console.log('Tüm işlemler başarıyla tamamlandı!');
    await browser.close();
  } catch (error) {
    console.error('İşlem sırasında bir hata oluştu:', error.message);
  }
})();
