const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const cookiesPath = './cookies.json';
    let cookies = null;

    if (fs.existsSync(cookiesPath)) {
      const cookiesString = fs.readFileSync(cookiesPath);
      cookies = JSON.parse(cookiesString);
    }

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(), // Puppeteer kendi indirdiği Chrome’u kullanacak
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

    if (cookies) {
      await page.setCookie(...cookies);
    }

    await page.goto('https://tradingview.com', { waitUntil: 'networkidle2' });

    if (!cookies) {
      console.log("Cookie geçersiz veya yok, login adımları çalışacak...");

      await page.click('button[data-name="header-user-menu-button"]');
      console.log("Menü butonuna tıklandı.");

      await page.click('button[data-name="header-user-menu-sign-in"]');
      console.log('Menüdeki "Sign in" butonuna tıklandı.');

      await page.waitForSelector('div[data-name="signin"] iframe');
      const frames = page.frames();
      const loginFrame = frames.find(f => f.url().includes('tradingview.com'));

      await loginFrame.click('button[email]');
      console.log("E-posta ile giriş seçeneğine tıklandı.");

      await loginFrame.type('input[name="username"]', process.env.TV_EMAIL);
      console.log("Kullanıcı adı girildi.");

      await loginFrame.type('input[name="password"]', process.env.TV_PASSWORD);
      console.log("Şifre girildi.");

      const signInButton = 'button[type="submit"]';
      await loginFrame.click(signInButton);
      console.log("Giriş butonuna ilk kez tıklandı (validator bekleniyor).");

      console.log("10 saniye bekleniyor, validator çözülmeli...");
      await new Promise(r => setTimeout(r, 10000));

      await loginFrame.click(signInButton);
      console.log("Giriş butonuna ikinci kez tıklandı.");

      await new Promise(r => setTimeout(r, 10000));
      await page.reload({ waitUntil: 'networkidle2' });

      const newCookies = await page.cookies();
      fs.writeFileSync(cookiesPath, JSON.stringify(newCookies));
    }

    console.log("Login işlemi başarıyla tamamlandı!");
    await browser.close();
  } catch (err) {
    console.error("İşlem sırasında bir hata oluştu:", err.message);
  }
})();
