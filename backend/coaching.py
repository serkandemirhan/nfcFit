from club_roles import COACH_ROLES
from exercise_media import library_media
"""Coaching domain on the existing tenant identity, transaction and database boundary."""

import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.routing import APIRoute
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    or_,
    and_,
    select,
    update,
)
from sqlalchemy.orm import Mapped, Session, mapped_column
from tenant_console import (
    Account,
    ConsoleBase,
    Membership,
    Tenant,
    TenantStaff,
    NfcTag,
    _tenant_access,
    get_account,
    get_db,
)


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


def fail(code, message):
    raise HTTPException(code, message)


def digest(value):
    return hashlib.sha256(
        json.dumps(
            value, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode()
    ).hexdigest()


class CoachLink(ConsoleBase):
    __tablename__ = "console_coach_links"
    __table_args__ = (UniqueConstraint("tenant_id", "trainer_id", "athlete_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id"), index=True)
    trainer_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    athlete_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class LibraryExercise(ConsoleBase):
    __tablename__ = "console_library_exercises"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    owner_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("console_accounts.id"), nullable=True, index=True
    )
    content: Mapped[dict] = mapped_column(JSON)


class ExerciseFavorite(ConsoleBase):
    __tablename__ = "console_exercise_favorites"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), primary_key=True
    )
    exercise_id: Mapped[str] = mapped_column(
        ForeignKey("console_library_exercises.id"), primary_key=True
    )


class CoachingPlan(ConsoleBase):
    __tablename__ = "console_coaching_plans"
    __table_args__ = (CheckConstraint("version >= 1"), Index("ix_trainer_plan_tenant_athlete", "tenant_id", "athlete_id"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"), index=True)
    athlete_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("console_accounts.id"), nullable=True, index=True
    )
    tenant_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("console_tenants.id"), nullable=True, index=True
    )
    template_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("console_coaching_plans.id"), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WorkoutTemplate(ConsoleBase):
    __tablename__ = "console_workout_templates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id"), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[dict] = mapped_column(JSON)


class PlanVersion(ConsoleBase):
    __tablename__ = "console_plan_versions"
    __table_args__ = (
        UniqueConstraint("plan_id", "version"),
        CheckConstraint("version >= 1"),
        Index("ix_trainer_version_review", "plan_id", "review_status"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    plan_id: Mapped[str] = mapped_column(
        ForeignKey("console_coaching_plans.id"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    actor_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"))
    actor_role: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(String(1000), default="")
    review_status: Mapped[str] = mapped_column(String(20), default="reviewed")
    reviewed_by: Mapped[Optional[str]] = mapped_column(
        ForeignKey("console_accounts.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    content: Mapped[dict] = mapped_column(JSON)
    previous: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Workout(ConsoleBase):
    __tablename__ = "console_workouts"
    __table_args__ = (
        UniqueConstraint("plan_id", "session_key", "scheduled_date"),
        CheckConstraint("version >= 1"),
        Index("ix_trainer_workout_member_date", "athlete_id", "scheduled_date", "id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    athlete_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    plan_id: Mapped[str] = mapped_column(
        ForeignKey("console_coaching_plans.id"), index=True
    )
    plan_version: Mapped[int] = mapped_column(Integer)
    session_key: Mapped[str] = mapped_column(String(36))
    scheduled_date: Mapped[str] = mapped_column(String(10), index=True)
    state: Mapped[str] = mapped_column(String(24), default="not_started")
    version: Mapped[int] = mapped_column(Integer, default=1)
    snapshot: Mapped[dict] = mapped_column(JSON)
    actual: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WorkoutEvent(ConsoleBase):
    __tablename__ = "console_workout_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workout_id: Mapped[str] = mapped_column(
        ForeignKey("console_workouts.id"), index=True
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    command: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WeeklyReport(ConsoleBase):
    __tablename__ = "console_weekly_reports"
    __table_args__ = (UniqueConstraint("athlete_id", "week", "timezone", "scope"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    athlete_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    scope: Mapped[str] = mapped_column(String(36), default="all")
    week: Mapped[str] = mapped_column(String(10))
    timezone: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="awaiting_review")
    content: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ReportSnapshot(ConsoleBase):
    __tablename__ = "console_report_snapshots"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    report_id: Mapped[str] = mapped_column(
        ForeignKey("console_weekly_reports.id"), index=True
    )
    status: Mapped[str] = mapped_column(String(30))
    content: Mapped[dict] = mapped_column(JSON)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CoachReview(ConsoleBase):
    __tablename__ = "console_coach_reviews"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    report_id: Mapped[str] = mapped_column(
        ForeignKey("console_weekly_reports.id"), index=True
    )
    reviewer_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    status: Mapped[str] = mapped_column(String(30))
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CoachingMessage(ConsoleBase):
    __tablename__ = "console_coaching_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    link_id: Mapped[str] = mapped_column(
        ForeignKey("console_coach_links.id"), index=True
    )
    author_id: Mapped[str] = mapped_column(ForeignKey("console_accounts.id"))
    context_type: Mapped[str] = mapped_column(String(20), default="general")
    context_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    body: Mapped[str] = mapped_column(String(4000))
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CoachingNotification(ConsoleBase):
    __tablename__ = "console_coaching_notifications"
    __table_args__ = (UniqueConstraint("account_id", "group_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    group_key: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(String(400))
    context_id: Mapped[str] = mapped_column(String(80))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PrivateWellness(ConsoleBase):
    __tablename__ = "console_private_wellness"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20), index=True)
    content: Mapped[dict] = mapped_column(JSON)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class WellnessConsent(ConsoleBase):
    __tablename__ = "console_wellness_consent"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), primary_key=True
    )
    trainer_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String(20), primary_key=True)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False)


class WellnessPreference(ConsoleBase):
    __tablename__ = "console_wellness_preferences"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("console_accounts.id"), primary_key=True
    )
    water_goal_ml: Mapped[int] = mapped_column(Integer, default=2000)
    timezone: Mapped[str] = mapped_column(String(80), default="Europe/Istanbul")
    __table_args__ = (CheckConstraint("water_goal_ml > 0 AND water_goal_ml <= 10000"),)


class Equipment(ConsoleBase):
    __tablename__ = "console_equipment"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("console_tenants.id"), index=True)
    tag_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("console_nfc_tags.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    name: Mapped[str] = mapped_column(String(160))
    equipment_type: Mapped[str] = mapped_column(String(80))
    exercise_ids: Mapped[list] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Strict(BaseModel):
    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True, allow_inf_nan=False
    )


class LibraryInput(Strict):
    name: str = Field(min_length=2, max_length=120)
    name_en: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=2000)
    muscle: str = Field(min_length=2, max_length=80)
    secondary_muscles: list[str] = Field(default_factory=list, max_length=20)
    equipment: str = Field(min_length=2, max_length=80)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    instructions: list[str] = Field(default_factory=list, max_length=20)
    safety: list[str] = Field(default_factory=list, max_length=20)
    measurements: list[Literal["reps", "kg", "seconds", "meters"]] = Field(
        min_length=1, max_length=4
    )
    tags: list[str] = Field(default_factory=list, max_length=30)
    variations: list[str] = Field(default_factory=list, max_length=30)
    media: list[dict] = Field(
        default_factory=list, max_length=0
    )  # Asset ingestion requires a separate licensed-media workflow.


class Target(Strict):
    id: UUID
    exercise_id: str = Field(min_length=1, max_length=80)
    sets: int = Field(ge=1, le=100)
    reps: Optional[int] = Field(default=None, ge=1, le=10000)
    kg: Optional[float] = Field(default=None, ge=0, le=2000)
    seconds: Optional[float] = Field(default=None, gt=0, le=86400)
    meters: Optional[float] = Field(default=None, gt=0, le=1000000)
    rest_seconds: int = Field(default=60, ge=0, le=3600)
    notes: str = Field(default="", max_length=2000)
    superset: Optional[str] = Field(default=None, max_length=36)

    @model_validator(mode="after")
    def measured(self):
        if self.reps is None and self.seconds is None and self.meters is None:
            raise ValueError("Tekrar, süre veya mesafe hedefi gerekli.")
        return self


class PlannedDay(Strict):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    dates: list[date] = Field(min_length=1, max_length=366)
    exercises: list[Target] = Field(
        min_length=1
    )  # Deliberately no arbitrary 6/10 exercise limit.

    @model_validator(mode="after")
    def distinct(self):
        if len({e.id for e in self.exercises}) != len(self.exercises) or len(
            set(self.dates)
        ) != len(self.dates):
            raise ValueError("Yinelenen egzersiz/saat kimliği.")
        return self


class PlanContent(Strict):
    name: str = Field(min_length=2, max_length=160)
    goal: str = Field(default="", max_length=1000)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"
    start_date: date
    weeks: int = Field(ge=1, le=52)
    timezone: str = "Europe/Istanbul"
    planning_status: Literal["draft", "published", "archived"] = "published"
    rest_dates: list[date] = Field(default_factory=list, max_length=366)
    days: list[PlannedDay] = Field(default_factory=list, max_length=366)

    @model_validator(mode="after")
    def valid_dates(self):
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Geçersiz saat dilimi.")
        if len({d.id for d in self.days}) != len(self.days):
            raise ValueError("Gün kimlikleri benzersiz olmalı.")
        if self.planning_status == "published" and not self.days:
            raise ValueError("Yayınlamak için en az bir antrenman gerekli.")
        if set(self.rest_dates) & {dt for d in self.days for dt in d.dates}:
            raise ValueError("Dinlenme gününe antrenman eklenemez.")
        end = self.start_date + timedelta(weeks=self.weeks)
        if any(not self.start_date <= dt < end for dt in self.rest_dates):
            raise ValueError("Dinlenme tarihleri program aralığında olmalı.")
        if any(not self.start_date <= dt < end for d in self.days for dt in d.dates):
            raise ValueError("Tarihler program aralığında olmalı.")
        return self


class PlanCreate(Strict):
    id: UUID
    tenant_id: Optional[str] = None
    content: PlanContent


class PlanEdit(Strict):
    expected_version: int = Field(ge=1)
    reason: str = Field(default="", max_length=1000)
    content: PlanContent


class Assign(Strict):
    athlete_ids: list[str] = Field(min_length=1, max_length=100)
    request_id: UUID
    start_date: Optional[date] = None
    allow_overlap: bool = False


class LinkInput(Strict):
    trainer_id: str
    athlete_id: str
    active: bool = True


class WorkoutStart(Strict):
    id: UUID
    plan_id: str
    session_key: UUID
    plan_version: Optional[int] = Field(default=None, ge=1)
    scheduled_date: date


class ActualSet(Strict):
    id: UUID
    exercise_key: UUID
    set_number: int = Field(ge=1, le=100)
    reps: Optional[int] = Field(default=None, ge=0, le=10000)
    kg: Optional[float] = Field(default=None, ge=0, le=2000)
    seconds: Optional[float] = Field(default=None, ge=0, le=86400)
    meters: Optional[float] = Field(default=None, ge=0, le=1000000)
    method: Literal["nfc", "manual"] = "manual"
    status: Literal["completed", "skipped"] = "completed"
    occurred_at: datetime
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def valid_actual(self):
        if not self.occurred_at.tzinfo:
            raise ValueError("Saat dilimi gerekli.")
        if self.occurred_at > now() + timedelta(minutes=5):
            raise ValueError("Gelecekte bir set kaydedilemez.")
        if (
            self.status == "completed"
            and self.reps is None
            and self.seconds is None
            and self.meters is None
        ):
            raise ValueError("Gerçekleşen miktar gerekli.")
        return self


class WorkoutCommand(Strict):
    request_id: UUID
    expected_version: int = Field(ge=1)
    action: Literal[
        "start",
        "pause",
        "resume",
        "set",
        "skip_exercise",
        "add_exercise",
        "reorder",
        "note",
        "finish",
        "skip",
        "cancel",
    ]
    actual_set: Optional[ActualSet] = None
    exercise: Optional[Target] = None
    exercise_key: Optional[UUID] = None
    order: Optional[list[UUID]] = None
    notes: str = Field(default="", max_length=4000)
    partial: bool = False
    occurred_at: Optional[datetime] = None

    @model_validator(mode="after")
    def valid_time(self):
        if self.occurred_at and (
            not self.occurred_at.tzinfo
            or self.occurred_at > now() + timedelta(minutes=5)
        ):
            raise ValueError("Geçerli işlem saati gerekli.")
        return self


class MessageInput(Strict):
    id: UUID
    link_id: str
    body: str = Field(min_length=1, max_length=4000)
    context_type: Literal["general", "workout", "report", "revision", "exercise"] = (
        "general"
    )
    context_id: Optional[str] = Field(default=None, max_length=80)


class WellnessInput(Strict):
    id: UUID
    kind: Literal["water", "coffee", "sleep", "wellbeing"]
    occurred_at: datetime
    amount: Optional[float] = Field(default=None, gt=0, le=10000)
    coffee_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    caffeine_mg: Optional[float] = Field(default=None, ge=0, le=2000)
    quality: Optional[int] = Field(default=None, ge=1, le=5)
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    fatigue: Optional[int] = Field(default=None, ge=1, le=5)
    recovery: Optional[int] = Field(default=None, ge=1, le=5)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def valid_entry(self):
        if not self.occurred_at.tzinfo or self.occurred_at > now() + timedelta(
            minutes=5
        ):
            raise ValueError("Geçerli zaman damgası gerekli.")
        if self.kind in ("water", "coffee", "sleep") and self.amount is None:
            raise ValueError("Miktar gerekli (ml veya uyku dakikası).")
        if self.kind == "sleep" and self.amount > 1440:
            raise ValueError("Uyku süresi 24 saati aşamaz.")
        if self.kind == "coffee" and not self.coffee_type:
            raise ValueError("Kahve türü gerekli.")
        if self.kind == "wellbeing" and all(
            getattr(self, k) is None for k in ("energy", "mood", "fatigue", "recovery")
        ):
            raise ValueError("En az bir iyi yaşam ölçütü gerekli.")
        return self


class ConsentInput(Strict):
    trainer_id: str
    kind: Literal["water", "coffee", "sleep", "wellbeing"]
    allowed: bool


class EquipmentInput(Strict):
    id: UUID
    tag_id: Optional[str] = None
    name: str = Field(min_length=2, max_length=160)
    equipment_type: str = Field(min_length=2, max_length=80)
    exercise_ids: list[str] = Field(min_length=1, max_length=100)
    active: bool = True


class CoachingRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()

        async def handler(request):
            try:
                return await original(request)
            except IntegrityError as exc:
                raise HTTPException(
                    409,
                    "Eşzamanlı kayıt çakışması. Güncel veriyi alıp aynı işlemi yeniden dene.",
                ) from exc

        return handler


router = APIRouter(
    route_class=CoachingRoute, prefix="/api/console/coaching", tags=["coaching"]
)


def active_link(db, trainer, athlete, tenant=None):
    stmt = (
        select(CoachLink)
        .join(Tenant, Tenant.id == CoachLink.tenant_id)
        .join(
            TenantStaff,
            (TenantStaff.tenant_id == CoachLink.tenant_id)
            & (TenantStaff.account_id == CoachLink.trainer_id),
        )
        .join(
            Membership,
            (Membership.tenant_id == CoachLink.tenant_id)
            & (Membership.account_id == CoachLink.athlete_id),
        )
        .where(
            CoachLink.trainer_id == trainer,
            CoachLink.athlete_id == athlete,
            CoachLink.active.is_(True),
            Tenant.status == "active",
            TenantStaff.status == "active",
            TenantStaff.role.in_(COACH_ROLES),
            Membership.status == "active",
        )
    )
    if tenant:
        stmt = stmt.where(CoachLink.tenant_id == tenant)
    return db.scalar(stmt)


def athlete_access(db, actor, athlete):
    if actor.id != athlete and not active_link(db, actor.id, athlete):
        fail(403, "Bu sporcu için aktif antrenör ataman yok.")


def coaching_staff_access(db, account_id, tenant_id):
    return db.scalar(select(TenantStaff.id).join(Tenant, Tenant.id == TenantStaff.tenant_id).where(
        TenantStaff.tenant_id == tenant_id, TenantStaff.account_id == account_id,
        TenantStaff.status == "active", Tenant.status == "active", TenantStaff.role.in_(COACH_ROLES)
    )) is not None


def plan_access(db, actor, plan):
    if not plan:
        fail(404, "Program bulunamadı.")
    if plan.athlete_id:
        athlete_access(db, actor, plan.athlete_id)
        if actor.id != plan.athlete_id and (
            not plan.tenant_id
            or not active_link(db, actor.id, plan.athlete_id, plan.tenant_id)
        ):
            fail(403, "Tesis programına erişim yok.")
    elif plan.owner_id != actor.id or (plan.tenant_id and not coaching_staff_access(db, actor.id, plan.tenant_id)):
        fail(403, "Program için güncel antrenör yetkin yok.")


def shared_exercise_ids(db, actor):
    cache_key = ("coaching-exercise-access", actor.id)
    if cache_key in db.info:
        return db.info[cache_key]
    conditions = [CoachingPlan.athlete_id == actor.id]
    for link in db.scalars(
        select(CoachLink).where(
            CoachLink.trainer_id == actor.id, CoachLink.active.is_(True)
        )
    ):
        if active_link(db, actor.id, link.athlete_id, link.tenant_id):
            conditions.append(
                (CoachingPlan.athlete_id == link.athlete_id)
                & (CoachingPlan.tenant_id == link.tenant_id)
            )
    contents = db.scalars(
        select(PlanVersion.content)
        .join(
            CoachingPlan,
            (PlanVersion.plan_id == CoachingPlan.id)
            & (PlanVersion.version == CoachingPlan.version),
        )
        .where(or_(*conditions))
    )
    result = {
        e["exercise_id"]
        for content in contents
        for d in content["days"]
        for e in d["exercises"]
    }
    db.info[cache_key] = result
    return result


def visible_exercise(db, actor, exercise_id):
    e = db.get(LibraryExercise, exercise_id)
    if not e:
        fail(422, "Egzersiz kütüphanede bulunamadı.")
    if (
        e.owner_id
        and e.owner_id != actor.id
        and exercise_id not in shared_exercise_ids(db, actor)
    ):
        fail(422, "Egzersiz özel.")
    return e


def validate_exercises(db, actor, content):
    for d in content.days:
        for e in d.exercises:
            item = visible_exercise(db, actor, e.exercise_id).content
            for key in ("reps", "kg", "seconds", "meters"):
                if getattr(e, key) is not None and key not in item["measurements"]:
                    fail(422, "Bu egzersiz ölçüm türünü desteklemiyor: " + key)


def version_for(db, plan):
    return db.scalar(
        select(PlanVersion).where(
            PlanVersion.plan_id == plan.id, PlanVersion.version == plan.version
        )
    )


def plan_json(db, plan, current_version=None):
    v = current_version if current_version is not None else version_for(db, plan)
    return {
        "id": plan.id,
        "owner_id": plan.owner_id,
        "athlete_id": plan.athlete_id,
        "tenant_id": plan.tenant_id,
        "template_id": plan.template_id,
        "version": plan.version,
        "content": v.content,
    }


def workout_json(w):
    return {
        key: getattr(w, key)
        for key in (
            "id",
            "athlete_id",
            "plan_id",
            "plan_version",
            "session_key",
            "scheduled_date",
            "state",
            "version",
            "snapshot",
            "actual",
        )
    }


def report_json(r):
    return {
        "id": r.id,
        "athlete_id": r.athlete_id,
        "week": r.week,
        "timezone": r.timezone,
        "scope": r.scope,
        "status": r.status,
        "content": r.content,
    }


def notify(db, account_id, key, body, context_id):
    n = db.scalar(
        select(CoachingNotification).where(
            CoachingNotification.account_id == account_id,
            CoachingNotification.group_key == key,
        )
    )
    if n:
        n.body, n.read, n.created_at = body, False, now()
    else:
        db.add(
            CoachingNotification(
                account_id=account_id, group_key=key, body=body, context_id=context_id
            )
        )


@router.get("/library")
def library(
    q: str = Query(default="", max_length=120),
    muscle: str = "",
    equipment: str = "",
    favorite: bool = False,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    favorites = set(
        db.scalars(
            select(ExerciseFavorite.exercise_id).where(
                ExerciseFavorite.account_id == account.id
            )
        )
    )
    shared_ids = shared_exercise_ids(db, account)
    rows = db.scalars(
        select(LibraryExercise).where(
            or_(
                LibraryExercise.owner_id.is_(None),
                LibraryExercise.owner_id == account.id,
                LibraryExercise.id.in_(shared_ids),
            )
        )
    )
    return [
        {"id": e.id, **e.content, "media": library_media(e.id, e.owner_id, e.content.get("media")), "favorite": e.id in favorites}
        for e in rows
        if (
            not q
            or q.casefold() in json.dumps(e.content, ensure_ascii=False).casefold()
        )
        and (not muscle or e.content["muscle"] == muscle)
        and (not equipment or e.content["equipment"] == equipment)
        and (not favorite or e.id in favorites)
    ]


@router.post("/library", status_code=201)
def custom_exercise(
    payload: LibraryInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    e = LibraryExercise(id=uid(), owner_id=account.id, content=payload.model_dump())
    db.add(e)
    db.commit()
    return {"id": e.id, **e.content}


@router.post("/library/{exercise_id}/favorite")
def favorite_exercise(
    exercise_id: str,
    favorite: bool,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    visible_exercise(db, account, exercise_id)
    row = db.get(ExerciseFavorite, (account.id, exercise_id))
    if favorite and not row:
        db.add(ExerciseFavorite(account_id=account.id, exercise_id=exercise_id))
    if not favorite and row:
        db.delete(row)
    db.commit()
    return {"favorite": favorite}


@router.post("/tenants/{tenant_id}/assignments")
def assign_coach(
    tenant_id: str,
    payload: LinkInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    _tenant_access(db, tenant_id, account, {"owner", "admin"})
    trainer = db.scalar(
        select(TenantStaff).where(
            TenantStaff.tenant_id == tenant_id,
            TenantStaff.account_id == payload.trainer_id,
            TenantStaff.status == "active",
        )
    )
    member = db.scalar(
        select(Membership).where(
            Membership.tenant_id == tenant_id,
            Membership.account_id == payload.athlete_id,
            Membership.status == "active",
        )
    )
    if not trainer or trainer.role not in COACH_ROLES or not member or payload.trainer_id == payload.athlete_id:
        fail(422, "Aktif antrenör ve farklı bir aktif üye gerekli.")
    row = db.scalar(
        select(CoachLink).where(
            CoachLink.tenant_id == tenant_id,
            CoachLink.trainer_id == payload.trainer_id,
            CoachLink.athlete_id == payload.athlete_id,
        )
    )
    if row:
        row.active = payload.active
    else:
        row = CoachLink(
            tenant_id=tenant_id,
            trainer_id=payload.trainer_id,
            athlete_id=payload.athlete_id,
            active=payload.active,
        )
        db.add(row)
    db.commit()
    return {"id": row.id, **payload.model_dump()}


@router.get("/overview")
def overview(
    athlete_id: Optional[str] = None,
    include_workouts: bool = True,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    athlete = athlete_id or account.id
    athlete_access(db, account, athlete)
    # Validate every relationship in one query; do not perform one authorization
    # round trip per member, plan and report during a mobile sync.
    links = list(db.scalars(select(CoachLink)
        .join(Tenant, Tenant.id == CoachLink.tenant_id)
        .join(TenantStaff, (TenantStaff.tenant_id == CoachLink.tenant_id) & (TenantStaff.account_id == CoachLink.trainer_id))
        .join(Membership, (Membership.tenant_id == CoachLink.tenant_id) & (Membership.account_id == CoachLink.athlete_id))
        .where(or_(CoachLink.trainer_id == account.id, CoachLink.athlete_id == account.id),
               CoachLink.active.is_(True), Tenant.status == "active", TenantStaff.status == "active",
               TenantStaff.role.in_(COACH_ROLES), Membership.status == "active")))
    authorized_tenants = {l.tenant_id for l in links if l.trainer_id == account.id and l.athlete_id == athlete}
    template_tenants = set(db.scalars(select(TenantStaff.tenant_id).join(Tenant, Tenant.id == TenantStaff.tenant_id).where(
        TenantStaff.account_id == account.id, TenantStaff.status == "active", Tenant.status == "active", TenantStaff.role.in_(COACH_ROLES))))
    related = {
        l.athlete_id if l.trainer_id == account.id else l.trainer_id for l in links
    }
    names = (
        {
            a.id: a.name
            for a in db.scalars(select(Account).where(Account.id.in_(related)))
        }
        if related
        else {}
    )
    plans = list(db.scalars(select(CoachingPlan).where(or_(
        CoachingPlan.athlete_id == athlete,
        (CoachingPlan.owner_id == account.id) & CoachingPlan.athlete_id.is_(None),
    ))))
    plans = [p for p in plans if (
        not p.athlete_id and (not p.tenant_id or p.tenant_id in template_tenants)
    ) or p.athlete_id == account.id or p.tenant_id in authorized_tenants]
    visible_plan_ids = {p.id for p in plans if p.athlete_id == athlete}
    versions = {v.plan_id: v for v in db.scalars(select(PlanVersion).join(CoachingPlan,
        (CoachingPlan.id == PlanVersion.plan_id) & (CoachingPlan.version == PlanVersion.version)
    ).where(CoachingPlan.id.in_([p.id for p in plans])))}
    workouts = list(
        db.scalars(
            select(Workout)
            .where(Workout.athlete_id == athlete, Workout.plan_id.in_(visible_plan_ids))
            .order_by(Workout.scheduled_date.desc())
        )
    ) if include_workouts else []
    reports = db.scalars(
        select(WeeklyReport)
        .where(WeeklyReport.athlete_id == athlete)
        .order_by(WeeklyReport.week.desc())
    )
    messages = db.scalars(
        select(CoachingMessage)
        .where(CoachingMessage.link_id.in_([l.id for l in links]))
        .order_by(CoachingMessage.created_at.desc())
        .limit(200)
    )
    notifications = db.scalars(
        select(CoachingNotification)
        .where(CoachingNotification.account_id == account.id)
        .order_by(CoachingNotification.created_at.desc())
        .limit(100)
    )
    consents = list(
        db.scalars(select(WellnessConsent).where(WellnessConsent.account_id == athlete))
    )
    allowed = {c.kind for c in consents if c.trainer_id == account.id and c.allowed}
    wellness = (
        db.scalars(
            select(PrivateWellness)
            .where(PrivateWellness.account_id == athlete)
            .order_by(PrivateWellness.occurred_at.desc())
            .limit(366)
        )
        if athlete == account.id
        else db.scalars(
            select(PrivateWellness)
            .where(
                PrivateWellness.account_id == athlete, PrivateWellness.kind.in_(allowed)
            )
            .order_by(PrivateWellness.occurred_at.desc())
            .limit(366)
        )
    )
    member_tenants = set(
        db.scalars(
            select(Membership.tenant_id)
            .join(Tenant, Tenant.id == Membership.tenant_id)
            .where(
                Membership.account_id == account.id,
                Membership.status == "active",
                Tenant.status == "active",
            )
        )
    )
    equipment = list(
        db.scalars(select(Equipment).where(Equipment.tenant_id.in_(member_tenants)))
    )
    pref = db.get(WellnessPreference, athlete)
    return {
        "water_goal_ml": pref.water_goal_ml if pref and athlete == account.id else 2000,
        "timezone": pref.timezone if pref else "Europe/Istanbul",
        "equipment": [
            {
                "id": e.id,
                "tenant_id": e.tenant_id,
                "tag_id": e.tag_id,
                "name": e.name,
                "exercise_ids": e.exercise_ids,
                "active": e.active,
            }
            for e in equipment
        ],
        "account_id": account.id,
        "athlete_id": athlete,
        "links": [
            {
                "id": l.id,
                "tenant_id": l.tenant_id,
                "trainer_id": l.trainer_id,
                "athlete_id": l.athlete_id,
                "name": names.get(
                    l.athlete_id if l.trainer_id == account.id else l.trainer_id, ""
                ),
            }
            for l in links
        ],
        "plans": [plan_json(db, p, versions[p.id]) for p in plans],
        "workouts": [workout_json(w) for w in workouts],
        "reports": [
            report_json(r)
            for r in reports
            if athlete == account.id
            or (r.scope != "all" and r.scope in authorized_tenants)
        ],
        "messages": [
            {
                "id": m.id,
                "link_id": m.link_id,
                "author_id": m.author_id,
                "body": m.body,
                "context_type": m.context_type,
                "context_id": m.context_id,
                "read_at": m.read_at,
                "created_at": m.created_at,
            }
            for m in messages
        ],
        "notifications": [
            {"id": n.id, "body": n.body, "context_id": n.context_id, "read": n.read}
            for n in notifications
        ],
        "wellness": [
            {
                "id": w.id,
                "kind": w.kind,
                "occurred_at": w.occurred_at,
                "content": w.content,
            }
            for w in wellness
        ],
        "consents": [
            {"trainer_id": c.trainer_id, "kind": c.kind, "allowed": c.allowed}
            for c in consents
            if athlete == account.id or c.trainer_id == account.id
        ],
    }


@router.post("/plans", status_code=201)
def create_plan(
    payload: PlanCreate,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    if payload.tenant_id:
        _tenant_access(db, payload.tenant_id, account, COACH_ROLES)
    elif not db.scalar(select(Membership.id).join(Tenant, Tenant.id == Membership.tenant_id).where(
        Membership.account_id == account.id, Membership.status == "active", Tenant.status == "active"
    )):
        fail(403, "Kişisel program oluşturmak için aktif kulüp üyeliği gerekli.")
    validate_exercises(db, account, payload.content)
    old = db.get(CoachingPlan, str(payload.id))
    if old:
        if old.owner_id != account.id or version_for(
            db, old
        ).content != payload.content.model_dump(mode="json"):
            fail(409, "Program kimliği daha önce kullanılmış.")
        return plan_json(db, old)
    p = CoachingPlan(
        id=str(payload.id),
        owner_id=account.id,
        athlete_id=None if payload.tenant_id else account.id,
        tenant_id=payload.tenant_id,
    )
    db.add(p)
    db.flush()
    db.add(
        PlanVersion(
            plan_id=p.id,
            version=1,
            actor_id=account.id,
            actor_role="trainer" if payload.tenant_id else "athlete",
            content=payload.content.model_dump(mode="json"),
        )
    )
    db.commit()
    return plan_json(db, p)


@router.post("/plans/{plan_id}/assign", status_code=201)
def assign_plan(
    plan_id: str,
    payload: Assign,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    from uuid import uuid5

    p = db.get(CoachingPlan, plan_id)
    plan_access(db, account, p)
    if p.athlete_id or not p.tenant_id or p.owner_id != account.id:
        fail(422, "Yalnızca kendi tesis şablonunu atayabilirsin.")
    source = version_for(db, p).content
    if source.get("planning_status", "published") != "published":
        fail(422, "Yalnızca yayınlanmış program atanabilir.")
    for a in set(payload.athlete_ids):
        if not active_link(db, account.id, a, p.tenant_id):
            fail(403, "Yalnızca atanmış sporcularına program atayabilirsin.")
    result = []
    for a in dict.fromkeys(payload.athlete_ids):
        assigned_id = str(uuid5(payload.request_id, a))
        copy = db.get(CoachingPlan, assigned_id)
        if copy:
            if (
                copy.template_id != p.id
                or copy.athlete_id != a
                or copy.owner_id != account.id
            ):
                fail(409, "Atama kimliği çakıştı.")
            initial = db.scalar(select(PlanVersion).where(PlanVersion.plan_id == copy.id, PlanVersion.version == 1)).content
            if payload.start_date and initial["start_date"] != payload.start_date.isoformat():
                fail(409, "Aynı atama kimliği farklı başlangıç tarihiyle kullanılamaz.")
        else:
            content = json.loads(json.dumps(version_for(db, p).content))
            if payload.start_date:
                shift = payload.start_date - date.fromisoformat(content["start_date"])
                content["start_date"] = payload.start_date.isoformat()
                for day in content["days"]:
                    day["dates"] = [(date.fromisoformat(dt) + shift).isoformat() for dt in day["dates"]]
                content["rest_dates"] = [(date.fromisoformat(dt) + shift).isoformat() for dt in content.get("rest_dates", [])]
                content = PlanContent.model_validate(content).model_dump(mode="json")
            content["rest_dates"] = [
                (date.fromisoformat(dt) + (payload.start_date - date.fromisoformat(source["start_date"]) if payload.start_date else timedelta())).isoformat()
                for dt in source.get("rest_dates", [])
            ]
            first = date.fromisoformat(content["start_date"])
            last = first + timedelta(weeks=content["weeks"])
            if not payload.allow_overlap:
                for existing in db.scalars(select(CoachingPlan).where(
                    CoachingPlan.athlete_id == a, CoachingPlan.tenant_id == p.tenant_id
                )):
                    prior = version_for(db, existing).content
                    prior_start = date.fromisoformat(prior["start_date"])
                    if prior.get("planning_status", "published") == "published" and prior_start < last and first < prior_start + timedelta(weeks=prior["weeks"]):
                        fail(409, "Üyenin çakışan programı var. Mevcut programı koruyarak eklemek için çakışmayı onayla.")
            copy = CoachingPlan(
                id=assigned_id,
                owner_id=account.id,
                athlete_id=a,
                tenant_id=p.tenant_id,
                template_id=p.id,
            )
            db.add(copy)
            db.flush()
            db.add(
                PlanVersion(
                    plan_id=copy.id,
                    version=1,
                    actor_id=account.id,
                    actor_role="trainer",
                    content=content,
                )
            )
            notify(
                db, a, "assigned:" + copy.id, "Yeni antrenman programın hazır.", copy.id
            )
        result.append(copy)
    db.commit()
    return [plan_json(db, p) for p in result]


@router.get("/plans/{plan_id}/versions")
def versions(
    plan_id: str, account: Account = Depends(get_account), db: Session = Depends(get_db)
):
    p = db.get(CoachingPlan, plan_id)
    plan_access(db, account, p)
    return [
        {
            "id": v.id,
            "plan_id": v.plan_id,
            "version": v.version,
            "actor_id": v.actor_id,
            "actor_role": v.actor_role,
            "reason": v.reason,
            "review_status": v.review_status,
            "reviewed_by": v.reviewed_by,
            "reviewed_at": v.reviewed_at,
            "content": v.content,
            "previous": v.previous,
            "created_at": v.created_at,
        }
        for v in db.scalars(
            select(PlanVersion)
            .where(PlanVersion.plan_id == plan_id)
            .order_by(PlanVersion.version)
        )
    ]


@router.patch("/plans/{plan_id}")
def edit_plan(
    plan_id: str,
    payload: PlanEdit,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    p = db.get(CoachingPlan, plan_id)
    plan_access(db, account, p)
    old = version_for(db, p).content
    if p.athlete_id and old.get("planning_status") == "archived":
        fail(409, "İptal edilmiş atama düzenlenemez. Gerekirse yeni bir atama oluştur.")
    validate_exercises(db, account, payload.content)
    new = payload.content.model_dump(mode="json")
    if p.athlete_id and new["planning_status"] != "published":
        fail(422, "Atanmış program yayınlanmış kalmalı.")
    # Freeze all dates through today in the original program timezone. Past and current session targets are historical.
    today = now().astimezone(ZoneInfo(old["timezone"])).date().isoformat()
    historical = lambda data: sorted(
        [
            json.dumps(
                {
                    "day": d["id"],
                    "name": d["name"],
                    "date": dt,
                    "exercises": d["exercises"],
                },
                sort_keys=True,
            )
            for d in data["days"]
            for dt in d["dates"]
            if dt <= today
        ]
    )
    if p.athlete_id and (
        old["timezone"] != new["timezone"] or historical(old) != historical(new)
    ):
        fail(
            409,
            "Bugün ve geçmiş seanslar korunmalı; yalnızca gelecek tarihleri değiştir.",
        )
    changed = db.execute(
        update(CoachingPlan)
        .where(
            CoachingPlan.id == p.id, CoachingPlan.version == payload.expected_version
        )
        .values(version=payload.expected_version + 1)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        fail(409, "Program başka bir cihazda değişti. Yenileyip tekrar dene.")
    athlete_edit = p.athlete_id == account.id and p.owner_id != account.id
    db.add(
        PlanVersion(
            plan_id=p.id,
            version=payload.expected_version + 1,
            actor_id=account.id,
            actor_role="athlete" if p.athlete_id == account.id else "trainer",
            content=new,
            previous=old,
            reason=payload.reason,
            review_status="unreviewed" if athlete_edit else "reviewed",
        )
    )
    if p.athlete_id:
        recipients = (
            [
                l.trainer_id
                for l in db.scalars(
                    select(CoachLink).where(
                        CoachLink.athlete_id == p.athlete_id,
                        CoachLink.tenant_id == p.tenant_id,
                        CoachLink.active.is_(True),
                    )
                )
            ]
            if athlete_edit
            else [p.athlete_id]
        )
        for recipient in recipients:
            notify(
                db,
                recipient,
                "revision:" + p.id,
                "Programın gelecek seansları güncellendi.",
                p.id,
            )
    db.commit()
    db.refresh(p)
    return plan_json(db, p)


@router.post("/plans/{plan_id}/versions/{version}/review")
def review_version(
    plan_id: str,
    version: int,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    p = db.get(CoachingPlan, plan_id)
    plan_access(db, account, p)
    if (
        not p.athlete_id
        or not p.tenant_id
        or account.id == p.athlete_id
        or not active_link(db, account.id, p.athlete_id, p.tenant_id)
    ):
        fail(403, "Antrenör incelemesi gerekli.")
    v = db.scalar(
        select(PlanVersion).where(
            PlanVersion.plan_id == plan_id, PlanVersion.version == version
        )
    )
    if not v:
        fail(404, "Sürüm bulunamadı.")
    v.review_status = "reviewed"
    v.reviewed_by = account.id
    v.reviewed_at = now()
    db.commit()
    return {"review_status": "reviewed"}


@router.post("/workouts", status_code=201)
def start_workout(
    payload: WorkoutStart,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    p = db.get(CoachingPlan, payload.plan_id)
    plan_access(db, account, p)
    if p.athlete_id != account.id:
        fail(403, "Yalnızca kendi antrenmanını başlatabilirsin.")
    old = db.get(Workout, str(payload.id))
    if old:
        if (old.athlete_id, old.plan_id, old.session_key, old.scheduled_date) != (
            account.id,
            p.id,
            str(payload.session_key),
            payload.scheduled_date.isoformat(),
        ) or (
            payload.plan_version is not None
            and old.plan_version != payload.plan_version
        ):
            fail(409, "Antrenman kimliği çakıştı.")
        return workout_json(old)
    # Serialize new session creation with cancellation on the same plan (including SQLite).
    held = db.execute(update(CoachingPlan).where(CoachingPlan.id==p.id,CoachingPlan.version==p.version)
        .values(version=p.version).execution_options(synchronize_session=False))
    if held.rowcount!=1:fail(409,"Program değişti. Güncel atamayı yeniden yükle.")
    require_active_plan_membership(db, p)
    v = version_for(db, p)
    if v.content.get("planning_status", "published") != "published":
        fail(409,"Bu program ataması artık aktif değil. Yeni seans başlatılamaz.")
    day = next(
        (
            d
            for d in v.content["days"]
            if d["id"] == str(payload.session_key)
            and payload.scheduled_date.isoformat() in d["dates"]
        ),
        None,
    )
    if not day:
        fail(422, "Programda bu seans bulunamadı.")
    if payload.plan_version is not None and payload.plan_version != p.version:
        fail(
            409,
            "Program çevrimdışıyken değişti; yerel antrenmanın korunuyor. Yeni sürümle uzlaştır.",
        )
    existing = db.scalar(
        select(Workout).where(
            Workout.plan_id == p.id,
            Workout.session_key == str(payload.session_key),
            Workout.scheduled_date == payload.scheduled_date.isoformat(),
        )
    )
    if existing:
        return workout_json(existing)
    snapshot = json.loads(json.dumps(day))
    for e in snapshot["exercises"]:
        entry = db.get(LibraryExercise, e["exercise_id"])
        # An assigned private custom exercise is readable via the immutable plan snapshot, not the global library.
        e["name"] = entry.content["name"] if entry else e["exercise_id"]
        e["measurements"] = (
            entry.content["measurements"]
            if entry
            else ["reps", "kg", "seconds", "meters"]
        )
    w = Workout(
        id=str(payload.id),
        athlete_id=account.id,
        plan_id=p.id,
        plan_version=p.version,
        session_key=str(payload.session_key),
        scheduled_date=payload.scheduled_date.isoformat(),
        snapshot=snapshot,
        actual={
            "sets": [],
            "added": [],
            "skipped": [],
            "order": [e["id"] for e in snapshot["exercises"]],
            "notes": "",
        },
    )
    db.add(w)
    db.commit()
    return workout_json(w)


def require_active_plan_membership(db, p):
    if not p.tenant_id:
        return
    tenant = db.get(Tenant, p.tenant_id)
    member = db.scalar(
        select(Membership).where(
            Membership.tenant_id == p.tenant_id,
            Membership.account_id == p.athlete_id,
            Membership.status == "active",
        )
    )
    if not tenant or tenant.status != "active" or not member:
        fail(403, "Program için aktif tesis üyeliği gerekli.")


TERMINAL = {"completed", "partial", "skipped", "cancelled"}


def apply_command(w, cmd, db=None, account=None):
    """Pure transition reducer; SQL handler uses compare-and-swap and immutable command receipts."""
    if w.state in TERMINAL:
        fail(409, "Tamamlanmış antrenman değiştirilemez.")
    actual = json.loads(json.dumps(w.actual))
    state = w.state
    at = cmd.occurred_at or now()

    def stop_clock():
        if actual.get("active_since"):
            started = datetime.fromisoformat(actual["active_since"])
            elapsed = (at - started).total_seconds()
            if elapsed < 0:
                fail(
                    409,
                    "Telefon saati antrenman sırasında geriye alınmış; kayıtları kontrol et.",
                )
            actual["active_seconds"] = actual.get("active_seconds", 0) + elapsed
            actual["active_since"] = None

    if cmd.action == "start":
        if state != "not_started":
            fail(409, "Antrenman zaten başladı.")
        state = "in_progress"
        actual["started_at"] = at.isoformat()
        actual["active_since"] = at.isoformat()
        actual["active_seconds"] = 0
    elif cmd.action == "pause":
        if state != "in_progress":
            fail(409, "Yalnızca süren antrenman duraklatılır.")
        state = "paused"
        stop_clock()
        actual["paused_at"] = at.isoformat()
    elif cmd.action == "resume":
        if state != "paused":
            fail(409, "Antrenman duraklatılmamış.")
        state = "in_progress"
        actual["active_since"] = at.isoformat()
    elif cmd.action in ("skip", "cancel"):
        state = "skipped" if cmd.action == "skip" else "cancelled"
        stop_clock()
        actual["finished_at"] = at.isoformat()
    else:
        if state != "in_progress":
            fail(409, "Önce antrenmanı başlat veya devam ettir.")
        exercises = w.snapshot["exercises"] + actual["added"]
        if cmd.action == "set":
            if not cmd.actual_set:
                fail(422, "Set bilgisi gerekli.")
            s = cmd.actual_set.model_dump(mode="json")
            e = next((e for e in exercises if e["id"] == s["exercise_key"]), None)
            if not e:
                fail(422, "Egzersiz bu antrenmanda değil.")
            for key in ("reps", "kg", "seconds", "meters"):
                if s[key] is not None and key not in e.get(
                    "measurements", ["reps", "kg", "seconds", "meters"]
                ):
                    fail(422, "Egzersiz ölçüm türü uyumsuz.")
            previous = next((x for x in actual["sets"] if x["id"] == s["id"]), None)
            if previous and (previous["exercise_key"], previous["set_number"]) != (
                s["exercise_key"],
                s["set_number"],
            ):
                fail(409, "Set kimliği başka egzersize taşınamaz.")
            if any(
                x["id"] != s["id"]
                and x["exercise_key"] == s["exercise_key"]
                and x["set_number"] == s["set_number"]
                for x in actual["sets"]
            ):
                fail(409, "Bu set zaten kaydedilmiş; mevcut seti düzenle.")
            actual["sets"] = [x for x in actual["sets"] if x["id"] != s["id"]] + [s]
        elif cmd.action == "skip_exercise":
            if not any(e["id"] == str(cmd.exercise_key) for e in exercises):
                fail(422, "Egzersiz bulunamadı.")
            actual["skipped"] = list(
                dict.fromkeys(actual["skipped"] + [str(cmd.exercise_key)])
            )
        elif cmd.action == "add_exercise":
            if not cmd.exercise:
                fail(422, "Egzersiz gerekli.")
            e = cmd.exercise.model_dump(mode="json")
            if any(x["id"] == e["id"] for x in exercises):
                fail(409, "Egzersiz kimliği zaten kullanılıyor.")
            entry = visible_exercise(db, account, e["exercise_id"])
            for key in ("reps", "kg", "seconds", "meters"):
                if e[key] is not None and key not in entry.content["measurements"]:
                    fail(422, "Ölçüm türü uyumsuz.")
            e.update(
                name=entry.content["name"], measurements=entry.content["measurements"]
            )
            actual["added"].append(e)
            actual["order"].append(e["id"])
        elif cmd.action == "reorder":
            order = [str(x) for x in cmd.order or []]
            if len(order) != len(exercises) or set(order) != {
                e["id"] for e in exercises
            }:
                fail(422, "Sıralama tüm egzersizleri bir kez içermeli.")
            actual["order"] = order
        elif cmd.action == "note":
            actual["notes"] = cmd.notes
        elif cmd.action == "finish":
            all_done = all(
                sum(
                    s["status"] == "completed" and s["exercise_key"] == e["id"]
                    for s in actual["sets"]
                )
                >= e["sets"]
                and e["id"] not in actual["skipped"]
                for e in w.snapshot["exercises"]
            )
            if not all_done and not cmd.partial:
                fail(409, "Eksik set var. Kısmi tamamlamayı seç.")
            state = "completed" if all_done else "partial"
            stop_clock()
            actual["finished_at"] = at.isoformat()
    return state, actual


@router.post("/workouts/{workout_id}/commands")
def workout_command(
    workout_id: str,
    payload: WorkoutCommand,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    w = db.get(Workout, workout_id)
    if not w or w.athlete_id != account.id:
        fail(403, "Bu antrenman sana ait değil.")
    plan_access(db, account, db.get(CoachingPlan, w.plan_id))
    fingerprint = digest(payload.model_dump(mode="json"))
    receipt = db.get(WorkoutEvent, str(payload.request_id))
    if receipt:
        if (
            receipt.workout_id != w.id
            or receipt.actor_id != account.id
            or receipt.fingerprint != fingerprint
        ):
            fail(409, "İstek kimliği başka veriyle kullanılmış.")
        return receipt.result
    require_active_plan_membership(db, db.get(CoachingPlan, w.plan_id))
    if w.version != payload.expected_version:
        fail(409, "Antrenman başka cihazda değişti. Yenileyip yeniden dene.")
    state, actual = apply_command(w, payload, db, account)
    row = db.execute(
        update(Workout)
        .where(Workout.id == w.id, Workout.version == payload.expected_version)
        .values(version=w.version + 1, state=state, actual=actual, updated_at=now())
        .execution_options(synchronize_session=False)
    )
    if row.rowcount != 1:
        fail(409, "Antrenman başka cihazda değişti.")
    db.refresh(w)
    result = workout_json(w)
    db.add(
        WorkoutEvent(
            id=str(payload.request_id),
            workout_id=w.id,
            actor_id=account.id,
            fingerprint=fingerprint,
            command=payload.model_dump(mode="json"),
            result=result,
        )
    )
    if state in ("completed", "partial"):
        for l in db.scalars(
            select(CoachLink).where(
                CoachLink.athlete_id == account.id, CoachLink.active.is_(True)
            )
        ):
            if active_link(db, l.trainer_id, account.id, l.tenant_id):
                notify(
                    db,
                    l.trainer_id,
                    "workout:" + w.id,
                    "Sporcun antrenmanını tamamladı.",
                    w.id,
                )
    db.commit()
    return result


@router.post("/tenants/{tenant_id}/equipment")
def save_equipment(
    tenant_id: str,
    payload: EquipmentInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    _tenant_access(db, tenant_id, account, {"owner", "admin"})
    for eid in payload.exercise_ids:
        visible_exercise(db, account, eid)
    if payload.tag_id:
        tag = db.get(NfcTag, payload.tag_id)
        if not tag or tag.tenant_id != tenant_id:
            fail(422, "Kart tesise ait değil.")
    row = db.get(Equipment, str(payload.id))
    if row and row.tenant_id != tenant_id:
        fail(403, "Ekipman başka tesise ait.")
    if not row:
        row = Equipment(id=str(payload.id), tenant_id=tenant_id)
        db.add(row)
    for key, value in payload.model_dump(exclude={"id"}).items():
        setattr(row, key, value)
    db.commit()
    return {"id": row.id, **payload.model_dump(mode="json")}


@router.get("/equipment/{tag_id}")
def resolve_equipment(
    tag_id: str,
    workout_id: Optional[str] = None,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    row = db.scalar(
        select(Equipment).where(Equipment.tag_id == tag_id, Equipment.active.is_(True))
    )
    tag = db.get(NfcTag, tag_id)
    if not row or not tag or not tag.active:
        fail(404, "Aktif ekipman eşleşmesi yok.")
    tenant = db.get(Tenant, row.tenant_id)
    member = db.scalar(
        select(Membership).where(
            Membership.tenant_id == row.tenant_id,
            Membership.account_id == account.id,
            Membership.status == "active",
        )
    )
    if not tenant or tenant.status != "active" or not member:
        fail(403, "Aktif tesis üyeliği gerekli.")
    matched = []
    if workout_id:
        w = db.get(Workout, workout_id)
        if not w or w.athlete_id != account.id:
            fail(403, "Antrenmana erişim yok.")
        matched = [
            e
            for e in w.snapshot["exercises"] + w.actual["added"]
            if e["exercise_id"] in row.exercise_ids
        ]
    return {
        "id": row.id,
        "name": row.name,
        "exercise_ids": row.exercise_ids,
        "matches": matched,
        "requires_confirmation": True,
    }


@router.post("/wellness", status_code=201)
def save_wellness(
    payload: WellnessInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    content = payload.model_dump(mode="json", exclude={"id", "occurred_at", "kind"})
    existing = db.get(PrivateWellness, str(payload.id))
    if existing:
        if (
            existing.account_id != account.id
            or existing.kind != payload.kind
            or existing.content != content
            or (
                existing.occurred_at.astimezone(timezone.utc)
                if existing.occurred_at.tzinfo
                else existing.occurred_at.replace(tzinfo=timezone.utc)
            )
            != payload.occurred_at.astimezone(timezone.utc)
        ):
            fail(409, "Kayıt kimliği çakıştı.")
        return {"id": existing.id}
    row = PrivateWellness(
        id=str(payload.id),
        account_id=account.id,
        kind=payload.kind,
        content=content,
        occurred_at=payload.occurred_at.astimezone(timezone.utc),
    )
    db.add(row)
    db.commit()
    return {"id": row.id}


@router.post("/wellness/consent")
def consent(
    payload: ConsentInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    if payload.allowed and not active_link(db, payload.trainer_id, account.id):
        fail(403, "Aktif antrenör ilişkisi gerekli.")
    row = db.get(WellnessConsent, (account.id, payload.trainer_id, payload.kind))
    if not row:
        row = WellnessConsent(
            account_id=account.id, trainer_id=payload.trainer_id, kind=payload.kind
        )
        db.add(row)
    row.allowed = payload.allowed
    db.commit()
    return payload.model_dump()


@router.post("/messages", status_code=201)
def message(
    payload: MessageInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    link = db.get(CoachLink, payload.link_id)
    if (
        not link
        or account.id not in (link.trainer_id, link.athlete_id)
        or not active_link(db, link.trainer_id, link.athlete_id, link.tenant_id)
    ):
        fail(403, "Aktif antrenör ilişkisi gerekli.")
    if payload.context_type != "general":
        if not payload.context_id:
            fail(422, "Bağlam kimliği gerekli.")
        if payload.context_type == "workout":
            ctx = db.get(Workout, payload.context_id)
            if (
                not ctx
                or ctx.athlete_id != link.athlete_id
                or db.get(CoachingPlan, ctx.plan_id).tenant_id != link.tenant_id
            ):
                fail(403, "Antrenman bu ilişkiye ait değil.")
        elif payload.context_type == "report":
            ctx = db.get(WeeklyReport, payload.context_id)
            if (
                not ctx
                or ctx.athlete_id != link.athlete_id
                or ctx.scope != link.tenant_id
            ):
                fail(403, "Rapor bu sporcuya ait değil.")
        elif payload.context_type == "revision":
            ctx = db.get(PlanVersion, payload.context_id)
            p = db.get(CoachingPlan, ctx.plan_id) if ctx else None
            if (
                not p
                or p.athlete_id != link.athlete_id
                or p.tenant_id != link.tenant_id
            ):
                fail(403, "Sürüm bu ilişkiye ait değil.")
        elif payload.context_type == "exercise":
            visible_exercise(db, account, payload.context_id)
    old = db.get(CoachingMessage, str(payload.id))
    if old:
        if (old.author_id, old.link_id, old.body, old.context_type, old.context_id) != (
            account.id,
            payload.link_id,
            payload.body,
            payload.context_type,
            payload.context_id,
        ):
            fail(409, "Mesaj kimliği çakıştı.")
        return {"id": old.id}
    db.add(
        CoachingMessage(
            id=str(payload.id),
            author_id=account.id,
            **payload.model_dump(exclude={"id"}),
        )
    )
    recipient = link.athlete_id if account.id == link.trainer_id else link.trainer_id
    notify(db, recipient, "message:" + link.id, "Yeni mesajın var.", link.id)
    db.commit()
    return {"id": str(payload.id)}


@router.post("/messages/{message_id}/read")
def read_message(
    message_id: str,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    m = db.get(CoachingMessage, message_id)
    l = db.get(CoachLink, m.link_id) if m else None
    if (
        not l
        or account.id not in (l.trainer_id, l.athlete_id)
        or not active_link(db, l.trainer_id, l.athlete_id, l.tenant_id)
    ):
        fail(403, "Mesaja erişim yok.")
    if m.author_id != account.id and m.read_at is None:
        m.read_at = now()
    db.commit()
    return {"read": True}


@router.post("/notifications/{notification_id}/read")
def read_notification(
    notification_id: str,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    n = db.get(CoachingNotification, notification_id)
    if not n or n.account_id != account.id:
        fail(403, "Bildirime erişim yok.")
    n.read = True
    db.commit()
    return {"read": True}


class ReportInput(Strict):
    tenant_id: Optional[str] = None
    week: date
    timezone: str = "Europe/Istanbul"

    @model_validator(mode="after")
    def valid_week(self):
        try:
            zone = ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Geçersiz saat dilimi.")
        if self.week.weekday() != 0:
            raise ValueError("Hafta pazartesi başlamalı.")
        if self.week + timedelta(days=7) > now().astimezone(zone).date():
            raise ValueError("Yalnızca bitmiş haftalar raporlanabilir.")
        return self


class ReviewInput(Strict):
    status: Literal["reviewed", "revision_recommended", "closed"]


@router.post("/athletes/{athlete_id}/reports")
def generate_report(
    athlete_id: str,
    payload: ReportInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    athlete_access(db, account, athlete_id)
    scope = payload.tenant_id or "all"
    if account.id != athlete_id and (
        scope == "all" or not active_link(db, account.id, athlete_id, scope)
    ):
        fail(403, "Antrenör raporu için atanmış tesis kapsamı gerekli.")
    old = db.scalar(
        select(WeeklyReport).where(
            WeeklyReport.scope == scope,
            WeeklyReport.athlete_id == athlete_id,
            WeeklyReport.week == payload.week.isoformat(),
            WeeklyReport.timezone == payload.timezone,
        )
    )
    end = payload.week + timedelta(days=7)
    start = payload.week.isoformat()
    stop = end.isoformat()
    scheduled = {}
    plans = list(
        db.scalars(select(CoachingPlan).where(CoachingPlan.athlete_id == athlete_id))
    )
    plans = [p for p in plans if scope == "all" or p.tenant_id == scope]
    for p in plans:
        history = list(
            db.scalars(
                select(PlanVersion)
                .where(PlanVersion.plan_id == p.id)
                .order_by(PlanVersion.version)
            )
        )
        # Revisions cannot rewrite past/today; choose a snapshot effective by that calendar day.
        for offset in range(7):
            dt = payload.week + timedelta(days=offset)
            cutoff = datetime.combine(
                dt + timedelta(days=1), datetime.min.time(), ZoneInfo(payload.timezone)
            )
            effective = [
                v
                for v in history
                if (
                    v.created_at
                    if v.created_at.tzinfo
                    else v.created_at.replace(tzinfo=timezone.utc)
                )
                < cutoff
            ]
            if not effective:
                continue
            for d in effective[-1].content["days"]:
                if dt.isoformat() in d["dates"]:
                    scheduled[(p.id, d["id"], dt.isoformat())] = d
    workouts = list(
        db.scalars(
            select(Workout).where(
                Workout.athlete_id == athlete_id,
                Workout.plan_id.in_([p.id for p in plans]),
                Workout.scheduled_date >= start,
                Workout.scheduled_date < stop,
            )
        )
    )
    for w in workouts:
        scheduled[(w.plan_id, w.session_key, w.scheduled_date)] = w.snapshot
    sets = [
        (s, w) for w in workouts for s in w.actual["sets"] if s["status"] == "completed"
    ]
    completed = sum(w.state == "completed" for w in workouts)
    targets = [e for d in scheduled.values() for e in d["exercises"]]
    planned_sets = sum(e["sets"] for e in targets)
    reps_target = sum(
        e["sets"] * e["reps"] for e in targets if e.get("reps") is not None
    )
    volume = sum(
        s["kg"] * s["reps"]
        for s, w in sets
        if s.get("kg") is not None and s.get("reps") is not None
    )
    skipped = sum(
        len(w.actual["skipped"])
        + sum(s["status"] == "skipped" for s in w.actual["sets"])
        for w in workouts
    )
    completed_planned = sum(
        sum(
            min(
                e["sets"],
                sum(
                    s["status"] == "completed" and s["exercise_key"] == e["id"]
                    for s in w.actual["sets"]
                ),
            )
            for e in w.snapshot["exercises"]
        )
        for w in workouts
    )
    changes = list(
        db.scalars(
            select(PlanVersion).where(
                PlanVersion.plan_id.in_([p.id for p in plans]), PlanVersion.version > 1
            )
        )
    )
    begin_time = datetime.combine(
        payload.week, datetime.min.time(), ZoneInfo(payload.timezone)
    )
    end_time = datetime.combine(end, datetime.min.time(), ZoneInfo(payload.timezone))
    changes = [
        v
        for v in changes
        if begin_time
        <= (
            v.created_at
            if v.created_at.tzinfo
            else v.created_at.replace(tzinfo=timezone.utc)
        )
        < end_time
    ]
    data = {
        "scheduled_sessions": len(scheduled),
        "completed_sessions": completed,
        "partial_sessions": sum(w.state == "partial" for w in workouts),
        "missed_sessions": sum(
            not any(
                (w.plan_id, w.session_key, w.scheduled_date) == key
                and w.state in ("completed", "partial")
                for w in workouts
            )
            for key in scheduled
        ),
        "completion_rate": completed / len(scheduled) if scheduled else None,
        "planned_exercises": len(targets),
        "planned_sets": planned_sets,
        "completed_sets": len(sets),
        "planned_reps": reps_target,
        "actual_reps": sum(s.get("reps") or 0 for s, w in sets),
        "recorded_volume_kg_reps": (
            volume
            if any(
                s.get("kg") is not None and s.get("reps") is not None for s, w in sets
            )
            else None
        ),
        "active_duration_seconds": (
            sum(
                w.actual["active_seconds"]
                for w in workouts
                if w.actual.get("active_seconds") is not None
            )
            if any(w.actual.get("active_seconds") is not None for w in workouts)
            else None
        ),
        "skipped_records": skipped,
        "added_exercises": sum(len(w.actual["added"]) for w in workouts),
        "set_adherence": (
            min(completed_planned / planned_sets, 1) if planned_sets else None
        ),
        "changes": [
            {
                "plan_id": v.plan_id,
                "version": v.version,
                "actor_role": v.actor_role,
                "reason": v.reason,
            }
            for v in changes
        ],
        "insufficient_data": not scheduled or not sets,
        "workouts": [workout_json(w) for w in workouts],
        "calculation_note": "Tamamlama ve planlı set uyumu ayrıdır. Eksik ağırlıklar sıfır kabul edilmez. Kahve suya eklenmez.",
    }
    if old and old.content == data:
        return report_json(old)
    if old:
        db.add(ReportSnapshot(report_id=old.id, status=old.status, content=old.content))
        old.content = data
        old.status = "awaiting_review"
        r = old
    else:
        r = WeeklyReport(
            athlete_id=athlete_id,
            scope=scope,
            week=start,
            timezone=payload.timezone,
            content=data,
        )
        db.add(r)
    db.flush()
    notify(db, athlete_id, "report:" + r.id, "Haftalık raporun hazır.", r.id)
    for l in db.scalars(
        select(CoachLink).where(
            CoachLink.athlete_id == athlete_id, CoachLink.active.is_(True)
        )
    ):
        if (
            scope != "all"
            and l.tenant_id == scope
            and active_link(db, l.trainer_id, athlete_id, l.tenant_id)
        ):
            notify(
                db,
                l.trainer_id,
                "report:" + r.id,
                "Haftalık rapor inceleme bekliyor.",
                r.id,
            )
    if data["missed_sessions"]:
        notify(
            db,
            athlete_id,
            "missed:" + start + ":" + scope,
            "Geçen haftaki bazı planlı seansların tamamlanmadı.",
            r.id,
        )
    db.commit()
    return report_json(r)


@router.post("/reports/{report_id}/review")
def review_report(
    report_id: str,
    payload: ReviewInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    r = db.get(WeeklyReport, report_id)
    if (
        not r
        or account.id == r.athlete_id
        or r.scope == "all"
        or not active_link(db, account.id, r.athlete_id, r.scope)
    ):
        fail(403, "Atanmış antrenör incelemesi gerekli.")
    fingerprint = digest(r.content)
    previous_review = db.scalar(
        select(CoachReview).where(
            CoachReview.report_id == r.id,
            CoachReview.reviewer_id == account.id,
            CoachReview.status == payload.status,
            CoachReview.fingerprint == fingerprint,
        )
    )
    if not previous_review:
        db.add(
            CoachReview(
                report_id=r.id,
                reviewer_id=account.id,
                status=payload.status,
                fingerprint=fingerprint,
            )
        )
    r.status = payload.status
    notify(
        db,
        r.athlete_id,
        "review:" + r.id,
        "Antrenörün haftalık raporunu inceledi.",
        r.id,
    )
    db.commit()
    return report_json(r)


def seed_catalog(db):
    entries = json.loads(
        (Path(__file__).parent / "data" / "exercise_catalog.json").read_text()
    )
    existing = set(
        db.scalars(
            select(LibraryExercise.id).where(
                LibraryExercise.id.in_([e["id"] for e in entries])
            )
        )
    )
    db.add_all(
        [
            LibraryExercise(
                id=e["id"], content={k: v for k, v in e.items() if k != "id"}
            )
            for e in entries
            if e["id"] not in existing
        ]
    )


@router.get("/dashboard")
def trainer_dashboard(
    account: Account = Depends(get_account), db: Session = Depends(get_db)
):
    staff = db.scalar(
        select(TenantStaff.id)
        .join(Tenant, Tenant.id == TenantStaff.tenant_id)
        .where(
            TenantStaff.account_id == account.id,
            TenantStaff.status == "active",
            Tenant.status == "active",
            TenantStaff.role.in_(COACH_ROLES),
        )
    )
    if staff is None:
        fail(
            403,
            "Antrenör alanı için aktif antrenör veya tesis yöneticisi yetkisi gerekli.",
        )
    links = [
        l
        for l in db.scalars(
            select(CoachLink).where(
                CoachLink.trainer_id == account.id, CoachLink.active.is_(True)
            )
        )
        if active_link(db, account.id, l.athlete_id, l.tenant_id)
    ]
    result = []
    for l in links:
        athlete = db.get(Account, l.athlete_id)
        plans = list(
            db.scalars(
                select(CoachingPlan).where(
                    CoachingPlan.athlete_id == l.athlete_id,
                    CoachingPlan.tenant_id == l.tenant_id,
                )
            )
        )
        plan_ids = [p.id for p in plans]
        workouts = list(
            db.scalars(select(Workout).where(Workout.plan_id.in_(plan_ids)))
        )
        changes = list(
            db.scalars(
                select(PlanVersion).where(
                    PlanVersion.plan_id.in_(plan_ids),
                    PlanVersion.review_status == "unreviewed",
                )
            )
        )
        messages = list(
            db.scalars(
                select(CoachingMessage).where(
                    CoachingMessage.link_id == l.id,
                    CoachingMessage.author_id != account.id,
                    CoachingMessage.read_at.is_(None),
                )
            )
        )
        reports = list(
            db.scalars(
                select(WeeklyReport).where(
                    WeeklyReport.athlete_id == l.athlete_id,
                    WeeklyReport.scope == l.tenant_id,
                    WeeklyReport.status == "awaiting_review",
                )
            )
        )
        scheduled = []
        for p in plans:
            c = version_for(db, p).content
            today = now().astimezone(ZoneInfo(c["timezone"])).date()
            monday = today - timedelta(days=today.weekday())
            scheduled.extend(
                (p.id, d["id"], dt)
                for d in c["days"]
                for dt in d["dates"]
                if monday.isoformat() <= dt <= today.isoformat()
            )
        complete = sum(
            any(
                w.plan_id == pid
                and w.session_key == day
                and w.scheduled_date == dt
                and w.state == "completed"
                for w in workouts
            )
            for pid, day, dt in scheduled
        )
        missed = sum(
            dt
            < now()
            .astimezone(
                ZoneInfo(version_for(db, db.get(CoachingPlan, pid)).content["timezone"])
            )
            .date()
            .isoformat()
            and not any(
                w.plan_id == pid
                and w.session_key == day
                and w.scheduled_date == dt
                and w.state in ("completed", "partial")
                for w in workouts
            )
            for pid, day, dt in scheduled
        )
        result.append(
            {
                "id": l.id,
                "athlete_id": l.athlete_id,
                "tenant_id": l.tenant_id,
                "name": athlete.name,
                "active_plans": sum(
                    version_for(db, p).content.get("planning_status", "published") == "published"
                    and date.fromisoformat(version_for(db, p).content["start_date"]) <= now().astimezone(ZoneInfo(version_for(db, p).content["timezone"])).date()
                    < date.fromisoformat(version_for(db, p).content["start_date"]) + timedelta(weeks=version_for(db, p).content["weeks"])
                    for p in plans
                ),
                "completion_rate": complete / len(scheduled) if scheduled else None,
                "missed": missed,
                "unreviewed_changes": len(changes),
                "unread_messages": len(messages),
                "pending_reports": len(reports),
                "recent_workouts": [
                    workout_json(w)
                    for w in sorted(
                        workouts, key=lambda w: w.scheduled_date, reverse=True
                    )[:5]
                ],
            }
        )
    return result


@router.get("/jobs/weekly-reports")
def scheduled_reports(
    authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)
):
    import os
    import secrets

    secret = os.getenv("CRON_SECRET", "")
    if len(secret) < 32:
        fail(503, "Haftalık rapor zamanlayıcısı yapılandırılmadı.")
    if not secrets.compare_digest(authorization or "", "Bearer " + secret):
        fail(401, "Zamanlayıcı yetkisi gerekli.")
    generated = []
    pairs = {
        (l.athlete_id, l.tenant_id)
        for l in db.scalars(select(CoachLink).where(CoachLink.active.is_(True)))
        if active_link(db, l.trainer_id, l.athlete_id, l.tenant_id)
    }
    for athlete_id, tenant_id in sorted(pairs):
        plans = list(
            db.scalars(
                select(CoachingPlan).where(
                    CoachingPlan.athlete_id == athlete_id,
                    CoachingPlan.tenant_id == tenant_id,
                )
            )
        )
        pref = db.get(WellnessPreference, athlete_id)
        zones = {pref.timezone if pref else "Europe/Istanbul"} if plans else set()
        for zone in zones:
            today = now().astimezone(ZoneInfo(zone)).date()
            monday = today - timedelta(days=today.weekday() + 7)
            r = generate_report(
                athlete_id,
                ReportInput(week=monday, timezone=zone, tenant_id=tenant_id),
                db.get(Account, athlete_id),
                db,
            )
            generated.append(r["id"])
    return {"reports": generated}


class WaterGoalInput(Strict):
    water_goal_ml: int = Field(gt=0, le=10000)


@router.post("/wellness/goal")
def water_goal(
    payload: WaterGoalInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    row = db.get(WellnessPreference, account.id)
    if not row:
        row = WellnessPreference(account_id=account.id)
        db.add(row)
    row.water_goal_ml = payload.water_goal_ml
    db.commit()
    return payload.model_dump()


@router.get("/tenants/{tenant_id}/equipment")
def list_equipment(
    tenant_id: str,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    _tenant_access(db, tenant_id, account)
    return [
        {
            "id": e.id,
            "tag_id": e.tag_id,
            "name": e.name,
            "equipment_type": e.equipment_type,
            "exercise_ids": e.exercise_ids,
            "active": e.active,
        }
        for e in db.scalars(select(Equipment).where(Equipment.tenant_id == tenant_id))
    ]


class AccountPreferencesInput(Strict):
    timezone: str = Field(min_length=1, max_length=80)

    @model_validator(mode="after")
    def valid_zone(self):
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Geçerli bir IANA saat dilimi gir.")
        return self


@router.post("/preferences")
def update_preferences(
    payload: AccountPreferencesInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    row = db.get(WellnessPreference, account.id)
    if not row:
        row = WellnessPreference(account_id=account.id)
        db.add(row)
    row.timezone = payload.timezone
    db.commit()
    return {"timezone": row.timezone}


@router.get("/jobs/daily-reminders")
def daily_reminders(
    authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)
):
    import os
    import secrets

    secret = os.getenv("CRON_SECRET", "")
    if len(secret) < 32:
        fail(503, "Günlük hatırlatıcı yapılandırılmadı.")
    if not secrets.compare_digest(authorization or "", "Bearer " + secret):
        fail(401, "Zamanlayıcı yetkisi gerekli.")
    delivered = []
    for plan in db.scalars(
        select(CoachingPlan).where(
            CoachingPlan.athlete_id.is_not(None), CoachingPlan.tenant_id.is_not(None)
        )
    ):
        links = [
            link
            for link in db.scalars(
                select(CoachLink).where(
                    CoachLink.athlete_id == plan.athlete_id,
                    CoachLink.tenant_id == plan.tenant_id,
                    CoachLink.active.is_(True),
                )
            )
            if active_link(db, link.trainer_id, link.athlete_id, link.tenant_id)
        ]
        if not links:
            continue
        content = version_for(db, plan).content
        yesterday = (
            now().astimezone(ZoneInfo(content["timezone"])).date() - timedelta(days=1)
        ).isoformat()
        for day in content["days"]:
            if yesterday not in day["dates"]:
                continue
            workout = db.scalar(
                select(Workout).where(
                    Workout.plan_id == plan.id,
                    Workout.session_key == day["id"],
                    Workout.scheduled_date == yesterday,
                )
            )
            if workout and workout.state in ("completed", "partial", "cancelled"):
                continue
            key = f"missed:{plan.id}:{day['id']}:{yesterday}"
            for recipient in {plan.athlete_id, *(link.trainer_id for link in links)}:
                if db.scalar(
                    select(CoachingNotification.id).where(
                        CoachingNotification.account_id == recipient,
                        CoachingNotification.group_key == key,
                    )
                ):
                    continue
                notify(
                    db,
                    recipient,
                    key,
                    f"{yesterday}: {content['name']} · {day['name']} seansı tamamlanmadı.",
                    plan.id,
                )
                delivered.append(recipient)
    db.commit()
    return {"notifications": len(delivered)}


class RefreshWorkoutInput(Strict):
    request_id: UUID
    expected_version: int = Field(ge=1)


@router.post("/workouts/{workout_id}/refresh-plan")
def refresh_prepared_workout(
    workout_id: str,
    payload: RefreshWorkoutInput,
    account: Account = Depends(get_account),
    db: Session = Depends(get_db),
):
    workout = db.get(Workout, workout_id)
    if not workout or workout.athlete_id != account.id:
        fail(404, "Antrenman bulunamadı.")
    fingerprint = digest({"action": "refresh_plan", **payload.model_dump(mode="json")})
    receipt = db.get(WorkoutEvent, str(payload.request_id))
    if receipt:
        if (
            receipt.workout_id != workout_id
            or receipt.actor_id != account.id
            or receipt.fingerprint != fingerprint
        ):
            fail(409, "İstek kimliği çakıştı.")
        return receipt.result
    plan = db.get(CoachingPlan, workout.plan_id)
    plan_access(db, account, plan)
    require_active_plan_membership(db, plan)
    if (
        workout.state != "not_started"
        or workout.actual.get("sets")
        or workout.actual.get("added")
        or workout.actual.get("notes")
        or workout.actual.get("started_at")
    ):
        fail(
            409,
            "Başlamış veya gerçekleşen kaydı olan antrenmanın hedefleri değiştirilemez.",
        )
    if workout.version != payload.expected_version:
        fail(409, "Antrenman başka bir cihazda değişti.")
    content = version_for(db, plan).content
    if (
        workout.scheduled_date
        <= now().astimezone(ZoneInfo(content["timezone"])).date().isoformat()
    ):
        fail(409, "Bugünkü ve geçmiş seansların hedefleri korunur.")
    candidates = [d for d in content["days"] if workout.scheduled_date in d["dates"]]
    day = next((d for d in candidates if d["id"] == workout.session_key), None)
    if day is None and len(candidates) == 1:
        day = candidates[0]
    if day is None:
        fail(
            409,
            "Seans yeni programda kaldırılmış veya belirsiz; programından yeni seansı seç.",
        )
    snapshot = json.loads(json.dumps(day))
    for exercise in snapshot["exercises"]:
        entry = db.get(LibraryExercise, exercise["exercise_id"])
        exercise["name"] = entry.content["name"] if entry else exercise["exercise_id"]
        exercise["measurements"] = (
            entry.content["measurements"]
            if entry
            else ["reps", "kg", "seconds", "meters"]
        )
    actual = {**workout.actual, "order": [e["id"] for e in snapshot["exercises"]]}
    changed = db.execute(
        update(Workout)
        .where(
            Workout.id == workout_id,
            Workout.version == payload.expected_version,
            Workout.state == "not_started",
        )
        .values(
            snapshot=snapshot,
            actual=actual,
            session_key=day["id"],
            plan_version=plan.version,
            version=payload.expected_version + 1,
            updated_at=now(),
        )
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        fail(409, "Antrenman başka bir cihazda değişti.")
    db.expire(workout)
    result = workout_json(workout)
    db.add(
        WorkoutEvent(
            id=str(payload.request_id),
            workout_id=workout_id,
            actor_id=account.id,
            fingerprint=fingerprint,
            command={"action": "refresh_plan", **payload.model_dump(mode="json")},
            result=result,
        )
    )
    db.commit()
    return result


class WorkoutTemplateInput(Strict):
    id: UUID
    tenant_id: str
    expected_version: Optional[int] = None
    content: PlannedDay


def workout_template_json(row):
    return {"id": row.id, "tenant_id": row.tenant_id, "version": row.version, "content": row.content}


@router.get("/workout-templates")
def workout_templates(tenant_id: str, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    _tenant_access(db, tenant_id, account, COACH_ROLES)
    return [workout_template_json(row) for row in db.scalars(select(WorkoutTemplate).where(
        WorkoutTemplate.tenant_id == tenant_id, WorkoutTemplate.owner_id == account.id))]


@router.post("/workout-templates", status_code=201)
def save_workout_template(payload: WorkoutTemplateInput, account: Account = Depends(get_account), db: Session = Depends(get_db)):
    _tenant_access(db, payload.tenant_id, account, COACH_ROLES)
    # Reuse the exact measurement/visibility validation used by plans.
    validate_exercises(db, account, type("Content", (), {"days": [payload.content]})())
    content = payload.content.model_dump(mode="json")
    row = db.get(WorkoutTemplate, str(payload.id))
    if row:
        if row.owner_id != account.id or row.tenant_id != payload.tenant_id:
            fail(403, "Antrenman şablonuna erişim yok.")
        if row.content == content:
            return workout_template_json(row)
        changed = db.execute(update(WorkoutTemplate).where(WorkoutTemplate.id == row.id,
            WorkoutTemplate.version == payload.expected_version).values(content=content, version=row.version + 1).execution_options(synchronize_session=False))
        if changed.rowcount != 1:
            fail(409, "Antrenman değişti. Yenileyip tekrar dene.")
    else:
        row = WorkoutTemplate(id=str(payload.id), tenant_id=payload.tenant_id, owner_id=account.id, content=content)
        db.add(row)
    db.commit()
    db.refresh(row)
    return workout_template_json(row)


@router.get("/trainer/members")
def trainer_member_page(
    tenant_id: str,
    q: str = Query(default="", max_length=160),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    review_filter: Literal["", "needs_program", "scheduled", "missed", "unreviewed_changes", "unread_messages", "pending_reports"] = "",
    attention: bool = False,
    sort: Literal["name", "attention", "completion", "programs"] = "name",
    direction: Literal["asc", "desc"] = "asc",
    athlete_id: Optional[str] = None,
    account: Account = Depends(get_account), db: Session = Depends(get_db),
):
    from trainer_workspace import member_page
    return member_page(db, account, tenant_id, q, page, page_size, review_filter, attention, sort, direction, athlete_id)


@router.get("/trainer/workouts")
def trainer_workout_page(tenant_id: str, athlete_id: str,
    page: int = Query(default=1,ge=1),page_size:int=Query(default=10,ge=1,le=50),
    from_date:Optional[date]=None,until:Optional[date]=None,plan_id:Optional[str]=None,
    state:Optional[Literal["not_started","in_progress","paused","completed","partial","skipped","cancelled"]]=None,
    workout_id:Optional[str]=None,account:Account=Depends(get_account),db:Session=Depends(get_db)):
    from trainer_workspace import workout_page
    return workout_page(db,account,tenant_id,athlete_id,page,page_size,
        from_date.isoformat() if from_date else None,until.isoformat() if until else None,plan_id,state,workout_id)


class CancelAssignment(Strict):
    expected_version:int=Field(ge=1)
    reason:str=Field(min_length=3,max_length=900)


@router.post('/plans/{plan_id}/cancel-assignment')
def trainer_cancel_assignment(plan_id:str,payload:CancelAssignment,
    account:Account=Depends(get_account),db:Session=Depends(get_db)):
    from trainer_assignments import cancel_assignment
    if len(payload.reason.strip())<3:fail(422,'İptal nedenini en az 3 karakterle yaz.')
    return cancel_assignment(db,account,plan_id,payload.expected_version,payload.reason)


@router.get('/trainer/assignment-history')
def trainer_assignment_history(tenant_id:str,athlete_id:str,page:int=Query(default=1,ge=1),
    page_size:int=Query(default=10,ge=1,le=50),account:Account=Depends(get_account),db:Session=Depends(get_db)):
    from trainer_assignments import assignment_history
    return assignment_history(db,account,tenant_id,athlete_id,page,page_size)
