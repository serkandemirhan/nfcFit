"""Populate only the disposable planning SQLite fixture; never production data."""
import runpy
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL
root = Path(__file__).resolve().parents[2]
fixture = Path('/tmp/nfcfit-trainer-planning-browser.db')
if not fixture.exists():
    raise SystemExit('Start serve_trainer_planning_fixture.py first; isolated DB missing.')
ns = runpy.run_path(str(root / 'backend/scripts/serve_trainer_planning_fixture.py'), run_name='density_fixture_seed')
tc, select, CoachLink = ns['tc'], ns['select'], ns['CoachLink']
assert str(tc.console_engine.url) == 'sqlite:////tmp/nfcfit-trainer-planning-browser.db'
names = ['Ayşe Demir','Burak Yıldız','Ceren Aydın','Can Öztürk','Derya Çelik','Deniz Arslan','Ece Şahin','Efe Koç','Elif Aksoy','Emir Yalçın','Esra Güneş','Furkan Kaya','Gizem Polat','Hakan Yılmaz','İrem Tekin','Kaan Acar','Leyla Keskin','Mert Eren','Melis Yavuz','Nazlı Doğan','Oğuz Bulut','Öykü Sezer','Pelin Karaca','Selin Erdem','Seda Uslu','Serkan Tunç','Sıla Çetin','Tolga Aslan','Tuğçe Güler','Umut Taş','Yağmur Yücel','Yiğit Sarı','Zeynep Kılıç','Berk İnce']
trainer = str(uuid5(NAMESPACE_URL, 'trainer@planning.test'))
with tc.ConsoleSession.begin() as db:
    for i, name in enumerate(names):
        email = f'density.member.{i+1:02d}@planning.test'
        account_id = str(uuid5(NAMESPACE_URL, email))
        if not db.get(tc.Account, account_id):
            db.add(tc.Account(id=account_id,email=email,name=name,password_hash='fixture-only',is_platform_admin=False))
            db.flush()
        if not db.scalar(select(tc.Membership).where(tc.Membership.tenant_id=='planning-club',tc.Membership.account_id==account_id)):
            db.add(tc.Membership(tenant_id='planning-club',account_id=account_id,status='active',source='density-fixture'))
        if not db.scalar(select(CoachLink).where(CoachLink.tenant_id=='planning-club',CoachLink.trainer_id==trainer,CoachLink.athlete_id==account_id)):
            db.add(CoachLink(tenant_id='planning-club',trainer_id=trainer,athlete_id=account_id,active=True))
print(f'Isolated fixture: {len(names)} additional assigned members; original identities/history unchanged.')
