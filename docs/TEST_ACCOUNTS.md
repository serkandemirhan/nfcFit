# NFCFit test accounts

These accounts are for the isolated NFCFit test environment only. They are
auto-confirmed in Supabase Auth and must not be used for real members or reused
for any other service. Passwords are intentionally not stored in this
repository; they are provided separately to the project owner.

| Account | Email | Role |
| --- | --- | --- |
| Platform test admin | `platform-admin@nfcfit.test` | Platform administrator |
| Club owner | `club-owner@nfcfit.test` | Owner of the demo club |
| Club staff | `club-staff@nfcfit.test` | Coach |
| Test member 1 | `member-test1@nfcfit.test` | Club member |
| Test member 2 | `member-test2@nfcfit.test` | Club member |

## Demo data

- Club: **NFCFit Demo Club** (`nfcfit-demo-2026`)
- Exercise: **Plank**, default **30 seconds**
- Demo tag: **Demo Plank Tag (synthetic UID)**
- Demo UID: `NFCFIT-TEST-PLANK-01`
- Web console: <https://nfc-fit.vercel.app/console>
- Tenant API: <https://nfcfit-tenant-api.vercel.app>

The web console supports entering the UID manually, so the join, approval,
activity confirmation, and history flow can be tested without an NFC device.
The demo UID is not a physical card UID. For a real NFC test, scan the card
with the mobile NFC test screen and register that exact UID as a tag in the
club console.

## Mobile builds

- Android test APK: `../mobile/nfc-task-tracker/android/app/build/outputs/apk/release/app-release.apk`
- The APK includes the live tenant API URL and is signed with the Android debug
  key for internal sideload testing; it is not a Play Store release.
- No Android device was connected for installation or physical NFC validation.
- An iOS build is not included: the available Xcode is 15.2, below the version
  required by this Expo/React Native stack, and Apple signing is not configured.

## Verified test flow

1. Sign in as either test member and enter the demo UID in **Join a sports
   center**. This creates a pending join request.
2. Sign in as the club owner and approve the request under **Overview** or
   **Members**.
3. Sign in as the member, enter the UID again, confirm the exercise quantity,
   and check **My recent activities**.
4. Sign in as the owner and verify the activity in **Activity**.

The flow has been exercised for both test members; member 1 has a 45-second
Plank entry and member 2 has a 60-second entry. Both memberships are active.

## Mobile management test (new APK required)

The Android APK 1.0.8 (versionCode 9) opens management directly for staff accounts
and includes a **Yönetim** bottom-navigation item plus **Profile → Yönetim paneli**.
Profile shows the app version and resolved permissions; failed permission
requests display an error and retry instead of silently showing a member view.
Sign in as the club
owner to register a center tag by scanning its UID with the phone, assign an
exercise, edit tags/exercises, review membership requests, and manage staff.
The platform test admin can create centers and change plans, limits, and status.
The coach has read-only center access; member accounts have no management entry.
Center tag registration does not write NDEF data or create member activity.

Cards are now a searchable compact list, ten per page. Tap a row to edit, assign
or detach an exercise, enable/disable, or delete the registration. Exercise
assignment is optional at creation. Deleting a tag preserves member activity.
The drawer scene respects the bottom/side safe area, including Android's
three-button navigation. This still needs visual verification on a real Samsung.

Validation for this update: mobile TypeScript passed, the nine backend tests passed
(including owner edits, coach restrictions, staff suspension, and activity
isolation), and the Android release APK built successfully. Physical NFC and
interactive visual verification of the new management screens remain pending.
The web console's targeted TypeScript check and Vite build passed. Full-project
web TypeScript still reports pre-existing errors in old_App.tsx and KanbanPage.tsx.

## NFC app-link tests (1.0.3)

Owner: Management → NFC cards → select a card → Write app link. Confirm replacing
the NDEF records, then hold the matching card to the phone. A wrong UID, a
read-only card or insufficient capacity must cause no write. Verify the readback,
then remove the card and rescan outside the app. The stored HTTPS link is stable
when the exercise assignment changes. Opening a link must not create membership
requests or activity until the user explicitly confirms. Test signed-in,
signed-out, active/pending/suspended membership, unassigned and disabled/deleted
cards, and cold/warm app launches.

The app-link association is published for this internal APK's signing certificate.
There are nine mock NFC writer tests plus nine backend tests. No physical device
or background NFC launch has been verified here. iOS Universal Links remain
unconfigured: a real Apple Team ID and a signed iOS build are required; the
published AASA has an empty app list until then. The Android APK is not an iOS build.

## Card deletion responsiveness (1.0.4)

After the server confirms DELETE, the selected card disappears and its sheet
closes without waiting for six management reloads and an identity request.
No optimistic deletion is performed: failures retain the card. Four cache
regression tests cover active observers (no follow-up fetch), repeated completion,
an old response racing deletion, and completion after logout/cache clear. The
mobile TypeScript check passed. Device timing still needs to be measured.

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

## 1.0.9 coaching test flow
Use the existing accounts/passwords; no passwords were reset by this release.
1. Facility owner: Yönetim → Antrenör ve sporcu atamaları. Select active staff and an approved member; save the explicit relationship. Facility admin access alone does not expose private workouts.
2. Coach: Programım → Program oluştur; select the facility template context (or web Antrenör alanı → Programlar). Add scheduled sessions and 12+ exercises, save, then Sporcuya ata. Each selected member gets an independent copy.
3. Member: connect once, open Programım, prepare/start a session, enable airplane mode with NFC enabled, record actual sets manually or from an equipment tag, pause/resume and restart the app. Review local history and Antrenman eşitlemesi; reconnect to send pending commands.
4. Owner: Ekipman eşleştirmeleri links an existing card to one or more library exercises. This is separate from the retained simple card→exercise activity mapping. Deep links/NFC match an open structured workout when an equipment mapping exists; scanning alone does not save a set.
5. Coach: Antrenör paneli → Sporcu detayı → changes/history/reports; revise a future session and review a completed-week report. Member sees feedback in Mesajlar. Completed snapshots stay unchanged.
6. Member: İyi yaşam quick water and separate coffee; grant/revoke each metric's sharing and verify only granted metrics appear for the coach.

Old free activity goals/reports remain in Egzersizler. Structured actual sets are shown in Programım and İlerleme, not duplicated into the old counters. Physical NFC/iOS/background delivery still need device validation; see the implementation report.
