from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.clients import router as clients_router
from app.api.v1.stages import router as stages_router
from app.api.v1.deals import router as deals_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.activities import router as activities_router
from app.api.v1.reports import router as reports_router
from app.api.v1.audit_logs import router as audit_logs_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(clients_router)
api_router.include_router(stages_router)
api_router.include_router(deals_router)
api_router.include_router(tasks_router)
api_router.include_router(activities_router)
api_router.include_router(reports_router)
api_router.include_router(audit_logs_router)
