"""End-to-end coaching tests use real SQLAlchemy transactions and the existing auth boundary."""

import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4
from zoneinfo import ZoneInfo

import test_tenant_console as baseline
from fastapi.testclient import TestClient
from app import app
from tenant_console import Account, ConsoleSession, Membership, Tenant, TenantStaff
from coaching import CoachingPlan, PlanVersion, WeeklyReport, Workout


class CoachingJourneyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ctx = TestClient(app)
        cls.client = cls.ctx.__enter__()
        cls.auth = patch(
            "tenant_console._fetch_supabase_identity",
            side_effect=baseline.TenantConsoleFlowTests.identity_for_token,
        )
        cls.auth.start()

    @classmethod
    def tearDownClass(cls):
        cls.auth.stop()
        cls.ctx.__exit__(None, None, None)

    def req(self, method, path, actor="athlete", expected=200, **kwargs):
        r = self.client.request(
            method,
            "/api/console/coaching" + path,
            headers={"Authorization": "Bearer " + self.emails[actor]},
            **kwargs,
        )
        self.assertEqual(r.status_code, expected, r.text)
        return r.json() if r.content else None

    def setUp(self):
        self.emails = {
            r: f"{r}-{uuid4().hex}@nfcfit.test"
            for r in ["owner", "coach", "athlete", "second", "stranger", "othercoach"]
        }
        self.ids = {}
        for role, email in self.emails.items():
            r = self.client.get(
                "/api/console/auth/me", headers={"Authorization": "Bearer " + email}
            )
            self.assertEqual(r.status_code, 200, r.text)
            self.ids[role] = r.json()["account"]["id"]
        with ConsoleSession.begin() as db:
            t = Tenant(name="Training", slug=uuid4().hex)
            db.add(t)
            db.flush()
            self.tenant = t.id
            for r in ["owner", "coach", "othercoach"]:
                db.add(
                    TenantStaff(
                        tenant_id=t.id,
                        account_id=self.ids[r],
                        role="owner" if r == "owner" else "coach",
                    )
                )
            for r in ["athlete", "second"]:
                db.add(
                    Membership(tenant_id=t.id, account_id=self.ids[r], status="active")
                )
        self.day = str(uuid4())
        self.exercise = str(uuid4())
        self.content = {
            "name": "Güç programı",
            "start_date": (
                datetime.now(ZoneInfo("Europe/Istanbul")).date() + timedelta(days=1)
            ).isoformat(),
            "weeks": 2,
            "days": [
                {
                    "id": self.day,
                    "name": "A günü",
                    "dates": [
                        (
                            datetime.now(ZoneInfo("Europe/Istanbul")).date() + timedelta(days=1)
                        ).isoformat()
                    ],
                    "exercises": [
                        {
                            "id": self.exercise,
                            "exercise_id": "lib-bench-press",
                            "sets": 2,
                            "reps": 10,
                            "kg": 40,
                        }
                    ],
                }
            ],
        }

    def link(self, athlete="athlete"):
        return self.req(
            "POST",
            f"/tenants/{self.tenant}/assignments",
            "owner",
            json={"trainer_id": self.ids["coach"], "athlete_id": self.ids[athlete]},
        )

    def plan(self):
        self.link()
        self.link("second")
        template = self.req(
            "POST",
            "/plans",
            "coach",
            201,
            json={
                "id": str(uuid4()),
                "tenant_id": self.tenant,
                "content": self.content,
            },
        )
        assigned = self.req(
            "POST",
            f'/plans/{template["id"]}/assign',
            "coach",
            201,
            json={
                "athlete_ids": [self.ids["athlete"], self.ids["second"]],
                "request_id": str(uuid4()),
            },
        )
        return template, assigned

    def workout(self, p):
        return self.req(
            "POST",
            "/workouts",
            expected=201,
            json={
                "id": str(uuid4()),
                "plan_id": p["id"],
                "session_key": self.day,
                "scheduled_date": self.content["days"][0]["dates"][0],
            },
        )

    def command(self, w, action, **data):
        return self.req(
            "POST",
            f'/workouts/{w["id"]}/commands',
            json={
                "request_id": str(uuid4()),
                "expected_version": w["version"],
                "action": action,
                **data,
            },
        )

    def test_assignment_independent_snapshots_revision_conflict_and_review(self):
        template, assigned = self.plan()
        first, second = assigned
        self.assertNotEqual(first["id"], second["id"])
        self.req("GET", f'/plans/{first["id"]}/versions', "stranger", 403)
        self.req(
            "GET", f'/plans/{first["id"]}/versions', "owner", 403
        )  # Administration alone is not a coaching relationship.
        changed = json.loads(json.dumps(first["content"]))
        changed["days"][0]["exercises"][0]["reps"] = 8
        edited = self.req(
            "PATCH",
            f'/plans/{first["id"]}',
            json={
                "expected_version": 1,
                "reason": "Yükü ayarladım",
                "content": changed,
            },
        )
        self.assertEqual(edited["version"], 2)
        self.req(
            "PATCH",
            f'/plans/{first["id"]}',
            "coach",
            409,
            json={"expected_version": 1, "content": changed},
        )
        versions = self.req("GET", f'/plans/{first["id"]}/versions', "coach")
        self.assertEqual(versions[-1]["review_status"], "unreviewed")
        self.assertEqual(
            versions[-1]["previous"]["days"][0]["exercises"][0]["reps"], 10
        )
        self.req("POST", f'/plans/{first["id"]}/versions/2/review', "coach")
        other = self.req("GET", "/overview", "second")["plans"][0]
        self.assertEqual(other["content"]["days"][0]["exercises"][0]["reps"], 10)
        self.assertEqual(
            self.req("GET", f'/plans/{template["id"]}/versions', "coach")[-1][
                "version"
            ],
            1,
        )

    def test_workout_manual_sets_retry_immutable_terminal_and_plan_targets(self):
        _, assigned = self.plan()
        w = self.workout(assigned[0])
        w = self.command(w, "start")
        self.assertEqual(w["state"], "in_progress")
        for n in [1, 2]:
            payload = {
                "request_id": str(uuid4()),
                "expected_version": w["version"],
                "action": "set",
                "actual_set": {
                    "id": str(uuid4()),
                    "exercise_key": self.exercise,
                    "set_number": n,
                    "reps": 9,
                    "kg": 35,
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                },
            }
            w = self.req("POST", f'/workouts/{w["id"]}/commands', json=payload)
            duplicate = self.req("POST", f'/workouts/{w["id"]}/commands', json=payload)
            self.assertEqual(w, duplicate)
        self.assertEqual(len(w["actual"]["sets"]), 2)
        self.assertEqual(w["snapshot"]["exercises"][0]["reps"], 10)
        w = self.command(w, "pause")
        w = self.command(w, "resume")
        w = self.command(w, "finish")
        self.assertEqual(w["state"], "completed")
        self.req(
            "POST",
            f'/workouts/{w["id"]}/commands',
            expected=409,
            json={
                "request_id": str(uuid4()),
                "expected_version": w["version"],
                "action": "note",
                "notes": "rewrite",
            },
        )
        self.req(
            "POST",
            f'/workouts/{w["id"]}/commands',
            "stranger",
            403,
            json={
                "request_id": str(uuid4()),
                "expected_version": w["version"],
                "action": "start",
            },
        )
        self.assertEqual(
            self.req("GET", "/overview")["workouts"][0]["actual"]["sets"][0]["kg"], 35
        )

    def test_long_workout_partial_skips_and_quantity_validation(self):
        self.content["days"][0]["exercises"] = [
            {
                "id": str(uuid4()),
                "exercise_id": "lib-bench-press",
                "sets": 3,
                "reps": 10,
            }
            for _ in range(15)
        ]
        _, assigned = self.plan()
        w = self.workout(assigned[0])
        self.assertEqual(len(w["snapshot"]["exercises"]), 15)
        w = self.command(w, "start")
        w = self.command(w, "reorder", order=list(reversed(w["actual"]["order"])))
        w = self.command(w, "skip_exercise", exercise_key=w["actual"]["order"][0])
        self.req(
            "POST",
            f'/workouts/{w["id"]}/commands',
            expected=409,
            json={
                "request_id": str(uuid4()),
                "expected_version": w["version"],
                "action": "finish",
            },
        )
        w = self.command(w, "finish", partial=True)
        self.assertEqual(w["state"], "partial")

    def test_wellness_private_granular_consent_revocation_and_context_messages(self):
        l = self.link()
        for kind in ["water", "coffee"]:
            self.req(
                "POST",
                "/wellness",
                expected=201,
                json={
                    "id": str(uuid4()),
                    "kind": kind,
                    "amount": 250,
                    "coffee_type": "filtre" if kind == "coffee" else None,
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        self.assertEqual(
            self.req("GET", f'/overview?athlete_id={self.ids["athlete"]}', "coach")[
                "wellness"
            ],
            [],
        )
        self.req(
            "POST",
            "/wellness/consent",
            json={"trainer_id": self.ids["coach"], "kind": "water", "allowed": True},
        )
        coach = self.req("GET", f'/overview?athlete_id={self.ids["athlete"]}', "coach")
        self.assertEqual([w["kind"] for w in coach["wellness"]], ["water"])
        self.req(
            "GET", f'/overview?athlete_id={self.ids["athlete"]}', "othercoach", 403
        )
        self.req(
            "POST",
            "/messages",
            expected=201,
            json={
                "id": str(uuid4()),
                "link_id": l["id"],
                "body": "Son sette zorlandım.",
            },
        )
        inbox = self.req("GET", "/overview", "coach")["messages"]
        self.assertEqual(inbox[0]["body"], "Son sette zorlandım.")
        self.req("POST", f'/messages/{inbox[0]["id"]}/read', "coach")
        self.assertIsNotNone(self.req("GET", "/overview")["messages"][0]["read_at"])
        self.req(
            "POST",
            "/messages",
            "stranger",
            403,
            json={"id": str(uuid4()), "link_id": l["id"], "body": "bad"},
        )
        self.req(
            "POST",
            "/wellness/consent",
            json={"trainer_id": self.ids["coach"], "kind": "water", "allowed": False},
        )
        self.assertEqual(
            self.req("GET", f'/overview?athlete_id={self.ids["athlete"]}', "coach")[
                "wellness"
            ],
            [],
        )

    def test_revoked_membership_prevents_new_workout_commands(self):
        _, assigned = self.plan()
        w = self.workout(assigned[0])
        with ConsoleSession.begin() as db:
            m = (
                db.query(Membership)
                .filter_by(tenant_id=self.tenant, account_id=self.ids["athlete"])
                .one()
            )
            m.status = "suspended"
        self.req(
            "POST",
            f'/workouts/{w["id"]}/commands',
            expected=403,
            json={"request_id": str(uuid4()), "expected_version": 1, "action": "start"},
        )
        self.req("GET", f'/overview?athlete_id={self.ids["athlete"]}', "coach", 403)

    def test_weekly_report_deterministic_scope_and_no_invented_volume(self):
        _, assigned = self.plan()
        p = assigned[0]
        last_monday = datetime.now(timezone.utc).date() - timedelta(
            days=datetime.now(timezone.utc).weekday() + 7
        )
        with ConsoleSession.begin() as db:
            v = db.query(PlanVersion).filter_by(plan_id=p["id"], version=1).one()
            c = json.loads(json.dumps(v.content))
            c["start_date"] = last_monday.isoformat()
            c["days"][0]["dates"] = [last_monday.isoformat()]
            v.content = c
            v.created_at = datetime.combine(
                last_monday - timedelta(days=1), datetime.min.time(), timezone.utc
            )
            db.add(
                Workout(
                    id=str(uuid4()),
                    athlete_id=self.ids["athlete"],
                    plan_id=p["id"],
                    plan_version=1,
                    session_key=self.day,
                    scheduled_date=last_monday.isoformat(),
                    state="partial",
                    snapshot=c["days"][0],
                    actual={
                        "sets": [
                            {
                                "id": str(uuid4()),
                                "exercise_key": self.exercise,
                                "set_number": 1,
                                "status": "completed",
                                "reps": 9,
                                "kg": 35,
                                "occurred_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ],
                        "added": [],
                        "skipped": [],
                        "notes": "Noted",
                    },
                )
            )
        payload = {
            "week": last_monday.isoformat(),
            "timezone": "Europe/Istanbul",
            "tenant_id": self.tenant,
        }
        r = self.req(
            "POST", f'/athletes/{self.ids["athlete"]}/reports', "coach", json=payload
        )
        self.assertEqual(r["content"]["recorded_volume_kg_reps"], 315)
        self.assertEqual(r["content"]["set_adherence"], 0.5)
        self.assertEqual(r["content"]["completion_rate"], 0)
        self.assertEqual(
            r["id"],
            self.req(
                "POST",
                f'/athletes/{self.ids["athlete"]}/reports',
                "coach",
                json=payload,
            )["id"],
        )
        self.req(
            "POST", f'/reports/{r["id"]}/review', "coach", json={"status": "reviewed"}
        )
        self.req(
            "POST",
            f'/athletes/{self.ids["athlete"]}/reports',
            "othercoach",
            403,
            json=payload,
        )
        self.req(
            "POST",
            f'/athletes/{self.ids["athlete"]}/reports',
            "coach",
            403,
            json={"week": last_monday.isoformat()},
        )

    def test_library_filters_favorites_private_custom_and_media_guard(self):
        catalog = self.req("GET", "/library")
        self.assertGreaterEqual(len(catalog), 100)
        result = self.req("GET", "/library?q=Bench&muscle=chest")
        self.assertGreater(len(result), 0)
        self.req("POST", "/library/lib-bench-press/favorite?favorite=true")
        self.assertEqual(len(self.req("GET", "/library?favorite=true")), 1)
        custom = self.req(
            "POST",
            "/library",
            expected=201,
            json={
                "name": "Özel hareket",
                "muscle": "core",
                "equipment": "none",
                "measurements": ["seconds"],
            },
        )
        self.assertNotIn(
            custom["id"], [e["id"] for e in self.req("GET", "/library", "stranger")]
        )
        self.req(
            "POST",
            "/library",
            expected=422,
            json={
                "name": "Unsafe media",
                "muscle": "core",
                "equipment": "none",
                "measurements": ["seconds"],
                "media": [{"url": "fake"}],
            },
        )

    def test_personal_plans_hidden_from_facility_coaches_and_scheduled_worker_protected(
        self,
    ):
        self.link()
        p = self.req(
            "POST",
            "/plans",
            expected=201,
            json={"id": str(uuid4()), "content": self.content},
        )
        visible = self.req(
            "GET", f'/overview?athlete_id={self.ids["athlete"]}', "coach"
        )
        self.assertNotIn(p["id"], [x["id"] for x in visible["plans"]])
        self.req("GET", f'/plans/{p["id"]}/versions', "coach", 403)
        self.req("GET", "/jobs/weekly-reports", expected=503)
        with patch.dict("os.environ", {"CRON_SECRET": "a" * 40}):
            self.req("GET", "/jobs/weekly-reports", expected=401)

    def test_equipment_can_map_multiple_exercises_and_never_creates_a_set(self):
        _, assigned = self.plan()
        tag = self.client.post(
            f"/api/console/tenants/{self.tenant}/tags",
            headers={"Authorization": "Bearer " + self.emails["owner"]},
            json={"uid": uuid4().hex[:8], "name": "İstasyon"},
        )
        self.assertEqual(tag.status_code, 201, tag.text)
        equipment = self.req(
            "POST",
            f"/tenants/{self.tenant}/equipment",
            "owner",
            json={
                "id": str(uuid4()),
                "tag_id": tag.json()["id"],
                "name": "Çok amaçlı makine",
                "equipment_type": "machine",
                "exercise_ids": ["lib-bench-press", "lib-cable-curl"],
            },
        )
        w = self.workout(assigned[0])
        context = self.req("GET", f'/equipment/{tag.json()["id"]}?workout_id={w["id"]}')
        self.assertEqual(len(context["matches"]), 1)
        self.assertTrue(context["requires_confirmation"])
        self.assertEqual(
            self.req("GET", "/overview")["workouts"][0]["actual"]["sets"], []
        )
        self.req("GET", f'/equipment/{tag.json()["id"]}', "stranger", 403)
        self.assertEqual(
            len(self.req("GET", f"/tenants/{self.tenant}/equipment", "owner")), 1
        )

    def test_cron_authentication_and_idempotent_generation(self):
        self.plan()
        with patch.dict("os.environ", {"CRON_SECRET": "test-secret-" + "x" * 40}):
            response = self.client.get(
                "/api/console/coaching/jobs/weekly-reports",
                headers={"Authorization": "Bearer " + "test-secret-" + "x" * 40},
            )
            self.assertEqual(response.status_code, 200, response.text)
            first = response.json()["reports"]
            replay = self.client.get(
                "/api/console/coaching/jobs/weekly-reports",
                headers={"Authorization": "Bearer " + "test-secret-" + "x" * 40},
            )
            self.assertEqual(replay.status_code, 200, replay.text)
            self.assertEqual(first, replay.json()["reports"])

    def test_recorded_clock_excludes_pauses_and_completed_snapshot_survives_revision(
        self,
    ):
        _, assigned = self.plan()
        w = self.workout(assigned[0])
        at = datetime.now(timezone.utc) - timedelta(hours=2)
        for action, offset in [
            ("start", 0),
            ("pause", 300),
            ("resume", 900),
            ("finish", 1200),
        ]:
            w = self.req(
                "POST",
                f'/workouts/{w["id"]}/commands',
                json={
                    "request_id": str(uuid4()),
                    "expected_version": w["version"],
                    "action": action,
                    "occurred_at": (at + timedelta(seconds=offset)).isoformat(),
                    "partial": True,
                },
            )
        self.assertEqual(w["actual"]["active_seconds"], 600)
        changed = json.loads(json.dumps(assigned[0]["content"]))
        changed["days"][0]["exercises"][0]["kg"] = 50
        self.req(
            "PATCH",
            f'/plans/{assigned[0]["id"]}',
            "coach",
            json={
                "expected_version": 1,
                "content": changed,
                "reason": "Sonraki seans hedefi",
            },
        )
        old = self.req("GET", "/overview")["workouts"][0]
        self.assertEqual(old["plan_version"], 1)
        self.assertEqual(old["snapshot"]["exercises"][0]["kg"], 40)
        self.assertEqual(old["actual"]["active_seconds"], 600)

    def test_account_timezone_is_validated_private_and_used_by_report_worker(self):
        self.req(
            "POST", "/preferences", json={"timezone": "Mars/Unknown"}, expected=422
        )
        self.req("POST", "/preferences", json={"timezone": "America/New_York"})
        self.assertEqual(self.req("GET", "/overview")["timezone"], "America/New_York")
        self.assertEqual(
            self.req("GET", "/overview", "second")["timezone"], "Europe/Istanbul"
        )
        self.plan()
        secret = "timezone-secret-" + "x" * 40
        with patch.dict("os.environ", {"CRON_SECRET": secret}):
            response = self.client.get(
                "/api/console/coaching/jobs/weekly-reports",
                headers={"Authorization": "Bearer " + secret},
            )
        self.assertEqual(response.status_code, 200, response.text)
        with ConsoleSession() as db:
            reports = (
                db.query(WeeklyReport).filter_by(athlete_id=self.ids["athlete"]).all()
            )
            self.assertTrue(reports)
            self.assertEqual({r.timezone for r in reports}, {"America/New_York"})

    def test_daily_reminders_are_authorized_deduplicated_and_stop_after_revocation(
        self,
    ):
        _, plans = self.plan()
        # Move the clock beyond the scheduled day without mutating historical plans.
        date = plans[0]["content"]["days"][0]["dates"][0]
        clock = datetime.fromisoformat(date + "T12:00:00+00:00") + timedelta(days=1)
        secret = "daily-secret-" + "x" * 40
        with patch.dict("os.environ", {"CRON_SECRET": secret}), patch(
            "coaching.now", return_value=clock
        ):
            self.req("GET", "/jobs/daily-reminders", expected=401)
            first = self.client.get(
                "/api/console/coaching/jobs/daily-reminders",
                headers={"Authorization": "Bearer " + secret},
            )
            self.assertEqual(first.status_code, 200, first.text)
            self.assertGreaterEqual(first.json()["notifications"], 3)
            second = self.client.get(
                "/api/console/coaching/jobs/daily-reminders",
                headers={"Authorization": "Bearer " + secret},
            )
            self.assertEqual(second.json()["notifications"], 0)
        with ConsoleSession.begin() as db:
            for row in db.query(Membership).filter_by(tenant_id=self.tenant):
                row.status = "revoked"
        with patch.dict("os.environ", {"CRON_SECRET": secret}), patch(
            "coaching.now", return_value=clock
        ):
            denied = self.client.get(
                "/api/console/coaching/jobs/daily-reminders",
                headers={"Authorization": "Bearer " + secret},
            )
            self.assertEqual(denied.json()["notifications"], 0)

    def test_prepared_future_workout_refresh_is_explicit_idempotent_and_preserves_actuals(
        self,
    ):
        _, plans = self.plan()
        w = self.workout(plans[0])
        revised = json.loads(json.dumps(plans[0]["content"]))
        revised["days"][0]["exercises"][0]["kg"] = 55
        self.req(
            "PATCH",
            f'/plans/{plans[0]["id"]}',
            "coach",
            json={"expected_version": 1, "reason": "Progression", "content": revised},
        )
        before = next(
            x for x in self.req("GET", "/overview")["workouts"] if x["id"] == w["id"]
        )
        self.assertEqual(before["snapshot"]["exercises"][0]["kg"], 40)
        payload = {"request_id": str(uuid4()), "expected_version": w["version"]}
        path = f'/workouts/{w["id"]}/refresh-plan'
        updated = self.req("POST", path, json=payload)
        self.assertEqual(updated["plan_version"], 2)
        self.assertEqual(updated["snapshot"]["exercises"][0]["kg"], 55)
        self.assertEqual(self.req("POST", path, json=payload), updated)
        self.req("POST", path, "second", 404, json=payload)
        self.command(updated, "start")
        self.req(
            "POST",
            path,
            json={
                "request_id": str(uuid4()),
                "expected_version": updated["version"] + 1,
            },
            expected=409,
        )

    def test_coach_dashboard_requires_explicit_active_staff_not_ordinary_membership(
        self,
    ):
        escalation = self.client.post(
            f"/api/console/tenants/{self.tenant}/staff",
            headers={"Authorization": "Bearer " + self.emails["athlete"]},
            json={"email": self.emails["athlete"], "role": "coach"},
        )
        self.assertEqual(escalation.status_code, 403, escalation.text)
        self.req("GET", "/dashboard", expected=403)
        self.req("GET", "/dashboard", "stranger", 403)
        self.assertEqual(self.req("GET", "/dashboard", "coach"), [])
        self.assertEqual(self.req("GET", "/dashboard", "owner"), [])
        self.link()
        dashboard = self.req("GET", "/dashboard", "coach")
        self.assertEqual([r["athlete_id"] for r in dashboard], [self.ids["athlete"]])
        # Membership and being assigned to a coach never grant the coach role.
        self.req("GET", "/dashboard", expected=403)
        self.req("GET", "/overview?athlete_id=" + self.ids["second"], expected=403)
        self.req("GET", "/library")  # Ordinary members can still browse exercises.
        with ConsoleSession.begin() as db:
            staff = (
                db.query(TenantStaff)
                .filter_by(tenant_id=self.tenant, account_id=self.ids["coach"])
                .one()
            )
            staff.status = "suspended"
        self.req("GET", "/dashboard", "coach", 403)
        with ConsoleSession.begin() as db:
            db.get(Tenant, self.tenant).status = "suspended"
        self.req("GET", "/dashboard", "owner", 403)

    def test_new_member_template_rebase_review_comment_and_isolation(self):
        # Each setup creates fresh users, facility, coach and members in a disposable DB.
        self.link()
        self.link("second")
        content = json.loads(json.dumps(self.content))
        original = datetime.now(timezone.utc).date() - timedelta(days=60)
        content["start_date"] = original.isoformat()
        content["days"][0]["dates"] = [(original + timedelta(days=2)).isoformat()]
        template = self.req("POST", "/plans", "coach", 201, json={
            "id": str(uuid4()), "tenant_id": self.tenant, "content": content,
        })
        start = datetime.now(ZoneInfo("Europe/Istanbul")).date() + timedelta(days=1)
        payload = {"request_id": str(uuid4()), "athlete_ids": [self.ids["athlete"], self.ids["second"]], "start_date": start.isoformat()}
        copies = self.req("POST", f'/plans/{template["id"]}/assign', "coach", 201, json=payload)
        replay = self.req("POST", f'/plans/{template["id"]}/assign', "coach", 201, json=payload)
        self.assertEqual([p["id"] for p in copies], [p["id"] for p in replay])
        self.assertEqual(copies[0]["content"]["days"][0]["dates"], [(start + timedelta(days=2)).isoformat()])
        self.assertEqual(copies[0]["content"]["start_date"], start.isoformat())
        self.assertEqual(self.req("GET", "/overview")["plans"][0]["id"], copies[0]["id"])
        self.req("POST", f'/plans/{template["id"]}/assign', "coach", 409, json={**payload, "start_date": (start + timedelta(days=1)).isoformat()})
        self.req("POST", f'/plans/{template["id"]}/assign', "athlete", 403, json={**payload, "request_id": str(uuid4())})
        changed = json.loads(json.dumps(copies[0]["content"]))
        changed["days"][0]["exercises"][0]["reps"] = 6
        self.req("PATCH", f'/plans/{copies[0]["id"]}', "coach", json={"expected_version": 1, "reason": "Yeni üyeye uyarlama", "content": changed})
        other = self.req("GET", "/overview", "second")["plans"][0]
        self.assertEqual(other["content"]["days"][0]["exercises"][0]["reps"], 10)
        self.assertEqual(self.req("GET", f'/plans/{template["id"]}/versions', "coach")[0]["content"]["start_date"], original.isoformat())
        link = self.req("GET", "/overview", "coach")["links"]
        link_id = next(l["id"] for l in link if l["athlete_id"] == self.ids["athlete"])
        revision = self.req("GET", f'/plans/{copies[0]["id"]}/versions', "coach")[-1]
        note = {"id": str(uuid4()), "link_id": link_id, "body": "Programını seviyene göre düzenledim.", "context_type": "revision", "context_id": revision["id"]}
        self.req("POST", "/messages", "coach", 201, json=note)
        self.req("POST", "/messages", "coach", 201, json=note)
        self.assertEqual(len(self.req("GET", "/overview")["messages"]), 1)
        self.assertEqual(self.req("GET", "/overview", "second")["messages"], [])

    def test_library_media_is_read_only_and_preserves_training_history(self):
        from coaching import LibraryExercise
        _, assigned = self.plan()
        workout = self.workout(assigned[0])
        workout = self.command(workout, "start")
        self.command(workout, "set", actual_set={"id": str(uuid4()), "exercise_key": self.exercise, "set_number": 1, "reps": 10, "kg": 40, "occurred_at": datetime.now(timezone.utc).isoformat()})
        def snapshot():
            with ConsoleSession() as db:
                return json.dumps({
                    "library": [(e.id, e.owner_id, e.content) for e in db.query(LibraryExercise).order_by(LibraryExercise.id)],
                    "versions": [(v.id, v.content) for v in db.query(PlanVersion).order_by(PlanVersion.id)],
                    "workouts": [(w.id, w.snapshot, w.actual) for w in db.query(Workout).order_by(Workout.id)],
                }, sort_keys=True, default=str)
        before = snapshot()
        catalog = self.req("GET", "/library", "coach")
        bench = next(e for e in catalog if e["id"] == "lib-bench-press")
        self.assertEqual({m["role"] for m in bench["media"]}, {"thumbnail", "position_1", "position_2"})
        self.assertTrue(all(m["license"] == "CC BY-SA 4.0" for m in bench["media"]))
        self.assertEqual(snapshot(), before)
