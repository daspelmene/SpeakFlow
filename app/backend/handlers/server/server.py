import uvicorn
from fastapi import FastAPI

from backend.handlers.routes import v1_router


class Server:
    app: FastAPI

    def __init__(self):
        self.app = FastAPI(title="SpeakFlow API")
        self.app.include_router(v1_router)

    def run(self, host: str = "0.0.0.0", port: int = 8000):
        uvicorn.run(self.app, host=host, port=port)
