# SpeakFlow

 	  	      
		
A web platform for structured foreign language speaking practice between people from different countries. Users create profiles with native and target languages, level, country, and interests. The system matches suitable partners and allows them to join built-in audio-only rooms. During a session, users follow guided conversation scenarios with stages, roles, timers, topic cards, useful phrases, roleplay tasks, correction notes, feedback. The main goal is to make language exchange more structured, balanced, and useful than regular chats or random calls.

## Project Structure

```
speakflow/
├── app/
│   ├── backend/               # FastAPI backend
│   │   ├── alembic/           # DB migrations
│   │   ├── config/            # Settings (DATABASE_URL, SECRET_KEY, etc.)
│   │   ├── handlers/          # FastAPI routes + Server
│   │   │   ├── routes/        # auth.py, user.py
│   │   │   └── server/        # Server (FastAPI) class
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── storage/           # Database (engine, get_db) + UserRepository
│   │   ├── utils/             # hasher.py, jwt.py
│   │   ├── Dockerfile
│   │   ├── entrypoint.sh
│   │   ├── main.py            # Entry point (uvicorn target)
│   │   └── requirements.txt
│   ├── frontend/              # Next.js frontend
│   └── tests/                 # pytest tests
├── docker-compose.yml
└── .env                       # Environment variables
```

## Tech Stack

### Backend
- **FastAPI** — REST API
- **SQLAlchemy 2.0** (async) + **asyncpg** — database
- **PostgreSQL** — database
- **JWT** (python-jose) — access + refresh token auth
- **passlib[bcrypt]** — password hashing
- **pytest** + **pytest-asyncio** + **httpx** — testing

### Frontend
- **Next.js** — React framework
- **TypeScript** — type safety
- **Tailwind CSS** — styling

## Environment Variables (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `speakflow` |
| `POSTGRES_USER` | Database user | `admin` |
| `POSTGRES_PASSWORD` | Database password | `12345` |
| `DATABASE_URL` | PostgreSQL connection string (local) | `postgresql+asyncpg://admin:12345@localhost:5433/speakflow` |
| `SECRET_KEY` | JWT signing key | `841ca35892683bb79ed7a92cdf99b9d417b73af7a2080f9eb5c411f1960bde36` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (minutes) | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime (days) | `1` |

## Build&Run our project locally on your machine

```bash
git clone git@gitlab.pg.innopolis.university:speakflow/speakflow.git && cd speakflow
docker compose up --build
```

| Service       | URL |
|---------------|-----|
| Backend       | `http://localhost:8000` |
| Swagger UI    | `http://localhost:8000/docs` |
| ReDoc         | `http://localhost:8000/redoc` |
| Main app (UI) | `http://localhost:3000` |

## See our app running on VM

| Service       | URL |
|---------------|-----|
| Backend       | `http://10.93.27.41:8000` |
| Swagger UI    | `http://10.93.27.41:8000/docs` |
| ReDoc         | `http://10.93.27.41:8000/redoc` |
| Main app (UI) | `http://10.93.27.41:3000/` |

## Testing

```bash
PYTHONPATH=. pytest app/tests/test_auth.py -v
```

Requires a running PostgreSQL instance (test skips if database is unavailable).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh tokens |
| GET | `/api/v1/users/me` | Current user profile |
| PATCH | `/api/v1/users/me` | Update profile |
| DELETE | `/api/v1/users/me` | Delete account |
| GET | `/api/v1/users/match` | Find conversation partners |