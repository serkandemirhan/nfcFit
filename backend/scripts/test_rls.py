"""Run migration/RLS tests in a disposable socket-only PostgreSQL cluster; never touches app DB."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from sqlalchemy import URL

root = Path(__file__).resolve().parents[2]
cluster = Path(tempfile.mkdtemp(prefix="nfcfit-rls-", dir="/tmp"))
data = cluster / "data"
sock = cluster / "socket"
sock.mkdir()
started = False
try:
    subprocess.run(
        ["initdb", "-D", str(data), "-A", "trust", "--no-locale", "--encoding=UTF8"],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "pg_ctl",
            "-D",
            str(data),
            "-l",
            str(cluster / "postgres.log"),
            "-o",
            f"-k {sock} -p 55439 -c listen_addresses=''",
            "start",
            "-w",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    started = True
    url = URL.create(
        "postgresql+psycopg",
        username=os.environ.get("USER"),
        database="postgres",
        query={"host": str(sock), "port": "55439"},
    )
    env = {
        **os.environ,
        "NFCFIT_RLS_TEST_URL": url.render_as_string(hide_password=False),
    }
    result = subprocess.run(
        [
            str(root / "backend/.venv/bin/python"),
            "-m",
            "unittest",
            "discover",
            "-s",
            "backend/tests",
            "-p",
            "test_coaching_rls.py",
            "-v",
        ],
        cwd=root,
        env=env,
    )
    raise SystemExit(result.returncode)
finally:
    if started:
        subprocess.run(
            ["pg_ctl", "-D", str(data), "stop", "-m", "fast", "-w"],
            stdout=subprocess.DEVNULL,
            check=True,
        )
    shutil.rmtree(cluster)
