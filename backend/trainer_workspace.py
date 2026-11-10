"""Scoped SQL aggregates and bounded Trainer pages. No complete member/history hydration."""
from collections import defaultdict
from datetime import date, timedelta
import unicodedata
from zoneinfo import ZoneInfo
from sqlalchemy import select, func, case, cast, String, Integer, Date, true, and_
from sqlalchemy.dialects.postgresql import JSONB
from coaching import (CoachLink, CoachingPlan, PlanVersion, Workout, CoachingMessage,
                      WeeklyReport, COACH_ROLES, now, fail, workout_json, active_link)
from tenant_console import Account, Tenant, TenantStaff, Membership


def fold(value):
    value = value.replace('ı', 'i').replace('İ', 'i').casefold()
    return ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c))


def require_staff(db, account, tenant_id):
    if not db.scalar(select(TenantStaff.id).join(Tenant, Tenant.id == TenantStaff.tenant_id).where(
            TenantStaff.tenant_id == tenant_id, TenantStaff.account_id == account.id,
            TenantStaff.status == 'active', Tenant.status == 'active', TenantStaff.role.in_(COACH_ROLES))):
        fail(403, 'Bu kulübün antrenör çalışma alanına erişimin yok.')


def authorized_members(account, tenant_id):
    return select(CoachLink.id, CoachLink.athlete_id, CoachLink.tenant_id, Account.name).join(
        Account, Account.id == CoachLink.athlete_id).join(Membership,
        (Membership.account_id == CoachLink.athlete_id) & (Membership.tenant_id == CoachLink.tenant_id)).where(
        CoachLink.tenant_id == tenant_id, CoachLink.trainer_id == account.id,
        CoachLink.active.is_(True), Membership.status == 'active').cte('authorized')


def member_metrics(db, account, tenant_id):
    """Every search/filter/count/sort/page is executed by the database, including JSON schedules."""
    sqlite = db.bind.dialect.name == 'sqlite'
    clock = now()
    if sqlite:
        connection = db.connection().connection.driver_connection
        connection.create_function('trainer_fold', 1, fold, deterministic=True)
        connection.create_function('trainer_today', 1, lambda tz: clock.astimezone(ZoneInfo(tz)).date().isoformat(), deterministic=True)
        connection.create_function('trainer_monday', 1, lambda tz: (
            clock.astimezone(ZoneInfo(tz)).date()-timedelta(days=clock.astimezone(ZoneInfo(tz)).weekday())).isoformat(), deterministic=True)
    members = authorized_members(account, tenant_id)
    content = PlanVersion.content
    start = content['start_date'].as_string()
    weeks = content['weeks'].as_integer()
    tz = content['timezone'].as_string()
    today = func.trainer_today(tz) if sqlite else cast(cast(func.timezone(tz, clock), Date), String)
    monday = func.trainer_monday(tz) if sqlite else cast(cast(func.date_trunc('week',func.timezone(tz, clock)), Date), String)
    end = func.date(start, func.printf('+%d days',weeks*7)) if sqlite else cast(cast(start, Date)+weeks*7, String)
    plans = select(CoachingPlan.id, CoachingPlan.athlete_id, content.label('content'), start.label('start'),
        end.label('end'), today.label('today'), monday.label('monday'),
        (func.coalesce(content['planning_status'].as_string(),'published')=='published').label('published')).join(
        PlanVersion, (PlanVersion.plan_id==CoachingPlan.id)&(PlanVersion.version==CoachingPlan.version)).join(
        members, members.c.athlete_id==CoachingPlan.athlete_id).where(CoachingPlan.tenant_id==tenant_id).cte('plans')
    p = plans.c
    aggregate = select(p.athlete_id,
        func.sum(case((and_(p.published,p.start<=p.today,p.end>p.today),1),else_=0)).label('active_plans'),
        func.sum(case((and_(p.published,p.start>p.today),1),else_=0)).label('upcoming_plans'),
        func.min(case((and_(p.published,p.start>p.today),p.start),else_=None)).label('next_start_date')).group_by(p.athlete_id).cte('program_counts')
    if sqlite:
        days=func.json_each(p.content,'$.days').table_valued('key','value',joins_implicitly=True).alias('days')
        dates=func.json_each(days.c.value,'$.dates').table_valued('key','value',joins_implicitly=True).alias('dates')
        day_id=func.json_extract(days.c.value,'$.id')
    else:
        days=func.jsonb_array_elements(cast(p.content,JSONB)['days']).table_valued('value',joins_implicitly=True).alias('days')
        dates=func.jsonb_array_elements_text(cast(days.c.value,JSONB)['dates']).table_valued('value',joins_implicitly=True).alias('dates')
        day_id=cast(days.c.value,JSONB)['id'].astext
    recorded=select(Workout.plan_id,Workout.session_key,Workout.scheduled_date,
        func.max(case((Workout.state=='completed',1),else_=0)).label('complete'),
        func.max(case((Workout.state.in_(['completed','partial']),1),else_=0)).label('attended')).join(
        plans,plans.c.id==Workout.plan_id).where(Workout.scheduled_date>=p.monday,Workout.scheduled_date<=p.today).group_by(
        Workout.plan_id,Workout.session_key,Workout.scheduled_date).cte('recorded')
    weekly=select(p.athlete_id,func.count().label('scheduled'),
        func.sum(func.coalesce(recorded.c.complete,0)).label('completed'),
        func.sum(case((and_(dates.c.value<p.today,func.coalesce(recorded.c.attended,0)==0),1),else_=0)).label('missed')).select_from(
        plans.join(days,true()).join(dates,true()).outerjoin(recorded,
        (recorded.c.plan_id==p.id)&(recorded.c.session_key==day_id)&(recorded.c.scheduled_date==dates.c.value))).where(
        p.published, dates.c.value>=p.monday,dates.c.value<=p.today).group_by(p.athlete_id)
    weekly=weekly.cte('weekly_counts')
    changed=select(p.athlete_id,func.count(PlanVersion.id).label('unreviewed_changes')).join(
        PlanVersion,PlanVersion.plan_id==p.id).where(PlanVersion.review_status=='unreviewed').group_by(p.athlete_id).cte('changed')
    unread=select(CoachingMessage.link_id,func.count().label('unread_messages')).join(members,members.c.id==CoachingMessage.link_id).where(
        CoachingMessage.author_id!=account.id,CoachingMessage.read_at.is_(None)).group_by(CoachingMessage.link_id).cte('unread')
    reports=select(WeeklyReport.athlete_id,func.count().label('pending_reports')).join(members,members.c.athlete_id==WeeklyReport.athlete_id).where(
        WeeklyReport.scope==tenant_id,WeeklyReport.status=='awaiting_review').group_by(WeeklyReport.athlete_id).cte('reports')
    active=func.coalesce(aggregate.c.active_plans,0);upcoming=func.coalesce(aggregate.c.upcoming_plans,0)
    missed=func.coalesce(weekly.c.missed,0);changes=func.coalesce(changed.c.unreviewed_changes,0)
    messages=func.coalesce(unread.c.unread_messages,0);pending=func.coalesce(reports.c.pending_reports,0)
    needs=and_(active==0,upcoming==0)
    metrics=select(members,active.label('active_plans'),upcoming.label('upcoming_plans'),aggregate.c.next_start_date,
        case((active>0,'active'),(upcoming>0,'scheduled'),else_='needs_program').label('program_state'),
        (weekly.c.completed*1.0/func.nullif(weekly.c.scheduled,0)).label('completion_rate'),
        missed.label('missed'),changes.label('unreviewed_changes'),messages.label('unread_messages'),pending.label('pending_reports'),
        (case((needs,1),else_=0)+missed+changes+messages+pending).label('attention_count')).select_from(
        members.outerjoin(aggregate,aggregate.c.athlete_id==members.c.athlete_id).outerjoin(weekly,weekly.c.athlete_id==members.c.athlete_id)
        .outerjoin(changed,changed.c.athlete_id==members.c.athlete_id).outerjoin(unread,unread.c.link_id==members.c.id)
        .outerjoin(reports,reports.c.athlete_id==members.c.athlete_id)).cte('metrics')
    return members, metrics


def member_page(db, account, tenant_id, q='', page=1, page_size=10, review_filter='', attention=False, sort='name', direction='asc', athlete_id=None):
    require_staff(db,account,tenant_id)
    authorized, metrics=member_metrics(db,account,tenant_id)
    m=metrics.c
    stats=dict(db.execute(select(func.count().label('assigned'),
        func.coalesce(func.sum(case((m.active_plans>0,1),else_=0)),0).label('with_program'),
        func.coalesce(func.sum(case((m.program_state=='scheduled',1),else_=0)),0).label('scheduled_program'),
        func.coalesce(func.sum(case((m.program_state=='needs_program',1),else_=0)),0).label('needs_program'),
        func.coalesce(func.sum(case((m.attention_count>0,1),else_=0)),0).label('attention')).select_from(metrics)).mappings().one())
    # Translate before lower() so Turkish capitals also work in a PostgreSQL C locale.
    latin=[chr(n) for n in range(0x00c0,0x0250) if len(fold(chr(n)))==1 and fold(chr(n)).isascii()]
    name=func.trainer_fold(m.name) if db.bind.dialect.name=='sqlite' else func.lower(
        func.translate(m.name,''.join(latin)+'\u0307',''.join(fold(c) for c in latin)))
    query=select(metrics)
    if q.strip(): query=query.where(name.contains(fold(q.strip()),autoescape=True))
    if athlete_id: query=query.where(m.athlete_id==athlete_id)
    if attention: query=query.where(m.attention_count>0)
    if review_filter:
        query=query.where(m.program_state==review_filter if review_filter in ('needs_program','scheduled') else m[review_filter]>0)
    total=db.scalar(select(func.count()).select_from(query.subquery()))
    page=min(page,max(1,(total+page_size-1)//page_size))
    key={'programs':m.active_plans,'attention':m.attention_count,'completion':func.coalesce(m.completion_rate,-1)}.get(sort,name)
    items=[dict(row) for row in db.execute(query.order_by(key.desc() if direction=='desc' else key.asc(),name,m.athlete_id)
        .offset((page-1)*page_size).limit(page_size)).mappings()]
    ids=[r['athlete_id'] for r in items];recent=defaultdict(list)
    if ids:
        ranked=select(Workout.id,func.row_number().over(partition_by=Workout.athlete_id,
            order_by=(Workout.scheduled_date.desc(),Workout.id)).label('rank')).join(CoachingPlan,CoachingPlan.id==Workout.plan_id).where(
            Workout.athlete_id.in_(ids),CoachingPlan.tenant_id==tenant_id,CoachingPlan.athlete_id==Workout.athlete_id).subquery()
        records=db.scalars(select(Workout).join(ranked,ranked.c.id==Workout.id).where(ranked.c.rank<=5).order_by(Workout.scheduled_date.desc(),Workout.id)).all()
        for w in records:recent[w.athlete_id].append(workout_json(w))
    for row in items:row['recent_workouts']=recent[row['athlete_id']]
    activity=db.execute(select(Workout,authorized.c.name).join(CoachingPlan,CoachingPlan.id==Workout.plan_id).join(
        authorized,authorized.c.athlete_id==Workout.athlete_id).where(CoachingPlan.tenant_id==tenant_id,
        CoachingPlan.athlete_id==Workout.athlete_id,Workout.state.in_(['completed','partial']))
        .order_by(Workout.scheduled_date.desc(),Workout.id).limit(4)).all()
    return dict(items=items,total=total,page=page,page_size=page_size,stats=stats,
        recent_activity=[dict(name=name,athlete_id=w.athlete_id,workout=workout_json(w)) for w,name in activity])


def workout_page(db,account,tenant_id,athlete_id,page=1,page_size=10,from_date=None,until=None,plan_id=None,state=None,workout_id=None):
    require_staff(db,account,tenant_id)
    if not active_link(db,account.id,athlete_id,tenant_id):fail(403,'Bu üye sana atanmış değil.')
    query=select(Workout).join(CoachingPlan,CoachingPlan.id==Workout.plan_id).where(
        Workout.athlete_id==athlete_id,CoachingPlan.athlete_id==athlete_id,CoachingPlan.tenant_id==tenant_id)
    if from_date:query=query.where(Workout.scheduled_date>=from_date)
    if until:query=query.where(Workout.scheduled_date<=until)
    if plan_id:query=query.where(Workout.plan_id==plan_id)
    if state:query=query.where(Workout.state==state)
    if workout_id:query=query.where(Workout.id==workout_id)
    scoped=query.subquery()
    summary=dict(db.execute(select(func.count().label('total'),func.coalesce(func.sum(case((scoped.c.state=='completed',1),else_=0)),0).label('completed_sessions'))).mappings().one())
    page=min(page,max(1,(summary['total']+page_size-1)//page_size))
    items=db.scalars(query.order_by(Workout.scheduled_date.desc(),Workout.id).offset((page-1)*page_size).limit(page_size)).all()
    return dict(items=[workout_json(w) for w in items],total=summary['total'],page=page,page_size=page_size,summary=summary)
