from fastapi import FastAPI

from eriknar.api.router import router


def create_app() -> FastAPI:
    app = FastAPI(title="ErikNar API", version="0.1.0")
    app.include_router(router)
    return app


app = create_app()

