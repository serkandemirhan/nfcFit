# NFC Task Tracker – Web

Vite + React (TypeScript) web uygulaması. Yerel geliştirme için gerekli adımlar aşağıda.

## Gereksinimler

- Node.js 18+ (önerilen 20 LTS)

## Kurulum ve Çalıştırma

1. Bağımlılıkları kurun:
   - `npm install`
2. (Opsiyonel) Ortam değişkenleri:
   - `.env.local` dosyası oluşturup `GEMINI_API_KEY=` satırı ekleyebilirsiniz. Uygulama çalışmak için zorunlu kılmaz.
   - Örnek için `.env.example` dosyasına bakın.
3. Geliştirme sunucusunu başlatın:
   - `npm run dev`
   - Varsayılan: `http://localhost:3000`

## Üretim Derlemesi

- `npm run build` komutu ile üretim derlemesi alınır. Çıktı `dist/` klasöründedir.

## Notlar

- `index.html` içindeki CDN import map kaldırıldı; tüm paketler yerel olarak (node_modules) üzerinden Vite ile çözülür.
