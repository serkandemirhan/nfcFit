# NFC Fitness Tracker Migration Plan

Bu dokuman mevcut NFC Task Tracker projesini "NFC tag'e dokun, egzersiz otomatik kaydedilsin" urunune cevirmek icin uygulanacak degisiklikleri listeler.

## 1. Urun Adi ve Navigasyon

- `NFC Task Tracker` -> `NFC Fitness Tracker`
- `Tasks / Gorevler` -> `Workout / Bugun`
- `Cards / NFC Kartlari` -> `Exercise Tags / Spor Tag'leri`
- `Layouts / Yerlesimler` -> `Workout Areas / Antrenman Alanlari`
- `Completed Tasks / Tamamlanan Gorevler` -> `Exercise Log / Bugun Yapilanlar`
- `Kanban` ekranini ilk surumde kaldir veya `Goal Board` olarak yeniden adlandir.

## 2. Ana Akis

1. Kullanici mobil uygulamada `NFC Tara` butonuna basar.
2. Uygulama tag UID veya NDEF payload bilgisini okur.
3. Supabase `log_exercise_from_nfc` RPC fonksiyonu tag'i dogrular.
4. Tag aktifse `exercise_logs` kaydi olusturulur.
5. Gunluk hedef ilerlemesi `daily_goal_progress` view uzerinden guncellenir.
6. Mobil uygulama sonucu gosterir: `Serkan bugun 10 push-up yapti`.
7. Health entegrasyonu aktifse kayit sonraki fazda Apple Health / Health Connect'e senkronlanir.

## 3. Veri Modeli

Yeni Supabase projesinde eski task tablolarini tasimadan temiz baslamak onerilir. Ana tablolar:

- `users`: profil, boy, kilo, yas, kondisyon seviyesi, hedefler
- `exercise_types`: push-up, squat, plank, running gibi hareket sozlugu
- `locations`: ev, salon, park, ofis, gym
- `exercise_tags`: NFC tag ile egzersiz eslestirmesi
- `exercise_logs`: tag okutuldugunda olusan gercek aktivite kaydi
- `daily_goals`: kullanici bazli gunluk hedefler
- `health_integrations`: Apple Health / Health Connect baglanti durumu
- `nfc_scan_events`: basarili ve basarisiz NFC denemeleri icin audit log

Yeni SQL dosyasi: `supabase_fitness_schema.sql`.

## 4. Web Panel Degisiklikleri

- Dashboard:
  - Bugunku toplam tekrar/sure/mesafe
  - Yakilan tahmini kalori
  - Gunluk hedef ilerlemeleri
  - Son aktiviteler
- Spor Tag'leri:
  - Tag adi
  - NFC UID
  - Hareket tipi
  - Miktar
  - Birim: `repetition`, `seconds`, `minutes`, `meters`
  - Kalori tahmini
  - Zorluk seviyesi
  - Lokasyon
  - Aktif / pasif
- Bugun / Workout:
  - Aktif gorev listesi yerine gunluk hedefler ve loglar
  - `50 push-up hedefi, 30 yapildi, 20 kaldi`
- Kullanici profili:
  - Gunluk hedef
  - Haftalik hedef
  - Boy, kilo, yas
  - Kondisyon seviyesi
  - Health entegrasyon durumu

## 5. Mobil Uygulama Degisiklikleri

- `TasksScreen` -> `TodayScreen` veya `WorkoutScreen`
- `create-task` -> `create-exercise-tag`
- `cards` -> `exercise-tags`
- `nfc.tsx` akisi:
  - `verify_nfc_scan` + `complete_task_from_nfc` yerine `log_exercise_from_nfc`
  - Eslesen task listesi gosterme yerine tek egzersiz sonucu gosterme
  - Eslesme yoksa yeni `Exercise Tag` olusturma modali acma
- Alt navigasyon:
  - Bugun
  - NFC Tara
  - Spor Tag'leri
  - Alanlar
  - Profil/Ayarlar

## 6. API / RPC Degisiklikleri

Eski:

- `verify_tag`
- `verify_nfc_scan`
- `complete_task_from_nfc`

Yeni:

- `log_exercise_from_nfc(p_uid, p_ndef_payload, p_user_id, p_logged_at)`
- `daily_goal_progress` view
- Opsiyonel: `create_exercise_tag_from_scan`

## 7. Health Entegrasyonu

Ilk surumda veritabaninda entegrasyon durumu tutulur, native senkronizasyon ikinci faza birakilir.

- iOS: HealthKit ile genel `strength_training`, `active_energy_burned`, `exercise_minutes`
- Android: Google Health Connect uzerinden aktivite / kalori / sure
- Push-up gibi hareket sayilari standart health alanlarina birebir yazilamayabilir; uygulama kendi `exercise_logs` tablosunu ana kaynak olarak tutmali.

## 8. Yeni GitHub / Vercel / Supabase Baglantilari

Eski baglari koparmak icin:

1. Yeni GitHub reposu hazir: `https://github.com/serkandemirhan/nfcFit.git`.
2. Lokal remote'u degistir:
   - `git remote set-url origin https://github.com/serkandemirhan/nfcFit.git`
3. Vercel'de yeni proje olustur ve yeni GitHub reposuna bagla.
4. Yeni Supabase projesi olustur.
5. Supabase SQL editor'de `supabase_fitness_schema.sql` dosyasini calistir.
6. Vercel Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `API_ALLOWED_ORIGINS=https://<new-vercel-domain>`
7. Mobil `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
8. Eski Supabase URL/key degerlerinin `.env.local`, Vercel ve Expo EAS secrets icinde kalmadigini kontrol et.

## 9. Uygulama Sirasi

1. Yeni Supabase semasini kur.
2. Web tiplerini ve API endpointlerini `exercise_*` modeline cevir.
3. Mobil `lib/api.ts` icinde yeni tipleri ve `logExerciseFromNfc` fonksiyonunu ekle.
4. Mobil NFC ekranini yeni RPC'ye bagla.
5. Web panelde Dashboard, Spor Tag'leri ve Bugun ekranlarini yeni modele tasiyarak eski task UI'larini kaldir.
6. Seed data ile push-up, squat, plank, sit-up ve walking taglerini test et.
7. Yeni Vercel projesine deploy et.
8. Yeni GitHub repo remote'una push et.
