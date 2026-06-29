import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from handlers.routes import v1_router


class Server:
    app: FastAPI

    def __init__(self):
        self.app = FastAPI(title="SpeakFlow API")

        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        self.app.include_router(v1_router)

    def run(self, host: str = "0.0.0.0", port: int = 8000):
        uvicorn.run(self.app, host=host, port=port)
