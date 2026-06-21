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

| Variable | Description |
|----------|-------------|
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET_KEY` | JWT signing key |
| `JWT_ALGORITHM` | JWT algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (minutes) |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime (days) |

## Build & Run on your machine with Docker Compose

```bash
# Clone the repository
git clone https://gitlab.pg.innopolis.university/speakflow/speakflow.git
# Build and run
cd speakflow
./install.sh
```

| Service       | URL |
|---------------|-----|
| Backend       | `http://localhost:8000` |
| Swagger UI    | `http://localhost:8000/docs` |
| ReDoc         | `http://localhost:8000/redoc` |
| Main app (UI) | `http://localhost:3000` |

## Run on your machine with Kubernetes

```bash
# Clone the repository
git clone https://gitlab.pg.innopolis.university/speakflow/speakflow.git
# Build and run
cd speakflow
kubectl apply -k k8s/base/
```

| Service       | URL |
|---------------|-----|
| Backend       | `https://localhost:8000` |
| Swagger UI    | `https://localhost:8000/docs` |
| ReDoc         | `https://localhost:8000/redoc` |
| Main app (UI) | `https://localhost` |

## See our app running on VM

| Service       | URL |
|---------------|-----|
| Backend       | `https://10.93.27.41:8000` |
| Swagger UI    | `https://10.93.27.41:8000/docs` |
| ReDoc         | `https://10.93.27.41:8000/redoc` |
| Main app (UI) | `https://10.93.27.41/` |

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