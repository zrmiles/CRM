from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    SECRET_KEY: str = Field(min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTH_RATE_LIMIT_PER_MINUTE: int = 60
    REDIS_URL: str | None = None
    REFRESH_TOKEN_COOKIE_NAME: str = "mini_crm_refresh_token"
    REFRESH_TOKEN_COOKIE_SECURE: bool = False
    ALGORITHM: str = "HS256"
    APP_NAME: str = "Mini-CRM"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
