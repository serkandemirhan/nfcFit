# Başka bilgisayarda geliştirmeye devam etme

Güncel çalışma dalı: `feat/trainer-admin-ui-completion`.

```bash
git clone --branch feat/trainer-admin-ui-completion https://github.com/serkandemirhan/nfcFit.git
cd nfcFit
```

Repo zaten varsa, yerel değişikliklerinizi koruyarak bu dala geçin ve `git pull --ff-only` çalıştırın.

- Web Trainer ve kulüp yönetimi: `web/` (React + Vite).
- Mobil: `mobile/nfc-task-tracker/` (Expo + React Native).
- API, migration ve fixture araçları: `backend/`.
- Son rapor: `test-results/trainer-optimization/TEST_REPORT.md`.
- Ekranlar: `test-results/trainer-optimization/SCREENSHOT_INDEX.md`.

## Bağımlılıklar

Node.js 20.19+ ve projenin Python bağımlılıklarını destekleyen Python sürümünü kullanın.

```bash
cd web
npm ci
cd ../mobile/nfc-task-tracker
npm ci
cd ../../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Backend testleri için ayrıca `pip install httpx` gerekir. Browser testleri için `web/` içinde `npx playwright install chromium` çalıştırın.

## Yerel Trainer demosu

Fixture ayrı, sentetik bir SQLite veritabanı oluşturur; gerçek Supabase oturumu veya canlı üye verisi kullanmaz. Repo kökünden bir terminalde:

```bash
backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py
```

İlk açılıştan sonra ikinci terminalde ek demo üyelerini ve geçmiş örneklerini oluşturabilirsiniz:

```bash
backend/.venv/bin/python backend/scripts/seed_trainer_density_fixture.py
backend/.venv/bin/python backend/scripts/seed_trainer_optimization_fixture.py
```

Web terminalinde yerel fixture kimlik sağlayıcısını seçerek başlatın:

```bash
cd web
VITE_SUPABASE_URL=http://127.0.0.1:8000/fixture-auth VITE_SUPABASE_ANON_KEY=fixture-only VITE_CONSOLE_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1
```

`http://127.0.0.1:3000/console` adresinde `trainer@planning.test` / `PlanningTestOnly!26` ile giriş yapın. Bu parola yalnızca depodaki izole test sağlayıcısına aittir; canlı hesaplarda geçerli değildir. Fixture sunucusunu internete açmayın.

Yerel SQLite verisi GitHub'a aktarılmaz. Seed araçları demo üyelerini ve Berk'in geçmiş kayıtlarını oluşturur; bu bilgisayarda elle oluşturulmuş bütün programları veya tarayıcıdaki kurtarma taslaklarını taşımaz.

## Gerçek backend ve mobil geliştirme

Canlı servislerle geliştirmek için `backend/README.md`, `web/.env.example` ve `mobile/nfc-task-tracker/.env.example` yönergelerine göre yerel ortam dosyalarını oluşturun. Gerçek anahtarları ve veritabanı bağlantısını güvenli kanaldan aktarın; bunlar GitHub'a dahil değildir. Demo komutundaki fixture ayarlarını gerçek servislere bağlanırken kullanmayın.

Normal API: `backend/` içinde etkin sanal ortamla `uvicorn app:app --reload --port 8000`.

Mobil: `mobile/nfc-task-tracker/` içinde `npm start`; native çalışma için uygun Android SDK veya Xcode kurulumuyla `npm run android` / `npm run ios`. Üretilen `ios/`, `android/`, bağımlılıklar ve derleme çıktıları yeniden oluşturulur.

## Egzersiz görsellerinin durumu

Everkinetic pilotu 10 hareket / 29 WebP dosyası içerir. Diğer 92 hareket henüz eşleştirilmedi. Genel hareketin veritabanındaki medya alanı boşsa API paketlenmiş pilotu salt okunur olarak sunar; özel görseller korunur. Web ve Expo bileşenlerinde küçük görsel ve pozisyon seçimi bulunur. Ayrıntılar: `docs/EXERCISE_MEDIA_WORKFLOW.md`; eşleştirmeler: `docs/EXERCISE_MEDIA_MAPPING.json`.
