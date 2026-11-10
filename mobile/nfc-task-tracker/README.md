# Current workout experience — 1.0.13

Android internal APK: `android/app/build/outputs/apk/release/NFCFit-1.0.13.apk`, versionCode 14. Active workout → NFC/manual set review → durable local save → pause/summary and progress. Weekly/rest/missed-day views and independent online make-up plans are included. See [implementation and device acceptance](../../docs/NFCFIT_WORKOUT_EXPERIENCE.md). Existing member/coach authorization and offline queues are retained.

## Previous visual release

# NFCFit mobile

Current Android internal test release: **1.0.12 / versionCode 13**. Member Today, Programım, plan setup and exercise library follow the dark navy/lime visual direction. Install the APK from `android/app/build/outputs/apk/release/NFCFit-1.0.12.apk` over the previous internal build. See [design verification and device test flow](../../docs/NFCFIT_DESIGN_REVIEW.md). The illustrated movement and muscle assets are original schematics; licensed exercise demonstrations remain a separate content input.

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Live tenant and NFC testing

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
`EXPO_PUBLIC_TENANT_API_URL` in local `.env`/`.env.local` files before creating
a native build. The tenant API URL for the test environment is
`https://nfcfit-tenant-api.vercel.app`. Never put a Supabase service-role key
in the mobile app.

The test accounts, demo club, and end-to-end web test steps are documented in
[`../../docs/TEST_ACCOUNTS.md`](../../docs/TEST_ACCOUNTS.md). Its demo NFC UID is
synthetic and cannot be read from a physical tag; replace it in the console with
the UID shown by the NFC test screen before testing a real card.

## Mobil yönetim paneli

1.0.8 sürümünde doğrulanmış salon sahibi, yönetici veya antrenör hesabıyla giriş
yapınca doğrudan yönetim paneli açılır; alt menüde **Yönetim** görünür.
**Profil → Yönetim paneli** ve yan menüdeki **Yönetim** bağlantısı da kullanılabilir.
Birden çok salonda yetkisi olan hesaplar üstteki seçimden salon değiştirebilir.
Yetkiler Supabase profilindeki bir rol alanından değil, tenant API'deki gerçek
personel kaydından alınır ve her işlem backend tarafından tekrar doğrulanır.
Yetki sorgusu başarısız olduğunda hata ve yeniden deneme seçeneği gösterilir;
profil ekranında uygulama sürümü, hesap yetkisi ve eksik salon yetkisi bilgisi
bulunur.

- **Özet:** kapasite, bugünkü aktivite ve bekleyen üye başvuruları.
- **NFC kartları:** aramalı kompakt liste ve 10'arlı sayfalama. Karta dokununca
  düzenleme, egzersize bağlama/bağlantıyı kaldırma, aktif/pasif yapma ve silme.
  Egzersiz seçmeden kayıt yapılabilir. Kart silinse de geçmiş aktiviteler korunur.
  Salon kartı tanımlamak kişisel
  karta ekleme veya aktivite kaydetme işlemi yapmaz; karta NDEF verisi yazmaz.
- **Üyeler:** arama, başvuru onayı/reddi, aktif üyeliği askıya alma/yeniden açma.
- **Egzersizler:** ekleme, ad/kategori/birim/miktar/kalori düzenleme ve durum.
- **Personel:** e-postayla personel ekleme, erişim açma/kapatma; yalnızca salon
  sahibi yönetici atayabilir. Antrenörler yönetim listelerini salt okunur görür.
- **Aktiviteler:** salona ait son 100 aktivite ve manuel yenileme.
- **Platform yöneticisi:** salon oluşturma, plan/limit/durum yönetimi. Salonun
  iç yönetimine erişim için ayrıca o salonda personel yetkisi gerekir.

Android'de bu özellikler için yeni APK yüklenmelidir; eski yüklü sürüm otomatik
güncellenmez. NFC olmayan cihazlarda UID elle girilebilir. iOS'ta fiziksel NFC
testi için imzalı native build gerekir.

## Kart silme performansı (1.0.4)

DELETE sunucudan başarılı döndüğünde kart doğrudan mevcut salon listesinden
kaldırılır, kapasite sayacı güncellenir ve işlem penceresi kapanır. Silme
tamamlanmadan kart gizlenmez. Önceki davranış, silme cevabından sonra altı salon
listesi ve hesap yetkisi sorgusunun da bitmesini bekliyordu. Silme artık bu yedi
ek isteği başlatmaz; veriler sonraki yenileme/ekran odağında uzlaştırılır.
Silme başlarken eski devam eden liste sorgusu iptal edilir; eski cevap kartı
listeye geri getiremez. Diğer salona/hesaba ait önbellek etkilenmez.
`npm run test:management-cache` bu yarış durumlarını ve sayaç tutarlılığını sınar.
Sunucunun DELETE ve oturum doğrulama süresi bu değişiklikle ortadan kalkmaz.

## NFC uygulama bağlantıları (1.0.3)

**Yönetim → NFC kartları → kartı seç → Uygulama bağlantısını karta yaz**.
Yönetici onayından sonra sunucudaki yetki tekrar doğrulanır. Yalnızca seçili
kartın fiziksel UID'si eşleşirse tek bir HTTPS NDEF URI kaydı yazılır; salt okunur,
NDEF desteklemeyen, kapasitesi yetersiz veya farklı UID'li kartlara yazılmaz.
Yazılan içerik tekrar okunur; doğrulama başarısızsa başarılı doğrulama olarak
sunulmaz ve ayrıca **Tekrar okutarak doğrula** seçeneği vardır. Mevcut NDEF
kayıtları değişeceğinden bu işlem otomatik kayıt akışından ayrıdır.

Kartta `https://nfc-fit.vercel.app/tag/<tag-id>` saklanır. Egzersiz, kullanıcı,
parola veya access token yazılmaz. Link egzersiz yeniden atanınca aynı kalır.
Link ekranı önce salt okunur bir sorguyla güncel kart, salon ve üyelik durumunu
alır. Başvuru ve aktivite ancak kullanıcı düğmeye dokunduğunda gönderilir.
Giriş ekranı öncesindeki rota korunur. Silinmiş/pasif kartlar çalıştırılmaz;
link veya UID, fiziksel katılımın kriptografik kanıtı değildir.

### Android

App Links, `/tag/` yolu ve HTTPS alan adı için `autoVerify` ile tanımlıdır.
Android 15 ve öncesindeki NFC URI intent'i için yerel config plugin'i ayrıca
`android.nfc.action.NDEF_DISCOVERED` filtresi üretir. Oluşturulan native manifest
aynı yapılandırmayı içerir; React Native hem soğuk hem sıcak açılışta bu intent'i
ve `ACTION_VIEW` intent'ini Linking'e aktarır. `web/public/.well-known/assetlinks.json`
mevcut dahili APK'nın imza parmak izini içerir. Play Store/yayın imzası değişirse
o sertifikanın SHA-256 değeri de ilişkilendirmeye eklenmelidir. Kullanıcının
Android ayarlarında desteklenen bağlantıları açma izni de açık olmalıdır.

### iOS — harici kurulum gerekli

`ios.associatedDomains` hazırdır. Apple Team ID bu oturumda henüz sağlanmadığından
AASA'nın `details` listesi bilinçli olarak boş; iOS Universal Links tamamlanmış
**değildir**. Gerçek Apple Team ID ile şu komutu çalıştırın ve web'i yeniden
yayınlayın:

```bash
node scripts/configure-ios-links.cjs APPLE_TEAM_ID
```

Sonra aynı Apple ekibi/bundle identifier ile Associated Domains yetkisini içeren
imzalı bir iOS build üretip cihaza yükleyin. Bu Mac'teki Xcode 15.2 mevcut Expo
sürümü için yeterli değildir; uygun Xcode makinesi veya EAS cloud build gerekir.
Uydurma Team ID ya da imzasız bir IPA bu doğrulamayı tamamlamaz.

Her iki sistemde de kartın yazılabilir NDEF ve cihazla uyumlu olması gerekir.
Desteklenen iPhone'larda ekran açıkken okunan kart bildirim gösterir; kullanıcı
bildirime dokununca uygulama açılır. iOS'ta sessiz/koşulsuz otomatik açılış vaat
edilmez. Uygulama yoksa HTTPS sayfası açılır; **NFCFit uygulamasında aç** düğmesi
vardır. Henüz mağaza bağlantıları olmadığı için sahte indirme bağlantısı verilmez.

Kontroller: `npm run test:nfc-link` yerel NFC katmanı taklit edilerek yanlış kart,
salt okunur kart, kapasite, iptal, URI biçimi ve okuma doğrulamasını sınar. Bunlar
fiziksel NFC veya cihazda soğuk/sıcak açılış testinin yerine geçmez.

Kaynaklar: [Android NFC](https://developer.android.com/develop/connectivity/nfc/nfc),
[Expo App Links](https://docs.expo.dev/linking/android-app-links/),
[Expo Universal Links](https://docs.expo.dev/linking/ios-universal-links/),
[Apple arka planda NFC okuma](https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading).

## Geliştirme

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Üye aktivitelerinin görüntülenmesi (1.0.5)

Onaylanarak kaydedilen salon NFC aktiviteleri Bugün, Fitness ve Geçmiş ekranlarına dahil edilir. Kişisel egzersiz seçimi gerektirmez; farklı salonların aynı adlı egzersizleri ayrı tutulur. Kayıt sonrası üyenin listesi hemen güncellenir ve ekran tekrar açıldığında sunucudan yenilenir. Kalori bilgisi bulunmayan salon kayıtları için kalori uydurulmaz; süre yalnızca saniye/dakika birimli kayıtlardan hesaplanır. Telefonla fiziksel test ayrıca gereklidir.

## Salon hedefleri, raporlar ve hız (1.0.6)

Üye hesabında Bugün → Salon egzersiz hedeflerim bölümünden okuttuğunuz egzersiz için günlük hedef belirleyin. Hedef başka bir telefonda aynı hesapla da kullanılabilir. Kartla onaylanarak kaydedilen miktar günün ilerlemesine eklenir. Fitness → Egzersiz raporum bölümünde gün/hafta/ay toplamları bulunur. Salon raporları son 100 kayıt sınırına takılmaz; telefonun yerel gün sınırı kullanılır. Farklı salonlar ve farklı birimler ayrı hesaplanır. Kalori kaydı olmayan aktivitelerde kalori gösterilmez.

Yönetim yüklemesi altı ayrı HTTP isteği yerine tek yönetim isteği kullanır. Kart/egzersiz kaydı sunucu onayından sonra önbelleğe eklenir; bütün sekmeler tekrar yüklenmez. Bağlı hesap kimliği değişmediğinde sunucu gereksiz commit/refresh yapmaz; her istekte oturum ve yetki kontrolü devam eder. Android NFC okumada NDEF ve boş NFC-A kartı tek oturumda kabul edilir, kütüphanenin varsayılan 1000 ms temizleme beklemesi kaldırılmıştır.

Telefonda kontrol: günlük hedefi kaydedin → karttan egzersiz kaydedin → Bugün ilerlemesini ve Fitness gün/hafta/ay toplamlarını kontrol edin → uygulamayı yeniden açıp hedefin kaldığını doğrulayın. Kart/egzersiz eklerken sonucu görün; iptal edilen NFC taramasının yeniden başlamadığını kontrol edin. Fiziksel cihaz testi ayrıca gereklidir; sunucu başlangıcı ve bağlantı gecikmesi hâlâ etkili olabilir.

## Üye etkileşimi ve güvenli yeniden deneme (1.0.7)

Bugün ekranı sıradaki salon hedefini, yüzdeyi ve kalan miktarı gösterir; tek belirgin Kart okut düğmesi bulunur. Hedef düzenleme alanları isteğe bağlı açılır. Boş kişisel hedef/iyi yaşam bölümleri özette yer kaplamaz. Ana kullanıcı akışının başlık ve metinleri Türkçeleştirilmiştir. Fitness içindeki haftalık grafiğin günlerine dokunularak kayıt sayısı görülür; son 7 gün, önceki 7 günle kayıt sayısı üzerinden karşılaştırılır ve aktif günler gösterilir.

Salon kartının hem uygulama içi taraması hem HTTPS bağlantısı aynı kayıt/sonuç bileşenini kullanır. Kartın okunması, egzersizin getirilmesi, kaydın onaylanması ve hedefin güncellenmesi ayrı durumlar olarak görünür. Sonuç, eklenen miktarı ve hedefe kalan miktarı gösterir; Yeni kart okut / İlerlememi gör düğmeleri bulunur. Hedef kayıtla aşıldığında kısa kontrol işareti animasyonu ve başarı titreşimi çalışır. Aynı kullanıcı/egzersiz/birim için günde bir kez tetiklenir; sadece ekranı açmak kutlamayı tetiklemez. Hareket azaltma tercihi animasyonda dikkate alınır.

Salon kaydı gönderilmeden önce istek kimliği ve miktarı bu cihazda, kullanıcıya özel AsyncStorage anahtarında tutulur. Bağlantı hatasında veya uygulama yeniden başlatıldığında Bekleyen kaydı aç düğmesiyle aynı işlem yeniden denenir. Sunucunun hesap+istek kimliği benzersizliği çift kayıt oluşturmayı önler. Belirsiz işlem varken farklı miktarla yeni gönderim engellenir. Kayıt sunucuda onaylandıktan sonra hedef güncellemesi hata verirse kayıt başarısız gösterilmez. Kullanıcı onayı olmadan arka planda kayıt gönderilmez. Bu koruma yeni salon kayıt akışı içindir; eski kişisel kart RPC akışı değiştirilmemiştir.

Cihaz testi: hedef belirle → kart okut → miktarı kaydet → sonuçtaki yüzde/kalan miktarı ve hedef tamamlandığında titreşimi kontrol et → ekranı yeniden açıp kutlamanın tekrar etmediğini gör → grafikte güne dokun → kayıt sırasında bağlantıyı kesip aynı işlemi tekrar dene → uygulamayı kapat/aç ve bekleyen işlemi kontrol et. Gerçek telefon ile görsel, NFC ve titreşim doğrulaması ayrıca gereklidir.

## Yerelden çalışan tesis kartları ve çift yönlü eşitleme (1.0.8)

Tesis kartları, egzersiz tanımları, üyelik onayı, aktiviteler, hedefler ve gönderim kuyruğu cihazın özel SQLite veritabanında kullanıcı/tesis bazında saklanır. Mevcut oturum bir kez çevrimiçi açıldıktan sonra, uygulama kapatılıp çevrimdışı açıldığında profil servisi beklenmez. Açıkça çıkış yapıldığında yerel oturum geri yükleme izni kaldırılır. Kuyruk ve geçmiş silinmez; başka hesabın oturumuyla gönderilmez. Eski profil kimliği ile Supabase kimliği farklı olan hesaplar da eşlenir.

Üyelik isteği, ilk tesis kartının çevrimiçi okutulmasıyla oluşturulur; pending üyeye yalnızca tesis kart/egzersiz tanımları iner. Diğer üyelerin veya personelin kişisel bilgileri pakette bulunmaz. Aktif onayı en az bir kez indirilmeden yerel aktivite kaydı açılamaz. Onaylı ve tamamlanmış paketle UID/HTTPS kart çözümü, kayıt, hedefler, Bugün ve Egzersiz raporları yerelden çalışır. İlk kez görülen ve indirilmemiş kart için internet gerekir. Kişisel eski kart RPC akışı ve yönetim işlemleri bu tesis çevrimdışı kapsamına dahil değildir.

Onayla ve kaydet işlemi önce SQLite işleminde aktiviteyi ve benzersiz istek kimliğini kalıcı kuyruğa yazar. Sonuç hemen Telefonuna kaydedildi / Eşitleme bekliyor gösterir. Hedefler ve raporlar bekleyen kayıtları da içerir. Aynı gönderim kimliği tekrarında sunucu ikinci aktivite oluşturmaz. Gerçek egzersiz saati created_at içinde korunur; received_at eşitleme teslim saatidir. Sunucu reddederse kayıt/önerilen hedef kuyrukta ve ayrıntı ekranında nedeniyle korunur; reddedilen aktivite hedef/rapor toplamına dahil edilmez.

İndirmede kayıt başına sürüm/hash karşılaştırması yapılır: yalnızca değişen tanımlar ve silme işaretleri alınır. Bilinen silinmiş UID kişisel kart ekleme akışına yanlışlıkla düşmez. Kart aynı UID ile yeni tanıma alınırsa yeni tanım çalışabilir. Kayıt onayı sırasında egzersiz veya birim değişirse miktar başka bir egzersiz/birim olarak yorumlanmaz. Geçmiş 500 satırlık kalıcı devam imleciyle tam indirilir; 100 kayıt sınırı yoktur. Teslim yanıtı kaybolursa sonraki indirme aynı request_id ile yerel kaydı tek satırda uzlaştırır.

Uygulama açıkken bağlantı değişiminde, uygulamaya dönüşte, yeni kayıt/hedef sonrasında ve yaklaşık dakikada bir eşitleme denenir. Android sistem zamanlayıcısına arka plan işi de kaydedilir (en az 15 dakika istenir; gerçek çalışma zamanı pil/Doze/üretici ayarları ve işletim sistemi tarafından belirlenir). Zorla durdurulmuş uygulamada anlık eşitleme vaat edilmez; yeniden açılınca kaldığı yerden sürer. Ön plan ve arka plan işlerinin aynı hesabı aynı anda eşitlemesi SQLite kiralama kilidiyle engellenir. Ağ hatalarında kuyruk korunur; kalıcı retler otomatik olarak sonsuz tekrar edilmez.

Fiziksel test sırası:
1. APK'yı mevcut uygulamanın üstüne yükle; internet açıkken giriş yap. İlk sürüm yükseltmesinde çevrimiçi açılış şarttır.
2. Tesis üyelik onayını ve indirme/eşitlemenin tamamlandığını kontrol et. Yeni üyede onay öncesi kaydın kapalı olduğunu doğrula.
3. Uçak modunu aç; NFC'yi ayrıca açık tut. Kart okut, miktarı kaydet, yerel hedef ve grafikleri kontrol et.
4. Uygulamayı tamamen kapatıp çevrimdışı yeniden aç; aynı hesabın geçmişinin ve kuyruk kayıtlarının kaldığını doğrula.
5. İnterneti aç; Eşitleme ayrıntıları ekranından kuyruğun boşalmasını ve aynı aktivitelerin sunucuda birer kez oluşmasını kontrol et.
6. Yönetimden kart ekle/düzenle/pasifleştir/sil; sonraki eşitlemede telefondaki tanımın değiştiğini doğrula.
7. Telefon çevrimdışıyken üyeliği askıya al veya kartın egzersizini/birimini değiştir; çevrimiçi dönüşte reddin görünür kaldığını ve kaydın sessizce silinmediğini doğrula.
8. İkinci hesapla giriş yap; ilk hesabın kuyruk/geçmişinin görünmediğini ve bu hesapla gönderilmediğini kontrol et.

60 otomatik test (11 sunucu, 49 mobil/SQLite/iş akışı) ile normal kayıt, delta, silme, onay, saat, sayfalama, çift gönderim, yanıt kaybı, hedef çakışması, oturum ayrımı ve süreç kilidi sınanır. Gerçek telefonla NFC, görünüm, uçak modu ve işletim sistemi arka plan davranışı ayrıca doğrulanmalıdır.

### 1.0.9 coaching test release
Programım now supports personal plans, facility templates, scheduled sessions, unrestricted-length exercise lists, targets, copies and independent athlete assignments. Management links to explicit coach assignments and equipment/tag mappings. The coach can inspect athlete history, revisions, reports and shared wellness; athlete changes use version checks and notify the coach.

Workout detail records actual sets, pause/resume, skip/edit/add/reorder/partial completion and notes. NFC only selects compatible equipment/exercise context; confirmation is required. Shared navy/lime components and a separate coaching translation namespace are used for new flows.

Coaching SQLite snapshots and ordered commands survive restart, with account-bound worker leases and stable request IDs. Actual timestamps and pause-excluding duration are preserved. Wellness (water/coffee/sleep/wellbeing), messages and water goals also queue locally. Conflict review/export/archive is at Antrenman eşitlemesi. Plan editing/assignment, consent changes, report generation and private trainer reads require internet. Previous Supabase habits/free activity stay separate and unchanged.

Verify with `npm run test:coaching`, `node --test tests/*.test.cjs`, `npx tsc --noEmit`. Native NFC requires a real APK/development build; Expo Go is not sufficient. Final report and release checks: `../../docs/NFCFIT_IMPLEMENTATION_REPORT.md`.


### 1.0.10 follow-up test release
Settings → Saat dilimi saves an account IANA timezone through the durable offline queue. Progress/wellness calendar grouping and new program defaults use the preference. Existing program schedules remain pinned to their own zone. Coach dashboards offer combined review filters; trainer web also offers date/program/state filters and actual-set-date charts with a readable data table. The web coaching module loads only when opened.

For a revised program, a future prepared workout that has not started can explicitly fetch current targets online using “Güncel plan hedeflerini al”. Started/past sessions and pending/conflicting records are protected. The operation uses server receipts and version checks. Today no longer points to a session already completed that day.

The coaching translation resources now cover the same 384 keys in Turkish and English, including previously missing static coaching labels; free user content, server-generated notices and legacy screens retain their original language. Global English parity is not claimed. Licensed images/animations have a disk-cached viewer and attribution; video/3D links open a compatible viewer. Actual assets still need supplied rights-cleared files.

### 1.0.11 role and library correction
Ordinary members no longer see Antrenör alanı. A shared staff screen boundary protects direct routes and trainer-context progress/builder/history/messages; unauthorized children/data hooks do not mount. Management/equipment screens require facility administrator permissions. Online identity checks now refresh actual server roles with a bounded request; a 401/403 never falls back to prior cached staff identity. Failed private trainer reads hide stale query results. Offline role awareness still uses last downloaded information; current server permissions are always checked for private API access.

Egzersiz kütüphanesi is a separate drawer screen and a Programım action, with browsing/detail/favorites/custom exercises, first-use download, retry/refresh and persisted offline catalog. This is the existing 102-entry library; no new unlicensed media is bundled. Owners/admins grant Antrenör through Yönetim → Personel and assign athletes through Antrenör ve sporcu atamaları. Member enrollment alone never grants a staff role.


### Android 1.0.15 — device-review follow-up
Internal APK: android/app/build/outputs/apk/release/NFCFit-1.0.15.apk (code16). Adds compact selected-day weekly navigation, persistent plan save/error footer and compact set entry. 75 tests, TypeScript, targeted lint and release verification pass. The physical Samsung review covered 1.0.14; USB disconnected before 1.0.15 installation. See ../../artifacts/member-review-1.0.15/index.html for the exact coverage and existing test records.


### Android 1.0.16 — report labels and direct goal editing
Internal APK android/app/build/outputs/apk/release/NFCFit-1.0.16.apk (code17). Shows inclusive aggregated chart date ranges, planned-session counts and a direct Profile → Goals editor. 76 mobile tests, TypeScript, targeted lint and release-source/signature checks pass. Physical 1.0.15 acceptance now includes offline resume/save/restart, reconnection without duplicate sets, partial finish/report update and member denial of staff deep links. USB disconnected again before 1.0.16 installation. Exact evidence: ../../artifacts/member-review-1.0.16/index.html.
