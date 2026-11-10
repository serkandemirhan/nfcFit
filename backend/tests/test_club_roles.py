"""Actual HTTP permission tests; isolated fixture, no real staff invitations are sent."""
import unittest
from unittest.mock import patch
from uuid import uuid4

import test_tenant_console as baseline
from fastapi.testclient import TestClient
from app import app
from tenant_console import Account, ConsoleSession, Tenant, TenantStaff, Membership, AuditLog
from sqlalchemy import select


class ClubRoleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ctx = TestClient(app)
        cls.client = cls.ctx.__enter__()
        cls.auth = patch('tenant_console._fetch_supabase_identity', side_effect=baseline.TenantConsoleFlowTests.identity_for_token)
        cls.auth.start()

    @classmethod
    def tearDownClass(cls):
        cls.auth.stop()
        cls.ctx.__exit__(None, None, None)

    def setUp(self):
        self.emails = {r: f'{r}-{uuid4().hex}@roles.test' for r in ['CLUB_ADMIN','CLUB_MANAGER','TRAINER','CLUB_MEMBER','PLATFORM_ADMIN','stranger']}
        self.ids = {}
        for role in self.emails:
            r = self.client.get('/api/console/auth/me', headers=self.headers(role))
            self.assertEqual(r.status_code, 200, r.text)
            self.ids[role] = r.json()['account']['id']
        with ConsoleSession.begin() as db:
            t = Tenant(name='Permission Fixture',slug=uuid4().hex,member_limit=3)
            other = Tenant(name='Other Club',slug=uuid4().hex)
            db.add_all([t,other]); db.flush()
            self.club,self.other=t.id,other.id
            self.staff={}
            for role in ['CLUB_ADMIN','CLUB_MANAGER','TRAINER']:
                row=TenantStaff(tenant_id=t.id,account_id=self.ids[role],role=role)
                db.add(row);db.flush();self.staff[role]=row.id
            db.add(TenantStaff(tenant_id=other.id,account_id=self.ids['CLUB_MEMBER'],role='CLUB_ADMIN'))
            member=Membership(tenant_id=t.id,account_id=self.ids['CLUB_MEMBER'],status='active')
            db.add(member);db.flush();self.member=member.id
            db.get(Account,self.ids['PLATFORM_ADMIN']).is_platform_admin=True
        self.base=f'/api/console/tenants/{self.club}'

    def headers(self,role): return {'Authorization':'Bearer '+self.emails[role]}
    def req(self,method,path,role='CLUB_ADMIN',expected=200,**kwargs):
        r=self.client.request(method,path,headers=self.headers(role),**kwargs)
        self.assertEqual(r.status_code,expected,f'{role} {method} {path}: {r.text}')
        return r.json() if r.content else None

    def test_operational_reads_for_every_role_and_cross_club(self):
        for role in self.emails:
            for resource in ['dashboard','members','tags','activities','staff','management']:
                with self.subTest(role=role,resource=resource):
                    self.req('GET',self.base+'/'+resource,role,200 if role in ['CLUB_ADMIN','CLUB_MANAGER'] else 403)
            self.req('GET',f'/api/console/tenants/{self.other}/management',role,200 if role=='CLUB_MEMBER' else 403)
        self.req('GET',self.base+'/exercises','TRAINER')
        for role in self.emails:
            self.req('GET','/api/console/coaching/dashboard',role,200 if role in ['CLUB_ADMIN','TRAINER','CLUB_MEMBER'] else 403)

    def test_admin_only_subscription_settings_and_audit(self):
        for role in self.emails:
            allowed=role=='CLUB_ADMIN'
            self.req('GET',self.base+'/subscription',role,200 if allowed else 403)
            self.req('GET',self.base+'/audit',role,200 if allowed else 403)
            self.req('PATCH',self.base+'/settings',role,200 if allowed else 403,json={'name':'Updated Club'})
            self.req('POST',self.base+'/subscription/requests',role,201 if allowed else 403,json={'requested_plan':'Club Pro'})
        self.req('POST',self.base+'/subscription/requests',expected=409,json={'requested_plan':'Club Pro'})
        self.assertEqual(self.req('GET',self.base+'/subscription')['tenant']['member_limit'],3)
        self.req('PATCH',f'/api/console/platform/tenants/{self.club}','CLUB_ADMIN',403,json={'member_limit':999})
        self.req('PATCH',f'/api/console/platform/tenants/{self.club}','PLATFORM_ADMIN',json={'member_limit':4})

    def test_billing_profile_and_platform_subscription_review(self):
        profile={'legal_name':'Example Fitness Ltd','billing_email':'billing@roles.test','tax_id':'TEST-123','address':'Test address'}
        for role in self.emails:
            self.req('PATCH',self.base+'/billing-profile',role,200 if role=='CLUB_ADMIN' else 403,json=profile)
        self.assertEqual(self.req('GET',self.base+'/subscription')['billing_profile'],profile)
        row=self.req('POST',self.base+'/subscription/requests',expected=201,json={'requested_plan':'Club Pro'})
        path=f"/api/console/platform/subscription-requests/{row['id']}/review"
        for role in ['CLUB_ADMIN','CLUB_MANAGER','TRAINER','CLUB_MEMBER']:
            self.req('POST',path,role,403,json={'decision':'approve','member_limit':10,'card_limit':20})
        self.req('POST',path,'PLATFORM_ADMIN',422,json={'decision':'approve'})
        self.req('POST',path,'PLATFORM_ADMIN',json={'decision':'approve','member_limit':10,'card_limit':20})
        subscription=self.req('GET',self.base+'/subscription')
        self.assertEqual((subscription['tenant']['plan'],subscription['tenant']['member_limit']),('Club Pro',10))
        self.req('POST',path,'PLATFORM_ADMIN',409,json={'decision':'reject'})
        row=self.req('POST',self.base+'/subscription/requests',expected=201,json={'requested_plan':'Different Club Plan'})
        self.req('POST',f"/api/console/platform/subscription-requests/{row['id']}/review",'PLATFORM_ADMIN',json={'decision':'reject'})
        self.assertEqual(self.req('GET',self.base+'/subscription')['tenant']['plan'],'Club Pro')
        logs=self.req('GET',self.base+'/audit')
        profile_log=next(r for r in logs if r['action']=='billing.profile_changed')
        self.assertNotIn('TEST-123',str(profile_log))
        self.assertNotIn('Test address',str(profile_log))

    def test_manager_can_invite_trainers_but_no_higher_roles_or_self_promotion(self):
        for role in ['CLUB_ADMIN','CLUB_MANAGER','owner','admin']:
            self.req('POST',self.base+'/staff','CLUB_MANAGER',403,json={'name':'Forbidden','email':f'{uuid4()}@roles.test','role':role})
        row=self.req('POST',self.base+'/staff','CLUB_MANAGER',201,json={'name':'New Trainer','email':f'{uuid4()}@roles.test','role':'TRAINER'})
        for status in ['suspended','active','removed']:
            self.req('PATCH',self.base+'/staff/'+row['id'],'CLUB_MANAGER',json={'status':status})
        for target in ['CLUB_ADMIN','CLUB_MANAGER']:
            self.req('PATCH',self.base+'/staff/'+self.staff[target],'CLUB_MANAGER',403,json={'status':'removed'})
        self.req('PATCH',self.base+'/staff/'+self.staff['CLUB_MANAGER'],'CLUB_MANAGER',403,json={'role':'CLUB_ADMIN'})
        self.req('PATCH',self.base+'/staff/'+row['id'],'CLUB_MANAGER',403,json={'role':'CLUB_MANAGER'})

    def test_verified_promotion_last_admin_and_history_preserving_removal(self):
        admin=self.staff['CLUB_ADMIN']
        for payload in [{'status':'suspended'},{'status':'removed'},{'role':'TRAINER'},{'role':'CLUB_MANAGER'}]:
            self.req('PATCH',self.base+'/staff/'+admin,expected=409,json=payload)
        self.req('DELETE',self.base+'/staff/'+admin,expected=409)
        self.req('PATCH',self.base+'/staff/'+self.staff['TRAINER'],json={'role':'CLUB_ADMIN'})
        self.req('DELETE',self.base+'/staff/'+admin)
        # Demoted caller loses authority on the very next API request.
        self.req('GET',self.base+'/audit',expected=403)
        with ConsoleSession() as db:
            self.assertIsNotNone(db.get(Account,self.ids['CLUB_ADMIN']))
            self.assertEqual(db.get(TenantStaff,admin).status,'removed')

    def test_unverified_account_cannot_be_promoted_to_admin(self):
        row=self.req('POST',self.base+'/staff',expected=201,json={'name':'Invite','email':f'{uuid4()}@roles.test','role':'CLUB_MANAGER'})
        self.req('PATCH',self.base+'/staff/'+row['id'],expected=409,json={'role':'CLUB_ADMIN'})
        self.req('PATCH',self.base+'/staff/'+self.staff['TRAINER'],expected=422,json={'role':None})

    def test_members_cards_and_audit_are_tenant_scoped(self):
        for role in ['TRAINER','CLUB_MEMBER','PLATFORM_ADMIN','stranger']:
            self.req('POST',self.base+'/members',role,403,json={'name':'Member','email':f'{uuid4()}@roles.test'})
            self.req('POST',self.base+'/tags',role,403,json={'name':'Card','uid':uuid4().hex})
        row=self.req('POST',self.base+'/members','CLUB_MANAGER',201,json={'name':'New Member','email':f'{uuid4()}@roles.test'})
        self.req('POST',self.base+'/join-requests/'+row['id']+'/review','CLUB_MANAGER',json={'decision':'approve'})
        self.req('DELETE',self.base+'/members/'+row['id'],'CLUB_MANAGER')
        card=self.req('POST',self.base+'/tags','CLUB_MANAGER',201,json={'name':'Card','uid':uuid4().hex})
        self.req('PATCH',self.base+'/tags/'+card['id'],'CLUB_MANAGER',json={'active':False})
        self.req('DELETE',self.base+'/tags/'+card['id'],'CLUB_MANAGER',204)
        logs=self.req('GET',self.base+'/audit')
        self.assertTrue({'membership.invited','membership.reviewed','membership.changed','card.revoked','card.removed'} <= {r['action'] for r in logs})
        self.assertTrue(any(r['detail'].get('revoked') for r in logs))
        self.req('PATCH',f'/api/console/tenants/{self.other}/members/{self.member}','CLUB_MEMBER',404,json={'status':'removed'})

    def test_catalog_equipment_and_assignment_mutations_match_role_matrix(self):
        for role in self.emails:
            allowed=role in ['CLUB_ADMIN','CLUB_MANAGER']
            exercise=self.req('POST',self.base+'/exercises',role,201 if allowed else 403,json={'name':f'Exercise {uuid4()}','unit':'repetition','default_quantity':10})
            equipment={'id':str(uuid4()),'name':'Bench machine','equipment_type':'machine','exercise_ids':['lib-bench-press']}
            self.req('POST',f'/api/console/coaching/tenants/{self.club}/equipment',role,200 if allowed else 403,json=equipment)
            self.req('POST',f'/api/console/coaching/tenants/{self.club}/assignments',role,200 if allowed else 403,json={'trainer_id':self.ids['TRAINER'],'athlete_id':self.ids['CLUB_MEMBER'],'active':True})
        # Operations staff cannot assign themselves as Trainers to gain member access.
        self.req('POST',f'/api/console/coaching/tenants/{self.club}/assignments','CLUB_MANAGER',422,json={'trainer_id':self.ids['CLUB_MANAGER'],'athlete_id':self.ids['CLUB_MEMBER'],'active':True})
        content={'name':'Club Plan','weeks':1,'start_date':'2026-11-08','days':[{'id':str(uuid4()),'name':'Full Body','dates':['2026-11-08'],'exercises':[{'id':str(uuid4()),'exercise_id':'lib-bench-press','sets':2,'reps':10}]}]}
        for role in self.emails:
            self.req('POST','/api/console/coaching/plans',role,201 if role in ['CLUB_ADMIN','TRAINER'] else 403,json={'id':str(uuid4()),'tenant_id':self.club,'content':content})

    def test_platform_admin_needs_explicit_club_grant(self):
        self.req('GET',self.base+'/management','PLATFORM_ADMIN',403)
        with ConsoleSession.begin() as db:
            db.add(TenantStaff(tenant_id=self.club,account_id=self.ids['PLATFORM_ADMIN'],role='CLUB_MANAGER'))
        self.req('GET',self.base+'/management','PLATFORM_ADMIN')
        self.req('GET',self.base+'/subscription','PLATFORM_ADMIN',403)
        self.req('GET',f'/api/console/tenants/{self.other}/management','PLATFORM_ADMIN',403)
        self.req('GET','/api/console/platform/overview','PLATFORM_ADMIN')

    def test_canonical_and_legacy_identity_roles_and_legacy_rows_are_not_rewritten(self):
        with ConsoleSession.begin() as db:
            for role,alias in [('CLUB_ADMIN','owner'),('CLUB_MANAGER','admin'),('TRAINER','coach')]:
                db.get(TenantStaff,self.staff[role]).role=alias
        for role,alias in [('CLUB_ADMIN','owner'),('CLUB_MANAGER','admin'),('TRAINER','coach')]:
            identity=self.req('GET','/api/console/auth/me',role)
            row=next(s for s in identity['staff'] if s['tenant_id']==self.club)
            self.assertEqual((row['role'],row['effective_role']),(alias,role))
            self.req('GET',self.base+'/management',role,403 if role=='TRAINER' else 200)

    def test_no_independent_athlete_plan_creation(self):
        # Validating a complete existing plan payload is covered by coaching journeys;
        # this guard is independently tested through an actual valid HTTP body.
        content={'name':'New Plan','weeks':1,'start_date':'2026-11-08','days':[{'id':str(uuid4()),'name':'Full Body','dates':['2026-11-08'],'exercises':[{'id':str(uuid4()),'exercise_id':'lib-bench-press','sets':2,'reps':10,'kg':20}]}]}
        self.req('POST','/api/console/coaching/plans','stranger',403,json={'id':str(uuid4()),'content':content})


import test_coaching as coaching_baseline

class CanonicalCoachingTests(coaching_baseline.CoachingJourneyTests):
    """Repeat real plan/workout/privacy journeys using canonical staff roles."""
    def setUp(self):
        super().setUp()
        from club_roles import canonical_role
        with ConsoleSession.begin() as db:
            for row in db.scalars(select(TenantStaff).where(TenantStaff.tenant_id == self.tenant)):
                row.role = canonical_role(row.role)

    def test_role_demotion_blocks_existing_templates_and_trainer_performance(self):
        plan=str(uuid4())
        self.req('POST','/plans','coach',201,json={'id':plan,'tenant_id':self.tenant,'content':self.content})
        with ConsoleSession.begin() as db:
            row=db.scalar(select(TenantStaff).where(TenantStaff.tenant_id==self.tenant,TenantStaff.account_id==self.ids['coach']))
            row.role='CLUB_MANAGER'
        self.req('GET',f'/plans/{plan}/versions','coach',403)
        self.req('GET',f'/overview?athlete_id={self.ids["athlete"]}','coach',403)
        self.req('GET','/dashboard','coach',403)
        self.assertNotIn(plan,[p['id'] for p in self.req('GET','/overview','coach')['plans']])
        with ConsoleSession() as db:
            self.assertIsNotNone(db.get(coaching_baseline.CoachingPlan,plan))

    def test_overview_query_count_does_not_grow_per_plan(self):
        from sqlalchemy import event
        from tenant_console import console_engine
        from coaching import CoachingPlan, PlanVersion
        def seed(count):
            with ConsoleSession.begin() as db:
                for _ in range(count):
                    plan=CoachingPlan(id=str(uuid4()),owner_id=self.ids['coach'],athlete_id=self.ids['athlete'],tenant_id=self.tenant)
                    db.add(plan);db.flush()
                    db.add(PlanVersion(plan_id=plan.id,version=1,actor_id=self.ids['coach'],actor_role='trainer',content=self.content))
        def request_count():
            calls=[]
            def observed(*args):calls.append(args[2])
            event.listen(console_engine,'before_cursor_execute',observed)
            try:result=self.req('GET','/overview')
            finally:event.remove(console_engine,'before_cursor_execute',observed)
            return result,len(calls)
        seed(1);single,first=request_count()
        seed(39);many,second=request_count()
        self.assertEqual(len(single['plans']),1)
        self.assertEqual(len(many['plans']),40)
        self.assertLessEqual(second,first+1)
        self.assertEqual({p['version'] for p in many['plans']},{1})
