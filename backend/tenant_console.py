import json
import hashlib
import os
import re
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import Boolean, and_, or_, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, case, create_engine, func, inspect, select, text, update
from sqlalchemy.exc import IntegrityError
from club_roles import CLUB_ADMIN, CLUB_MANAGER, TRAINER, OPERATORS, STAFF_ROLES, canonical_role, permits
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/nfc",
)
def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


DATABASE_URL = _normalize_database_url(DATABASE_URL)

console_engine = create_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
ConsoleSession = sessionmaker(bind=console_engine, autoflush=False, expire_on_commit=False)


class ConsoleBase(DeclarativeBase):
    pass


class Account(ConsoleBase):
    __tablename__ = "console_accounts"
    __table_args__ = (Index("uq_console_accounts_supabase_user_id", "supabase_user_id", unique=True),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(100))
    supabase_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Tenant(ConsoleBase):
    __tablename__ = "console_tenants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    plan: Mapped[str] = mapped_column(String(80), default="Sports Center Basic", nullable=False)
    member_limit: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    card_limit: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TenantStaff(ConsoleBase):
    __tablename__ = "console_tenant_staff"
    __table_args__ = (UniqueConstraint("tenant_id", "account_id", name="uq_console_staff_tenant_account"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Membership(ConsoleBase):
    __tablename__ = "console_memberships"
    __table_args__ = (UniqueConstraint("tenant_id", "account_id", name="uq_console_membership_tenant_account"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="nfc", nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(ForeignKey("console_accounts.id"), nullable=True)
    review_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class Exercise(ConsoleBase):
    __tablename__ = "console_exercises"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_console_exercise_tenant_name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(30), default="strength", nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    default_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    default_calories: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class NfcTag(ConsoleBase):
    __tablename__ = "console_nfc_tags"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[Optional[str]] = mapped_column(ForeignKey("console_exercises.id", ondelete="RESTRICT"), index=True, nullable=True)
    uid: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    read_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_scanned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Activity(ConsoleBase):
    __tablename__ = "console_activities"
    __table_args__ = (Index("uq_console_activity_account_request", "account_id", "request_id", unique=True),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("console_exercises.id", ondelete="RESTRICT"), index=True)
    tag_id: Mapped[Optional[str]] = mapped_column(ForeignKey("console_nfc_tags.id", ondelete="SET NULL"), nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    request_payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="nfc", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)


class MemberExerciseGoal(ConsoleBase):
    __tablename__ = "console_member_exercise_goals"
    __table_args__ = (UniqueConstraint("account_id", "exercise_id", "unit", name="uq_console_member_exercise_goal"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    account_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id", ondelete="CASCADE"), index=True)
    exercise_id: Mapped[str] = mapped_column(ForeignKey("console_exercises.id", ondelete="CASCADE"), index=True)
    unit: Mapped[str] = mapped_column(String(20))
    target_quantity: Mapped[float] = mapped_column(Float, nullable=False)


class AuditLog(ConsoleBase):
    __tablename__ = "console_audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"))
    action: Mapped[str] = mapped_column(String(80))
    subject_id: Mapped[str] = mapped_column(String(160))
    detail: Mapped[str] = mapped_column(String(8000), default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ClubBillingProfile(ConsoleBase):
    __tablename__ = "console_club_billing_profiles"
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id"), primary_key=True)
    legal_name: Mapped[str] = mapped_column(String(200), default="")
    billing_email: Mapped[str] = mapped_column(String(320), default="")
    tax_id: Mapped[str] = mapped_column(String(80), default="")
    address: Mapped[str] = mapped_column(String(1000), default="")


class SubscriptionRequest(ConsoleBase):
    __tablename__ = "console_subscription_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"))
    requested_plan: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def audit(db, tenant_id, actor_id, action, subject_id, detail):
    db.add(AuditLog(tenant_id=tenant_id, actor_id=actor_id, action=action,
                    subject_id=subject_id, detail=json.dumps(detail, ensure_ascii=False)))


router = APIRouter(prefix="/api/console", tags=["tenant console"])
def initialize_console_schema() -> None:
    if "console_accounts" in inspect(console_engine).get_table_names():
        columns = {column["name"] for column in inspect(console_engine).get_columns("console_accounts")}
        if "supabase_user_id" not in columns:
            with console_engine.begin() as connection:
                connection.execute(text("ALTER TABLE console_accounts ADD COLUMN supabase_user_id VARCHAR(36)"))
    if "console_activities" in inspect(console_engine).get_table_names():
        columns = {column["name"] for column in inspect(console_engine).get_columns("console_activities")}
        with console_engine.begin() as connection:
            for name, size in (("request_id", 36), ("request_payload_hash", 64)):
                if name not in columns:
                    clause = "IF NOT EXISTS " if console_engine.dialect.name == "postgresql" else ""
                    connection.execute(text(f"ALTER TABLE console_activities ADD COLUMN {clause}{name} VARCHAR({size})"))
    if "console_activities" in inspect(console_engine).get_table_names():
        columns = {column["name"] for column in inspect(console_engine).get_columns("console_activities")}
        if "received_at" not in columns:
            with console_engine.begin() as connection:
                clause = "IF NOT EXISTS " if console_engine.dialect.name == "postgresql" else ""
                connection.execute(text(f"ALTER TABLE console_activities ADD COLUMN {clause}received_at TIMESTAMP" + (" WITH TIME ZONE" if console_engine.dialect.name == "postgresql" else "")))
    ConsoleBase.metadata.create_all(console_engine)
    from sqlalchemy.schema import CreateIndex
    with console_engine.begin() as connection:
        for table in ConsoleBase.metadata.tables.values():
            for index in table.indexes:
                if index.name.startswith("ix_trainer_"):
                    connection.execute(CreateIndex(index, if_not_exists=True))
    with console_engine.begin() as connection:
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_console_activity_account_request ON console_activities(account_id, request_id)"))
    tag_columns = {column["name"]: column for column in inspect(console_engine).get_columns("console_nfc_tags")}
    if not tag_columns["exercise_id"]["nullable"]:
        if console_engine.dialect.name != "postgresql":
            raise RuntimeError("Existing console_nfc_tags.exercise_id must allow NULL before using optional exercise assignment.")
        with console_engine.begin() as connection:
            connection.execute(text("ALTER TABLE console_nfc_tags ALTER COLUMN exercise_id DROP NOT NULL"))
    email = os.getenv("CONSOLE_SUPERADMIN_EMAIL", "").strip().lower()
    name = os.getenv("CONSOLE_SUPERADMIN_NAME", "Platform Admin").strip()
    if email:
        with ConsoleSession.begin() as db:
            account = db.scalar(select(Account).where(Account.email == email))
            if account is None:
                db.add(Account(email=email, name=name, password_hash="supabase-auth-managed", is_platform_admin=True))
            elif not account.is_platform_admin:
                account.is_platform_admin = True


def _fetch_supabase_identity(access_token: str) -> dict:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured on the backend.")
    request = Request(
        f"{supabase_url}/auth/v1/user",
        headers={"apikey": anon_key, "Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=5) as response:
            identity = json.loads(response.read())
    except HTTPError as exc:
        if exc.code in {401, 403}:
            raise HTTPException(status_code=401, detail="Your Supabase session is invalid or expired.") from exc
        raise HTTPException(status_code=503, detail="Supabase authentication could not be reached.") from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=503, detail="Supabase authentication could not be reached.") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=503, detail="Supabase returned an invalid authentication response.") from exc

    if not isinstance(identity, dict):
        raise HTTPException(status_code=401, detail="Supabase returned an invalid user identity.")
    try:
        user_id = str(UUID(str(identity["id"])))
        raw_email = identity["email"]
        if not isinstance(raw_email, str) or "@" not in raw_email or any(character.isspace() for character in raw_email):
            raise ValueError("Invalid email")
        email = raw_email.strip().lower()
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Supabase returned an invalid user identity.") from exc
    metadata = identity.get("user_metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    return {
        "id": user_id,
        "email": email,
        "name": str(metadata.get("name") or "").strip(),
        "email_confirmed": bool(identity.get("email_confirmed_at")),
    }


def _get_or_link_account(db: Session, identity: dict) -> Account:
    if not identity["email_confirmed"]:
        raise HTTPException(status_code=403, detail="Verify your email address before using the tenant console.")
    email = identity["email"]
    account = db.scalar(select(Account).where(Account.supabase_user_id == identity["id"]))
    if account is None:
        account = db.scalar(select(Account).where(func.lower(Account.email) == email))
        if account is not None and account.supabase_user_id is not None:
            raise HTTPException(status_code=409, detail="This email is already linked to another Supabase account.")
        if account is None:
            account = Account(
                email=email,
                name=identity["name"] or email.split("@", 1)[0],
                password_hash="supabase-auth-managed",
            )
            db.add(account)
            db.flush()
    elif account.email.lower() != email:
        email_owner = db.scalar(select(Account).where(func.lower(Account.email) == email, Account.id != account.id))
        if email_owner is not None:
            raise HTTPException(status_code=409, detail="This email is already assigned to another console account.")
        account.email = email
    # Existing linked identities do not need a write transaction on every request.
    if account.supabase_user_id == identity["id"] and not db.is_modified(account):
        return account
    account.supabase_user_id = identity["id"]
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This Supabase account is already linked.") from exc
    return account


def get_db():
    with ConsoleSession() as db:
        yield db


def get_account(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> Account:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    access_token = authorization[7:].strip()
    if not access_token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    return _get_or_link_account(db, _fetch_supabase_identity(access_token))


def require_platform_admin(account: Account = Depends(get_account)) -> Account:
    if not account.is_platform_admin:
        raise HTTPException(status_code=403, detail="Platform administrator access required.")
    return account


def _tenant_access(db: Session, tenant_id: str, account: Account, roles: set[str] = frozenset({"owner", "admin", "coach"})) -> TenantStaff:
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Sports center not found.")
    if tenant.status != "active":
        raise HTTPException(status_code=403, detail="This sports center is inactive.")
    staff = db.scalar(select(TenantStaff).where(
        TenantStaff.tenant_id == tenant_id,
        TenantStaff.account_id == account.id,
        TenantStaff.status == "active",
    ).execution_options(populate_existing=True))
    if staff is None or not permits(staff.role, roles):
        raise HTTPException(status_code=403, detail="You do not have access to this sports center.")
    return staff


def _tenant_admin(tenant_id: str, db: Session = Depends(get_db), account: Account = Depends(get_account)) -> Account:
    _tenant_access(db, tenant_id, account, {"owner", "admin"})
    return account


def _tenant_staff(tenant_id: str, db: Session = Depends(get_db), account: Account = Depends(get_account)) -> Account:
    _tenant_access(db, tenant_id, account)
    return account


class TenantCreateInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    plan: str = Field(default="Sports Center Basic", min_length=2, max_length=80)
    member_limit: int = Field(default=50, ge=1, le=100000)
    card_limit: int = Field(default=200, ge=0, le=1000000)
    owner_name: str = Field(min_length=2, max_length=160)
    owner_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class TenantUpdateInput(BaseModel):
    status: Optional[Literal["active", "suspended"]] = None
    plan: Optional[str] = Field(default=None, min_length=2, max_length=80)
    member_limit: Optional[int] = Field(default=None, ge=1, le=100000)
    card_limit: Optional[int] = Field(default=None, ge=0, le=1000000)


class ReviewInput(BaseModel):
    decision: Literal["approve", "reject"]
    note: Optional[str] = Field(default=None, max_length=500)


class StaffCreateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=160)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    role: Literal["owner", "admin", "coach", "CLUB_ADMIN", "CLUB_MANAGER", "TRAINER"]


class ExerciseInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: Literal["strength", "core", "cardio", "mobility", "rehab", "other"] = "strength"
    unit: Literal["repetition", "seconds", "minutes", "meters"]
    default_quantity: float = Field(gt=0, le=100000)
    default_calories: float = Field(default=0, ge=0, le=100000)
    active: bool = True


def _normalize_tag_uid(value: str) -> str:
    value = value.strip()
    compact = re.sub(r"[:\s-]", "", value)
    if len(compact) >= 4 and len(compact) % 2 == 0 and re.fullmatch(r"[0-9a-fA-F]+", compact):
        return compact.upper()
    return value


class TagCreateInput(BaseModel):
    uid: str = Field(min_length=4, max_length=160)
    name: str = Field(min_length=2, max_length=120)
    exercise_id: Optional[str] = None
    active: bool = True

    @field_validator("uid", mode="before")
    @classmethod
    def normalize_uid(cls, value):
        return _normalize_tag_uid(value) if isinstance(value, str) else value


class TagUpdateInput(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    exercise_id: Optional[str] = None
    active: Optional[bool] = None


class ScanInput(BaseModel):
    uid: str = Field(min_length=4, max_length=160)

    @field_validator("uid", mode="before")
    @classmethod
    def normalize_uid(cls, value):
        return _normalize_tag_uid(value) if isinstance(value, str) else value


class TagLinkInput(BaseModel):
    tag_id: UUID


class MembershipStatusInput(BaseModel):
    status: Literal["active", "suspended", "removed"]


class StaffUpdateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Optional[Literal["owner", "admin", "coach", "CLUB_ADMIN", "CLUB_MANAGER", "TRAINER"]] = None
    status: Optional[Literal["active", "suspended", "removed"]] = None


class ActivityRecordInput(BaseModel):
    tag_id: str
    quantity: Optional[float] = Field(default=None, gt=0, le=100000, allow_inf_nan=False)
    request_id: Optional[UUID] = None
    occurred_at: Optional[datetime] = None
    expected_exercise_id: Optional[UUID] = None
    expected_unit: Optional[Literal["repetition", "seconds", "minutes", "meters"]] = None


def _account_json(account: Account) -> dict:
    return {"id": account.id, "email": account.email, "name": account.name, "is_platform_admin": account.is_platform_admin, "platform_role": "PLATFORM_ADMIN" if account.is_platform_admin else None}


def _tenant_json(tenant: Tenant, db: Session) -> dict:
    active_members = db.scalar(select(func.count()).select_from(Membership).where(Membership.tenant_id == tenant.id, Membership.status == "active")) or 0
    pending = db.scalar(select(func.count()).select_from(Membership).where(Membership.tenant_id == tenant.id, Membership.status == "pending")) or 0
    cards = db.scalar(select(func.count()).select_from(NfcTag).where(NfcTag.tenant_id == tenant.id)) or 0
    return {
        "id": tenant.id, "name": tenant.name, "slug": tenant.slug, "status": tenant.status,
        "plan": tenant.plan, "member_limit": tenant.member_limit, "card_limit": tenant.card_limit,
        "active_members": active_members, "pending_joins": pending, "cards": cards,
        "created_at": tenant.created_at.isoformat(),
    }


@router.get("/auth/me")
def who_am_i(account: Account = Depends(get_account), db: Session = Depends(get_db)):
    memberships = db.execute(select(Membership, Tenant).join(Tenant).where(Membership.account_id == account.id)).all()
    staff_rows = db.execute(select(TenantStaff, Tenant).join(Tenant).where(TenantStaff.account_id == account.id)).all()
    return {
        "account": _account_json(account),
        "memberships": [{"tenant_id": m.tenant_id, "tenant_name": t.name, "tenant_slug": t.slug, "status": m.status, "role": "CLUB_MEMBER", "source": m.source} for m, t in memberships],
        "staff": [{"tenant_id": s.tenant_id, "tenant_name": t.name, "tenant_slug": t.slug, "tenant_status": t.status, "role": s.role, "effective_role": canonical_role(s.role), "status": s.status} for s, t in staff_rows],
    }


@router.get("/platform/overview")
def platform_overview(db: Session = Depends(get_db), _: Account = Depends(require_platform_admin)):
    tenants = db.scalars(select(Tenant).order_by(Tenant.created_at.desc())).all()
    return {
        "subscription_requests": [{"id": r.id, "tenant_id": r.tenant_id, "requested_plan": r.requested_plan} for r in db.scalars(select(SubscriptionRequest).where(SubscriptionRequest.status == "pending")).all()],
        "tenant_count": len(tenants),
        "active_tenants": sum(tenant.status == "active" for tenant in tenants),
        "member_count": db.scalar(select(func.count()).select_from(Membership).where(Membership.status == "active")) or 0,
        "pending_joins": db.scalar(select(func.count()).select_from(Membership).where(Membership.status == "pending")) or 0,
        "tenants": [_tenant_json(tenant, db) for tenant in tenants],
    }


@router.get("/platform/tenants")
def list_tenants(db: Session = Depends(get_db), _: Account = Depends(require_platform_admin)):
    return [_tenant_json(tenant, db) for tenant in db.scalars(select(Tenant).order_by(Tenant.created_at.desc())).all()]


@router.post("/platform/tenants", status_code=201)
def create_tenant(payload: TenantCreateInput, db: Session = Depends(get_db), _: Account = Depends(require_platform_admin)):
    if db.scalar(select(Tenant).where(Tenant.slug == payload.slug)):
        raise HTTPException(status_code=409, detail="This tenant slug is already in use.")
    email = str(payload.owner_email).lower()
    owner = db.scalar(select(Account).where(Account.email == email))
    if owner is None:
        owner = Account(email=email, name=payload.owner_name, password_hash="supabase-auth-managed")
        db.add(owner)
        db.flush()
    tenant = Tenant(name=payload.name, slug=payload.slug, plan=payload.plan, member_limit=payload.member_limit, card_limit=payload.card_limit)
    db.add(tenant)
    db.flush()
    db.add(TenantStaff(tenant_id=tenant.id, account_id=owner.id, role=CLUB_ADMIN))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tenant or owner conflicts with an existing record.") from exc
    db.refresh(tenant)
    return {**_tenant_json(tenant, db), "owner": _account_json(owner)}


@router.patch("/platform/tenants/{tenant_id}")
def update_tenant(tenant_id: str, payload: TenantUpdateInput, db: Session = Depends(get_db), _: Account = Depends(require_platform_admin)):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Sports center not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(tenant, key, value)
    db.commit()
    return _tenant_json(tenant, db)


@router.get("/my-tenants")
def my_tenants(account: Account = Depends(get_account), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Tenant, Membership).join(Membership, Membership.tenant_id == Tenant.id)
        .where(Membership.account_id == account.id, Membership.status == "active", Tenant.status == "active")
    ).all()
    return [{"id": tenant.id, "name": tenant.name, "slug": tenant.slug} for tenant, _ in rows]


@router.get("/tenants/{tenant_id}/dashboard")
def tenant_dashboard(tenant_id: str, account: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    tenant = db.get(Tenant, tenant_id)
    return {
        "tenant": _tenant_json(tenant, db),
        "activities_today": db.scalar(select(func.count()).select_from(Activity).where(Activity.tenant_id == tenant_id, Activity.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))) or 0,
        "inactive_members": db.scalar(select(func.count()).select_from(Membership).where(Membership.tenant_id == tenant_id, Membership.status == "suspended")) or 0,
    }


@router.get("/tenants/{tenant_id}/members")
def list_members(tenant_id: str, status: Optional[str] = None, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    query = select(Membership, Account).join(Account, Membership.account_id == Account.id).where(Membership.tenant_id == tenant_id)
    if status:
        if status not in {"pending", "active", "rejected", "suspended", "removed"}:
            raise HTTPException(status_code=422, detail="Invalid membership status.")
        query = query.where(Membership.status == status)
    return [
        {"id": m.id, "account_id": a.id, "name": a.name, "email": a.email, "status": m.status, "source": m.source, "requested_at": m.requested_at.isoformat(), "review_note": m.review_note}
        for m, a in db.execute(query.order_by(Membership.requested_at.desc())).all()
    ]


@router.post("/tenants/{tenant_id}/join-requests/{membership_id}/review")
def review_join(tenant_id: str, membership_id: str, payload: ReviewInput, account: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    membership = db.scalar(select(Membership).where(Membership.id == membership_id, Membership.tenant_id == tenant_id))
    if membership is None:
        raise HTTPException(status_code=404, detail="Join request not found.")
    if membership.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been reviewed.")
    if payload.decision == "approve":
        tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
        active = db.scalar(select(func.count()).select_from(Membership).where(Membership.tenant_id == tenant_id, Membership.status == "active")) or 0
        if tenant and active >= tenant.member_limit:
            raise HTTPException(status_code=409, detail="Member capacity reached. Upgrade the plan before approving.")
    membership.status = "active" if payload.decision == "approve" else "rejected"
    membership.reviewed_at = datetime.now(timezone.utc)
    membership.reviewed_by = account.id
    membership.review_note = payload.note
    audit(db, tenant_id, account.id, "membership.reviewed", membership.id, {"decision": payload.decision, "status": membership.status})
    db.commit()
    return {"id": membership.id, "status": membership.status, "reviewed_at": membership.reviewed_at.isoformat(), "note": membership.review_note}


@router.patch("/tenants/{tenant_id}/members/{membership_id}")
def update_membership(tenant_id: str, membership_id: str, payload: MembershipStatusInput, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    membership = db.scalar(select(Membership).where(Membership.id == membership_id, Membership.tenant_id == tenant_id))
    if membership is None:
        raise HTTPException(status_code=404, detail="Member not found.")
    if payload.status == "active" and membership.status != "active":
        tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
        count = db.scalar(select(func.count()).select_from(Membership).where(Membership.tenant_id == tenant_id, Membership.status == "active"))
        if count >= tenant.member_limit:
            raise HTTPException(status_code=409, detail="Member capacity reached.")
    audit(db, tenant_id, actor.id, "membership.changed", membership.id, {"before": membership.status, "after": payload.status})
    membership.status = payload.status
    db.commit()
    return {"id": membership.id, "status": membership.status}


@router.get("/tenants/{tenant_id}/staff")
def list_staff(tenant_id: str, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    rows = db.execute(select(TenantStaff, Account).join(Account).where(TenantStaff.tenant_id == tenant_id)).all()
    return [{"id": staff.id, "account_id": acc.id, "name": acc.name, "email": acc.email, "role": staff.role, "effective_role": canonical_role(staff.role), "status": staff.status} for staff, acc in rows]


@router.post("/tenants/{tenant_id}/staff", status_code=201)
def add_staff(tenant_id: str, payload: StaffCreateInput, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    actor_staff = _tenant_access(db, tenant_id, actor, OPERATORS)
    if canonical_role(actor_staff.role) != CLUB_ADMIN and canonical_role(payload.role) != TRAINER:
        raise HTTPException(status_code=403, detail="Only Club Admins can grant administrative roles.")
    if canonical_role(payload.role) == CLUB_ADMIN:
        raise HTTPException(status_code=409, detail="Invite as Trainer or Club Manager first; promote to Club Admin after verified sign-in.")
    email = str(payload.email).lower()
    account = db.scalar(select(Account).where(Account.email == email))
    if account is None:
        account = Account(email=email, name=payload.name, password_hash="supabase-auth-managed")
        db.add(account)
        db.flush()
    existing = db.scalar(select(TenantStaff).where(TenantStaff.tenant_id == tenant_id, TenantStaff.account_id == account.id))
    if existing:
        raise HTTPException(status_code=409, detail="This person already has a staff account at this center.")
    staff = TenantStaff(tenant_id=tenant_id, account_id=account.id, role=payload.role)
    db.add(staff)
    db.flush()
    audit(db, tenant_id, actor.id, "staff.invited", staff.id, {"role": canonical_role(staff.role), "email": email})
    db.commit()
    return {"id": staff.id, "account_id": account.id, "name": account.name, "email": account.email, "role": staff.role, "effective_role": canonical_role(staff.role), "status": staff.status}


@router.patch("/tenants/{tenant_id}/staff/{staff_id}")
def update_staff(tenant_id: str, staff_id: str, payload: StaffUpdateInput, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    staff = db.scalar(select(TenantStaff).where(TenantStaff.id == staff_id, TenantStaff.tenant_id == tenant_id))
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    # Every staff transition is serialized before reading its current target role.
    actor_staff = _tenant_access(db, tenant_id, actor, OPERATORS)
    if canonical_role(actor_staff.role) != CLUB_ADMIN and (
        canonical_role(staff.role) != TRAINER or
        (payload.role is not None and canonical_role(payload.role) != TRAINER)
    ):
        raise HTTPException(status_code=403, detail="Club Managers may only manage Trainers.")
    changes = payload.model_dump(exclude_unset=True)
    if any(value is None for value in changes.values()):
        raise HTTPException(status_code=422, detail="Role and status cannot be null.")
    before = {"role": canonical_role(staff.role), "status": staff.status}
    if canonical_role(staff.role) == CLUB_ADMIN and staff.status == "active" and (
        canonical_role(changes.get("role", staff.role)) != CLUB_ADMIN or changes.get("status", staff.status) != "active"
    ):
        other = db.scalar(select(TenantStaff.id).where(
            TenantStaff.tenant_id == tenant_id, TenantStaff.id != staff.id,
            TenantStaff.status == "active", TenantStaff.role.in_(["owner", CLUB_ADMIN])
        ))
        if not other:
            raise HTTPException(status_code=409, detail="The last active Club Admin is protected. Appoint another verified Club Admin before transferring ownership.")
    if payload.role and canonical_role(payload.role) == CLUB_ADMIN:
        target = db.get(Account, staff.account_id)
        if not target.supabase_user_id:
            raise HTTPException(status_code=409, detail="The new Club Admin must first sign in with a verified account.")
    for key, value in changes.items():
        setattr(staff, key, value)
    audit(db, tenant_id, actor.id, "staff.changed", staff.id, {"before": before, "after": {"role": canonical_role(staff.role), "status": staff.status}})
    db.commit()
    return {"id": staff.id, "account_id": staff.account_id, "role": staff.role, "effective_role": canonical_role(staff.role), "status": staff.status}


@router.get("/tenants/{tenant_id}/exercises")
def list_exercises(tenant_id: str, _: Account = Depends(_tenant_staff), db: Session = Depends(get_db)):
    return [
        {"id": row.id, "name": row.name, "category": row.category, "unit": row.unit, "default_quantity": row.default_quantity, "default_calories": row.default_calories, "active": row.active}
        for row in db.scalars(select(Exercise).where(Exercise.tenant_id == tenant_id).order_by(Exercise.name)).all()
    ]


@router.post("/tenants/{tenant_id}/exercises", status_code=201)
def create_exercise(tenant_id: str, payload: ExerciseInput, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    row = Exercise(tenant_id=tenant_id, **payload.model_dump())
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An exercise with this name already exists at this center.") from exc
    return _exercise_json(row)


@router.patch("/tenants/{tenant_id}/exercises/{exercise_id}")
def update_exercise(tenant_id: str, exercise_id: str, payload: ExerciseInput, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    row = db.scalar(select(Exercise).where(Exercise.id == exercise_id, Exercise.tenant_id == tenant_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An exercise with this name already exists at this center.") from exc
    return _exercise_json(row)


def _exercise_json(row: Exercise) -> dict:
    return {"id": row.id, "name": row.name, "category": row.category, "unit": row.unit, "default_quantity": row.default_quantity, "default_calories": row.default_calories, "active": row.active}


@router.get("/tenants/{tenant_id}/tags")
def list_tags(tenant_id: str, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    rows = db.execute(select(NfcTag, Exercise).outerjoin(Exercise).where(NfcTag.tenant_id == tenant_id).order_by(NfcTag.name)).all()
    return [_tag_json(tag, exercise) for tag, exercise in rows]


def _find_tag_by_uid(db: Session, uid: str) -> Optional[NfcTag]:
    canonical = _normalize_tag_uid(uid)
    if not re.fullmatch(r"[0-9A-F]+", canonical) or len(canonical) % 2:
        return db.scalar(select(NfcTag).where(NfcTag.uid == canonical))
    # Also match existing registrations without rewriting tenant data at startup.
    stored_uid = NfcTag.uid
    for separator in (":", "-", " ", "\t", "\r", "\n", "\v", "\f"):
        stored_uid = func.replace(stored_uid, separator, "")
    matches = db.scalars(select(NfcTag).where(func.upper(stored_uid) == canonical).limit(2)).all()
    if len(matches) > 1:
        raise HTTPException(status_code=409, detail="Multiple NFC tags use this UID in different formats. Contact the platform administrator.")
    return matches[0] if matches else None


def _tag_json(tag: NfcTag, exercise: Optional[Exercise]) -> dict:
    return {"id": tag.id, "uid": tag.uid, "name": tag.name, "exercise_id": tag.exercise_id, "active": tag.active, "read_count": tag.read_count, "last_scanned_at": tag.last_scanned_at.isoformat() if tag.last_scanned_at else None, "exercise": _exercise_json(exercise) if exercise else None}


@router.post("/tenants/{tenant_id}/tags", status_code=201)
def create_tag(tenant_id: str, payload: TagCreateInput, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    count = db.scalar(select(func.count()).select_from(NfcTag).where(NfcTag.tenant_id == tenant_id)) or 0
    if tenant and count >= tenant.card_limit:
        raise HTTPException(status_code=409, detail="NFC card capacity reached. Upgrade the plan before adding tags.")
    exercise = db.scalar(select(Exercise).where(Exercise.id == payload.exercise_id, Exercise.tenant_id == tenant_id, Exercise.active.is_(True))) if payload.exercise_id else None
    if payload.exercise_id is not None and exercise is None:
        raise HTTPException(status_code=422, detail="Select an active exercise belonging to this center.")
    if _find_tag_by_uid(db, payload.uid) is not None:
        raise HTTPException(status_code=409, detail="This NFC UID is already registered.")
    tag = NfcTag(tenant_id=tenant_id, **payload.model_dump())
    db.add(tag)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This NFC UID is already registered.") from exc
    return _tag_json(tag, exercise)


@router.patch("/tenants/{tenant_id}/tags/{tag_id}")
def update_tag(tenant_id: str, tag_id: str, payload: TagUpdateInput, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    tag = db.scalar(select(NfcTag).where(NfcTag.id == tag_id, NfcTag.tenant_id == tenant_id))
    if tag is None:
        raise HTTPException(status_code=404, detail="NFC tag not found.")
    before_active = tag.active
    changes = payload.model_dump(exclude_unset=True)
    if "exercise_id" in changes and changes["exercise_id"] is not None:
        exercise = db.scalar(select(Exercise).where(Exercise.id == changes["exercise_id"], Exercise.tenant_id == tenant_id, Exercise.active.is_(True)))
        if exercise is None:
            raise HTTPException(status_code=422, detail="Select an active exercise belonging to this center.")
    for key, value in changes.items():
        setattr(tag, key, value)
    audit(db, tenant_id, actor.id, "card.revoked" if before_active and not tag.active else "card.changed", tag.id, {"revoked": before_active and not tag.active, "before_active": before_active, "active": tag.active})
    db.commit()
    return _tag_json(tag, db.get(Exercise, tag.exercise_id) if tag.exercise_id else None)


@router.delete("/tenants/{tenant_id}/tags/{tag_id}", status_code=204)
def delete_tag(tenant_id: str, tag_id: str, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    tag = db.scalar(select(NfcTag).where(NfcTag.id == tag_id, NfcTag.tenant_id == tenant_id))
    if tag is None:
        raise HTTPException(status_code=404, detail="NFC tag not found.")
    # Keep members' recorded quantities and exercise history when removing a tag.
    db.execute(update(Activity).where(Activity.tag_id == tag.id).values(tag_id=None))
    db.delete(tag)
    audit(db, tenant_id, actor.id, "card.removed", tag.id, {"revoked": True})
    db.commit()


@router.get("/tenants/{tenant_id}/tags/{tag_id}/link")
def get_tag_write_link(tenant_id: str, tag_id: UUID, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    tag = db.scalar(select(NfcTag).where(NfcTag.id == str(tag_id), NfcTag.tenant_id == tenant_id))
    if tag is None:
        raise HTTPException(status_code=404, detail="NFC tag not found.")
    _find_tag_by_uid(db, tag.uid)  # Refuse ambiguous legacy duplicates before encoding.
    return {"tag_id": tag.id, "uid": _normalize_tag_uid(tag.uid), "url": f"https://nfc-fit.vercel.app/tag/{tag.id}"}


@router.get("/tenants/{tenant_id}/activities")
def list_activities(tenant_id: str, limit: int = 100, _: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    limit = min(max(limit, 1), 500)
    rows = db.execute(
        select(Activity, Account, Exercise, NfcTag)
        .join(Account, Activity.account_id == Account.id)
        .join(Exercise, Activity.exercise_id == Exercise.id)
        .outerjoin(NfcTag, Activity.tag_id == NfcTag.id)
        .where(Activity.tenant_id == tenant_id)
        .order_by(Activity.created_at.desc()).limit(limit)
    ).all()
    return [{"id": activity.id, "member": account.name, "email": account.email, "exercise": exercise.name, "quantity": activity.quantity, "unit": activity.unit, "source": activity.source, "tag": tag.name if tag else None, "created_at": activity.created_at.isoformat(), "received_at": (activity.received_at or activity.created_at).isoformat()} for activity, account, exercise, tag in rows]


def _active_member(db: Session, tenant_id: str, account_id: str) -> Membership:
    membership = db.scalar(select(Membership).where(Membership.tenant_id == tenant_id, Membership.account_id == account_id))
    if membership is None or membership.status != "active":
        raise HTTPException(status_code=403, detail="An active membership at this sports center is required.")
    return membership


@router.post("/nfc/scan")
def scan_tag(payload: ScanInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    tag = _find_tag_by_uid(db, payload.uid)
    if tag is None:
        raise HTTPException(status_code=404, detail="This NFC tag is not registered.")
    return _scan_registered_tag(tag, account, db)


@router.post("/nfc/open")
def open_tag_link(payload: TagLinkInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    tag = db.get(NfcTag, str(payload.tag_id))
    if tag is None:
        raise HTTPException(status_code=404, detail="NFC tag not found.")
    return _scan_registered_tag(tag, account, db)


@router.get("/nfc/resolve/{tag_id}")
def resolve_tag_link(tag_id: UUID, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    tag = db.get(NfcTag, str(tag_id))
    if tag is None:
        raise HTTPException(status_code=404, detail="NFC tag not found.")
    tenant = db.get(Tenant, tag.tenant_id)
    if tenant is None or tenant.status != "active" or not tag.active:
        raise HTTPException(status_code=410, detail="This sports center or NFC tag is inactive.")
    membership = db.scalar(select(Membership).where(Membership.tenant_id == tenant.id, Membership.account_id == account.id))
    exercise = db.get(Exercise, tag.exercise_id) if tag.exercise_id else None
    return {
        "tag": {"id": tag.id, "name": tag.name}, "tenant": {"id": tenant.id, "name": tenant.name},
        "exercise": _exercise_json(exercise) if exercise else None,
        "membership_status": membership.status if membership else "none",
    }


def _scan_registered_tag(tag: NfcTag, account: Account, db: Session):
    tenant = db.get(Tenant, tag.tenant_id)
    if tenant is None or tenant.status != "active" or not tag.active:
        raise HTTPException(status_code=410, detail="This sports center or NFC tag is inactive.")
    membership = db.scalar(select(Membership).where(Membership.tenant_id == tenant.id, Membership.account_id == account.id))
    if membership is None or membership.status == "rejected":
        if membership is None:
            membership = Membership(tenant_id=tenant.id, account_id=account.id, status="pending", source="nfc")
            db.add(membership)
        else:
            membership.status = "pending"
            membership.requested_at = datetime.now(timezone.utc)
            membership.reviewed_at = None
            membership.reviewed_by = None
            membership.review_note = None
        db.flush()
        audit(db, tenant.id, account.id, "membership.requested", membership.id, {"status": "pending"})
        db.commit()
        return {"result": "join_request_pending", "tenant": {"id": tenant.id, "name": tenant.name}, "membership_status": membership.status}
    if membership.status == "pending":
        return {"result": "join_request_pending", "tenant": {"id": tenant.id, "name": tenant.name}, "membership_status": membership.status}
    if membership.status != "active":
        raise HTTPException(status_code=403, detail="Your membership is not active.")
    if tag.exercise_id is None:
        return {"result": "tag_unassigned", "tenant": {"id": tenant.id, "name": tenant.name}, "tag": {"id": tag.id, "name": tag.name}}
    exercise = db.get(Exercise, tag.exercise_id)
    if exercise is None or not exercise.active:
        raise HTTPException(status_code=410, detail="The exercise assigned to this tag is inactive.")
    return {"result": "activity_confirmation_required", "tenant": {"id": tenant.id, "name": tenant.name}, "tag": {"id": tag.id, "name": tag.name}, "exercise": _exercise_json(exercise)}


@router.post("/nfc/record", status_code=201)
def record_nfc_activity(payload: ActivityRecordInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    fingerprint = None
    if payload.request_id:
        if payload.quantity is None:
            raise HTTPException(status_code=422, detail="Quantity is required for a retry-safe recording.")
        fingerprint_values = [payload.tag_id, float(payload.quantity)]
        if payload.occurred_at is not None:
            if payload.occurred_at.tzinfo is None:
                raise HTTPException(status_code=422, detail="The activity time must include a time zone.")
            fingerprint_values += [payload.occurred_at.astimezone(timezone.utc).isoformat(), str(payload.expected_exercise_id), payload.expected_unit]
        fingerprint = hashlib.sha256(json.dumps(fingerprint_values, separators=(",", ":")).encode()).hexdigest()
        existing = db.scalar(select(Activity).where(Activity.account_id == account.id, Activity.request_id == str(payload.request_id)))
        if existing:
            return _recording_receipt(existing, fingerprint, db)
    tag = db.get(NfcTag, payload.tag_id)
    if tag is None or not tag.active:
        raise HTTPException(status_code=404, detail="Active NFC tag not found.")
    tenant = db.get(Tenant, tag.tenant_id)
    if tenant is None or tenant.status != "active":
        raise HTTPException(status_code=403, detail="Sports center is inactive.")
    _active_member(db, tenant.id, account.id)
    if tag.exercise_id is None:
        raise HTTPException(status_code=409, detail="No exercise is assigned to this NFC tag yet.")
    exercise = db.get(Exercise, tag.exercise_id)
    if exercise is None or not exercise.active:
        raise HTTPException(status_code=410, detail="The exercise assigned to this tag is inactive.")
    if payload.expected_exercise_id and str(payload.expected_exercise_id) != exercise.id or payload.expected_unit and payload.expected_unit != exercise.unit:
        raise HTTPException(status_code=409, detail="Kartın egzersizi veya birimi değişmiş. Kayıt yeniden yorumlanmadı; tesis yöneticinizle kontrol edin.")
    if payload.occurred_at is not None and (payload.occurred_at < datetime.now(timezone.utc) - timedelta(days=3650) or payload.occurred_at > datetime.now(timezone.utc) + timedelta(minutes=5)):
        raise HTTPException(status_code=422, detail="Kayıt saati geçerli aralıkta değil. Telefonunuzun tarih ve saatini kontrol edin.")
    quantity = payload.quantity if payload.quantity is not None else exercise.default_quantity
    activity = Activity(tenant_id=tenant.id, account_id=account.id, exercise_id=exercise.id, tag_id=tag.id, quantity=quantity, unit=exercise.unit, source="nfc", created_at=payload.occurred_at or datetime.now(timezone.utc), request_id=str(payload.request_id) if payload.request_id else None, request_payload_hash=fingerprint)
    tag.read_count += 1
    tag.last_scanned_at = datetime.now(timezone.utc)
    db.add(activity)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(select(Activity).where(Activity.account_id == account.id, Activity.request_id == str(payload.request_id))) if payload.request_id else None
        if not existing:
            raise
        return _recording_receipt(existing, fingerprint, db)
    return _recording_receipt(activity, fingerprint, db)


def _recording_receipt(activity: Activity, fingerprint: Optional[str], db: Session):
    if activity.request_payload_hash != fingerprint:
        raise HTTPException(status_code=409, detail="This recording request was already used with different values.")
    tenant = db.get(Tenant, activity.tenant_id)
    exercise = db.get(Exercise, activity.exercise_id)
    tag = db.get(NfcTag, activity.tag_id) if activity.tag_id else None
    return _activity_receipt_json(activity, tenant, exercise, tag)


def _utc_iso(value):
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def _activity_receipt_json(activity, tenant, exercise, tag):
    return {"id": activity.id, "request_id": activity.request_id, "tenant": tenant.name, "tenant_id": tenant.id, "tenant_name": tenant.name,
            "exercise_id": exercise.id, "exercise": exercise.name, "tag_id": tag.id if tag else None, "tag": tag.name if tag else None,
            "quantity": activity.quantity, "unit": activity.unit, "source": activity.source,
            "created_at": _utc_iso(activity.created_at), "received_at": _utc_iso(activity.received_at or activity.created_at)}



@router.get("/me/join-requests")
def my_join_requests(account: Account = Depends(get_account), db: Session = Depends(get_db)):
    rows = db.execute(select(Membership, Tenant).join(Tenant).where(Membership.account_id == account.id).order_by(Membership.requested_at.desc())).all()
    return [{"membership_id": m.id, "tenant_id": t.id, "tenant_name": t.name, "status": m.status, "source": m.source, "requested_at": m.requested_at.isoformat(), "review_note": m.review_note} for m, t in rows]


@router.get("/me/activities")
def my_activities(limit: int = 100, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    limit = min(max(limit, 1), 500)
    rows = db.execute(
        select(Activity, Tenant, Exercise, NfcTag)
        .join(Tenant, Activity.tenant_id == Tenant.id)
        .join(Exercise, Activity.exercise_id == Exercise.id)
        .outerjoin(NfcTag, Activity.tag_id == NfcTag.id)
        .where(Activity.account_id == account.id)
        .order_by(Activity.created_at.desc())
        .limit(limit)
    ).all()
    return [
        {"id": activity.id, "request_id": activity.request_id, "received_at": (activity.received_at or activity.created_at).isoformat(), "tenant_id": tenant.id, "tenant_name": tenant.name, "exercise_id": exercise.id, "exercise": exercise.name, "tag_id": tag.id if tag else None,
         "quantity": activity.quantity, "unit": activity.unit, "source": activity.source,
         "tag": tag.name if tag else None, "created_at": activity.created_at.isoformat()}
        for activity, tenant, exercise, tag in rows
    ]


@router.get("/tenants/{tenant_id}/management")
def club_management(tenant_id: str, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    staff = _tenant_access(db, tenant_id, account, OPERATORS)
    # One authenticated request instead of six repeated auth/permission round trips.
    return {
        "dashboard": tenant_dashboard(tenant_id, account, db),
        "members": list_members(tenant_id, None, account, db),
        "tags": list_tags(tenant_id, account, db),
        "exercises": list_exercises(tenant_id, account, db),
        "staff": list_staff(tenant_id, account, db) if permits(staff.role, OPERATORS) else [],
        "activities": list_activities(tenant_id, 100, account, db),
    }


class MemberGoalInput(BaseModel):
    target_quantity: float = Field(gt=0, le=100000, allow_inf_nan=False)
    unit: Literal["repetition", "seconds", "minutes", "meters"]


@router.post("/me/exercise-goals/{exercise_id}")
def save_member_exercise_goal(exercise_id: UUID, payload: MemberGoalInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    exercise = db.get(Exercise, str(exercise_id))
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    _active_member(db, exercise.tenant_id, account.id)
    tenant = db.get(Tenant, exercise.tenant_id)
    if not exercise.active or tenant.status != "active" or payload.unit != exercise.unit:
        raise HTTPException(status_code=409, detail="Exercise is inactive or its unit has changed. Refresh and try again.")
    goal = db.scalar(select(MemberExerciseGoal).where(MemberExerciseGoal.account_id == account.id, MemberExerciseGoal.exercise_id == exercise.id, MemberExerciseGoal.unit == payload.unit))
    if goal is None:
        goal = MemberExerciseGoal(account_id=account.id, exercise_id=exercise.id, unit=payload.unit, target_quantity=payload.target_quantity)
        db.add(goal)
    else:
        goal.target_quantity = payload.target_quantity
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Goal was changed concurrently. Refresh and try again.") from exc
    return {"exercise_id": exercise.id, "unit": goal.unit, "target_quantity": goal.target_quantity}


@router.get("/me/fitness")
def member_fitness(day: date, utc_offset_minutes: int = Query(default=0, ge=-840, le=840), account: Account = Depends(get_account), db: Session = Depends(get_db)):
    local_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone(timedelta(minutes=utc_offset_minutes)))
    starts = {"day": local_start, "week": local_start - timedelta(days=day.weekday()), "month": local_start.replace(day=1)}
    end = (local_start + timedelta(days=1)).astimezone(timezone.utc)
    # Aggregate the complete periods in SQL, independently of the 100-item history page.
    columns = []
    for name, start in starts.items():
        condition = (Activity.created_at >= start.astimezone(timezone.utc)) & (Activity.created_at < end)
        columns.extend([func.sum(case((condition, 1), else_=0)).label(f"{name}_count"), func.sum(case((condition, Activity.quantity), else_=0)).label(f"{name}_quantity")])
    timeline_days = [(local_start - timedelta(days=13-index)) for index in range(14)]
    for index, start in enumerate(timeline_days):
        condition = (Activity.created_at >= start.astimezone(timezone.utc)) & (Activity.created_at < (start + timedelta(days=1)).astimezone(timezone.utc))
        columns.append(func.sum(case((condition, 1), else_=0)).label(f"timeline_{index}"))
    aggregates = db.execute(select(Activity.exercise_id, Activity.unit, *columns).where(Activity.account_id == account.id).group_by(Activity.exercise_id, Activity.unit)).mappings().all()
    timeline = [{"day": start.date().isoformat(), "count": sum(row[f"timeline_{index}"] for row in aggregates)} for index, start in enumerate(timeline_days)]
    own_goals = db.scalars(select(MemberExerciseGoal).where(MemberExerciseGoal.account_id == account.id)).all()
    ids = {row["exercise_id"] for row in aggregates} | {goal.exercise_id for goal in own_goals}
    if not ids:
        return {"day": day.isoformat(), "exercises": [], "timeline": timeline}
    exercises = db.execute(select(Exercise, Tenant, Membership).join(Tenant, Exercise.tenant_id == Tenant.id).outerjoin(Membership, (Membership.tenant_id == Tenant.id) & (Membership.account_id == account.id)).where(Exercise.id.in_(ids))).all()
    metadata = {exercise.id: (exercise, tenant, membership) for exercise, tenant, membership in exercises}
    goals = {(goal.exercise_id, goal.unit): goal.target_quantity for goal in own_goals}
    quantities = {(row["exercise_id"], row["unit"]): row for row in aggregates}
    keys = set(quantities) | set(goals) | {(exercise.id, exercise.unit) for exercise, _, _ in exercises}
    rows = []
    for exercise_id, unit in keys:
        exercise, tenant, membership = metadata[exercise_id]
        values = quantities.get((exercise_id, unit), {})
        rows.append({"exercise_id": exercise_id, "tenant_id": tenant.id, "tenant_name": tenant.name, "name": exercise.name, "unit": unit,
                     "target_quantity": goals.get((exercise_id, unit)),
                     "can_edit": bool(unit == exercise.unit and exercise.active and tenant.status == "active" and membership and membership.status == "active"),
                     **{name: {"count": values.get(f"{name}_count", 0), "quantity": values.get(f"{name}_quantity", 0)} for name in starts}})
    return {"day": day.isoformat(), "timeline": timeline, "exercises": sorted(rows, key=lambda row: (row["tenant_name"], row["name"], row["unit"]))}


class OfflineManifest(BaseModel):
    tags: dict[str, str] = Field(default_factory=dict, max_length=100000)
    exercises: dict[str, str] = Field(default_factory=dict, max_length=100000)


class OfflineHistoryPage(BaseModel):
    time: datetime
    id: str


class OfflinePullInput(BaseModel):
    catalogs: dict[str, OfflineManifest] = Field(default_factory=dict, max_length=1000)
    history_since: Optional[datetime] = None
    history_until: Optional[datetime] = None
    history_page: Optional[OfflineHistoryPage] = None


def _fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def _offline_delta(current, known):
    hashes = {row["id"]: _fingerprint(row) for row in current}
    return {"upsert": [{"hash": hashes[row["id"]], "data": row} for row in current if known.get(row["id"]) != hashes[row["id"]]],
            "delete": sorted(set(known) - set(hashes)), "version": _fingerprint(hashes)}


@router.post("/me/offline/pull")
def offline_pull(payload: OfflinePullInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    for value in (payload.history_since, payload.history_until, payload.history_page.time if payload.history_page else None):
        if value is not None and value.tzinfo is None:
            raise HTTPException(status_code=422, detail="Sync timestamps must include a time zone.")
    rows = db.execute(select(Membership, Tenant).join(Tenant).where(Membership.account_id == account.id)).all()
    catalogs = []
    for membership, tenant in rows:
        known = payload.catalogs.get(tenant.id, OfflineManifest())
        permitted = membership.status in {"pending", "active"} and tenant.status == "active"
        tags = db.scalars(select(NfcTag).where(NfcTag.tenant_id == tenant.id)).all() if permitted else []
        exercises = db.scalars(select(Exercise).where(Exercise.tenant_id == tenant.id)).all() if permitted else []
        # No other member, account, staff list, or activity is in the facility package.
        tag_data = [{"id": tag.id, "uid": _normalize_tag_uid(tag.uid), "name": tag.name, "exercise_id": tag.exercise_id, "active": tag.active} for tag in tags]
        exercise_data = [_exercise_json(row) for row in exercises]
        catalogs.append({"tenant_id": tenant.id, "tenant_name": tenant.name, "membership_status": membership.status, "tenant_status": tenant.status,
                         "tags": _offline_delta(tag_data, known.tags), "exercises": _offline_delta(exercise_data, known.exercises)})
    received = func.coalesce(Activity.received_at, Activity.created_at)
    until = min(payload.history_until or now, now)
    since = (payload.history_since or datetime(1970, 1, 1, tzinfo=timezone.utc)) - timedelta(minutes=10)
    query = select(Activity, Tenant, Exercise, NfcTag).join(Tenant, Activity.tenant_id == Tenant.id).join(Exercise, Activity.exercise_id == Exercise.id).outerjoin(NfcTag, Activity.tag_id == NfcTag.id).where(Activity.account_id == account.id, received >= since, received <= until)
    if payload.history_page:
        query = query.where(or_(received > payload.history_page.time, and_(received == payload.history_page.time, Activity.id > payload.history_page.id)))
    history = db.execute(query.order_by(received, Activity.id).limit(501)).all()
    more = len(history) > 500
    history = history[:500]
    last = history[-1][0] if more else None
    goals = db.scalars(select(MemberExerciseGoal).where(MemberExerciseGoal.account_id == account.id)).all()
    return {"catalogs": catalogs, "identity": who_am_i(account, db), "history": [_activity_receipt_json(activity, tenant, exercise, tag) for activity, tenant, exercise, tag in history],
            "goals": [{"exercise_id": row.exercise_id, "unit": row.unit, "target_quantity": row.target_quantity} for row in goals],
            "history_until": until.isoformat(), "history_page": {"time": _utc_iso(last.received_at or last.created_at), "id": last.id} if last else None,
            "server_time": now.isoformat()}


class OfflineActivityInput(BaseModel):
    request_id: UUID
    tag_id: UUID
    exercise_id: UUID
    unit: Literal["repetition", "seconds", "minutes", "meters"]
    quantity: float = Field(gt=0, le=100000, allow_inf_nan=False)
    occurred_at: datetime


class OfflineGoalInput(BaseModel):
    request_id: UUID
    exercise_id: UUID
    unit: Literal["repetition", "seconds", "minutes", "meters"]
    target_quantity: float = Field(gt=0, le=100000, allow_inf_nan=False)
    base_target: Optional[float] = None


class OfflinePushInput(BaseModel):
    activities: list[OfflineActivityInput] = Field(default_factory=list, max_length=50)
    goals: list[OfflineGoalInput] = Field(default_factory=list, max_length=50)


def _offline_reason(detail):
    return {
        "An active membership at this sports center is required.": "Tesis üyeliğin aktif değil. Yerel kayıt korunuyor; tesis yöneticinle kontrol et.",
        "Active NFC tag not found.": "Kart silinmiş veya pasifleştirilmiş. Yerel kayıt korunuyor.",
        "Sports center is inactive.": "Tesis pasifleştirilmiş. Yerel kayıt korunuyor.",
        "The exercise assigned to this tag is inactive.": "Kartın egzersizi pasifleştirilmiş. Yerel kayıt korunuyor.",
        "No exercise is assigned to this NFC tag yet.": "Kartın egzersiz bağlantısı kaldırılmış. Yerel kayıt korunuyor.",
        "Exercise is inactive or its unit has changed. Refresh and try again.": "Egzersiz pasif veya birimi değişmiş. Hedef yeniden yorumlanmadı.",
    }.get(detail, detail)


@router.post("/me/offline/push")
def offline_push(payload: OfflinePushInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    results = []
    for item in payload.activities:
        try:
            receipt = record_nfc_activity(ActivityRecordInput(tag_id=str(item.tag_id), quantity=item.quantity, request_id=item.request_id,
                                          occurred_at=item.occurred_at, expected_exercise_id=item.exercise_id, expected_unit=item.unit), account, db)
            results.append({"request_id": str(item.request_id), "kind": "activity", "status": "accepted", "receipt": receipt})
        except HTTPException as exc:
            db.rollback()
            results.append({"request_id": str(item.request_id), "kind": "activity", "status": "rejected", "reason": _offline_reason(str(exc.detail))})
    for item in payload.goals:
        try:
            exercise = db.get(Exercise, str(item.exercise_id))
            if exercise is None:
                raise HTTPException(status_code=404, detail="Egzersiz silinmiş.")
            _active_member(db, exercise.tenant_id, account.id)
            current = db.scalar(select(MemberExerciseGoal).where(MemberExerciseGoal.account_id == account.id, MemberExerciseGoal.exercise_id == exercise.id, MemberExerciseGoal.unit == item.unit).with_for_update())
            target = current.target_quantity if current else None
            if target != item.base_target and target != item.target_quantity:
                raise HTTPException(status_code=409, detail="Hedef başka bir cihazda değişmiş. Yeni değer otomatik olarak üzerine yazılmadı.")
            saved = save_member_exercise_goal(item.exercise_id, MemberGoalInput(unit=item.unit, target_quantity=item.target_quantity), account, db)
            results.append({"request_id": str(item.request_id), "kind": "goal", "status": "accepted", "goal": saved})
        except HTTPException as exc:
            db.rollback()
            results.append({"request_id": str(item.request_id), "kind": "goal", "status": "rejected", "reason": _offline_reason(str(exc.detail))})
    return {"results": results}


class ClubSettingsInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)


class SubscriptionChangeInput(BaseModel):
    requested_plan: str = Field(min_length=2, max_length=80)


class MemberInviteInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _club_admin(tenant_id: str, db: Session = Depends(get_db), account: Account = Depends(get_account)):
    _tenant_access(db, tenant_id, account, {CLUB_ADMIN})
    return account


@router.get("/tenants/{tenant_id}/subscription")
def club_subscription(tenant_id: str, actor: Account = Depends(_club_admin), db: Session = Depends(get_db)):
    requests = db.scalars(select(SubscriptionRequest).where(SubscriptionRequest.tenant_id == tenant_id).order_by(SubscriptionRequest.created_at.desc()).limit(50)).all()
    profile = db.get(ClubBillingProfile, tenant_id)
    return {"tenant": _tenant_json(db.get(Tenant, tenant_id), db),
            "billing_profile": {key: getattr(profile, key) if profile else "" for key in ("legal_name", "billing_email", "tax_id", "address")},
            "billing_status": "platform_managed", "payment_portal_url": None,
            "requests": [{"id": r.id, "requested_plan": r.requested_plan, "status": r.status} for r in requests]}


@router.post("/tenants/{tenant_id}/subscription/requests", status_code=201)
def request_subscription_change(tenant_id: str, payload: SubscriptionChangeInput, actor: Account = Depends(_club_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    existing = db.scalar(select(SubscriptionRequest).where(SubscriptionRequest.tenant_id == tenant_id, SubscriptionRequest.status == "pending"))
    if existing:
        raise HTTPException(status_code=409, detail="A subscription change is already awaiting platform review.")
    row = SubscriptionRequest(tenant_id=tenant_id, actor_id=actor.id, requested_plan=payload.requested_plan)
    db.add(row)
    db.flush()
    audit(db, tenant_id, actor.id, "subscription.requested", row.id, {"requested_plan": row.requested_plan})
    db.commit()
    return {"id": row.id, "status": row.status}


@router.patch("/tenants/{tenant_id}/settings")
def update_club_settings(tenant_id: str, payload: ClubSettingsInput, actor: Account = Depends(_club_admin), db: Session = Depends(get_db)):
    tenant = db.get(Tenant, tenant_id)
    audit(db, tenant_id, actor.id, "settings.changed", tenant_id, {"before": tenant.name, "after": payload.name})
    tenant.name = payload.name
    db.commit()
    return _tenant_json(tenant, db)


@router.get("/tenants/{tenant_id}/audit")
def club_audit(tenant_id: str, actor: Account = Depends(_club_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditLog).where(AuditLog.tenant_id == tenant_id).order_by(AuditLog.created_at.desc()).limit(200)).all()
    return [{"id": r.id, "actor_id": r.actor_id, "action": r.action, "subject_id": r.subject_id,
             "detail": json.loads(r.detail), "created_at": r.created_at.isoformat()} for r in rows]


@router.post("/tenants/{tenant_id}/members", status_code=201)
def invite_member(tenant_id: str, payload: MemberInviteInput, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    # Provision a club-scoped membership request; verified email sign-in binds the account.
    # No external invitation email is sent by this API.
    account = db.scalar(select(Account).where(Account.email == payload.email.lower()))
    if account is None:
        account = Account(email=payload.email.lower(), name=payload.name, password_hash="supabase-auth-managed")
        db.add(account)
        db.flush()
    if db.scalar(select(Membership.id).where(Membership.tenant_id == tenant_id, Membership.account_id == account.id)):
        raise HTTPException(status_code=409, detail="This person already has a membership record in this club.")
    row = Membership(tenant_id=tenant_id, account_id=account.id, status="pending", source="staff")
    db.add(row)
    db.flush()
    audit(db, tenant_id, actor.id, "membership.invited", row.id, {"email": payload.email.lower(), "status": "pending"})
    db.commit()
    return {"id": row.id, "account_id": row.account_id, "status": row.status, "name": account.name, "email": account.email, "source": row.source, "requested_at": row.requested_at.isoformat(), "review_note": row.review_note}


@router.delete("/tenants/{tenant_id}/staff/{staff_id}")
def remove_staff(tenant_id: str, staff_id: str, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    return update_staff(tenant_id, staff_id, StaffUpdateInput(status="removed"), actor, db)


@router.delete("/tenants/{tenant_id}/members/{membership_id}")
def remove_member(tenant_id: str, membership_id: str, actor: Account = Depends(_tenant_admin), db: Session = Depends(get_db)):
    return update_membership(tenant_id, membership_id, MembershipStatusInput(status="removed"), actor, db)


class ClubBillingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    legal_name: str = Field(min_length=2, max_length=200)
    billing_email: str = Field(max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    tax_id: str = Field(default="", max_length=80)
    address: str = Field(default="", max_length=1000)


@router.patch("/tenants/{tenant_id}/billing-profile")
def update_billing_profile(tenant_id: str, payload: ClubBillingInput, actor: Account = Depends(_club_admin), db: Session = Depends(get_db)):
    db.scalar(select(Tenant).where(Tenant.id == tenant_id).with_for_update())
    row = db.get(ClubBillingProfile, tenant_id)
    if row is None:
        row = ClubBillingProfile(tenant_id=tenant_id)
        db.add(row)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    # Log the changed field names, not invoice addresses or tax identifiers.
    audit(db, tenant_id, actor.id, "billing.profile_changed", tenant_id, {"fields": list(payload.model_fields_set)})
    db.commit()
    return payload.model_dump()


class SubscriptionReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["approve", "reject"]
    member_limit: Optional[int] = Field(default=None, ge=1, le=100000)
    card_limit: Optional[int] = Field(default=None, ge=0, le=1000000)


@router.post("/platform/subscription-requests/{request_id}/review")
def review_subscription_request(request_id: str, payload: SubscriptionReviewInput, actor: Account = Depends(require_platform_admin), db: Session = Depends(get_db)):
    row = db.scalar(select(SubscriptionRequest).where(SubscriptionRequest.id == request_id).with_for_update())
    if row is None:
        raise HTTPException(status_code=404, detail="Subscription request not found.")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="This subscription request has already been reviewed.")
    tenant = db.scalar(select(Tenant).where(Tenant.id == row.tenant_id).with_for_update())
    if payload.decision == "approve":
        if payload.member_limit is None or payload.card_limit is None:
            raise HTTPException(status_code=422, detail="Approved subscription capacities must be explicit.")
        usage = _tenant_json(tenant, db)
        if payload.member_limit < usage["active_members"] or payload.card_limit < usage["cards"]:
            raise HTTPException(status_code=409, detail="New limits cannot be lower than current usage.")
        tenant.plan, tenant.member_limit, tenant.card_limit = row.requested_plan, payload.member_limit, payload.card_limit
    row.status = "approved" if payload.decision == "approve" else "rejected"
    audit(db, row.tenant_id, actor.id, "subscription.reviewed", row.id, {"decision": payload.decision, "requested_plan": row.requested_plan, "member_limit": payload.member_limit, "card_limit": payload.card_limit})
    db.commit()
    return {"id": row.id, "status": row.status}
