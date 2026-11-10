"""Assignment audit and reversible future cancellation using existing immutable versions."""
import copy
from datetime import date, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import select, func, case, update, and_
from coaching import CoachingPlan, PlanVersion, Workout, now, fail, plan_json, active_link, notify
from tenant_console import Account
from trainer_workspace import require_staff

CANCEL_PREFIX = 'Atama iptali: '


def cancel_assignment(db,account,plan_id,expected_version,reason):
    plan=db.scalar(select(CoachingPlan).where(CoachingPlan.id==plan_id).with_for_update())
    if not plan or not plan.athlete_id or not plan.tenant_id:fail(404,'Üye ataması bulunamadı.')
    require_staff(db,account,plan.tenant_id)
    if account.id==plan.athlete_id or not active_link(db,account.id,plan.athlete_id,plan.tenant_id):
        fail(403,'Bu üyenin atamasını yönetme yetkin yok.')
    version=db.scalar(select(PlanVersion).where(PlanVersion.plan_id==plan.id,PlanVersion.version==plan.version))
    if plan.version!=expected_version:fail(409,'Atama değişti. Güncel durumu yeniden incele.')
    old=version.content
    if old.get('planning_status','published')!='published':fail(409,'Bu atama zaten aktif değil.')
    today=now().astimezone(ZoneInfo(old['timezone'])).date()
    if date.fromisoformat(old['start_date'])<=today:fail(409,'Başlamış veya geçmiş atama iptal edilemez; yalnızca gelecek seansları düzenleyebilirsin.')
    if db.scalar(select(Workout.id).where(Workout.plan_id==plan.id).limit(1)):
        fail(409,'Bu atamada antrenman kaydı var. Kayıtlar korunacağı için atama iptal edilemez.')
    changed=db.execute(update(CoachingPlan).where(CoachingPlan.id==plan.id,CoachingPlan.version==expected_version,
        ~select(Workout.id).where(Workout.plan_id==CoachingPlan.id).exists())
        .values(version=expected_version+1).execution_options(synchronize_session=False))
    if changed.rowcount!=1:fail(409,'Atama değişti veya antrenman kaydı oluştu. Yeniden yükle.')
    content=copy.deepcopy(old);content['planning_status']='archived'
    db.add(PlanVersion(plan_id=plan.id,version=expected_version+1,actor_id=account.id,actor_role='trainer',
        reason=CANCEL_PREFIX+reason.strip(),content=content,previous=old))
    notify(db,plan.athlete_id,'assignment-cancelled:'+plan.id,'Gelecek program ataman iptal edildi. Tamamlanan kayıtların korunur.',plan.id)
    db.commit();db.refresh(plan)
    return plan_json(db,plan)


def assignment_history(db,account,tenant_id,athlete_id,page=1,page_size=10):
    require_staff(db,account,tenant_id)
    if not active_link(db,account.id,athlete_id,tenant_id):fail(403,'Bu üye sana atanmış değil.')
    query=select(PlanVersion.id,PlanVersion.plan_id,PlanVersion.version,PlanVersion.actor_id,Account.name.label('actor_name'),
        PlanVersion.created_at,PlanVersion.reason,
        PlanVersion.content['name'].as_string().label('program_name'),
        PlanVersion.content['start_date'].as_string().label('start_date'),
        case((and_(PlanVersion.reason.startswith(CANCEL_PREFIX),PlanVersion.content['planning_status'].as_string()=='archived'),'cancelled'),(PlanVersion.version==1,'assigned'),else_='edited').label('event_type')).join(
        CoachingPlan,CoachingPlan.id==PlanVersion.plan_id).join(Account,Account.id==PlanVersion.actor_id).where(
        CoachingPlan.athlete_id==athlete_id,CoachingPlan.tenant_id==tenant_id)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    page=min(page,max(1,(total+page_size-1)//page_size))
    items=[dict(r) for r in db.execute(query.order_by(PlanVersion.created_at.desc(),PlanVersion.version.desc(),PlanVersion.id)
        .offset((page-1)*page_size).limit(page_size)).mappings()]
    for row in items:
        stamp=row['created_at']
        row['created_at']=(stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
    return dict(items=items,total=total,page=page,page_size=page_size)
