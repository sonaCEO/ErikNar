from fastapi import FastAPI

from eriknar.api.errors import install_exception_handlers
from eriknar.api.router import router


def create_app() -> FastAPI:
    app = FastAPI(title="ErikNar API", version="0.1.0")
    app.include_router(router)
    install_exception_handlers(app)
    return app


app = create_app()
