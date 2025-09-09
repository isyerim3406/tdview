# Bu bot, TradingView hesabına giriş yapar, belirli bir grafiğe gider,
# sinyal alanından ekran görüntüsü alır ve sinyali Telegram'a gönderir.

import time
import telegram
import numpy as np
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from PIL import Image

# --- Ayarlarınızı Buraya Girin ---
# Telegram ve TradingView bilgilerini ortam değişkenlerinden alın.
telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
chat_id = os.environ.get("TELEGRAM_CHAT_ID")
tradingview_username = os.environ.get("TRADINGVIEW_USERNAME")
tradingview_password = os.environ.get("TRADINGVIEW_PASSWORD")

# TradingView URL'leri
login_url = "https://tr.tradingview.com/#signin"
chart_url = "https://tr.tradingview.com/chart/?symbol=NASDAQ%3ATSLA"

# Sabit pencere boyutu (headless mod için önerilir)
WINDOW_WIDTH = 1920
WINDOW_HEIGHT = 1080

# Analiz edilecek alanın koordinatları (sol-x, üst-y, sağ-x, alt-y)
# Bu koordinatları, belirlediğiniz sabit çözünürlüğe göre ayarlayın.
# Örnek: (800, 500, 850, 550)
signal_area_coords = (800, 500, 850, 550)

# Sinyal tespiti için referans renkler
SIGNAL_COLORS = {
    "ALIM SİNYALİ GELDİ!": (0, 255, 0),  # Yeşil
    "SATIM SİNYALİ GELDİ!": (255, 0, 0)  # Kırmızı
}

# Hata toleransı (ortalama renk analizi için)
COLOR_TOLERANCE = 20

# --- Kod ---

def get_webdriver():
    """Chrome WebDriver'ı headless modda ayarlar ve döndürür."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument(f"--window-size={WINDOW_WIDTH},{WINDOW_HEIGHT}")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=chrome_options)
    return driver

def login_to_tradingview(driver):
    """TradingView'e kullanıcı adı ve şifre ile giriş yapar."""
    if not tradingview_username or not tradingview_password:
        print("Hata: TRADINGVIEW_USERNAME veya TRADINGVIEW_PASSWORD ortam değişkeni ayarlanmamış.")
        return False
    
    print("TradingView'e giriş yapılıyor...")
    driver.get(login_url)
    time.sleep(5)  # Sayfanın tamamen yüklenmesi için bekle

    try:
        # "Giriş Yap" butonunu bul ve tıkla
        login_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Giriş Yap')]")
        login_button.click()
        time.sleep(2)

        # Kullanıcı adı ve şifre alanlarını bul ve doldur
        username_field = driver.find_element(By.ID, "username")
        password_field = driver.find_element(By.ID, "password")

        username_field.send_keys(tradingview_username)
        password_field.send_keys(tradingview_password)
        time.sleep(1)

        # Giriş butonuna tekrar tıkla
        signin_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Giriş yap')]")
        signin_button.click()
        time.sleep(10) # Girişin tamamlanması için bekle

        print("Giriş başarılı.")
        return True
    
    except Exception as e:
        print(f"Giriş sırasında bir hata oluştu: {e}")
        return False


def take_and_crop_screenshot(driver, path, coords):
    """Belirtilen koordinatlara göre ekran görüntüsü alır ve kırpar."""
    driver.get_screenshot_as_file(path)
    img = Image.open(path)
    cropped_img = img.crop(coords)
    cropped_img.save(path)
    print(f"Ekran görüntüsü kırpıldı ve '{path}' olarak kaydedildi.")
    return cropped_img

def analyze_pixel_area(img):
    """Görüntüdeki tüm piksellerin ortalama RGB değerini hesaplar."""
    img_data = np.array(img)
    if img_data.size == 0:
        return (0, 0, 0)
    avg_color_per_row = np.average(img_data, axis=0)
    avg_color = np.average(avg_color_per_row, axis=0)
    return tuple(avg_color.astype(int))

def main():
    """Ana fonksiyon."""
    if not telegram_bot_token or not chat_id:
        print("Hata: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkeni ayarlanmamış.")
        return

    bot = telegram.Bot(token=telegram_bot_token)
    driver = get_webdriver()

    try:
        # Önce giriş yap
        if not login_to_tradingview(driver):
            return

        # Giriş başarılıysa grafiğe git
        print(f"Grafik sayfasına yönlendiriliyor: {chart_url}")
        driver.get(chart_url)
        # Grafiğin yüklenmesi için yeterli bekleme süresi
        time.sleep(15)

        while True:
            screenshot_path = "tradingview_screenshot.png"
            cropped_img = take_and_crop_screenshot(driver, screenshot_path, signal_area_coords)

            detected_rgb = analyze_pixel_area(cropped_img)
            print(f"Tespit edilen ortalama renk: {detected_rgb}")

            signal_message = None
            for message, target_color in SIGNAL_COLORS.items():
                if (abs(detected_rgb[0] - target_color[0]) <= COLOR_TOLERANCE and
                    abs(detected_rgb[1] - target_color[1]) <= COLOR_TOLERANCE and
                    abs(detected_rgb[2] - target_color[2]) <= COLOR_TOLERANCE):
                    signal_message = message
                    break

            if signal_message:
                print(f"Sinyal tespit edildi: {signal_message}")
                bot.send_message(chat_id=chat_id, text=f"TradingView Sinyal:\n{signal_message}")
            else:
                print("Henüz bir sinyal tespit edilmedi.")

            # Her 60 saniyede bir kontrol et
            time.sleep(60)

    except Exception as e:
        print(f"Genel bir hata oluştu: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
