import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from tenant_console import initialize_console_schema, router as tenant_console_router


environment = os.getenv("ENVIRONMENT", "development")
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
if environment == "production" and not frontend_origin.startswith("https://"):
    raise RuntimeError("FRONTEND_ORIGIN must be an HTTPS origin in production.")

app = FastAPI(title="NFCFit Tenant API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(tenant_console_router)
from coaching import router as coaching_router, seed_catalog
app.include_router(coaching_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    initialize_console_schema()
    from tenant_console import ConsoleSession
    with ConsoleSession.begin() as db:
        seed_catalog(db)
