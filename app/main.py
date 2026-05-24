from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        description="API Mini-CRM для розничных продаж с ролевым доступом",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_tags=[
            {"name": "auth", "description": "Аутентификация и авторизация"},
            {"name": "users", "description": "Управление пользователями"},
            {"name": "clients", "description": "Управление клиентами"},
            {"name": "stages", "description": "Стадии воронки продаж"},
            {"name": "deals", "description": "Управление сделками"},
            {"name": "tasks", "description": "Управление задачами"},
            {"name": "activities", "description": "Журнал активностей"},
            {"name": "reports", "description": "Отчеты по продажам"},
        ],
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api/v1")

    @application.get("/", tags=["health"])
    async def root():
        return {
            "name": settings.APP_NAME,
            "status": "ok",
            "docs": "/docs",
            "health": "/health",
            "api": "/api/v1",
        }

    @application.get("/health", tags=["health"])
    async def health():
        return {"status": "healthy"}

    @application.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        return Response(status_code=204)

    return application


app = create_app()
