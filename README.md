# TranslateAll 🎮📺⚡

**TranslateAll**, konsol (PS5, Xbox, Switch), PC veya TV ekranlarındaki yabancı oyunları, diyalogları ve menüleri **kamera veya ekran görüntüsü** aracılığıyla anlık olarak algılayıp **Türkçe'ye (ve diğer dillere) çeviren**, aynı zamanda **sesli diyalogları dinleyip canlı Türkçe dublaj / altyazı** yapan çok platformlu (PC, Android TV `.apk`, iOS `.ipa`) bir yapay zeka çeviri asistanıdır.

Gücünü **NVIDIA NIM** (Llama 3.2 11B/90B Vision Instruct & Llama 3.3 70B Instruct) modellerinden alır.

---

## 🌟 Öne Çıkan Özellikler

1. **Kamera ile TV & Ekran Canlı Çevirisi (Vision AI)**
   - Telefonu, tableti veya PC web kamerasını/USB capture kartını TV veya oyun ekranına tutun.
   - NVIDIA NIM Vision modeli ekrandaki altyazıları, görev metinlerini, menüleri ve NPC konuşmalarını anında algılar ve çevirir.
   - **Oto-Tarama (Continuous Live)**: Her 1.5 - 3 saniyede bir otomatik yeni diyalogları yakalar.
   - **Dondur & Çevir (Freeze Snap)**: Takıldığınız yerde tek tuşla kareyi dondurup çeviriyi inceleyin.
   - **Altyazı Bölgesi Odaklama (ROI)**: Sadece TV ekranının altındaki altyazı bandına odaklanarak ultra hızlı sonuç alın.

2. **Sesli Çeviri & Anlık Türkçe Dublaj (Voice / Audio)**
   - TV veya oyundaki karakter konuşmalarını mikrofondan canlı dinler.
   - NVIDIA API ile anlık çevirip büyük okunaklı altyazıya dönüştürür.
   - **Sesli Dublaj (TTS)**: Çevrilen Türkçe metni otomatik seslendirerek oyunları Türkçe sesli oynama deneyimi sunar.

3. **Android TV & Kumanda (D-Pad) Uyumluluğu (.apk)**
   - Android TV Leanback Launcher desteği (`android.software.leanback`).
   - Dokunmatik ekran zorunluluğu kaldırılmıştır (`touchscreen required=false`), bu sayede kumanda ile tam uyumludur.
   - TV koltuğundan rahatça okunabilen yüksek kontrastlı, ayarlanabilir boyutlu (Büyük / Devasa) altyazı modu.

4. **PC Masaüstü Sürümü (Windows)**
   - Electron masaüstü uygulaması veya web tarayıcı modu.
   - PC oyunlarını doğrudan pencere veya ekran yakalama (`getDisplayMedia`) ile doğrudan çevirme desteği.
   - Oyun üstünde yüzen (Always on Top) altyazı HUD'ı.

5. **iOS Desteği (.ipa)**
   - iPhone ve iPad için optimize edilmiş Capacitor iOS projesi.
   - Arka/ön kamera ve mikrofon donanım izinleri hazır.

---

## 🚀 Başlangıç ve Çalıştırma

### Gereksinimler
- Node.js (v18+)
- NVIDIA API Key ([build.nvidia.com](https://build.nvidia.com/) adresinden ücretsiz alınabilir)

### Proje Kurulumu
```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirici sunucusunu başlatın (Web / Mobil Tarayıcı)
npm run dev
```
Uygulama `http://localhost:5173` adresinde açılacaktır.

---

## 💻 PC Sürümünü Çalıştırma (Windows)

```bash
# Electron masaüstü uygulamasını geliştirici modunda başlatın:
npm run electron:dev

# Windows için tek tıkla kurulabilir .exe oluşturun:
npm run electron:build
```

---

## 📺 Android TV ve Android (.apk) Çıktısı Alma

1. Web projesini derleyip Android projesine aktarın:
   ```bash
   npm run cap:sync
   ```
2. Android Studio ile açmak için:
   ```bash
   npm run cap:android
   ```
3. Doğrudan Komut Satırından Debug APK derlemek için:
   ```bash
   cd android
   .\gradlew.bat assembleDebug
   ```
   Çıktı APK dosyanız burada oluşur:
   `android/app/build/outputs/apk/debug/app-debug.apk`

> **Android TV'ye Kurulum:**
> Oluşan `app-debug.apk` dosyasını bir USB belleğe atıp TV'nizin Dosya Yöneticisi ile kurabilir veya bilgisayarınızdan şu komutla TV'ye gönderebilirsiniz:
> ```bash
> adb connect <TV_IP_ADRESI>
> adb install android/app/build/outputs/apk/debug/app-debug.apk
> ```

---

## 🍏 iOS (.ipa) Çıktısı Alma

1. Web dosyalarını iOS projesine senkronize edin:
   ```bash
   npm run cap:sync
   ```
2. Xcode'da açmak için (Mac üzerinde):
   ```bash
   npm run cap:ios
   ```
3. **Mac Olmadan Bulutta Derleme (GitHub Actions)**:
   - Projenin içindeki `.github/workflows/build.yml` dosyası hazırdır.
   - Kodları GitHub reponuza yüklediğinizde GitHub Actions otomatik olarak macOS ve Ubuntu sanal sunucularında hem `.apk` hem de `.ipa` arşivini derleyip **Artifacts** bölümünden indirmenizi sağlar!

---

## 🎮 TV Kumandası & Klavye Kısayolları

| Tuş | İşlev |
| :--- | :--- |
| **SPACE / ENTER (Kumanda OK)** | Şimdiki kareyi yakala ve çevir (Snap) |
| **M** | Kamera ve Sesli Çeviri Modları Arasında Geçiş Yap |
| **C** | Kamerayı Değiştir (Ön / Arka / USB Capture Card) |
| **T** | TV Minimalist Altyazı Modunu Aç / Kapat |
| **F / F11** | Tam Ekran Moduna Geç / Çık |

---

## 🔑 NVIDIA API Key Nasıl Eklenir?

1. [build.nvidia.com](https://build.nvidia.com/) adresine gidin ve ücretsiz hesabınızla giriş yapın.
2. `meta/llama-3.2-11b-vision-instruct` sayfasına gidip **Get API Key** butonuna tıklayın.
3. TranslateAll uygulamasında sağ üstteki **Ayarlar (Çark)** ikonuna tıklayın.
4. `nvapi-...` ile başlayan anahtarınızı yapıştırıp **"Bağlantıyı Test Et"** ve ardından **"Kaydet ve Başla"** butonuna basın.
