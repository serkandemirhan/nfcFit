# NFC Task Tracker – Backend (FastAPI)

## Gereksinimler
- Python 3.9+

## Kurulum
```
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

## Çalıştırma
```
uvicorn app:app --reload --port 8000
```
- Sağlık kontrolü: http://localhost:8000/health
- Örnek API'ler: `/api/tasks`, `/api/users`, `/api/locations`, `/api/cards`
- API dokümantasyonu: http://localhost:8000/docs

## Tenant konsolu (super-admin ve spor tesisi)

Tenant API'leri `/api/console` altında çalışır ve `DATABASE_URL` üzerinde `console_*` tablolarını kullanır. Web konsolu ve Expo uygulaması, mevcut Supabase Auth oturumunun access token'ını aynı API'ye gönderir. Backend token'ı Supabase Auth üzerinden doğrular; e-posta doğrulanmadan hesap oluşturmaz veya önceden tanımlanmış owner/personel kaydıyla eşleştirmez. Backend service-role anahtarı kullanmaz.

### Vercel tenant API dağıtımı

Tenant API, eski görev API'lerinden ayrı olarak `nfcfit-tenant-api` Vercel projesinde `backend/index.py` giriş noktasından çalıştırılır. Bu servis yalnızca `/api/console/*` ve `/health` yollarını sunar; eski, kimlik doğrulaması olmayan görev CRUD uçlarını internete açmaz. Vercel projesinin kök dizini `backend` olmalıdır.

GitHub otomatik yayınında Vercel Project Settings → Root Directory değeri de
`backend` olmalıdır. Yerel CLI ile yalnızca backend klasörünü göndermek, Git
yayınının kök ayarını düzeltmez. Depo kökündeki `.vercelignore`, backend'e ait
hariç tutmaları da içerir: üretimde `index.py` kullanılır, eski `app.py`, testler
ve izole fixture sunucuları gönderilmez. Monorepo CLI yayını için depo kökünden
doğru Vercel projesini seçin; kök ayarı `backend` olan projeye tekrar yalnızca
`backend/` alt klasörünü göndermeyin.

Vercel'de bu projeye hem Production hem Preview için şu değişkenleri ekleyin:

```
DATABASE_URL=<Supabase Transaction Pooler URI>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<Supabase anon/publishable key>
ENVIRONMENT=production
FRONTEND_ORIGIN=https://nfc-fit.vercel.app
CONSOLE_SUPERADMIN_EMAIL=<verified Supabase Auth email>
```

`SUPABASE_SERVICE_ROLE_KEY` tenant API tarafından kullanılmaz ve bu projeye eklenmemelidir. Vercel'de env değerlerini ekledikten sonra yeni bir production deployment gerekir. Web projesinde `VITE_CONSOLE_API_URL` ve Expo derleme ortamında `EXPO_PUBLIC_TENANT_API_URL`, tenant API'nin HTTPS origin'ine ayarlanmalıdır.

Geliştirme ortamında backend `.env` dosyasına şu değişkenleri ekleyin. Supabase URL ve anon key değerlerini Supabase projenizden alın:

```
ENVIRONMENT=development
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
CONSOLE_SUPERADMIN_EMAIL=<platform-admin-email>
CONSOLE_SUPERADMIN_NAME=Platform Admin
FRONTEND_ORIGIN=http://localhost:3000
```

Web konsolunu `http://localhost:3000/console` adresinde açın. Supabase Auth kullanıcısı konsoldan kayıt olabilir veya var olan hesabıyla giriş yapabilir. E-posta doğrulaması Supabase tarafından yönetilir. Platform admin'i için `CONSOLE_SUPERADMIN_EMAIL`, Supabase'de doğrulanmış olan hesap e-postasıyla birebir eşleşmelidir. Kulüp owner/personel hesapları da yönetici tarafından girilen e-postayla eşleşen doğrulanmış Supabase hesabıyla ilk girişte bağlanır; parola API veya konsol veritabanında tutulmaz.

Web için `web/.env` değerleri:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
# Geliştirmede boş bırakılabilir; Vite /api isteklerini localhost:8000'e proxy eder.
# Canlı web dağıtımında FastAPI backend'in HTTPS adresini verin.
VITE_CONSOLE_API_URL=
```

Mobil için `mobile/nfc-task-tracker/.env` dosyasında `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` yanında `EXPO_PUBLIC_TENANT_API_URL` değerini FastAPI backend'in HTTPS adresine ayarlayın. Yerel cihazda test ederken `localhost` yerine cihazdan erişilebilen geliştirme makinesi adresini kullanın.

Üyelik ve aktivite akışı: üye tesise ait NFC tag'i okuttuğunda bekleyen katılım isteği oluşturulur. Tesis yöneticisi onayladıktan sonra yeniden okutma, egzersiz ve varsayılan miktarı gösterir. Üye miktarı onaylayınca kayıt backend'de saklanır ve hem web konsolu hem mobil Fitness/History ekranında görünür. Tenant tag'i backend'de kayıtlı değilse mevcut kişisel NFC/card akışı kullanılmaya devam eder.

Mevcut API grupları:

- `/auth/me`: doğrulanmış Supabase kullanıcısını console hesabına bağlar ve mevcut hesap/üyelikleri döndürür.
- `/platform`: tenant listeleme/oluşturma, plan/limit/durum yönetimi ve platform özeti (super-admin).
- `/tenants/{tenant_id}`: tenant paneli, üyeler ve başvuru değerlendirme, personel, egzersizler, NFC etiketleri ve aktivite geçmişi.
- `/nfc`: etiket okutma, üyelik isteği oluşturma ve onaydan sonra aktivite kaydetme.

Üretimde `ENVIRONMENT=production`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CONSOLE_SUPERADMIN_EMAIL` ve gerçek frontend origin'ini ayarlayın. Supabase access token'ı API isteği başına Supabase Auth endpoint'inde doğrulanır; SDK web/mobilde token yenilemesini yönetir. Console hesabına bağlanan Supabase `user_id` için mevcut veritabanlarına başlangıçta nullable alan eklenir. Bu otomatik geçiş temel entegrasyon içindir; üretim şemaları için versiyon kontrollü Alembic migration ve deploy pipeline henüz gereklidir.

Üretime açmadan önce ayrıca tenant NFC tag kimliğinin klonlanmasına karşı kriptografik doğrulama, paylaşımlı rate limiter, audit log, e-posta daveti/şifre kurtarma akışlarının ürün operasyonuna göre gözden geçirilmesi ve backend deployment/proxy kurulumu tamamlanmalıdır. NFC UID tek başına güvenli tag doğrulaması değildir. Uygulama `create_all` ile başlangıç tablolarını oluştursa da bu bir migration/deployment stratejisinin yerini tutmaz.

Vite geliştirme proxy'si `/api` çağrılarını yerel `localhost:8000` backend'ine iletir. `web/vercel.json` yalnızca statik Vite build'ini tanımlar; FastAPI API'si ayrıca güvenli bir backend ortamına deploy edilmeli ve frontend API base URL/CORS buna göre yapılandırılmalıdır.

## CORS

### Egzersizsiz NFC kartları (1.0.2)

1.0.3 bağlantı uçları: `GET /api/console/tenants/{id}/tags/{tag_id}/link` yalnızca
salon yöneticisine sabit HTTPS bağlantısı ve yazma öncesi doğrulanacak UID'yi
verir. `GET /api/console/nfc/resolve/{tag_id}` oturum gerektirir, üyelik veya
aktivite oluşturmaz. `POST /api/console/nfc/open` kullanıcı isteği üzerine
üyelik/egzersiz akışını başlatır; aktivite kaydı yine ayrı `/nfc/record`
onayına bağlıdır. Bağlantı bir oturum veya fiziksel katılım kanıtı değildir.

`POST /api/console/tenants/{id}/tags` artık `exercise_id` olmadan veya `null`
ile kart oluşturur. `PATCH` ile sonradan egzersiz atanabilir veya bağlantı `null`
ile kaldırılabilir. Liste cevabındaki `exercise` bu kartlar için `null` döner.
Aktif üye böyle bir kartı okuttuğunda `tag_unassigned` sonucu alır; aktivite
kaydı engellenir. Kart başvurusu ve üyelik onayı egzersiz atamasından bağımsızdır.

`DELETE /api/console/tenants/{id}/tags/{tag_id}` yalnızca salon sahibi/yöneticisi
tarafından kullanılabilir. İlgili aktivitelerin kart referansı temizlenir;
egzersiz, miktar ve üye geçmişi silinmez. Fiziksel karta veri yazılmaz.

Mevcut PostgreSQL şemasında `console_nfc_tags.exercise_id` nullable olmalıdır:
[`migrations/20261107_optional_tag_exercise.sql`](migrations/20261107_optional_tag_exercise.sql).
Backend başlangıcı bu aynı idempotent değişikliği PostgreSQL için uygular.
Yeni SQLite test veritabanları nullable şemayla kurulur; eski SQLite dosyaları
otomatik yeniden oluşturulmaz, nullable alan için ayrıca taşınmalıdır.

- `http://localhost:3000` (Vite) için CORS açık.

## PostgreSQL

### Docker ile hızlı başlatma
```
cd backend
docker compose up -d db
```

Ardından `.env` dosyanıza aşağıdakini ekleyin (örnek dosya: `.env.example`):
```
DATABASE_URL=postgresql+psycopg://nfc:nfc@localhost:5432/nfc
```

Sunucuyu başlatın:
```
uvicorn app:app --reload --port 8000
```

İlk çalıştırmada tablo oluşturulur ve örnek verilerle doldurulur.

> Not: Veriler artık PostgreSQL üzerinde kalıcıdır. İsteğe bağlı olarak Alembic migrasyonları eklenebilir.

## Üye hedefleri ve raporlar (1.0.6)

`GET /api/console/me/fitness?day=2026-11-07&utc_offset_minutes=180` yalnızca oturumdaki hesabın egzersiz hedeflerini, günlük/haftalık/aylık adet ve miktar toplamlarını döndürür. Her dönem seçilen yerel günün sonuna kadardır. Geçmiş liste sayfalaması rapor toplamını sınırlamaz. `POST /api/console/me/exercise-goals/{exercise_id}` `{ "unit": "seconds", "target_quantity": 60 }` ile aktif üyeliğin egzersizine günlük hedef kaydeder. Hedefin birimi egzersizin güncel birimiyle eşleşmelidir. Hesap kimliği istemciden alınmaz. Yeni `console_member_exercise_goals` tablosu başlangıçta oluşturulur; eşdeğer PostgreSQL SQL dosyası migrations/20261107_member_exercise_goals.sql içindedir.

`GET /api/console/tenants/{tenant_id}/management` altı yönetim listesini tek oturum/yetki kontrolüyle döndürür. Coach için personel listesi boştur; üye veya başka salon personeli erişemez. Diğer uçlar web istemcisi için korunur. Değişmemiş bağlı hesap kimliği için gereksiz commit/refresh yapılmaz; oturum doğrulaması önbelleğe alınmaz.

## Tekrarlanan salon kayıtları ve haftalık çizelge (1.0.7)

`POST /api/console/nfc/record` isteğine isteğe bağlı UUID `request_id` eklenebilir. Bu durumda `quantity` zorunludur. Hesap+request_id benzersizdir; aynı kart ve miktarla tekrar gönderim aynı aktivite makbuzunu döndürür. Farklı değerlerle yeniden kullanım 409 döndürür. Eşzamanlı tekrarlar veritabanı benzersiz indeksiyle korunur. Aynı makbuz, kart sonradan pasifleştiğinde/silindiğinde de yalnızca kendi hesabına döner; yeni bir aktivite oluşturmaz. Kayıt miktarı ve birimi aktivitedeki değerlerdir. Eski istemcilerin request_id içermeyen istekleri desteklenir.

Başlangıçta console_activities tablosuna nullable request_id ve request_payload_hash alanları ile benzersiz indeks eklenir. PostgreSQL SQL karşılığı migrations/20261107_activity_requests.sql dosyasındadır. Mevcut aktivitelere kimlik uydurulmaz ve geçmiş kayıtlar silinmez.

`GET /api/console/me/fitness` artık seçilen yerel günde biten 14 günlük `timeline` (day/count) döndürür. Tam SQL toplamları kullanılır; geçmiş listesinin 100 satırlık sınırı grafiği etkilemez. Diğer yanıt alanları korunur.

## Tesis çevrimdışı eşitleme API'si (1.0.8)

`POST /api/console/me/offline/pull`: oturumdaki hesabın pending/active üyelikleri için kart ve egzersiz paketlerini hash manifestine göre delta olarak döndürür. Bilinen silinen tanımlar delete listesine girer. Üyelik/tesis durumu her yanıtta yeniden doğrulanır; yetki başka hesap/personel listesine genişletilmez. Yanıttaki identity yalnızca kendi kimliği ve kendi rol/üyeliklerini içerir. İstemci catalogs[tenant_id].tags/exercises alanlarında ID→hash manifesti gönderir; kayıt ve paket version/hash değerleri sunucuda güncel içerikten üretilir, bu nedenle yönetim paneli veya başka istemcideki değişiklikler de kaçmaz.

Aynı uç kendi aktivite geçmişini teslim saati üzerinden artımlı indirir. history_since (önceki tamamlanan snapshot), history_until ve history_page {time,id} ile 500 satır/sayfa ilerlenir. Başlangıçta tam geçmiş alınır; sayfa imleci kalıcı olarak saklanır ve bitmeden watermark ilerletilmez. Geç teslim edilen eski tarihli egzersizler received_at ile yakalanır; 10 dakikalık örtüşme tekrarları request_id/server ID ile uzlaştırılır. Yerel raporlar geçmişin tamamını ve henüz gönderilmemiş aktiviteleri kullanır.

`POST /api/console/me/offline/push`: en fazla 50 aktivite ve 50 hedef değişikliği kabul eder; her satır için accepted/receipt veya rejected/reason döner. Aktiviteler request_id, tag_id, exercise_id, unit, quantity, occurred_at içerir. Üyelik, tesis, kart ve egzersiz sunucuda yeniden kontrol edilir; değişmiş eşleşme/birim sessizce yeni anlamda kaydedilmez. occurred_at zaman dilimli olmalı, sunucudan en çok beş dakika ileri veya on yıldan eski olmamalıdır. Tekrar gönderimde aynı makbuz döner; kabul sonrası kart silinse bile kullanıcı kendi makbuzunu alabilir. Hedefler base_target ile başka cihazın değişikliğini sessizce ezmez; çakışma görünür bir rettir.

received_at kolonunun PostgreSQL geçişi migrations/20261107_offline_sync.sql dosyasındadır; başlangıçta da idempotent uygulanır. Eski kayıtlarda COALESCE(received_at,created_at) kullanılır. Önceki APK'ların doğrudan kayıt ve yönetim uçları korunur. Oturum ve tesis yetkileri sunucuda her istekte kontrol edilir; yüklenen katalog, çevrimdışı oluşturulan kaydın sunucuda koşulsuz kabul edileceği anlamına gelmez.

### Coaching extension (Android 1.0.10)
The same identity/session now mounts `coaching.py` under `/api/console/coaching` in both entry points. Apply `migrations/20261107_coaching_foundation.sql` as owner before deployment. It adds immutable plan/workout audit and scoped reporting/wellness/messages/equipment, enables RLS and makes console client access read-only/scoped (legacy console tables backend-only). No existing fitness or console data is replaced. The 102-entry authored library seeds missing IDs in one read/batch, rather than one query per exercise at startup.

`GET /coaching/overview`, `/library`, `/dashboard`; plan create/assign/edit/version/review; workout creation and idempotent `/workouts/{id}/commands`; equipment registry; wellness/goal/consent; messages and notification read state; weekly generate/review. Athlete edits freeze today/past schedules; actual sets never update targets. Coaches must have active explicit assignments in the same tenant; owner/platform roles alone do not grant private access.

`CRON_SECRET` is server-only, at least 32 characters. `vercel.json` checks the latest finished week daily at 04:15 UTC (covering account timezones) at `/api/console/coaching/jobs/weekly-reports`, with constant-time bearer validation. Missing config is 503, wrong auth 401. Reports are deterministic/idempotent; late data refresh preserves the prior report and review audit.

Run all tests with `.venv/bin/python -m unittest discover -s tests -v`. From repository root run `backend/.venv/bin/python backend/scripts/test_rls.py` for a disposable local PostgreSQL cluster that applies the migration twice and tests RLS/triggers. It never connects to the configured application database. See `docs/NFCFIT_IMPLEMENTATION_REPORT.md` for architecture, verification and remaining limits.


The additive `migrations/20261107_account_timezone.sql` must also be applied before deploying 1.0.10 to an existing database. `POST /coaching/preferences` accepts a validated IANA timezone for the authenticated account. Report workers use that preference; existing plan schedules retain their own timezone.

`GET /coaching/jobs/daily-reminders` runs daily 05:30 UTC with the same protected cron boundary. It checks yesterday in each plan's timezone and sends one grouped in-app reminder per recipient/session/date, only for active relationships. Replays preserve notification read state. This is not a push delivery service.

`POST /coaching/workouts/{id}/refresh-plan` accepts request_id/expected_version. It explicitly updates a future, not-started, empty workout to the current plan snapshot. Same request replays its receipt; concurrent edits, started/past sessions, missing/ambiguous schedule slots and revoked memberships are rejected. Existing actuals/history never silently rebase.

Licensed-media import instructions: `../docs/EXERCISE_MEDIA_WORKFLOW.md`. The operator-only importer validates local bytes/provenance before optional transactional updates of global library media; no user-upload HTTP endpoint or unlicensed asset scraping is introduced.

### Role boundary correction (1.0.11)
`GET /coaching/dashboard` now requires active owner/admin/coach staff at an active facility and returns 403 for a plain member, platform-only account, or suspended/inactive staff context. Existing athlete data endpoints continue to require active explicit assignments in the same facility. `/auth/me` and offline identity payloads now include `staff[].tenant_status`; no database migration is needed. Member self-promotion through staff creation remains forbidden and is covered by the API journey test. See `docs/NFCFIT_ROLE_ACCESS.md` at the repository root.
