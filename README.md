# SpeakFlow

 	  	      
		
A web platform for structured foreign language speaking practice between people from different countries. Users create profiles with native and target languages, level, country, and interests. The system matches suitable partners and allows them to join built-in audio-only rooms. During a session, users follow guided conversation scenarios with stages, roles, timers, topic cards, useful phrases, roleplay tasks, correction notes, feedback. The main goal is to make language exchange more structured, balanced, and useful than regular chats or random calls.

## Project Structure

```
speakflow/
├── app/
│   └── backend/
│       ├── alembic/          # DB migrations
│       ├── config/           # Settings (DATABASE_URL, SECRET_KEY, etc.)
│       ├── handlers/         # FastAPI routes + Server
│       │   ├── routes/       # auth.py, user.py
│       │   └── server/       # Server (FastAPI) class
│       ├── models/           # SQLAlchemy ORM models
│       ├── schemas/          # Pydantic request/response schemas
│       ├── storage/          # Database (engine, get_db) + UserRepository
│       ├── utils/            # hasher.py, jwt.py
│       ├── Dockerfile
│       ├── entrypoint.sh
│       ├── main.py           # Entry point (uvicorn target)
│       └── requirements.txt
├── app/tests/                # pytest tests
├── docker-compose.yml
└── .env                      # Environment variables
```

## Tech Stack

- **FastAPI** — REST API
- **SQLAlchemy 2.0** (async) + **asyncpg** — database
- **PostgreSQL** — database
- **JWT** (python-jose) — access + refresh token auth
- **passlib[bcrypt]** — password hashing
- **Docker** / **docker-compose** — containerization
- **pytest** + **pytest-asyncio** + **httpx** — testing

## Run with Docker

```bash
docker compose up --build
```

Server will be available at `http://localhost:8000`.

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