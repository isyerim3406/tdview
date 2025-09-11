const puppeteer = require('puppeteer');
const fs = require('fs');

// sleep fonksiyonu
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true, // Render için headless
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

        const cookiesPath = './cookies.json';

        // Cookie varsa yükle
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath));
            await page.setCookie(...cookies);
            console.log('Önceki oturumdan cookie yüklendi.');
        }

        await page.goto('https://www.tradingview.com/chart/', { waitUntil: 'networkidle0' });

        const profileButtonSelector = 'button[data-name="header-user-menu-button"], button[data-name="user-menu-button"], .userMenu-U2jIw4km';
        let loggedIn = false;

        try {
            await page.waitForSelector(profileButtonSelector, { visible: true, timeout: 8000 });
            loggedIn = true;
            console.log('Cookie ile giriş başarılı. Validator çıkmadı.');
        } catch {
            console.log('Cookie geçersiz veya yok, login adımları çalışacak...');
        }

        if (!loggedIn) {
            // --- Giriş Adımları ---
            await page.waitForSelector('.button-U2jIw4km');
            await page.click('.button-U2jIw4km');

            await page.waitForSelector('.joinItem-U2jIw4km:nth-child(13)');
            await page.click('.joinItem-U2jIw4km:nth-child(13)');

            await page.waitForSelector('.emailButton-nKAw8Hvt');
            await page.click('.emailButton-nKAw8Hvt');

            const username = 'YNzHKOT0JW@jvovj.email';
            const password = '168425Ab+-/-';

            await page.waitForSelector('#id_username');
            await page.type('#id_username', username);

            await page.waitForSelector('#id_password');
            await page.type('#id_password', password);

            // Sign in butonunu bul
            const signInButton = await page.evaluateHandle((text) => {
                const elements = [...document.querySelectorAll('button')];
                return elements.find(el => el.textContent.includes(text));
            }, 'Sign in');

            if (!signInButton) throw new Error('Giriş butonu bulunamadı.');

            // İlk click → validator çıkabilir
            await signInButton.asElement().click();
            console.log('Giriş butonuna ilk kez tıklandı (validator bekleniyor).');

            // 10 saniye bekle
            console.log('10 saniye bekleniyor, validator çözülmeli...');
            await sleep(10000);

            // İkinci click → login devam eder
            await signInButton.asElement().click();
            console.log('Giriş butonuna ikinci kez tıklandı.');

            // 10 saniye bekle ve sayfa refresh
            console.log('10 saniye bekleniyor, ardından sayfa refresh edilecek...');
            await sleep(10000);
            await page.reload({ waitUntil: 'networkidle0' });
            console.log('Sayfa refresh tamamlandı.');

            // Profil butonunu bekle
            await page.waitForSelector(profileButtonSelector, { visible: true, timeout: 60000 });
            console.log('Giriş başarılı, profil butonu göründü.');

            // Cookie kaydet
            const cookies = await page.cookies();
            fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            console.log('Cookie kaydedildi, sonraki girişlerde validator çıkmayacak.');
        }

        // --- Şablon yükleme ---
        const templateButtonSelector = '.button-U2jIw4km[data-name="open-layout-manager"]';
        await page.waitForSelector(templateButtonSelector, { visible: true, timeout: 10000 });
        await page.click(templateButtonSelector);

        const templatesPanelSelector = '[data-dialog-name="Layouts"]';
        await page.waitForSelector(templatesPanelSelector, { visible: true, timeout: 10000 });

        const templateLinkSelector = `${templatesPanelSelector} a:nth-child(3)`; 
        await page.waitForSelector(templateLinkSelector, { visible: true, timeout: 10000 });
        await page.click(templateLinkSelector);

        console.log('Tüm işlemler başarıyla tamamlandı!');

    } catch (error) {
        console.error('İşlem sırasında bir hata oluştu:', error.message);
    } finally {
        // if (browser) await browser.close();
    }
})();
