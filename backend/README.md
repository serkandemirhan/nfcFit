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

## CORS
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
