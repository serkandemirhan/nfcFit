"""Disposable localhost-only browser fixture. Never import from production entrypoints.
Run with backend/.venv/bin/python backend/scripts/serve_trainer_planning_fixture.py.
Uses a separate /tmp SQLite DB and a test identity provider. No real member data.
"""
import os,sys,json,base64
from pathlib import Path
from uuid import uuid5,NAMESPACE_URL
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
if '--reset' in sys.argv:
    Path('/tmp/nfcfit-trainer-planning-browser.db').unlink(missing_ok=True)
os.environ['DATABASE_URL']='sqlite:////tmp/nfcfit-trainer-planning-browser.db'
os.environ['ENVIRONMENT']='development'
os.environ['FRONTEND_ORIGIN']='http://localhost:3000'
from app import app
import tenant_console as tc
from coaching import CoachLink,seed_catalog
from fastapi import HTTPException
from sqlalchemy import select
PEOPLE={'trainer@planning.test':'Deniz Kaya','member@planning.test':'Ada Yılmaz','second@planning.test':'Emre Demir','outsider@planning.test':'Unassigned Member','owner@planning.test':'Selin Yönetici','manager@planning.test':'Can Operasyon'}
def identity(token):
    try: email=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'=='))['email']
    except Exception: raise HTTPException(401,'Invalid fixture identity')
    if email not in PEOPLE: raise HTTPException(401,'Unknown fixture identity')
    return {'id':str(uuid5(NAMESPACE_URL,email)),'email':email,'name':PEOPLE[email],'email_confirmed':True}
tc._fetch_supabase_identity=identity
tc.initialize_console_schema()
with tc.ConsoleSession.begin() as db:
    seed_catalog(db)
    for email,name in PEOPLE.items():
        if not db.scalar(select(tc.Account).where(tc.Account.email==email)):
            db.add(tc.Account(id=str(uuid5(NAMESPACE_URL,email)),supabase_user_id=str(uuid5(NAMESPACE_URL,email)),email=email,name=name,password_hash='fixture-only',is_platform_admin=False))
    db.flush()
    if not db.get(tc.Tenant,'planning-club'):
        db.add(tc.Tenant(id='planning-club',name='NFCFit · Planlama Test Kulübü',slug='planning-fixture'))
        db.flush()
        db.add(tc.TenantStaff(tenant_id='planning-club',account_id=str(uuid5(NAMESPACE_URL,'trainer@planning.test')),role='TRAINER'))
        for email in ['member@planning.test','second@planning.test','outsider@planning.test']:
            db.add(tc.Membership(tenant_id='planning-club',account_id=str(uuid5(NAMESPACE_URL,email)),status='active'))
        for email in ['member@planning.test','second@planning.test']:
            db.add(CoachLink(tenant_id='planning-club',trainer_id=str(uuid5(NAMESPACE_URL,'trainer@planning.test')),athlete_id=str(uuid5(NAMESPACE_URL,email))))
    # UI-only role fixtures; never reset memberships, workouts or trainer access.
    for email, role in [('owner@planning.test', 'CLUB_ADMIN'), ('manager@planning.test', 'CLUB_MANAGER')]:
        account_id = str(uuid5(NAMESPACE_URL, email))
        if not db.scalar(select(tc.TenantStaff).where(tc.TenantStaff.tenant_id == 'planning-club', tc.TenantStaff.account_id == account_id)):
            db.add(tc.TenantStaff(tenant_id='planning-club', account_id=account_id, role=role))
# Test-only provider for Safari/OS-keyboard tests. Never mounted by production entrypoints.
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])

def fixture_user(email):
    return {"id":str(uuid5(NAMESPACE_URL,email)),"email":email,"aud":"authenticated","role":"authenticated","email_confirmed_at":"2026-11-09T00:00:00Z","created_at":"2026-11-09T00:00:00Z","app_metadata":{"provider":"email"},"user_metadata":{"name":PEOPLE[email]},"identities":[]}

def fixture_token(email):
    payload={"email":email,"sub":str(uuid5(NAMESPACE_URL,email)),"role":"authenticated","exp":int(datetime.now(timezone.utc).timestamp())+86400}
    return "eyJhbGciOiJIUzI1NiJ9."+base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")+".fixture-only"

@app.post("/fixture-auth/auth/v1/token")
async def fixture_login(request: Request):
    payload=await request.json()
    email=payload.get("email","")
    if email not in PEOPLE or payload.get("password")!="PlanningTestOnly!26":
        raise HTTPException(400,"Invalid isolated fixture credentials")
    return {"access_token":fixture_token(email),"refresh_token":"fixture-refresh","token_type":"bearer","expires_in":86400,"user":fixture_user(email)}

@app.get("/fixture-auth/auth/v1/user")
async def fixture_current_user(request: Request):
    actor=identity(request.headers.get("Authorization","").replace("Bearer ",""))
    return fixture_user(actor["email"])

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8000)
