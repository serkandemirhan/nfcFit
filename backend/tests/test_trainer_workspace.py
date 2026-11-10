"""Read-only queue authorization, stable pagination and bounded history regressions."""
import unittest
from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy import event
import test_coaching as coaching_tests
from tenant_console import ConsoleSession, Account, Membership
from coaching import CoachLink, Workout, CoachingPlan, PlanVersion

class TrainerWorkspaceTests(unittest.TestCase):
    setUpClass = classmethod(coaching_tests.CoachingJourneyTests.setUpClass.__func__)
    tearDownClass = classmethod(coaching_tests.CoachingJourneyTests.tearDownClass.__func__)
    setUp = coaching_tests.CoachingJourneyTests.setUp
    req = coaching_tests.CoachingJourneyTests.req
    link = coaching_tests.CoachingJourneyTests.link

    def page(self, query='', actor='coach', expected=200):
        return self.req('GET',f'/trainer/members?tenant_id={self.tenant}{query}',actor,expected)

    def test_authorization_and_revocation(self):
        self.link()
        self.assertEqual(self.page()['total'],1)
        self.page(actor='athlete',expected=403)
        self.page(actor='stranger',expected=403)
        self.assertEqual(self.page(actor='othercoach')['total'],0)
        with ConsoleSession.begin() as db:
            m=db.query(Membership).filter_by(tenant_id=self.tenant,account_id=self.ids['athlete']).one()
            m.status='inactive'
        self.assertEqual(self.page()['total'],0)

    def test_page_search_filter_and_constant_query_count(self):
        self.link(); self.link('second')
        with ConsoleSession.begin() as db:
            db.get(Account,self.ids['athlete']).name='Çağrı Işık'
            db.get(Account,self.ids['second']).name='Özgür Şen'
        first=self.page('&page_size=1')
        second=self.page('&page_size=1&page=2')
        self.assertNotEqual(first['items'][0]['athlete_id'],second['items'][0]['athlete_id'])
        self.assertEqual(self.page('&q=cagri%20isik')['total'],1)
        self.assertEqual(self.page('&review_filter=needs_program')['total'],2)
        self.assertEqual(self.page('&attention=true')['total'],2)
        self.assertEqual(self.page('&page=999')['page'],1)
        self.page('&page_size=51',expected=422)
        with ConsoleSession() as db: engine=db.get_bind()
        counts=[]
        def count(*args): counts.append(1)
        event.listen(engine,'before_cursor_execute',count)
        try:
            self.page('&page_size=5'); small=len(counts);counts.clear()
            with ConsoleSession.begin() as db:
                for i in range(1000):
                    account=Account(id=str(uuid4()),email=f'{uuid4()}@scale.test',name=f'Ölçek Üye {i:04d}',password_hash='fixture-no-login')
                    db.add(account);db.flush()
                    db.add(Membership(tenant_id=self.tenant,account_id=account.id,status='active'))
                    db.add(CoachLink(tenant_id=self.tenant,trainer_id=self.ids['coach'],athlete_id=account.id,active=True))
            counts.clear()
            large=self.page('&page_size=5&page=2'); big=len(counts)
            self.assertEqual(large['total'],1002)
            self.assertEqual(len(large['items']),5)
            self.assertEqual(big,small)
            self.assertTrue(all(len(m['recent_workouts'])<=5 for m in large['items']))
            print(f'Workspace scale: 2/1002 members, SELECT count {small}/{big}, page items 5')
        finally: event.remove(engine,'before_cursor_execute',count)

    def test_history_is_windowed_and_cross_tenant_is_forbidden(self):
        _, assigned=coaching_tests.CoachingJourneyTests.plan(self)
        with ConsoleSession.begin() as db:
            for person, plan in zip(['athlete','second'],assigned):
                for i in range(20):
                    db.add(Workout(id=str(uuid4()),athlete_id=self.ids[person],plan_id=plan['id'],
                        plan_version=1,session_key=str(uuid4()),scheduled_date=(date.today()-timedelta(days=i)).isoformat(),
                        state='completed',snapshot=plan['content']['days'][0],actual={'sets':[],'added':[]}))
        hydrated=[]
        def loaded(session,obj):hydrated.append(type(obj))
        event.listen(ConsoleSession,'loaded_as_persistent',loaded)
        try:response=self.page()
        finally:event.remove(ConsoleSession,'loaded_as_persistent',loaded)
        self.assertNotIn(CoachingPlan,hydrated)
        self.assertNotIn(PlanVersion,hydrated)
        self.assertLessEqual(hydrated.count(Workout),14)
        self.assertEqual([len(m['recent_workouts']) for m in response['items']],[5,5])
        self.assertEqual(len(response['recent_activity']),4)
        self.req('GET',f'/trainer/members?tenant_id={uuid4()}','coach',403)
        self.assertEqual(self.page('&athlete_id='+self.ids['stranger'])['items'],[])
