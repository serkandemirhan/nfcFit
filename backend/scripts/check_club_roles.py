"""Read-only preflight. Requires an explicitly selected DATABASE_URL; never migrates data."""
import os
import sys
from pathlib import Path
from collections import Counter
from sqlalchemy import select, text

if not os.environ.get('DATABASE_URL'):
    raise SystemExit('Set DATABASE_URL explicitly to the intended database. No changes were made.')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tenant_console import console_engine

with console_engine.connect() as db:
    if db.dialect.name != 'postgresql':
        raise SystemExit('This preflight targets PostgreSQL. No changes were made.')
    db.execute(text('SET TRANSACTION READ ONLY'))
    db.execute(text("SET LOCAL statement_timeout='10s'"))
    rows = db.execute(text('SELECT tenant_id,role,status FROM console_tenant_staff')).all()
    print('Stored role counts:', dict(Counter(row.role for row in rows)))
    known={'owner','admin','coach','CLUB_ADMIN','CLUB_MANAGER','TRAINER'}
    unknown=sorted({row.role for row in rows}-known)
    missing=db.execute(text("SELECT t.id FROM console_tenants t WHERE NOT EXISTS(SELECT 1 FROM console_tenant_staff s WHERE s.tenant_id=t.id AND s.status='active' AND s.role IN ('owner','CLUB_ADMIN'))")).scalars().all()
    print('Clubs without active Club Admin:', list(missing))
    policies=db.execute(text("SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('console_accounts','console_tenants','console_tenant_staff','console_memberships','console_exercises','console_nfc_tags','console_activities','console_member_exercise_goals','console_audit_logs','console_subscription_requests','console_club_billing_profiles') AND policyname<>'nfcfit_club_read' ORDER BY tablename,policyname")).all()
    print('Unexpected policies to review:', [list(row) for row in policies])
    if unknown or missing or policies:
        raise SystemExit('Preflight requires review. No data was changed.')
    print('Preflight passed. No data was changed.')
