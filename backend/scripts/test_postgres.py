"""Run the same tests against this project's local Compose PostgreSQL."""

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv

root = Path(__file__).resolve().parent.parent
load_dotenv(root / ".env")
password = os.getenv("POSTGRES_PASSWORD")
if not password:
    raise SystemExit("Set POSTGRES_PASSWORD in backend/.env first.")
subprocess.run(["docker", "compose", "up", "-d", "--wait", "db"], cwd=root, check=True)
environment = os.environ.copy()
user = quote(os.getenv("POSTGRES_USER", "medicinetrack"), safe="")
port = os.getenv("POSTGRES_PORT", "55432")
database = os.getenv("POSTGRES_DB", "medicinetrack")
environment["DATABASE_URL"] = (
    f"postgresql://{user}:{quote(password, safe='')}@127.0.0.1:{port}/{database}"
)
environment["REDIS_URL"] = ""
raise SystemExit(
    subprocess.run(
        [sys.executable, "-m", "pytest", "-q", *sys.argv[1:]], cwd=root, env=environment
    ).returncode
)
