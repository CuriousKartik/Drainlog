"""
JalKal (जलकाल) - Application Configuration
Module: backend/core/config.py
"""

from typing import List, Optional
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "JalKal - Urban Flood Nowcasting & Safe Navigation Engine"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings (PostGIS)
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "jalkal_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def SYNC_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis Cache Settings
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD", None)

    # Hydrology & Engineering Defaults
    SCS_CURVE_NUMBER_ROAD: float = 98.0      # High imperviousness for urban road surfaces
    DEFAULT_MANHOLE_DIAMETER_M: float = 0.60
    DEFAULT_CURB_HEIGHT_M: float = 0.15
    MAX_PASSABLE_DEPTH_CM: float = 25.0      # Maximum water depth traversable by emergency vehicles
    SLOWDOWN_DEPTH_CM: float = 10.0          # Slowdown threshold

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    class Config:
        case_sensitive = True


settings = Settings()

