"""
JalKal (जलकाल) - Urban Flood Nowcasting and Safe Navigation Engine
Module: backend/main.py

Main FastAPI entry point.
Smart India Hackathon (Ministry of Earth Sciences / NCMRWF, PS ID: SIH26085)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.api.v1.endpoints import nowcast, routing, calibration

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-resolution street-level urban inundation nowcasting (0-3 hr horizon) and flood-safe emergency routing.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for Next.js / React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
app.include_router(nowcast.router, prefix=f"{settings.API_V1_STR}/nowcast", tags=["Atmospheric & Hydraulic Nowcasting"])
app.include_router(routing.router, prefix=f"{settings.API_V1_STR}/routing", tags=["Safe Emergency Navigation"])
app.include_router(calibration.router, prefix=f"{settings.API_V1_STR}/calibration", tags=["Edge CCTV Ground Truth Calibration"])


@app.get("/")
def root():
    return {
        "engine": "JalKal (जलकाल)",
        "version": "1.0.0",
        "description": "Urban Flood Nowcasting and Safe Navigation Engine",
        "hackathon": "Smart India Hackathon - MoES / NCMRWF (SIH26085)",
        "status": "OPERATIONAL",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "backend": "UP",
        "dual_mode_solver": "ACTIVE",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

