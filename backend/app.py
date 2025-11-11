from datetime import datetime, timedelta
from typing import List, Optional, Literal

import os
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column, sessionmaker


# --- App & CORS ---
load_dotenv()
app = FastAPI(title="NFC Task Tracker Backend", version="0.2.0")

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# --- Database (SQLAlchemy) ---
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # Postgres default that matches docker-compose below
    "postgresql+psycopg://nfc:nfc@localhost:5432/nfc",
)

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base = declarative_base()

def hash_password(password: str) -> str:
    import bcrypt as _bcrypt
    # bcrypt limit 72 bytes; enforce truncation for safety
    pw_bytes = password.encode('utf-8')[:72]
    return _bcrypt.hashpw(pw_bytes, _bcrypt.gensalt()).decode('utf-8')


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- ORM Models ---
class UserORM(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatarUrl: Mapped[str] = mapped_column(String(512))
    passwordHash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class LayoutORM(Base):
    __tablename__ = "layouts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    imageUrl: Mapped[str] = mapped_column(String(512))


class LocationORM(Base):
    __tablename__ = "locations"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    layoutId: Mapped[str] = mapped_column(String, ForeignKey("layouts.id"))
    nfcCardId: Mapped[Optional[str]] = mapped_column(String, ForeignKey("cards.id"), nullable=True)
    x: Mapped[int] = mapped_column(Integer)
    y: Mapped[int] = mapped_column(Integer)


class NfcCardORM(Base):
    __tablename__ = "cards"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    secretCode: Mapped[str] = mapped_column(String(255))
    uid: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assignedLocationId: Mapped[Optional[str]] = mapped_column(String, ForeignKey("locations.id"), nullable=True)


class TaskORM(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32))
    locationId: Mapped[str] = mapped_column(String, ForeignKey("locations.id"))
    userId: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime)
    dueDate: Mapped[datetime] = mapped_column(DateTime)
    lastCompletedAt: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completionNotes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    repeat_frequency: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    repeat_unit: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)


class AttachmentORM(Base):
    __tablename__ = "attachments"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    taskId: Mapped[str] = mapped_column(String, ForeignKey("tasks.id"))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(255))
    size: Mapped[int] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(Text)


# --- Pydantic models (response/request) ---
TaskStatus = Literal['not_started', 'in_progress', 'completed', 'canceled']


class Repeat(BaseModel):
    frequency: int
    unit: Literal['hours', 'days']


class Attachment(BaseModel):
    id: str
    name: str
    type: str
    size: int
    url: str


class Task(BaseModel):
    id: str
    title: str
    description: str
    status: TaskStatus
    locationId: str
    userId: str
    createdAt: datetime
    dueDate: datetime
    attachments: List[Attachment] = []
    lastCompletedAt: Optional[datetime] = None
    completionNotes: Optional[str] = None
    repeat: Optional[Repeat] = None

    model_config = {"from_attributes": True}


class User(BaseModel):
    id: str
    name: str
    username: str
    email: Optional[str] = None
    avatarUrl: str

    model_config = {"from_attributes": True}


class NfcCard(BaseModel):
    id: str
    secretCode: str
    uid: Optional[str] = None
    assignedLocationId: Optional[str] = None

    model_config = {"from_attributes": True}


class Layout(BaseModel):
    id: str
    name: str
    imageUrl: str

    model_config = {"from_attributes": True}


class Location(BaseModel):
    id: str
    name: str
    layoutId: str
    nfcCardId: Optional[str] = None
    x: int
    y: int

    model_config = {"from_attributes": True}


def seed_if_empty(db: Session):
    if db.query(UserORM).first():
        return
    # Users
    u1 = UserORM(id="u1", name="Ahmet Yılmaz", username="ahmet", email="ahmet@example.com", avatarUrl="https://picsum.photos/seed/u1/100/100")
    u2 = UserORM(id="u2", name="Ayşe Kaya", username="ayse", email=None, avatarUrl="https://picsum.photos/seed/u2/100/100")
    u3 = UserORM(id="u3", name="Mehmet Öztürk", username="mehmet", email="mehmet@example.com", avatarUrl="https://picsum.photos/seed/u3/100/100")
    db.add_all([u1, u2, u3])

    # Layouts
    l1 = LayoutORM(id="layout1", name="Zemin Kat - Üretim Alanı", imageUrl="https://i.imgur.com/A4p4p0a.png")
    l2 = LayoutORM(id="layout2", name="Depo ve Lojistik Alanı", imageUrl="https://i.imgur.com/Uv7p4yS.png")
    db.add_all([l1, l2])

    # Cards FIRST (assignedLocationId NULL to avoid FK cycle)
    c1 = NfcCardORM(id="NFC001", secretCode="a1b2c3d4", uid="04:6a:9c:8d:a8:67:80", assignedLocationId=None)
    c2 = NfcCardORM(id="NFC002", secretCode="e5f6g7h8", uid="04:6a:9c:8d:a8:67:81", assignedLocationId=None)
    c3 = NfcCardORM(id="NFC003", secretCode="i9j0k1l2", uid="04:6a:9c:8d:a8:67:82", assignedLocationId=None)
    c4 = NfcCardORM(id="NFC004", secretCode="m3n4o5p6", uid="04:6a:9c:8d:a8:67:83", assignedLocationId=None)
    c5 = NfcCardORM(id="NFC005", secretCode="q7r8s9t0", uid="04:6a:9c:8d:a8:67:84", assignedLocationId=None)
    db.add_all([c1, c2, c3, c4, c5])
    db.flush()

    # Locations referencing existing cards
    loc1 = LocationORM(id="loc1", name="Ana Giriş Güvenlik Noktası", layoutId="layout1", nfcCardId="NFC001", x=15, y=25)
    loc2 = LocationORM(id="loc2", name="CNC Makinesi #3", layoutId="layout1", nfcCardId="NFC002", x=50, y=50)
    loc3 = LocationORM(id="loc3", name="Kalite Kontrol Masası", layoutId="layout2", nfcCardId="NFC003", x=80, y=70)
    db.add_all([loc1, loc2, loc3])
    db.flush()

    # Now tie back cards to locations
    c1.assignedLocationId = "loc1"
    c2.assignedLocationId = "loc2"
    c3.assignedLocationId = "loc3"

    # Tasks
    now = datetime.now()
    t1 = TaskORM(
        id="t1",
        title="Giriş kapısı kontrolü",
        description="Depo A giriş kapısının kilitli olduğundan emin ol.",
        status="completed",
        locationId="loc1",
        userId="u1",
        createdAt=now - timedelta(days=2),
        dueDate=now - timedelta(days=1),
        lastCompletedAt=now - timedelta(hours=23),
        completionNotes="Kapı kilitliydi, sorun yok.",
        repeat_frequency=1,
        repeat_unit="days",
    )
    t2 = TaskORM(
        id="t2",
        title="Makine yağı seviyesi kontrolü",
        description="Üretim hattındaki 2 numaralı makinenin yağ seviyesini kontrol et.",
        status="in_progress",
        locationId="loc2",
        userId="u2",
        createdAt=now - timedelta(hours=2),
        dueDate=now + timedelta(hours=4),
        repeat_frequency=1,
        repeat_unit="days",
    )
    t3 = TaskORM(
        id="t3",
        title="Mutfak temizliği",
        description="Ofis mutfağındaki kahve makinesini temizle.",
        status="not_started",
        locationId="loc3",
        userId="u3",
        createdAt=now - timedelta(hours=1),
        dueDate=now + timedelta(hours=8),
    )
    db.add_all([t1, t2, t3])
    db.commit()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(engine)
    # Ensure passwordHash column exists (for existing DBs without migrations)
    try:
        insp = inspect(engine)
        cols = [c['name'] for c in insp.get_columns('users')]
        if 'passwordHash' not in cols:
            with engine.begin() as conn:
                conn.execute(text('ALTER TABLE users ADD COLUMN "passwordHash" VARCHAR(255)'))
    except Exception:
        pass
    with SessionLocal() as db:
        seed_if_empty(db)


# --- Helpers ---
def orm_task_to_pydantic(db: Session, row: TaskORM) -> Task:
    att_rows = db.query(AttachmentORM).filter(AttachmentORM.taskId == row.id).all()
    attachments = [Attachment(id=a.id, name=a.name, type=a.type, size=a.size, url=a.url) for a in att_rows]
    repeat = None
    if row.repeat_frequency and row.repeat_unit:
        repeat = Repeat(frequency=row.repeat_frequency, unit=row.repeat_unit)  # type: ignore[arg-type]
    return Task(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,  # type: ignore[assignment]
        locationId=row.locationId,
        userId=row.userId,
        createdAt=row.createdAt,
        dueDate=row.dueDate,
        attachments=attachments,
        lastCompletedAt=row.lastCompletedAt,
        completionNotes=row.completionNotes,
        repeat=repeat,
    )


# --- API Endpoints ---
@app.get("/api/users", response_model=List[User])
def list_users(db: Session = Depends(get_db)):
    return db.query(UserORM).all()


class UserUpsert(BaseModel):
    name: str
    username: str
    email: Optional[str] = None
    avatarUrl: str
    password: Optional[str] = None


@app.post("/api/users", response_model=User, status_code=201)
def create_user(payload: UserUpsert, db: Session = Depends(get_db)):
    new_id = f"u-{uuid4().hex[:8]}"
    row = UserORM(
        id=new_id,
        name=payload.name,
        username=payload.username,
        email=payload.email,
        avatarUrl=payload.avatarUrl,
        passwordHash=hash_password(payload.password) if payload.password else None,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    db.refresh(row)
    return row


class PasswordResetRequest(BaseModel):
    newPassword: Optional[str] = None
    generate: Optional[bool] = False


@app.post("/api/users/{user_id}/password")
def reset_user_password(user_id: str, payload: PasswordResetRequest, db: Session = Depends(get_db)):
    row = db.get(UserORM, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    temp_password = None
    if payload.newPassword and len(payload.newPassword) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    if payload.newPassword:
        row.passwordHash = hash_password(payload.newPassword)
    else:
        # generate if requested or absent
        import secrets, string
        alphabet = string.ascii_letters + string.digits
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(10))
        row.passwordHash = hash_password(temp_password)
    db.commit()
    return {"ok": True, "temporaryPassword": temp_password}


@app.delete("/api/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    row = db.get(UserORM, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent deletion if user has tasks
    has_tasks = db.query(TaskORM).filter(TaskORM.userId == user_id).first() is not None
    if has_tasks:
        raise HTTPException(status_code=409, detail="User has tasks and cannot be deleted")
    db.delete(row)
    db.commit()
    return None


@app.get("/api/locations", response_model=List[Location])
def list_locations(db: Session = Depends(get_db)):
    return db.query(LocationORM).all()


@app.get("/api/cards", response_model=List[NfcCard])
def list_cards(db: Session = Depends(get_db)):
    return db.query(NfcCardORM).all()


@app.get("/api/layouts", response_model=List[Layout])
def list_layouts(db: Session = Depends(get_db)):
    return db.query(LayoutORM).all()


@app.get("/api/tasks", response_model=List[Task])
def list_tasks(db: Session = Depends(get_db)):
    rows = db.query(TaskORM).all()
    return [orm_task_to_pydantic(db, r) for r in rows]


@app.get("/api/tasks/{task_id}", response_model=Task)
def get_task(task_id: str, db: Session = Depends(get_db)):
    row = db.get(TaskORM, task_id)
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return orm_task_to_pydantic(db, row)


class TaskUpsert(BaseModel):
    title: str
    description: str
    status: TaskStatus
    locationId: str
    userId: str
    dueDate: datetime
    repeat: Optional[Repeat] = None


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(payload: TaskUpsert, db: Session = Depends(get_db)):
    new_id = f"t-{uuid4().hex[:8]}"
    row = TaskORM(
        id=new_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        locationId=payload.locationId,
        userId=payload.userId,
        createdAt=datetime.now(),
        dueDate=payload.dueDate,
        repeat_frequency=payload.repeat.frequency if payload.repeat else None,
        repeat_unit=payload.repeat.unit if payload.repeat else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return orm_task_to_pydantic(db, row)


@app.put("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, payload: TaskUpsert, db: Session = Depends(get_db)):
    row = db.get(TaskORM, task_id)
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    row.title = payload.title
    row.description = payload.description
    row.status = payload.status  # type: ignore[assignment]
    row.locationId = payload.locationId
    row.userId = payload.userId
    row.dueDate = payload.dueDate
    row.repeat_frequency = payload.repeat.frequency if payload.repeat else None
    row.repeat_unit = payload.repeat.unit if payload.repeat else None
    db.commit()
    db.refresh(row)
    return orm_task_to_pydantic(db, row)


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    row = db.get(TaskORM, task_id)
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    db.query(AttachmentORM).filter(AttachmentORM.taskId == task_id).delete()
    db.delete(row)
    db.commit()
    return None


class TaskCompleteRequest(BaseModel):
    notes: Optional[str] = None


@app.post("/api/tasks/{task_id}/complete", response_model=Task)
def complete_task(task_id: str, payload: TaskCompleteRequest, db: Session = Depends(get_db)):
    row = db.get(TaskORM, task_id)
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.now()
    row.status = 'completed'
    row.lastCompletedAt = now
    if payload.notes is not None:
        row.completionNotes = payload.notes or None

    # create next repeated task if configured
    if row.repeat_frequency and row.repeat_unit:
        if row.repeat_unit == 'days':
            due = now + timedelta(days=row.repeat_frequency)
        else:
            due = now + timedelta(hours=row.repeat_frequency)
        new_id = f"t-{uuid4().hex[:8]}"
        next_task = TaskORM(
            id=new_id,
            title=row.title,
            description=row.description,
            status='not_started',
            locationId=row.locationId,
            userId=row.userId,
            createdAt=now,
            dueDate=due,
            repeat_frequency=row.repeat_frequency,
            repeat_unit=row.repeat_unit,
        )
        db.add(next_task)

    db.commit()
    db.refresh(row)
    return orm_task_to_pydantic(db, row)
