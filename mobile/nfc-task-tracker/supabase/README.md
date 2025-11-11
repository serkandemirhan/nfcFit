# Supabase Migrations

Bu klasör veritabanı migration scriptlerini içerir.

## Task Status Normalizasyonu

**Sorun:** Veritabanındaki task status değerleri Türkçe olarak saklanmış (`"Yapılacak"`, `"Devam Ediyor"` vb.)

**Çözüm:** Tüm status değerlerini İngilizce standartlara çevirmek

### Migration Nasıl Çalıştırılır?

1. **Supabase Dashboard'a gidin**
   - https://app.supabase.com
   - Projenizi seçin

2. **SQL Editor'ı açın**
   - Sol menüden "SQL Editor" seçin
   - "+ New Query" tıklayın

3. **Migration Script'i Yapıştırın**
   - `migrations/normalize_task_statuses.sql` dosyasının içeriğini kopyalayın
   - SQL Editor'a yapıştırın

4. **Çalıştırın**
   - "Run" butonuna tıklayın
   - Sonuçları kontrol edin

### Beklenen Sonuç

```sql
status       | count | percentage
-------------|-------|------------
not_started  |   5   |   50.00
in_progress  |   2   |   20.00
completed    |   3   |   30.00
```

### Status Değerleri

Standart status değerleri:
- `not_started` - Başlanmadı (eski: "Yapılacak")
- `in_progress` - Devam ediyor (eski: "Devam Ediyor")
- `completed` - Tamamlandı (eski: "Tamamlandı")
- `canceled` - İptal edildi (eski: "İptal")

### Notlar

- ✅ Mobil app artık **hem İngilizce hem Türkçe** status'ları destekliyor
- ✅ Migration çalıştırılmasa bile app çalışmaya devam edecek
- ⚠️ Ancak veritabanını standartlaştırmak best practice'tir
- 📝 Migration sadece `active = true` veya `active IS NULL` olan taskları etkiler
