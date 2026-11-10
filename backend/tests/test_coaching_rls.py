import os
import sys
import unittest
from pathlib import Path
from uuid import uuid4
from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).parents[1]))


@unittest.skipUnless(
    os.getenv("NFCFIT_RLS_TEST_URL"),
    "Set isolated NFCFIT_RLS_TEST_URL using scripts/test_rls.py",
)
class PostgreSQLCoachingRLSTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from coaching import ConsoleBase

        cls.engine = create_engine(os.environ["NFCFIT_RLS_TEST_URL"])
        if "/tmp/nfcfit-rls-" not in str(cls.engine.url.query.get("host", "")):
            raise RuntimeError("RLS test requires its isolated Unix socket cluster.")
        with cls.engine.begin() as db:
            db.execute(
                text(
                    "CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;"
                )
            )
        ConsoleBase.metadata.create_all(cls.engine)
        migration = (
            Path(__file__).parents[1] / "migrations/20261107_coaching_foundation.sql"
        ).read_text()
        with cls.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as db:
            db.exec_driver_sql(migration)
            db.exec_driver_sql(migration)  # Re-applying the migration is safe.
            extra = (
                Path(__file__).parents[1] / "migrations/20261107_account_timezone.sql"
            ).read_text()
            db.exec_driver_sql(extra)
            db.exec_driver_sql(extra)
            roles = (Path(__file__).parents[1] / "migrations/20261108_club_roles.sql").read_text()
            db.exec_driver_sql(roles, execution_options={"no_parameters": True})
            db.exec_driver_sql(roles, execution_options={"no_parameters": True})
            planning = (Path(__file__).parents[1] / "migrations/20261109_trainer_planning.sql").read_text()
            db.exec_driver_sql(planning)
            db.exec_driver_sql(planning)

    def test_planning_templates_deny_direct_client_access(self):
        for role in ("anon", "authenticated"):
            with self.engine.connect() as db:
                db.exec_driver_sql("SET ROLE " + role)
                with self.assertRaises(Exception):
                    db.exec_driver_sql("SELECT * FROM console_workout_templates")
                db.rollback()

    def test_scoped_reads_wellness_consent_and_client_write_denial(self):
        from coaching import (
            CoachLink,
            CoachingPlan,
            LibraryExercise,
            PlanVersion,
            PrivateWellness,
            WellnessConsent,
            Workout,
            WeeklyReport,
        )
        from tenant_console import Account, Tenant, TenantStaff, Membership
        from sqlalchemy.orm import Session

        ids = {
            k: str(uuid4())
            for k in ["athlete", "coach", "owner", "stranger", "othercoach"]
        }
        auth = {k: str(uuid4()) for k in ids}
        tenant = str(uuid4())
        other = str(uuid4())
        plan = str(uuid4())
        otherplan = str(uuid4())
        personal = str(uuid4())
        with Session(self.engine) as db, db.begin():
            for k in ids:
                db.add(
                    Account(
                        id=ids[k],
                        supabase_user_id=auth[k],
                        name=k,
                        email=k + "@" + str(uuid4()) + ".test",
                        password_hash="never exposed",
                    )
                )
            db.add_all(
                [
                    Tenant(id=tenant, name="A", slug=str(uuid4())),
                    Tenant(id=other, name="B", slug=str(uuid4())),
                ]
            )
            db.flush()
            db.add_all(
                [
                    TenantStaff(
                        tenant_id=tenant, account_id=ids["coach"], role="coach"
                    ),
                    TenantStaff(
                        tenant_id=tenant, account_id=ids["owner"], role="owner"
                    ),
                    TenantStaff(
                        tenant_id=other, account_id=ids["othercoach"], role="coach"
                    ),
                    Membership(
                        tenant_id=tenant, account_id=ids["athlete"], status="active"
                    ),
                    Membership(
                        tenant_id=other, account_id=ids["athlete"], status="active"
                    ),
                ]
            )
            db.flush()
            db.add_all(
                [
                    CoachLink(
                        tenant_id=tenant,
                        trainer_id=ids["coach"],
                        athlete_id=ids["athlete"],
                    ),
                    CoachLink(
                        tenant_id=other,
                        trainer_id=ids["othercoach"],
                        athlete_id=ids["athlete"],
                    ),
                ]
            )
            db.add_all(
                [
                    CoachingPlan(
                        id=plan,
                        owner_id=ids["coach"],
                        athlete_id=ids["athlete"],
                        tenant_id=tenant,
                    ),
                    CoachingPlan(
                        id=otherplan,
                        owner_id=ids["othercoach"],
                        athlete_id=ids["athlete"],
                        tenant_id=other,
                    ),
                    CoachingPlan(
                        id=personal, owner_id=ids["athlete"], athlete_id=ids["athlete"]
                    ),
                ]
            )
            db.flush()
            for pid in [plan, otherplan, personal]:
                db.add(
                    PlanVersion(
                        plan_id=pid,
                        version=1,
                        actor_id=ids["athlete"],
                        actor_role="athlete",
                        content={},
                    )
                )
            for kind in ["water", "coffee"]:
                db.add(
                    PrivateWellness(
                        id=str(uuid4()),
                        account_id=ids["athlete"],
                        kind=kind,
                        content={"amount": 250},
                        occurred_at=__import__("datetime").datetime.now(
                            __import__("datetime").timezone.utc
                        ),
                    )
                )
            db.add(
                WellnessConsent(
                    account_id=ids["athlete"],
                    trainer_id=ids["coach"],
                    kind="water",
                    allowed=True,
                )
            )
            for scope in ["all", tenant, other]:
                db.add(
                    WeeklyReport(
                        athlete_id=ids["athlete"],
                        scope=scope,
                        week="2026-10-26",
                        timezone="Europe/Istanbul",
                        content={},
                    )
                )

        with self.assertRaises(Exception):
            with self.engine.begin() as db:
                db.execute(
                    text(
                        "update console_plan_versions set content='{\"tampered\":true}'::json where plan_id=:id"
                    ),
                    {"id": plan},
                )
        with self.engine.begin() as db:
            db.execute(
                text(
                    "update console_plan_versions set review_status='reviewed', reviewed_by=:actor where plan_id=:id"
                ),
                {"actor": ids["coach"], "id": plan},
            )

        def read(role, sql):
            with self.engine.begin() as db:
                db.execute(
                    text("select set_config('request.jwt.claim.sub',:sub,true)"),
                    {"sub": auth[role]},
                )
                db.execute(text("SET LOCAL ROLE authenticated"))
                return [row[0] for row in db.execute(text(sql))]

        self.assertEqual(
            set(read("athlete", "select id from console_coaching_plans")),
            {plan, otherplan, personal},
        )
        self.assertEqual(read("coach", "select id from console_coaching_plans"), [plan])
        self.assertEqual(
            read("othercoach", "select id from console_coaching_plans"), [otherplan]
        )
        self.assertEqual(read("owner", "select id from console_coaching_plans"), [])
        self.assertEqual(read("stranger", "select id from console_coaching_plans"), [])
        self.assertEqual(
            read("coach", "select kind from console_private_wellness"), ["water"]
        )
        self.assertEqual(read("owner", "select kind from console_private_wellness"), [])
        self.assertEqual(
            read("coach", "select scope from console_weekly_reports"), [tenant]
        )
        self.assertEqual(len(read("coach", "select id from console_plan_versions")), 1)
        with self.assertRaises(Exception):
            read("coach", "update console_coaching_plans set version=2 returning id")
        with self.assertRaises(Exception):
            read("owner", "select password_hash from console_accounts")
        with self.engine.begin() as db:
            db.execute(text("update console_tenant_staff set role='TRAINER' where tenant_id=:t and account_id=:a"), {'t':tenant,'a':ids['coach']})
        self.assertEqual(read('coach','select id from console_coaching_plans'),[plan])
        self.assertEqual(read('coach','select kind from console_private_wellness'),['water'])
        with self.engine.begin() as db:
            db.execute(text("update console_tenant_staff set role='CLUB_MANAGER' where tenant_id=:t and account_id=:a"), {'t':tenant,'a':ids['coach']})
        self.assertEqual(read('coach','select id from console_coaching_plans'),[])
        self.assertEqual(read('coach','select kind from console_private_wellness'),[])
        with self.engine.begin() as db:
            db.execute(text("update console_tenant_staff set role='TRAINER' where tenant_id=:t and account_id=:a"), {'t':tenant,'a':ids['coach']})
        with self.engine.begin() as db:
            db.execute(
                text(
                    "update console_memberships set status='suspended' where tenant_id=:t"
                ),
                {"t": tenant},
            )
        self.assertEqual(read("coach", "select id from console_coaching_plans"), [])
        self.assertEqual(read("coach", "select kind from console_private_wellness"), [])

    def test_five_club_roles_database_boundaries_and_last_admin(self):
        from tenant_console import Account, Tenant, TenantStaff, Membership, AuditLog, SubscriptionRequest, ClubBillingProfile
        from sqlalchemy.orm import Session
        roles=['CLUB_ADMIN','CLUB_MANAGER','TRAINER','CLUB_MEMBER','PLATFORM_ADMIN']
        ids={r:str(uuid4()) for r in roles}
        auth={r:str(uuid4()) for r in roles}
        club,other=str(uuid4()),str(uuid4())
        with Session(self.engine) as db, db.begin():
            for r in roles:
                db.add(Account(id=ids[r],name=r,email=f'{uuid4()}@rls.test',password_hash='private',supabase_user_id=auth[r],is_platform_admin=r=='PLATFORM_ADMIN'))
            db.add_all([Tenant(id=club,name='Roles',slug=str(uuid4())),Tenant(id=other,name='Other',slug=str(uuid4()))]);db.flush()
            for r in roles[:3]:db.add(TenantStaff(tenant_id=club,account_id=ids[r],role=r))
            db.add(TenantStaff(tenant_id=other,account_id=ids['CLUB_MEMBER'],role='owner'))
            db.add(Membership(tenant_id=club,account_id=ids['CLUB_MEMBER'],status='active'))
            db.add(AuditLog(tenant_id=club,actor_id=ids['CLUB_ADMIN'],action='staff.invited',subject_id=ids['TRAINER']))
            db.add(SubscriptionRequest(tenant_id=club,actor_id=ids['CLUB_ADMIN'],requested_plan='Pro'))
            db.add(ClubBillingProfile(tenant_id=club,legal_name='Private company billing'))
        def read(role,sql):
            with self.engine.begin() as db:
                db.execute(text("select set_config('request.jwt.claim.sub',:sub,true)"),{'sub':auth[role]})
                db.execute(text('SET LOCAL ROLE authenticated'))
                return list(db.execute(text(sql),{'club':club,'other':other}))
        for r in roles:
            with self.subTest(role=r):
                self.assertEqual(len(read(r,'select id from console_audit_logs where tenant_id=:club')),1 if r=='CLUB_ADMIN' else 0)
                self.assertEqual(len(read(r,'select id from console_subscription_requests where tenant_id=:club')),1 if r=='CLUB_ADMIN' else 0)
                self.assertEqual(len(read(r,'select legal_name from console_club_billing_profiles where tenant_id=:club')),1 if r=='CLUB_ADMIN' else 0)
                self.assertEqual(len(read(r,'select id from console_memberships where tenant_id=:club')),0 if r in ['TRAINER','PLATFORM_ADMIN'] else 1)
                self.assertEqual(len(read(r,'select id from console_tenants where id=:other')),1 if r=='CLUB_MEMBER' else 0)
                for table in ['console_tenant_staff','console_memberships','console_nfc_tags','console_audit_logs','console_subscription_requests','console_club_billing_profiles']:
                    with self.assertRaises(Exception):read(r,f"delete from {table} where tenant_id=:club returning id")
                with self.assertRaises(Exception):read(r,'select password_hash from console_accounts')
        for statement in ["update console_tenant_staff set role='TRAINER'", "update console_tenant_staff set status='suspended'", 'delete from console_tenant_staff']:
            with self.assertRaises(Exception):
                with self.engine.begin() as db:
                    db.execute(text(statement+" where tenant_id=:club and account_id=:admin"),{'club':club,'admin':ids['CLUB_ADMIN']})
        with self.assertRaises(Exception):
            with self.engine.begin() as db:db.execute(text("update console_audit_logs set action='tampered' where tenant_id=:club"),{'club':club})
        # Verified ownership handoff: add a second admin, then revoke the old one.
        with self.engine.begin() as db:
            db.execute(text("update console_tenant_staff set role='CLUB_ADMIN' where tenant_id=:club and account_id=:manager"),{'club':club,'manager':ids['CLUB_MANAGER']})
            db.execute(text("update console_tenant_staff set status='removed' where tenant_id=:club and account_id=:admin"),{'club':club,'admin':ids['CLUB_ADMIN']})
        self.assertEqual(read('CLUB_ADMIN','select id from console_audit_logs where tenant_id=:club'),[])
        self.assertEqual(len(read('CLUB_MANAGER','select id from console_audit_logs where tenant_id=:club')),1)

    def test_concurrent_admin_removal_keeps_one_active_admin(self):
        from tenant_console import Account, Tenant, TenantStaff
        from sqlalchemy.orm import Session
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        club=str(uuid4());staff=[str(uuid4()),str(uuid4())]
        with Session(self.engine) as db,db.begin():
            db.add(Tenant(id=club,name='Concurrent',slug=str(uuid4())))
            for id in staff:db.add(Account(id=id,name='Admin',email=f'{uuid4()}@rls.test',password_hash='private'))
            db.flush()
            for id in staff:db.add(TenantStaff(tenant_id=club,account_id=id,role='CLUB_ADMIN'))
        barrier=Barrier(2)
        def remove(id):
            try:
                with self.engine.begin() as db:
                    barrier.wait(timeout=5)
                    db.execute(text("update console_tenant_staff set status='removed' where tenant_id=:club and account_id=:id"),{'club':club,'id':id})
                return True
            except Exception as exc:
                self.assertIn('last_active_club_admin',str(exc))
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(remove,staff))
        self.assertEqual(sorted(results),[False,True])
        with self.engine.begin() as db:
            self.assertEqual(db.scalar(text("select count(*) from console_tenant_staff where tenant_id=:club and status='active'"),{'club':club}),1)

    def test_role_migration_preserves_data_and_rejects_unknown_policy(self):
        migration=(Path(__file__).parents[1]/'migrations/20261108_club_roles.sql').read_text()
        with self.engine.begin() as db:
            before=list(db.execute(text('select id,tenant_id,account_id,role,status from console_tenant_staff order by id')))
            db.execute(text('create policy unexpected_allow_all on console_memberships for select to authenticated using (true)'))
        with self.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as db:
            try:
                with self.assertRaisesRegex(Exception,'Review unexpected existing RLS policies'):
                    db.exec_driver_sql(migration,execution_options={'no_parameters':True})
            finally:
                db.exec_driver_sql('ROLLBACK')
        with self.engine.begin() as db:
            self.assertEqual(list(db.execute(text('select id,tenant_id,account_id,role,status from console_tenant_staff order by id'))),before)
            db.execute(text('drop policy unexpected_allow_all on console_memberships'))
        with self.engine.connect().execution_options(isolation_level='AUTOCOMMIT') as db:
            db.exec_driver_sql(migration,execution_options={'no_parameters':True})
        with self.engine.begin() as db:
            self.assertEqual(list(db.execute(text('select id,tenant_id,account_id,role,status from console_tenant_staff order by id'))),before)
