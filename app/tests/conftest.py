import os
import subprocess
import pytest
import asyncpg
from httpx import AsyncClient
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    root_env = Path(__file__).resolve().parent.parent / ".env"
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)

POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "speakflow")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:5432/{POSTGRES_DB}"
BASE_URL = os.getenv("API_BASE_URL", "http://backend:8000/api/v1")

_migrations_applied = False

async def ensure_table_exists():
    global _migrations_applied
    if _migrations_applied:
        return
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # Check for a table added in a recent migration
        exists = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users')"
        )
        if not exists:
            print("Applying migrations via alembic...")
            backend_dir = Path(__file__).resolve().parent.parent / "backend"
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                cwd=str(backend_dir),
                capture_output=True,
                text=True,
                env=os.environ.copy(),
            )
            if result.returncode != 0:
                raise RuntimeError("Migrations failed: " + result.stderr)
            print("Migrations applied.")
        _migrations_applied = True
    finally:
        await conn.close()

async def delete_all_users_async():
    await ensure_table_exists()
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("DELETE FROM users")
    finally:
        await conn.close()

@pytest.fixture(scope="function", autouse=True)
async def clean_db():
    await delete_all_users_async()
    yield

async def register_user(client: AsyncClient, email: str, password: str, fullname: str):
    resp = await client.post("/auth/register", json={
        "email": email,
        "password": password,
        "fullname": fullname,
    })
    resp.raise_for_status()
    data = resp.json()
    return data["access_token"], data["refresh_token"]

@pytest.fixture(scope="function")
async def client():
    async with AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        yield client

@pytest.fixture(scope="function")
async def auth_client():
    async with AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        email = "test@example.com"
        password = "secret123"
        fullname = "Test User"
        access_token, _ = await register_user(client, email, password, fullname)
        client.headers["Authorization"] = f"Bearer {access_token}"
        client._test_user = {"email": email, "password": password, "fullname": fullname}
        client.access_token = access_token
        yield client

@pytest.fixture(scope="function")
async def second_user_client():
    async with AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        email = "second@example.com"
        password = "secret456"
        fullname = "Second User"
        token, _ = await register_user(client, email, password, fullname)
        client.headers["Authorization"] = f"Bearer {token}"
        client._test_user = {"email": email, "password": password, "fullname": fullname}
        client.access_token = token
        yield client
