"""
JalKal (जलकाल) - Ground Truth Calibration API
Module: backend/api/v1/endpoints/calibration.py

Accepts edge telemetry from municipal CCTV video feeds or citizen crowdsourced reports
to dynamically calibrate pipe clogging factors (alpha).
"""

from typing import Dict, Any, Optional
import time
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from backend.api.v1.endpoints.nowcast import SAMPLE_CONDUITS

router = APIRouter()

# In-memory calibration audit log
CALIBRATION_LOGS = []


class CloggingCalibrationRequest(BaseModel):
    conduit_code: str = Field(..., description="Target drainage conduit code")
    clogging_ratio: float = Field(..., ge=0.0, le=1.0, description="Dynamic clogging factor alpha [0.0 - 1.0]")
    observed_water_depth_cm: Optional[float] = Field(None, description="Ground truth depth verified by CCTV")
    sensor_source: str = Field("CCTV_EDGE_VISION", description="Sensor identifier or Camera ID")
    timestamp: Optional[float] = Field(default_factory=time.time)


@router.post("/clogging", response_model=Dict[str, Any])
def calibrate_conduit_clogging(payload: CloggingCalibrationRequest):
    """
    Updates the physical clogging ratio of a drainage conduit based on live CCTV waterline observation.
    """
    target_conduit = None
    for c in SAMPLE_CONDUITS:
        if c["conduit_code"] == payload.conduit_code or c["id"] == payload.conduit_code:
            target_conduit = c
            break

    old_ratio = target_conduit["clogging_ratio"] if target_conduit else 0.0

    if target_conduit:
        target_conduit["clogging_ratio"] = payload.clogging_ratio

    log_entry = {
        "event_id": len(CALIBRATION_LOGS) + 1,
        "conduit_code": payload.conduit_code,
        "previous_clogging_ratio": old_ratio,
        "new_clogging_ratio": payload.clogging_ratio,
        "observed_water_depth_cm": payload.observed_water_depth_cm,
        "sensor_source": payload.sensor_source,
        "timestamp": payload.timestamp,
        "status": "APPLIED" if target_conduit else "CONDUIT_NOT_FOUND_LOGGED_ANYWAY",
    }
    CALIBRATION_LOGS.append(log_entry)

    return {
        "success": True,
        "message": f"Conduit {payload.conduit_code} clogging ratio successfully updated to {payload.clogging_ratio}",
        "calibration_record": log_entry,
    }


@router.get("/logs")
def get_calibration_logs():
    """
    Retrieves history of dynamic CCTV sensor calibrations.
    """
    return {
        "total_calibrations": len(CALIBRATION_LOGS),
        "logs": list(reversed(CALIBRATION_LOGS[-50:])),
    }

