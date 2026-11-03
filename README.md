# KareForge 2D — Tarayıcı Tabanlı 2D Oyun Motoru

KareForge 2D, modern web tarayıcılarında çalışan tam teşekküllü, açık kaynak kodlu ve bağımsız bir 2D oyun geliştirme motorudur.

![KareForge 2D Banner](https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80)

---

## 🚀 Temel Özellikler

- **Görsel Sahne Editörü (2D Scene):** Katmanlar, Z-Index, AABB & Daire çarpışma kutuları, ızgara yapışma (grid snap).
- **Genişletilmiş Blok Kodlama Kütüphanesi:** Scratch & Blockly esintili, doğrudan TypeScript/JavaScript'e derlenen 50+ blok (fizik, hareket, zıplama modları, tetikleyiciler, sinyaller, değişkenler).
- **Gelişmiş Fizik ve Karakter Dinamikleri:**
  - Yere basmadan zıplayamama (Grounded Jump), Sınırlı Çift/Çoklu Zıplama (Multi Jump), Sınırsız Zıplama (Flappy/Jetpack modu).
  - Sağa ve sola dönüşlerde otomatik sprite/vektör yatay çevirme (Facing Direction Flip).
  - Yay / Trambolin zıplatıcıları, hareketli platformlar, dash (atılma) mekanikleri.
- **Karaktere Özel Görünmez Duvarlar & Harita Sınırları:**
  - `wallTargetFilter` ile her görünmez duvarın yalnızca oyuncuyu (`player_only`), yalnızca düşmanları (`enemy_only`), belirli karakterleri (`custom`) veya herkesi (`all`) engellemesini belirleyebilme.
  - Harita dışına çıkıldığında can kaybı, respawn (checkpoint noktasına dönme) veya sahne yeniden başlatma tetikleyicileri.
- **Dahili Piksel & Vektör Çizim Stüdyosu:** Kendi karakterlerinizi, düşmanlarınızı ve eşyalarınızı doğrudan tarayıcı içinde çizin ve sahneye ekleyin.
- **WebAudio 8-Bit Ses Laboratuvarı:** Harici ses dosyasına gerek duymadan anında sentezlenen Retro SFX (zıplama, lazer, patlama, altın, güçlendirme) ve arka plan müziği.
- **Geri Al / İleri Al Güvencesi (Universal Undo/Redo):** Editör içinde 50 adımlık geçmiş ve yanlışlıkla tarayıcı geri tuşuna basıldığında projeden çıkmayı engelleyen güvenli geçmiş koruması.
- **1:1 Bağımsız Çıktı (Single File HTML / ZIP Export):** Motor içindeki tüm fizik, çizim, ses ve blok kodlarını tek bir `.html` dosyasına gömerek sunucusuz, internetsiz her tarayıcıda tam motor eşitliğiyle çalıştırın.

---

## 🛠️ Yerel Kurulum ve Geliştirme

**Gereksinimler:** Node.js 18+

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. Geliştirme sunucusunu başlatın:
   ```bash
   npm run dev
   ```
   Tarayıcınızda `http://localhost:3000` adresini açın.

3. Üretim (Production) derlemesi:
   ```bash
   npm run build
   ```

---

## 🌐 Render.com Üzerinde Web Sitesi Olarak Yayınlama

Projede Render için hazır `render.yaml` yapılandırması bulunmaktadır.

1. [Render.com](https://render.com) paneline giriş yapın.
2. **New +** butonuna tıklayıp **Static Site** veya **Blueprint** seçeneğini seçin.
3. `e37422690/gamengin` GitHub deponuzu bağlayın.
4. Render ayarları otomatik algılayacaktır:
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `./dist`
5. **Create Static Site** butonuna basarak KareForge 2D oyun motorunuzu tüm dünyaya açık bir web sitesi olarak yayınlayın!
