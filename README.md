# SpeakFlow

A web platform for structured foreign language speaking practice between people from different parts of the world. Users create profiles with native and target languages and interests. The system matches suitable partners and allows them to join built-in audio-only rooms. During a session, users follow guided conversation scenarios with stages, roles, topic cards, useful phrases, correction notes and feedback. The main goal is to make language exchange more structured, balanced, and useful than regular chats or random calls.

## Figures

### Landing page

![landing page](docs/images/landing-page.png)

### Dashboard

![dashboard page](docs/images/dashboard.png)

### Session page

![session page](docs/images/session-page.png)

## Project Structure

```
speakflow
├── app                         # Application source code
│   ├── backend                 # FastAPI backend
│   │   ├── alembic             # Database migrations
│   │   ├── config              # Configuration management
│   │   ├── handlers            # HTTP and WebSocket handlers
│   │   │   ├── routes          # API endpoints
│   │   │   └── server          # WebSocket server
│   │   ├── models              # SQLAlchemy models
│   │   ├── resources           # Static backend resources
│   │   ├── schemas             # Pydantic request/response schemas
│   │   ├── services            # Business logic
│   │   │   └── llm             # LLM integration
│   │   ├── storage             # Repository layer
│   │   └── utils               # Shared utilities
│   ├── frontend                # Next.js frontend
│   │   ├── app                 # App Router pages
│   │   ├── components          # Reusable React components
│   │   │   ├── layout          # Layout components
│   │   │   └── ui              # Generic UI components
│   │   ├── hooks               # Custom React hooks
│   │   ├── lib                 # API clients and frontend utilities
│   │   └── public              # Static assets
│   ├── ml                      # Matching service
│   │   ├── data                # Dataset generation and mock data
│   │   ├── handlers            # ML service API
│   │   └── model               # Matching model implementation
│   └── tests                   # Backend integration and API tests
├── ci                          # GitLab CI/CD configuration
│   ├── scripts                 # CI helper scripts
│   └── templates               # Modular pipeline templates
│       ├── base                # Base job definitions
│       └── jobs                # Build, test, lint and deploy jobs
├── docker-compose.yml          # Local development environment
├── install.sh                  # Initial project setup
├── k8s                         # Kubernetes manifests
│   └── base                    # Base Kustomize configuration
│       ├── backend             # Backend resources
│       ├── frontend            # Frontend resources
│       ├── networking          # Ingress configuration
│       └── postgres            # PostgreSQL resources
├── .env.example                # Example .env file
└── README.md                   # Project documentation
```

## Tech Stack

### Backend
- **FastAPI** — REST API
- **SQLAlchemy 2.0** (async) + **asyncpg** — database
- **PostgreSQL** — database
- **JWT** (`python-jose`) — access + refresh token auth
- **passlib[bcrypt]** — password hashing
- **pytest** + **pytest-asyncio** + **httpx** — testing
- **Ruff** — code linting


### Frontend
- **Next.js** — React framework
- **TypeScript** — type safety
- **Tailwind CSS** — styling

### Infrastructure
- **Docker** — containerization
- **Kubernetes** — orchestration
- **Kubeseal** — secrets management
- **GitLab CI** — automation

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
| `DEEPSEEK_API_KEY` | Access key to DeepSeek API  |

## Build & Run on your machine with Docker Compose

```bash
# Clone the repository
git clone https://gitlab.pg.innopolis.university/speakflow/speakflow.git
# Build and run
cd speakflow
bash scripts/install.sh
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
| Backend       | `https://10.93.27.41` |
| Swagger UI    | `https://10.93.27.41/docs` |
| ReDoc         | `https://10.93.27.41/redoc` |
| Main app (UI) | `https://10.93.27.41/` |

## Testing

### Linux/MacOS

- **Prerequisites:** Docker

```bash
# Build & Run with Docker Compose
bash ./install.sh

# Run the tests
docker run --rm \
    --network speakflow_default \
    semyonnadutkin/speakflow-tests:latest -d
```

## API Endpoints

| Method | Path                                      | Description                    |
| ------ | ----------------------------------------- | ------------------------------ |
| POST   | `/api/v1/auth/register`                   | Register                       |
| POST   | `/api/v1/auth/login`                      | Login                          |
| POST   | `/api/v1/auth/refresh`                    | Refresh tokens                 |
| GET    | `/api/v1/users/me`                        | Current user profile           |
| PATCH  | `/api/v1/users/me`                        | Update profile                 |
| DELETE | `/api/v1/users/me`                        | Delete account                 |
| GET    | `/api/v1/users/match`                     | Find conversation partners     |
| GET    | `/api/v1/audio/active-room`               | Get active audio room          |
| POST   | `/api/v1/audio/create-room`               | Create audio room              |
| POST   | `/api/v1/audio/invite-by-email`           | Invite user to a room by email |
| GET    | `/api/v1/audio/pending-invitations`       | Get pending room invitations   |
| POST   | `/api/v1/audio/join-room`                 | Join audio room                |
| POST   | `/api/v1/audio/leave-room`                | Leave audio room               |
| POST   | `/api/v1/audio/decline-invitation`        | Decline room invitation        |
| GET    | `/api/v1/session-templates`               | List session templates         |
| GET    | `/api/v1/session-templates/{template_id}` | Get session template           |
| POST   | `/api/v1/session-templates/generate`      | Generate session template      |
| POST   | `/api/v1/notes/create`                    | Create live correction note    |
| GET    | `/api/v1/notes`                           | List notes                     |
| GET    | `/api/v1/notes/rooms/{room_id}/mine`      | Get user's notes for a room    |
| POST   | `/api/v1/feedback/create`                 | Submit session feedback        |
| GET    | `/api/v1/feedback`                        | List feedback                  |
