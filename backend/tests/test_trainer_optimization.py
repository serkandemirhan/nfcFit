"""SQL-side lifecycle metrics, paged history and non-destructive cancellation."""
import copy
import unittest
from datetime import date, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo
from sqlalchemy import select, event
import test_coaching as journeys
from tenant_console import ConsoleSession
from coaching import CoachingPlan, PlanVersion, Workout, now

class TrainerOptimizationTests(unittest.TestCase):
    setUpClass=classmethod(journeys.CoachingJourneyTests.setUpClass.__func__)
    tearDownClass=classmethod(journeys.CoachingJourneyTests.tearDownClass.__func__)
    setUp=journeys.CoachingJourneyTests.setUp
    req=journeys.CoachingJourneyTests.req
    link=journeys.CoachingJourneyTests.link
    def future(self):
        self.content['start_date']=(date.today()+timedelta(days=30)).isoformat()
        self.content['days'][0]['dates']=[self.content['start_date']]
        return journeys.CoachingJourneyTests.plan(self)
    def members(self,extra=''):
        return self.req('GET',f'/trainer/members?tenant_id={self.tenant}{extra}','coach')
    def history(self,extra='',actor='coach',expected=200):
        return self.req('GET',f'/trainer/workouts?tenant_id={self.tenant}&athlete_id={self.ids["athlete"]}{extra}',actor,expected)
    def cancel(self,plan,actor='coach',expected=200,version=None):
        return self.req('POST',f'/plans/{plan["id"]}/cancel-assignment',actor,expected,
            json={'expected_version':version or plan['version'],'reason':'Yanlış başlangıç; doğru program yeniden atanacak.'})

    def test_upcoming_is_not_missing_and_cancel_is_audited(self):
        source,assigned=self.future();first=assigned[0]
        result=self.members()
        self.assertEqual(result['stats']['needs_program'],0)
        self.assertEqual(result['stats']['scheduled_program'],2)
        self.assertEqual(result['stats']['attention'],0)
        self.assertEqual(self.members('&review_filter=scheduled')['total'],2)
        self.assertEqual(self.members('&review_filter=needs_program')['total'],0)
        self.assertEqual(result['items'][0]['upcoming_plans'],1)
        self.cancel(first,actor='athlete',expected=403)
        self.cancel(first,actor='othercoach',expected=403)
        cancelled=self.cancel(first)
        self.assertEqual(cancelled['content']['planning_status'],'archived')
        self.assertEqual(cancelled['content']['days'],first['content']['days'])
        self.assertEqual(cancelled['version'],2)
        self.cancel(first,expected=409)
        audit=self.req('GET',f'/trainer/assignment-history?tenant_id={self.tenant}&athlete_id={self.ids["athlete"]}','coach')
        self.assertEqual([v['event_type'] for v in audit['items']],['cancelled','assigned'])
        self.assertEqual(audit['items'][0]['actor_id'],self.ids['coach'])
        self.assertTrue(audit['items'][0]['reason'].startswith('Atama iptali:'))
        self.assertTrue(audit['items'][0]['created_at'].endswith(('+00:00','Z')))
        self.assertEqual(self.members()['stats']['needs_program'],1)
        # Archived assigned content cannot be resurrected by a generic edit or started offline.
        self.req('PATCH',f'/plans/{first["id"]}','coach',409,json={'expected_version':2,'content':first['content']})
        self.req('POST','/workouts','athlete',409,json={'id':str(uuid4()),'plan_id':first['id'],'session_key':self.day,'scheduled_date':self.content['start_date']})
        versions=self.req('GET',f'/plans/{first["id"]}/versions','coach')
        self.assertEqual(versions[0]['content'],first['content'])
        self.assertEqual(versions[1]['previous'],first['content'])
        self.assertEqual(self.req('GET','/overview','athlete')['workouts'],[])

    def test_no_cancellation_with_any_workout_or_started_schedule(self):
        _,assigned=self.future();first,second=assigned
        journeys.CoachingJourneyTests.workout(self,first)
        self.cancel(first,expected=409)
        with ConsoleSession.begin() as db:
            v=db.scalar(select(PlanVersion).where(PlanVersion.plan_id==second['id'],PlanVersion.version==1))
            content=copy.deepcopy(v.content);content['start_date']=(date.today()-timedelta(days=2)).isoformat();v.content=content
        self.cancel(second,expected=409)
        self.assertEqual(len(self.req('GET',f'/plans/{first["id"]}/versions','coach')),1)
        self.assertEqual(len(self.req('GET','/overview','athlete')['workouts']),1)

    def test_server_history_pages_filters_and_no_overview_hydration(self):
        _,assigned=self.future();plan=assigned[0]
        with ConsoleSession.begin() as db:
            for i in range(83):
                db.add(Workout(id=str(uuid4()),athlete_id=self.ids['athlete'],plan_id=plan['id'],plan_version=1,
                    session_key=str(uuid4()),scheduled_date=(date.today()-timedelta(days=i)).isoformat(),
                    state='completed' if i%2==0 else 'partial',snapshot=plan['content']['days'][0],actual={'sets':[],'added':[]}))
        first=self.history('&page_size=10');second=self.history('&page_size=10&page=2')
        self.assertEqual(first['total'],83);self.assertEqual(first['summary']['completed_sessions'],42)
        self.assertEqual(len(second['items']),10)
        self.assertTrue(set(x['id'] for x in first['items']).isdisjoint(x['id'] for x in second['items']))
        self.assertEqual(self.history('&state=partial')['total'],41)
        self.assertEqual(self.history('&plan_id='+str(uuid4()))['total'],0)
        oldest=self.history('&page_size=10&page=9')['items'][-1]
        self.assertEqual(self.history('&workout_id='+oldest['id'])['items'][0]['id'],oldest['id'])
        self.history(actor='othercoach',expected=403);self.history(actor='athlete',expected=403)
        statements=[]
        with ConsoleSession() as db:engine=db.get_bind()
        def capture(conn,cursor,statement,params,context,many):statements.append(statement)
        event.listen(engine,'before_cursor_execute',capture)
        try:
            slim=self.req('GET',f'/overview?athlete_id={self.ids["athlete"]}&include_workouts=false','coach')
            self.assertEqual(slim['workouts'],[])
            self.assertFalse(any('FROM console_workouts' in x for x in statements))
        finally:event.remove(engine,'before_cursor_execute',capture)
        self.assertEqual(len(self.req('GET','/overview','athlete')['workouts']),83)

    def test_sql_completion_and_missed_match_records_in_plan_timezone(self):
        _,assigned=self.future();plan=assigned[0]
        local_today=now().astimezone(ZoneInfo(plan['content']['timezone'])).date()
        monday=local_today-timedelta(days=local_today.weekday())
        # At least today's planned date is always in this week's calculation.
        dates=[local_today.isoformat()]
        if local_today>monday:dates.append((local_today-timedelta(days=1)).isoformat())
        with ConsoleSession.begin() as db:
            v=db.scalar(select(PlanVersion).where(PlanVersion.plan_id==plan['id'],PlanVersion.version==1))
            content=copy.deepcopy(v.content);content['start_date']=monday.isoformat();content['days'][0]['dates']=dates;v.content=content
            db.add(Workout(id=str(uuid4()),athlete_id=self.ids['athlete'],plan_id=plan['id'],plan_version=1,
                session_key=self.day,scheduled_date=dates[0],state='completed',snapshot=content['days'][0],actual={'sets':[],'added':[]}))
        row=self.members('&athlete_id='+self.ids['athlete'])['items'][0]
        self.assertEqual(row['active_plans'],1)
        self.assertAlmostEqual(row['completion_rate'],1/len(dates))
        self.assertEqual(row['missed'],len(dates)-1)
