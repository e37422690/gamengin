import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// dist klasörü yoksa otomatik olarak derlemeyi çalıştır
if (!fs.existsSync(indexPath)) {
  console.log('[KareForge 2D] Dist dizini bulunamadı. Otomatik üretim derlemesi (npm run build) başlatılıyor...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[KareForge 2D] Derleme başarıyla tamamlandı!');
  } catch (err) {
    console.error('[KareForge 2D] Derleme sırasında hata:', err);
  }
}

// Statik dosyaları dist dizininden sun
app.use(express.static(distPath));

// SPA (Single Page Application) yönlendirmesi - tüm istekleri index.html'e aktar
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send('KareForge 2D başlatılıyor, lütfen birkaç saniye sonra sayfayı yenileyin.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[KareForge 2D] Sunucu 0.0.0.0:${PORT} üzerinde başarıyla yayında.`);
});
