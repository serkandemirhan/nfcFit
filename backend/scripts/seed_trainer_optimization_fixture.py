"""Idempotent realistic history samples in the disposable local fixture ONLY."""
import runpy
from pathlib import Path
from datetime import date,timedelta,datetime,timezone
from uuid import uuid5,NAMESPACE_URL
root=Path(__file__).resolve().parents[2]
fixture=Path('/tmp/nfcfit-trainer-planning-browser.db')
if not fixture.exists():raise SystemExit('Local planning fixture missing.')
ns=runpy.run_path(str(root/'backend/scripts/serve_trainer_planning_fixture.py'),run_name='optimization_fixture_seed')
tc,select=ns['tc'],ns['select']
assert str(tc.console_engine.url)=='sqlite:////tmp/nfcfit-trainer-planning-browser.db'
from coaching import CoachingPlan,PlanVersion,Workout,PlanContent
uid=lambda key:str(uuid5(NAMESPACE_URL,'nfcfit-optimization:'+key))
with tc.ConsoleSession.begin() as db:
    member=db.scalar(select(tc.Account).where(tc.Account.name=='Berk İnce'))
    trainer=db.scalar(select(tc.Account).where(tc.Account.email=='trainer@planning.test'))
    if not member:raise SystemExit('Run density fixture first.')
    start=date(2026,7,6)
    days=[]
    for i,offset in enumerate([0,2,4]):
        days.append(dict(id=uid('day-'+str(i)),name=['Teknik kuvvet','Kontrollü itiş','Hafta sonu güç'][i],
            dates=[(start+timedelta(days=offset+week*7)).isoformat() for week in range(6)],
            exercises=[dict(id=uid('target-'+str(i)),exercise_id='lib-bench-press',sets=4,reps=10,kg=30+i*2.5,rest_seconds=75,notes='Demo: kontrollü tempo')]))
    training={dt for d in days for dt in d['dates']}
    content=dict(name='Optimizasyon · Berk geçmiş örnekleri',start_date=start.isoformat(),weeks=6,timezone='Europe/Istanbul',difficulty='beginner',goal='Geçmiş kayıtlarını sayfalama kontrolü',days=days,
        rest_dates=[(start+timedelta(days=i)).isoformat() for i in range(42) if (start+timedelta(days=i)).isoformat() not in training],planning_status='published')
    content=PlanContent.model_validate(content).model_dump(mode='json')
    pid=uid('history-plan')
    if not db.get(CoachingPlan,pid):
        db.add(CoachingPlan(id=pid,owner_id=trainer.id,athlete_id=member.id,tenant_id='planning-club'));db.flush()
        db.add(PlanVersion(plan_id=pid,version=1,actor_id=trainer.id,actor_role='trainer',reason='Yalnızca yerel demo geçmiş örnekleri',content=content))
    # Repair only this script's own version-1 demo fixture if an older seed added display-only target names.
    version=db.scalar(select(PlanVersion).where(PlanVersion.plan_id==pid,PlanVersion.version==1))
    if version and db.get(CoachingPlan,pid).version==1 and version.reason=='Yalnızca yerel demo geçmiş örnekleri':
        if any('name' in e for d in version.content['days'] for e in d['exercises']):version.content=content
    for d in days:
        for i,dt in enumerate(d['dates']):
            wid=uid('workout:'+dt)
            if db.get(Workout,wid):continue
            count=[3,4,5][i%3];at=datetime.fromisoformat(dt+'T15:00:00+00:00')
            sets=[dict(id=uid('set:'+dt+':'+str(n)),exercise_key=d['exercises'][0]['id'],set_number=n,status='completed',reps=9+i%2,kg=30+i*2.5,seconds=None,meters=None,occurred_at=(at+timedelta(minutes=n*2)).isoformat()) for n in range(1,count+1)]
            db.add(Workout(id=wid,athlete_id=member.id,plan_id=pid,plan_version=1,session_key=d['id'],scheduled_date=dt,state='partial' if count<4 else 'completed',snapshot=d,
                actual=dict(sets=sets,added=[],order=[d['exercises'][0]['id']],skipped=[],notes='Yerel demo seansı',started_at=at.isoformat(),finished_at=(at+timedelta(minutes=25)).isoformat(),elapsed_seconds=1500)))
print('Local fixture only: Berk 18 distinct historical workouts (3/4, 4/4, 5/4); Ada/Emre untouched.')
