import os
import sys
import tempfile
import unittest
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import NAMESPACE_URL, uuid4, uuid5

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker


_test_db = Path(tempfile.gettempdir()) / f"nfcfit-tenant-console-{uuid4().hex}.db"
os.environ["DATABASE_URL"] = os.environ.get("TRAINER_TEST_DATABASE_URL", f"sqlite:///{_test_db}")
os.environ["ENVIRONMENT"] = "development"
os.environ["CONSOLE_SUPERADMIN_EMAIL"] = "platform@nfcfit.test"
os.environ["CONSOLE_SUPERADMIN_NAME"] = "Test Platform Admin"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app import app
from tenant_console import Account, Activity, ConsoleSession, NfcTag, _get_or_link_account, _fetch_supabase_identity, _normalize_database_url, _normalize_tag_uid, initialize_console_schema
class TenantConsoleFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()
        cls.identity_patcher = patch("tenant_console._fetch_supabase_identity", side_effect=cls.identity_for_token)
        cls.identity_patcher.start()

    @classmethod
    def tearDownClass(cls):
        cls.identity_patcher.stop()
        cls.client_context.__exit__(None, None, None)
        if _test_db.exists():
            _test_db.unlink()

    @staticmethod
    def identity_for_token(token):
        if token.startswith("unverified:"):
            email = token.split(":", 1)[1]
            return {
                "id": str(uuid5(NAMESPACE_URL, token)),
                "email": email,
                "name": "Unverified",
                "email_confirmed": False,
            }
        if token.startswith("other-id:"):
            email = token.split(":", 1)[1]
            return {
                "id": str(uuid5(NAMESPACE_URL, token)),
                "email": email,
                "name": "Different account",
                "email_confirmed": True,
            }
        email = token
        return {
            "id": str(uuid5(NAMESPACE_URL, email)),
            "email": email,
            "name": email.split("@", 1)[0].title(),
            "email_confirmed": True,
        }

    @staticmethod
    def auth_headers(email):
        return {"Authorization": f"Bearer {email}"}

    def request_json(self, method, path, *, headers=None, expected=200, **kwargs):
        response = self.client.request(method, path, headers=headers, **kwargs)
        self.assertEqual(response.status_code, expected, response.text)
        return response.json() if response.content else None

    def test_postgres_urls_select_the_installed_psycopg_driver(self):
        self.assertEqual(
            _normalize_database_url("postgres://user:pass@db.example/test"),
            "postgresql+psycopg://user:pass@db.example/test",
        )
        self.assertEqual(
            _normalize_database_url("postgresql://user:pass@db.example/test"),
            "postgresql+psycopg://user:pass@db.example/test",
        )

    def test_uid_formats_preserve_hex_bytes_and_synthetic_identifiers(self):
        for value in ("04a1b2c3", "04:A1:B2:C3", "04-a1-b2-c3", " 04 A1 B2 C3 "):
            self.assertEqual(_normalize_tag_uid(value), "04A1B2C3")
        self.assertEqual(_normalize_tag_uid("0000a1b2"), "0000A1B2")
        self.assertEqual(_normalize_tag_uid("NFCFIT-TEST-PLANK-01"), "NFCFIT-TEST-PLANK-01")
        self.assertEqual(_normalize_tag_uid("PLANK-deadbeef"), "PLANK-deadbeef")

    def test_tenant_join_approval_nfc_record_and_isolation(self):
        platform_headers = self.auth_headers("platform@nfcfit.test")
        self.request_json("GET", "/api/console/auth/me", headers=platform_headers)

        slug = f"northside-{uuid4().hex[:8]}"
        owner_email = f"owner-{slug}@nfcfit.test"
        tenant = self.request_json(
            "POST",
            "/api/console/platform/tenants",
            headers=platform_headers,
            expected=201,
            json={
                "name": "Northside Fitness",
                "slug": slug,
                "plan": "Basic",
                "member_limit": 5,
                "card_limit": 5,
                "owner_name": "Center Owner",
                "owner_email": owner_email,
            },
        )
        owner_headers = self.auth_headers(owner_email)
        owner_identity = self.request_json("GET", "/api/console/auth/me", headers=owner_headers)
        owner_access = next(row for row in owner_identity["staff"] if row["tenant_id"] == tenant["id"])
        self.assertEqual((owner_access["role"], owner_access["status"]), ("CLUB_ADMIN", "active"))
        admin_email = f"admin-{slug}@nfcfit.test"
        self.request_json(
            "POST",
            f"/api/console/tenants/{tenant['id']}/staff",
            headers=owner_headers,
            expected=201,
            json={"name": "Center Admin", "email": admin_email, "role": "admin"},
        )
        admin_headers = self.auth_headers(admin_email)
        admin_promotion = self.client.post(
            f"/api/console/tenants/{tenant['id']}/staff",
            headers=admin_headers,
            json={"name": "Unexpected Admin", "email": f"unexpected-{slug}@nfcfit.test", "role": "admin"},
        )
        self.assertEqual(admin_promotion.status_code, 403)
        owner_staff = next(
            row for row in self.request_json("GET", f"/api/console/tenants/{tenant['id']}/staff", headers=owner_headers)
            if row["role"] in {"owner", "CLUB_ADMIN"}
        )
        owner_lockout = self.client.patch(
            f"/api/console/tenants/{tenant['id']}/staff/{owner_staff['id']}",
            headers=admin_headers,
            json={"status": "suspended"},
        )
        self.assertEqual(owner_lockout.status_code, 403)

        exercise = self.request_json(
            "POST",
            f"/api/console/tenants/{tenant['id']}/exercises",
            headers=owner_headers,
            expected=201,
            json={"name": "Plank", "category": "core", "unit": "seconds", "default_quantity": 30, "default_calories": 5},
        )
        physical_uid = f"04{uuid4().hex[:12]}".upper()
        formatted_uid = ":".join(physical_uid[i:i + 2] for i in range(0, len(physical_uid), 2)).lower()
        tag = self.request_json(
            "POST",
            f"/api/console/tenants/{tenant['id']}/tags",
            headers=owner_headers,
            expected=201,
            json={"uid": formatted_uid, "name": "Plank zone", "exercise_id": exercise["id"]},
        )
        self.assertEqual(tag["uid"], physical_uid)
        self.request_json(
            "POST", f"/api/console/tenants/{tenant['id']}/tags", headers=owner_headers, expected=409,
            json={"uid": physical_uid.lower(), "name": "Duplicate", "exercise_id": exercise["id"]},
        )

        # Simulate a card registered before UID normalization was introduced.
        with ConsoleSession() as db:
            db.get(NfcTag, tag["id"]).uid = formatted_uid
            db.commit()
        self.request_json(
            "POST", f"/api/console/tenants/{tenant['id']}/tags", headers=owner_headers, expected=409,
            json={"uid": physical_uid, "name": "Legacy duplicate", "exercise_id": exercise["id"]},
        )

        member_email = f"member-{slug}@nfcfit.test"
        member_headers = self.auth_headers(member_email)
        member = self.request_json("GET", "/api/console/auth/me", headers=member_headers)
        self.assertEqual(member["staff"], [])
        self.assertEqual(member["account"]["email"], member_email)
        self.assertTrue(member["account"]["id"])

        scan = self.request_json("POST", "/api/console/nfc/scan", headers=member_headers, json={"uid": tag["uid"]})
        self.assertEqual(scan["result"], "join_request_pending")
        formatted_scan = self.request_json("POST", "/api/console/nfc/scan", headers=member_headers, json={"uid": formatted_uid})
        self.assertEqual(formatted_scan["result"], "join_request_pending")
        join_request = self.request_json(
            "GET",
            f"/api/console/tenants/{tenant['id']}/members?status=pending",
            headers=owner_headers,
        )[0]
        denied_record = self.client.post(
            "/api/console/nfc/record",
            headers=member_headers,
            json={"tag_id": tag["id"]},
        )
        self.assertEqual(denied_record.status_code, 403)

        approved = self.request_json(
            "POST",
            f"/api/console/tenants/{tenant['id']}/join-requests/{join_request['id']}/review",
            headers=owner_headers,
            json={"decision": "approve"},
        )
        self.assertEqual(approved["status"], "active")
        confirmation = self.request_json("POST", "/api/console/nfc/scan", headers=member_headers, json={"uid": tag["uid"]})
        self.assertEqual(confirmation["result"], "activity_confirmation_required")
        record_request = str(uuid4())
        recorded = self.request_json(
            "POST",
            "/api/console/nfc/record",
            headers=member_headers,
            expected=201,
            json={"tag_id": tag["id"], "quantity": 30, "request_id": record_request},
        )
        self.assertEqual((recorded["exercise"], recorded["quantity"], recorded["unit"]), ("Plank", 30, "seconds"))
        self.assertEqual(recorded["tenant_id"], tenant["id"])
        self.assertEqual(recorded["tag_id"], tag["id"])
        self.assertTrue(recorded["exercise_id"])

        retried = self.request_json("POST", "/api/console/nfc/record", headers=member_headers, expected=201, json={"tag_id": tag["id"], "quantity": 30, "request_id": record_request})
        self.assertEqual(retried["id"], recorded["id"])
        self.request_json("POST", "/api/console/nfc/record", headers=member_headers, expected=409, json={"tag_id": tag["id"], "quantity": 31, "request_id": record_request})
        self.request_json("POST", "/api/console/nfc/record", headers=owner_headers, expected=403, json={"tag_id": tag["id"], "quantity": 30, "request_id": record_request})

        second_slug = f"lakeside-{uuid4().hex[:8]}"
        second_owner_email = f"owner-{second_slug}@nfcfit.test"
        second_tenant = self.request_json(
            "POST",
            "/api/console/platform/tenants",
            headers=platform_headers,
            expected=201,
            json={
                "name": "Lakeside Fitness",
                "slug": second_slug,
                "plan": "Basic",
                "member_limit": 5,
                "card_limit": 5,
                "owner_name": "Second Owner",
                "owner_email": second_owner_email,
            },
        )
        second_owner_headers = self.auth_headers(second_owner_email)
        second_exercise = self.request_json(
            "POST",
            f"/api/console/tenants/{second_tenant['id']}/exercises",
            headers=second_owner_headers,
            expected=201,
            json={"name": "Squat", "category": "strength", "unit": "repetition", "default_quantity": 12, "default_calories": 10},
        )
        second_tag = self.request_json(
            "POST",
            f"/api/console/tenants/{second_tenant['id']}/tags",
            headers=second_owner_headers,
            expected=201,
            json={"uid": f"SQUAT-{uuid4().hex[:8]}", "name": "Squat rack", "exercise_id": second_exercise["id"]},
        )
        second_scan = self.request_json(
            "POST",
            "/api/console/nfc/scan",
            headers=member_headers,
            json={"uid": second_tag["uid"]},
        )
        self.assertEqual(second_scan["result"], "join_request_pending")
        second_join = self.request_json(
            "GET",
            f"/api/console/tenants/{second_tenant['id']}/members?status=pending",
            headers=second_owner_headers,
        )[0]
        self.request_json(
            "POST",
            f"/api/console/tenants/{second_tenant['id']}/join-requests/{second_join['id']}/review",
            headers=second_owner_headers,
            json={"decision": "approve"},
        )
        self.request_json(
            "POST",
            "/api/console/nfc/record",
            headers=member_headers,
            expected=201,
            json={"tag_id": second_tag["id"]},
        )

        first_tenant_activity = self.request_json(
            "GET",
            f"/api/console/tenants/{tenant['id']}/activities",
            headers=owner_headers,
        )
        second_tenant_activity = self.request_json(
            "GET",
            f"/api/console/tenants/{second_tenant['id']}/activities",
            headers=second_owner_headers,
        )
        personal_activity = self.request_json("GET", "/api/console/me/activities", headers=member_headers)
        self.assertEqual((len(first_tenant_activity), len(second_tenant_activity), len(personal_activity)), (1, 1, 2))
        self.assertEqual({row["tenant_id"] for row in personal_activity}, {tenant["id"], second_tenant["id"]})
        self.assertTrue(all(row["exercise_id"] and row["tag_id"] for row in personal_activity))
        self.assertEqual(self.request_json("GET", "/api/console/me/activities", headers=second_owner_headers), [])

        local_day = (datetime.now(timezone.utc) + timedelta(hours=3)).date().isoformat()
        fitness_path = f"/api/console/me/fitness?day={local_day}&utc_offset_minutes=180"
        fitness = self.request_json("GET", fitness_path, headers=member_headers)
        self.assertEqual(sum(row["day"]["count"] for row in fitness["exercises"]), 2)
        self.assertEqual(len(fitness["timeline"]), 14)
        self.assertEqual(fitness["timeline"][-1], {"day": local_day, "count": 2})
        self.assertEqual({row["tenant_id"] for row in fitness["exercises"]}, {tenant["id"], second_tenant["id"]})
        goal_path = f"/api/console/me/exercise-goals/{exercise['id']}"
        for invalid in (0, -1, 100001):
            self.request_json("POST", goal_path, headers=member_headers, expected=422, json={"unit": "seconds", "target_quantity": invalid})
        self.request_json("POST", goal_path, headers=owner_headers, expected=403, json={"unit": "seconds", "target_quantity": 60})
        self.request_json("POST", goal_path, headers=member_headers, expected=409, json={"unit": "repetition", "target_quantity": 60})
        self.request_json("POST", goal_path, headers=member_headers, json={"unit": "seconds", "target_quantity": 60})
        self.request_json("POST", goal_path, headers=member_headers, json={"unit": "seconds", "target_quantity": 90})
        goals = self.request_json("GET", fitness_path, headers=member_headers)["exercises"]
        saved_goal = next(row for row in goals if row["exercise_id"] == exercise["id"])
        self.assertEqual((saved_goal["target_quantity"], saved_goal["day"]["quantity"], saved_goal["can_edit"]), (90, 30, True))
        self.assertEqual(self.request_json("GET", fitness_path, headers=second_owner_headers)["exercises"], [])
        self.request_json("GET", f"/api/console/me/fitness?day={local_day}&utc_offset_minutes=9999", headers=member_headers, expected=422)
        with patch("tenant_console._fetch_supabase_identity", side_effect=self.identity_for_token) as verification:
            combined = self.request_json("GET", f"/api/console/tenants/{tenant['id']}/management", headers=owner_headers)
            self.assertEqual(verification.call_count, 1)
        self.assertEqual(combined["tags"][0]["id"], tag["id"])
        self.assertTrue(combined["staff"])
        self.request_json("GET", f"/api/console/tenants/{tenant['id']}/management", headers=member_headers, expected=403)

        # Mobile management uses these same routes and must retain web permissions.
        coach_email = f"coach-{slug}@nfcfit.test"
        coach_headers = self.auth_headers(coach_email)
        coach = self.request_json(
            "POST", f"/api/console/tenants/{tenant['id']}/staff", headers=owner_headers, expected=201,
            json={"name": "Mobile Coach", "email": coach_email, "role": "coach"},
        )
        self.request_json("GET", f"/api/console/tenants/{tenant['id']}/management", headers=coach_headers, expected=403)
        for resource in ("dashboard", "members", "tags", "exercises", "activities"):
            self.request_json("GET", f"/api/console/tenants/{tenant['id']}/{resource}", headers=coach_headers, expected=200 if resource == "exercises" else 403)
        self.request_json("GET", f"/api/console/tenants/{tenant['id']}/staff", headers=coach_headers, expected=403)
        for path, payload in (
            (f"tags/{tag['id']}", {"name": "Unauthorized edit"}),
            (f"members/{join_request['id']}", {"status": "suspended"}),
            (f"staff/{coach['id']}", {"role": "admin"}),
        ):
            self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/{path}", headers=coach_headers, expected=403, json=payload)

        edited_tag = self.request_json(
            "PATCH", f"/api/console/tenants/{tenant['id']}/tags/{tag['id']}", headers=owner_headers,
            json={"name": "Mobile Plank", "exercise_id": exercise["id"], "active": False},
        )
        self.assertEqual(edited_tag["name"], "Mobile Plank")
        inactive_retry = self.request_json("POST", "/api/console/nfc/record", headers=member_headers, expected=201, json={"tag_id": tag["id"], "quantity": 30, "request_id": record_request})
        self.assertEqual(inactive_retry["id"], recorded["id"])

        self.request_json("POST", "/api/console/nfc/scan", headers=member_headers, expected=410, json={"uid": tag["uid"]})
        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/tags/{tag['id']}", headers=owner_headers, json={"active": True})
        exercise_payload = {"name": "Plank", "category": "core", "unit": "seconds", "default_quantity": 45, "default_calories": 5, "active": True}
        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/exercises/{exercise['id']}", headers=coach_headers, expected=403, json=exercise_payload)
        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/exercises/{exercise['id']}", headers=owner_headers, json=exercise_payload)
        updated_scan = self.request_json("POST", "/api/console/nfc/scan", headers=member_headers, json={"uid": tag["uid"]})
        self.assertEqual(updated_scan["exercise"]["default_quantity"], 45)

        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/members/{join_request['id']}", headers=owner_headers, json={"status": "suspended"})
        self.request_json("POST", "/api/console/nfc/record", headers=member_headers, expected=403, json={"tag_id": tag["id"]})
        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/members/{join_request['id']}", headers=owner_headers, json={"status": "active"})

        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/staff/{coach['id']}", headers=owner_headers, json={"role": "admin"})
        self.request_json("GET", f"/api/console/tenants/{tenant['id']}/staff", headers=coach_headers)
        self.request_json("PATCH", f"/api/console/tenants/{tenant['id']}/staff/{coach['id']}", headers=owner_headers, json={"status": "suspended"})
        suspended_identity = self.request_json("GET", "/api/console/auth/me", headers=coach_headers)
        self.assertFalse(any(row["status"] == "active" for row in suspended_identity["staff"]))
        self.request_json("GET", f"/api/console/tenants/{tenant['id']}/dashboard", headers=coach_headers, expected=403)
        # Managing a card or scanning it for confirmation must not create activity.
        self.assertEqual(len(self.request_json("GET", f"/api/console/tenants/{tenant['id']}/activities", headers=owner_headers)), 1)

        outsider_headers = self.auth_headers(f"outsider-{slug}@nfcfit.test")
        self.request_json("GET", "/api/console/auth/me", headers=outsider_headers)
        cross_tenant = self.client.get(f"/api/console/tenants/{tenant['id']}/members", headers=outsider_headers)
        self.assertEqual(cross_tenant.status_code, 403)
        platform_denied = self.client.post("/api/console/platform/tenants", headers=outsider_headers, json={})
        self.assertEqual(platform_denied.status_code, 403)

        # The report includes >100 records, preserves historical units, and uses local midnight.
        midnight = datetime.fromisoformat(local_day).replace(tzinfo=timezone(timedelta(hours=3))).astimezone(timezone.utc)
        with ConsoleSession.begin() as db:
            original = db.get(Activity, recorded["id"])
            for number in range(120):
                db.add(Activity(tenant_id=tenant["id"], account_id=original.account_id, exercise_id=exercise["id"], tag_id=tag["id"], quantity=1, unit="seconds", created_at=midnight + timedelta(minutes=1)))
            db.add(Activity(tenant_id=tenant["id"], account_id=original.account_id, exercise_id=exercise["id"], quantity=999, unit="seconds", created_at=midnight - timedelta(seconds=1)))
            db.add(Activity(tenant_id=tenant["id"], account_id=original.account_id, exercise_id=exercise["id"], quantity=7, unit="repetition", created_at=midnight + timedelta(minutes=1)))
        report = self.request_json("GET", fitness_path, headers=member_headers)["exercises"]
        seconds = next(row for row in report if row["exercise_id"] == exercise["id"] and row["unit"] == "seconds")
        repetitions = next(row for row in report if row["exercise_id"] == exercise["id"] and row["unit"] == "repetition")
        self.assertEqual((seconds["day"]["count"], seconds["day"]["quantity"]), (121, 150))
        self.assertEqual((repetitions["day"]["quantity"], repetitions["can_edit"], repetitions["target_quantity"]), (7, False, None))
        self.assertEqual(len(self.request_json("GET", "/api/console/me/activities", headers=member_headers)), 100)
        final_report = self.request_json("GET", fitness_path, headers=member_headers)
        self.assertEqual(final_report["timeline"][-1]["count"], 123)
        self.assertEqual(sum(row["day"]["count"] for row in final_report["exercises"]), 123)

    def test_offline_catalog_deltas_record_replay_conflicts_and_history_pagination(self):
        suffix=uuid4().hex[:8]
        platform=self.auth_headers('platform@nfcfit.test')
        owner=self.auth_headers(f'offline-owner-{suffix}@nfcfit.test')
        member=self.auth_headers(f'offline-member-{suffix}@nfcfit.test')
        tenant=self.request_json('POST','/api/console/platform/tenants',headers=platform,expected=201,json={'name':'Offline Club','slug':f'offline-{suffix}','owner_name':'Offline Owner','owner_email':f'offline-owner-{suffix}@nfcfit.test'})
        base=f"/api/console/tenants/{tenant['id']}"
        exercise=self.request_json('POST',f'{base}/exercises',headers=owner,expected=201,json={'name':'Plank','unit':'seconds','default_quantity':30})
        tag=self.request_json('POST',f'{base}/tags',headers=owner,expected=201,json={'uid':f'OFFLINE-{suffix}','name':'Plank card','exercise_id':exercise['id']})
        self.request_json('POST','/api/console/nfc/scan',headers=member,json={'uid':tag['uid']})
        pull='/api/console/me/offline/pull'
        pending=self.request_json('POST',pull,headers=member,json={})
        catalog=pending['catalogs'][0]
        self.assertEqual(catalog['membership_status'],'pending')
        self.assertEqual(len(catalog['tags']['upsert']),1)
        self.assertEqual(len(catalog['exercises']['upsert']),1)
        self.assertNotIn('members',catalog)
        self.assertNotIn('staff',catalog)
        manifest={tenant['id']:{kind:{row['data']['id']:row['hash'] for row in catalog[kind]['upsert']} for kind in ('tags','exercises')}}
        self.assertEqual(self.request_json('POST',pull,headers=owner,json={'catalogs':manifest})['catalogs'],[])
        event={'request_id':str(uuid4()),'tag_id':tag['id'],'exercise_id':exercise['id'],'quantity':30,'unit':'seconds','occurred_at':(datetime.now(timezone.utc)-timedelta(days=3)).isoformat()}
        push='/api/console/me/offline/push'
        rejected=self.request_json('POST',push,headers=member,json={'activities':[event]})['results'][0]
        self.assertEqual(rejected['status'],'rejected')
        join=self.request_json('GET',f'{base}/members',headers=owner)[0]
        self.request_json('POST',f"{base}/join-requests/{join['id']}/review",headers=owner,json={'decision':'approve'})
        unchanged=self.request_json('POST',pull,headers=member,json={'catalogs':manifest})
        self.assertEqual(unchanged['catalogs'][0]['membership_status'],'active')
        self.assertEqual(unchanged['catalogs'][0]['tags']['upsert'],[])
        self.assertEqual(unchanged['catalogs'][0]['exercises']['upsert'],[])
        accepted=self.request_json('POST',push,headers=member,json={'activities':[event]})['results'][0]
        replay=self.request_json('POST',push,headers=member,json={'activities':[event]})['results'][0]
        self.assertEqual(accepted['status'],'accepted')
        self.assertEqual(accepted['receipt']['id'],replay['receipt']['id'])
        self.assertEqual(datetime.fromisoformat(accepted['receipt']['created_at']),datetime.fromisoformat(event['occurred_at']))
        self.assertGreater(datetime.fromisoformat(accepted['receipt']['received_at']),datetime.fromisoformat(event['occurred_at']))
        changed={**event,'quantity':31}
        self.assertEqual(self.request_json('POST',push,headers=member,json={'activities':[changed]})['results'][0]['status'],'rejected')
        renamed={**exercise,'name':'Plank updated','default_quantity':45}
        self.request_json('PATCH',f"{base}/exercises/{exercise['id']}",headers=owner,json=renamed)
        delta=self.request_json('POST',pull,headers=member,json={'catalogs':manifest})['catalogs'][0]
        self.assertEqual(len(delta['exercises']['upsert']),1)
        self.assertEqual(delta['tags']['upsert'],[])
        self.request_json('PATCH',f"{base}/exercises/{exercise['id']}",headers=owner,json={**renamed,'unit':'repetition'})
        stale={**event,'request_id':str(uuid4())}
        self.assertEqual(self.request_json('POST',push,headers=member,json={'activities':[stale]})['results'][0]['status'],'rejected')
        self.request_json('PATCH',f"{base}/exercises/{exercise['id']}",headers=owner,json=renamed)
        self.request_json('DELETE',f"{base}/tags/{tag['id']}",headers=owner,expected=204)
        tombstone=self.request_json('POST',pull,headers=member,json={'catalogs':manifest})['catalogs'][0]
        self.assertEqual(tombstone['tags']['delete'],[tag['id']])
        replay_after_delete=self.request_json('POST',push,headers=member,json={'activities':[event]})['results'][0]
        self.assertEqual(replay_after_delete['receipt']['id'],accepted['receipt']['id'])
        self.assertIsNone(replay_after_delete['receipt']['tag_id'])
        self.assertEqual(self.request_json('POST',push,headers=member,json={'activities':[stale]})['results'][0]['status'],'rejected')
        goal={'request_id':str(uuid4()),'exercise_id':exercise['id'],'unit':'seconds','target_quantity':60,'base_target':None}
        self.assertEqual(self.request_json('POST',push,headers=member,json={'goals':[goal]})['results'][0]['status'],'accepted')
        self.assertEqual(self.request_json('POST',push,headers=member,json={'goals':[goal]})['results'][0]['status'],'accepted')
        self.assertEqual(self.request_json('POST',push,headers=member,json={'goals':[{**goal,'target_quantity':90}]})['results'][0]['status'],'rejected')
        self.assertEqual(self.request_json('POST',push,headers=member,json={'goals':[{**goal,'target_quantity':90,'base_target':60}]})['results'][0]['status'],'accepted')
        # Old occurrence dates must still arrive using the later received-at watermark.
        since=(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()
        self.assertEqual(len(self.request_json('POST',pull,headers=member,json={'history_since':since})['history']),1)
        with ConsoleSession.begin() as db:
            original=db.get(Activity,accepted['receipt']['id'])
            for number in range(505):
                db.add(Activity(tenant_id=tenant['id'],account_id=original.account_id,exercise_id=exercise['id'],quantity=1,unit='seconds',created_at=datetime.now(timezone.utc)-timedelta(days=5)))
        first=self.request_json('POST',pull,headers=member,json={})
        self.assertEqual(len(first['history']),500)
        self.assertIsNotNone(first['history_page'])
        second=self.request_json('POST',pull,headers=member,json={'history_until':first['history_until'],'history_page':first['history_page']})
        self.assertEqual(len(second['history']),6)
        self.assertIsNone(second['history_page'])
        self.assertEqual(len({row['id'] for row in first['history']+second['history']}),506)
        self.assertEqual(self.request_json('POST',pull,headers=owner,json={})['history'],[])
        self.request_json('POST',pull,headers=member,expected=422,json={'history_since':'2026-11-07T10:00:00'})

    def test_unchanged_linked_identity_does_not_commit_or_refresh_account(self):
        email = f"unchanged-{uuid4().hex}@nfcfit.test"
        headers = self.auth_headers(email)
        self.request_json("GET", "/api/console/auth/me", headers=headers)
        with ConsoleSession() as db:
            with patch.object(db, "commit", wraps=db.commit) as commit, patch.object(db, "refresh", wraps=db.refresh) as refresh:
                account = _get_or_link_account(db, self.identity_for_token(email))
                self.assertEqual(account.email, email)
                self.assertEqual(commit.call_count, 0)
                self.assertEqual(refresh.call_count, 0)


    def test_unassigned_tag_can_be_assigned_detached_and_deleted_without_losing_activity(self):
        suffix = uuid4().hex[:8]
        platform = self.auth_headers("platform@nfcfit.test")
        owner = self.auth_headers(f"inventory-owner-{suffix}@nfcfit.test")
        member = self.auth_headers(f"inventory-member-{suffix}@nfcfit.test")
        coach = self.auth_headers(f"inventory-coach-{suffix}@nfcfit.test")
        tenant = self.request_json("POST", "/api/console/platform/tenants", headers=platform, expected=201, json={
            "name": "Inventory Club", "slug": f"inventory-{suffix}", "owner_name": "Inventory Owner", "owner_email": f"inventory-owner-{suffix}@nfcfit.test",
        })
        base = f"/api/console/tenants/{tenant['id']}"
        self.request_json("POST", f"{base}/staff", headers=owner, expected=201, json={"name": "Inventory Coach", "email": f"inventory-coach-{suffix}@nfcfit.test", "role": "coach"})
        physical_uid = f"04{uuid4().hex[:12]}".upper()
        tag = self.request_json("POST", f"{base}/tags", headers=owner, expected=201, json={"uid": physical_uid, "name": "Unassigned card"})
        self.assertIsNone(tag["exercise"])
        self.assertIsNone(tag["exercise_id"])
        spare = self.request_json("POST", f"{base}/tags", headers=owner, expected=201, json={"uid": f"SPARE-{suffix}", "name": "Spare card", "exercise_id": None})
        listed = self.request_json("GET", f"{base}/tags", headers=owner)
        self.assertEqual(len(listed), 2)
        self.assertTrue(all(row["exercise"] is None for row in listed))
        link = self.request_json("GET", f"{base}/tags/{tag['id']}/link", headers=owner)
        self.assertEqual(link["url"], f"https://nfc-fit.vercel.app/tag/{tag['id']}")
        self.assertEqual(link["uid"], physical_uid)
        self.request_json("GET", f"{base}/tags/{tag['id']}/link", headers=coach, expected=403)
        self.request_json("GET", f"{base}/tags/{tag['id']}/link", headers=member, expected=403)
        self.request_json("GET", f"/api/console/nfc/resolve/{tag['id']}", expected=401)
        preview = self.request_json("GET", f"/api/console/nfc/resolve/{tag['id']}", headers=member)
        self.assertEqual(preview["membership_status"], "none")
        self.assertIsNone(preview["exercise"])
        self.assertEqual(self.request_json("GET", f"{base}/members", headers=owner), [])
        self.assertEqual(self.request_json("GET", f"{base}/activities", headers=owner), [])
        self.request_json("POST", "/api/console/nfc/open", headers=member, json={"tag_id": tag["id"]})
        join = self.request_json("GET", f"{base}/members?status=pending", headers=owner)[0]
        self.request_json("POST", f"{base}/join-requests/{join['id']}/review", headers=owner, json={"decision": "approve"})
        result = self.request_json("POST", "/api/console/nfc/scan", headers=member, json={"uid": physical_uid.lower()})
        self.assertEqual(result["result"], "tag_unassigned")
        self.request_json("POST", "/api/console/nfc/record", headers=member, expected=409, json={"tag_id": tag["id"]})
        self.request_json("PATCH", f"{base}/tags/{tag['id']}", headers=owner, expected=422, json={"exercise_id": "unavailable-exercise"})
        exercise = self.request_json("POST", f"{base}/exercises", headers=owner, expected=201, json={"name": "Push-up", "unit": "repetition", "default_quantity": 10})
        assigned = self.request_json("PATCH", f"{base}/tags/{tag['id']}", headers=owner, json={"exercise_id": exercise["id"]})
        self.assertEqual(assigned["exercise"]["name"], "Push-up")
        self.assertEqual(self.request_json("GET", f"/api/console/nfc/resolve/{tag['id']}", headers=member)["exercise"]["name"], "Push-up")
        self.request_json("PATCH", f"{base}/tags/{tag['id']}", headers=owner, json={"active": False})
        self.request_json("GET", f"/api/console/nfc/resolve/{tag['id']}", headers=member, expected=410)
        self.request_json("POST", "/api/console/nfc/open", headers=member, expected=410, json={"tag_id": tag["id"]})
        self.request_json("PATCH", f"{base}/tags/{tag['id']}", headers=owner, json={"active": True})
        self.request_json("POST", "/api/console/nfc/record", headers=member, expected=201, json={"tag_id": tag["id"], "quantity": 12})
        detached = self.request_json("PATCH", f"{base}/tags/{tag['id']}", headers=owner, json={"exercise_id": None})
        self.assertIsNone(detached["exercise"])
        self.request_json("POST", "/api/console/nfc/record", headers=member, expected=409, json={"tag_id": tag["id"]})
        # Old differently formatted duplicates must never select an arbitrary tenant tag.
        with ConsoleSession() as db:
            duplicate = NfcTag(tenant_id=tenant["id"], uid=physical_uid.lower(), name="Legacy duplicate")
            db.add(duplicate)
            db.commit()
            duplicate_id = duplicate.id
        self.request_json("POST", "/api/console/nfc/scan", headers=member, expected=409, json={"uid": physical_uid})
        self.request_json("DELETE", f"{base}/tags/{duplicate_id}", headers=owner, expected=204)
        self.assertEqual(self.request_json("POST", "/api/console/nfc/scan", headers=member, json={"uid": physical_uid})["result"], "tag_unassigned")
        self.request_json("DELETE", f"{base}/tags/{tag['id']}", headers=member, expected=403)
        self.request_json("DELETE", f"{base}/tags/{tag['id']}", headers=coach, expected=403)
        self.request_json("DELETE", f"{base}/tags/{tag['id']}", headers=owner, expected=204)
        self.request_json("GET", f"/api/console/nfc/resolve/{tag['id']}", headers=member, expected=404)
        self.request_json("DELETE", f"{base}/tags/{tag['id']}", headers=owner, expected=404)
        history = self.request_json("GET", f"{base}/activities", headers=owner)
        self.assertEqual(len(history), 1)
        self.assertEqual((history[0]["exercise"], history[0]["quantity"], history[0]["tag"]), ("Push-up", 12, None))
        self.assertEqual(self.request_json("GET", f"{base}/tags", headers=owner)[0]["id"], spare["id"])

    def test_unverified_supabase_email_cannot_link_or_create_account(self):
        response = self.client.get(
            "/api/console/auth/me",
            headers={"Authorization": "Bearer unverified:unverified@nfcfit.test"},
        )
        self.assertEqual(response.status_code, 403)

    def test_email_already_linked_to_another_supabase_user_is_rejected(self):
        email = f"linked-{uuid4().hex}@nfcfit.test"
        self.request_json("GET", "/api/console/auth/me", headers=self.auth_headers(email))
        response = self.client.get(
            "/api/console/auth/me",
            headers={"Authorization": f"Bearer other-id:{email}"},
        )
        self.assertEqual(response.status_code, 409)

    def test_supabase_auth_endpoint_identity_response_is_normalized(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

            def read(self):
                return json.dumps({
                    "id": str(uuid4()),
                    "email": "Member@Example.com",
                    "email_confirmed_at": "2026-01-01T00:00:00Z",
                    "user_metadata": {"name": "Member"},
                }).encode()

        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://project.supabase.co/",
            "SUPABASE_ANON_KEY": "public-anon-key",
        }), patch("tenant_console.urlopen", return_value=FakeResponse()) as auth_request:
            identity = _fetch_supabase_identity("supabase-access-token")

        request = auth_request.call_args.args[0]
        self.assertEqual(request.full_url, "https://project.supabase.co/auth/v1/user")
        self.assertEqual(request.get_header("Authorization"), "Bearer supabase-access-token")
        self.assertEqual(request.get_header("Apikey"), "public-anon-key")
        self.assertEqual(identity["email"], "member@example.com")
        self.assertTrue(identity["email_confirmed"])
        self.assertEqual(identity["name"], "Member")

    def test_existing_console_accounts_table_gets_supabase_link_column(self):
        legacy_db = Path(tempfile.gettempdir()) / f"nfcfit-legacy-console-{uuid4().hex}.db"
        legacy_engine = create_engine(f"sqlite:///{legacy_db}")
        try:
            with legacy_engine.begin() as connection:
                connection.execute(text(
                    "CREATE TABLE console_accounts ("
                    "id VARCHAR(36) PRIMARY KEY, email VARCHAR(320) NOT NULL, name VARCHAR(160) NOT NULL, "
                    "password_hash VARCHAR(100) NOT NULL, is_platform_admin BOOLEAN NOT NULL, created_at DATETIME NOT NULL)"
                ))
                connection.execute(text(
                    "INSERT INTO console_accounts (id, email, name, password_hash, is_platform_admin, created_at) "
                    "VALUES ('legacy-account', 'legacy@nfcfit.test', 'Legacy User', 'unused', 0, CURRENT_TIMESTAMP)"
                ))
            with patch("tenant_console.console_engine", legacy_engine), patch(
                "tenant_console.ConsoleSession", sessionmaker(bind=legacy_engine, expire_on_commit=False)
            ):
                initialize_console_schema()
            columns = {column["name"] for column in inspect(legacy_engine).get_columns("console_accounts")}
            self.assertIn("supabase_user_id", columns)
            with legacy_engine.connect() as connection:
                linked = connection.execute(
                    text("SELECT supabase_user_id FROM console_accounts WHERE id = 'legacy-account'")
                ).scalar_one()
            self.assertIsNone(linked)
        finally:
            legacy_engine.dispose()
            if legacy_db.exists():
                legacy_db.unlink()

    def test_supabase_identity_lookup_requires_bearer_token(self):
        response = self.client.get("/api/console/auth/me")
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
