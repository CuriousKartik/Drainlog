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

    # CARTO Cloud Spatial & Maps API Settings
    CARTO_API_KEY: str = os.getenv(
        "CARTO_API_KEY",
        "eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfbnM4NXgxZXQiLCJqdGkiOiIzMmE5OTQwYyIsImV4cCI6MTc5MTI5NzQyMH0.U5pH9TRFvYID3Rb-99KMAUF3WNALVNNp0BSCVj28K9U"
    )
    CARTO_ACCOUNT_ID: str = "ac_ns85x1et"
    CARTO_CONNECTION: str = "carto_dw"
    CARTO_SQL_ENDPOINT: str = "https://gcp-us-east1.api.carto.com/v3/sql/carto_dw/query"
    CARTO_BASEMAP_TILE_URL: str = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    class Config:
        case_sensitive = True


settings = Settings()

