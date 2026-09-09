"""
JalKal (जलकाल) - Nowcast API Endpoints
Module: backend/api/v1/endpoints/nowcast.py

Serves dynamic street-level inundation maps and drainage network hydraulic state
for forecast horizons T+0 to T+180 min (at 15-min intervals).
"""

from typing import Dict, Any, List, Optional
import math
import time
import logging
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import APIRouter, Query, HTTPException
from backend.core.config import settings
from backend.services.hydrology_service import hydrology_service
from backend.services.hydraulic_solver import hydraulic_solver

router = APIRouter()
logger = logging.getLogger("nowcast")

# In-memory realistic Delhi urban drainage & road sample topology for immediate execution
SAMPLE_NODES = [
    {"id": "node-1", "node_code": "MH_CP_INNER_01", "coords": [77.2185, 28.6328], "z_ground": 216.5, "z_invert": 214.0, "basin_area_m2": 5200.0, "curb_length_m": 4.0},
    {"id": "node-2", "node_code": "MH_CP_INNER_02", "coords": [77.2205, 28.6315], "z_ground": 215.8, "z_invert": 213.2, "basin_area_m2": 6100.0, "curb_length_m": 4.5},
    {"id": "node-3", "node_code": "MH_CP_OUTER_03", "coords": [77.2225, 28.6295], "z_ground": 214.9, "z_invert": 212.1, "basin_area_m2": 7800.0, "curb_length_m": 5.0},
    {"id": "node-4", "node_code": "MH_MINTO_BRIDGE", "coords": [77.2245, 28.6360], "z_ground": 212.2, "z_invert": 209.5, "basin_area_m2": 12000.0, "curb_length_m": 6.0},
    {"id": "node-5", "node_code": "MH_BARAKHAMBA_05", "coords": [77.2260, 28.6280], "z_ground": 215.2, "z_invert": 212.8, "basin_area_m2": 4900.0, "curb_length_m": 3.5},
    {"id": "node-6", "node_code": "MH_KG_MARG_06", "coords": [77.2210, 28.6255], "z_ground": 215.6, "z_invert": 213.0, "basin_area_m2": 5500.0, "curb_length_m": 3.8},
    # Terminal outfall of the trunk drain into the Yamuna (no tributary catchment).
    {"id": "node-7", "node_code": "OUTFALL_YAMUNA_01", "coords": [77.2340, 28.6385], "z_ground": 209.5, "z_invert": 206.8, "basin_area_m2": 0.0, "curb_length_m": 0.0},
]

SAMPLE_CONDUITS = [
    {"id": "cond-1", "conduit_code": "COND_CP_01", "source_node": "node-1", "target_node": "node-2", "coords": [[77.2185, 28.6328], [77.2205, 28.6315]], "diameter_m": 0.90, "length_m": 240.0, "slope": 0.005, "clogging_ratio": 0.0},
    {"id": "cond-2", "conduit_code": "COND_CP_02", "source_node": "node-2", "target_node": "node-3", "coords": [[77.2205, 28.6315], [77.2225, 28.6295]], "diameter_m": 1.00, "length_m": 290.0, "slope": 0.006, "clogging_ratio": 0.0},
    {"id": "cond-3", "conduit_code": "COND_MINTO_CULVERT", "source_node": "node-3", "target_node": "node-4", "coords": [[77.2225, 28.6295], [77.2245, 28.6360]], "diameter_m": 1.20, "length_m": 650.0, "slope": 0.004, "clogging_ratio": 0.45},
    {"id": "cond-4", "conduit_code": "COND_BARA_04", "source_node": "node-3", "target_node": "node-5", "coords": [[77.2225, 28.6295], [77.2260, 28.6280]], "diameter_m": 0.90, "length_m": 380.0, "slope": 0.005, "clogging_ratio": 0.0},
    {"id": "cond-5", "conduit_code": "COND_KG_05", "source_node": "node-2", "target_node": "node-6", "coords": [[77.2205, 28.6315], [77.2210, 28.6255]], "diameter_m": 0.85, "length_m": 320.0, "slope": 0.005, "clogging_ratio": 0.0},
    # Silted trunk drain out of the Minto sump towards the Yamuna outfall: the
    # network's hydraulic choke point. Its constrained effective capacity is
    # what backs stormwater up into the underpass during heavy rainfall.
    {"id": "cond-6", "conduit_code": "COND_MINTO_TRUNK", "source_node": "node-4", "target_node": "node-7", "coords": [[77.2245, 28.6360], [77.2340, 28.6385]], "diameter_m": 0.80, "length_m": 620.0, "slope": 0.002, "clogging_ratio": 0.55},
]

SAMPLE_ROADS = [
    {
        "id": 101, "osm_id": 900101, "road_name": "Connaught Circus Inner",
        "source_vertex": 1, "target_vertex": 2, "length_m": 250.0, "z_elevation": 216.2,
        "coordinates": [[77.2185, 28.6328], [77.2195, 28.6322], [77.2205, 28.6315]]
    },
    {
        "id": 102, "osm_id": 900102, "road_name": "Radial Road 3",
        "source_vertex": 2, "target_vertex": 3, "length_m": 300.0, "z_elevation": 215.4,
        "coordinates": [[77.2205, 28.6315], [77.2215, 28.6305], [77.2225, 28.6295]]
    },
    {
        "id": 103, "osm_id": 900103, "road_name": "Minto Underpass Subway (Choke Point)",
        "source_vertex": 3, "target_vertex": 4, "length_m": 680.0, "z_elevation": 211.8, # Low underpass dip
        "coordinates": [[77.2225, 28.6295], [77.2235, 28.6328], [77.2245, 28.6360]]
    },
    {
        "id": 104, "osm_id": 900104, "road_name": "Barakhamba Elevated Flyover (Safe Bypass)",
        "source_vertex": 3, "target_vertex": 5, "length_m": 420.0, "z_elevation": 217.5, # Elevated
        "coordinates": [[77.2225, 28.6295], [77.2242, 28.6288], [77.2260, 28.6280]]
    },
    {
        "id": 105, "osm_id": 900105, "road_name": "Bhavbhuti Marg Bypass",
        "source_vertex": 5, "target_vertex": 4, "length_m": 580.0, "z_elevation": 216.0,
        "coordinates": [[77.2260, 28.6280], [77.2255, 28.6325], [77.2245, 28.6360]]
    },
    {
        "id": 106, "osm_id": 900106, "road_name": "Kasturba Gandhi Marg",
        "source_vertex": 2, "target_vertex": 6, "length_m": 340.0, "z_elevation": 215.8,
        "coordinates": [[77.2205, 28.6315], [77.2208, 28.6280], [77.2210, 28.6255]]
    },
]


def _scripted_fallback_rainfall(horizon_min: int) -> float:
    """
    Scripted stand-in rainfall curve (a monsoon-cloudburst-shaped bell curve),
    used ONLY when the live rainfall API is unreachable or returns no usable
    data. This is NOT a forecast -- it is a fixed, hardcoded curve that
    returns the same numbers regardless of real weather.
    """
    if horizon_min < 0:
        return 0.0
    peak_time = 45.0
    width = 30.0
    intensity = 78.0 * math.exp(-((horizon_min - peak_time) ** 2) / (2 * (width ** 2)))
    return round(max(5.0, intensity), 2)


# Reference point for the live rainfall lookup: Connaught Place, Delhi
# (matches the sample drainage network's location).
CITY_LAT = 28.6315
CITY_LON = 77.2167

# Open-Meteo's free forecast API needs no API key/signup, which keeps this
# usable for a hackathon demo without provisioning secrets.
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Simple in-memory cache so every horizon request (and every dashboard poll)
# doesn't re-hit the external API; refreshed at most once every 5 minutes.
_rainfall_cache: Dict[str, Any] = {"fetched_at": 0.0, "series": None}
_CACHE_TTL_SEC = 300.0


def _fetch_live_precipitation_series() -> Optional[List[Dict[str, Any]]]:
    """
    Fetches a real 15-minute-resolution precipitation forecast from Open-Meteo.
    Returns a list of {"time": datetime, "precip_mm_per_15min": float}, or
    None if the API is unreachable / returns no usable data -- callers must
    handle that by falling back to the scripted curve.
    """
    now = time.time()
    if _rainfall_cache["series"] is not None and (now - _rainfall_cache["fetched_at"]) < _CACHE_TTL_SEC:
        return _rainfall_cache["series"]

    try:
        response = httpx.get(
            OPEN_METEO_URL,
            params={
                "latitude": CITY_LAT,
                "longitude": CITY_LON,
                "minutely_15": "precipitation",
                "forecast_days": 1,
                "timezone": "UTC",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()

        times = payload["minutely_15"]["time"]
        precip = payload["minutely_15"]["precipitation"]

        series = [
            {
                "time": datetime.fromisoformat(t).replace(tzinfo=timezone.utc),
                "precip_mm_per_15min": float(p) if p is not None else 0.0,
            }
            for t, p in zip(times, precip)
        ]
        _rainfall_cache["series"] = series
        _rainfall_cache["fetched_at"] = now
        return series

    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning(f"Live rainfall API unavailable, using scripted fallback: {exc}")
        return None


def get_rainfall_intensity_for_horizon(horizon_min: int, simulate: bool = False) -> Dict[str, Any]:
    """
    Returns real rainfall intensity (mm/hr) for T+horizon_min from a live
    weather API when available; otherwise falls back to a scripted curve.
    Always reports which source was actually used, so the app never silently
    presents simulated numbers as if they were live.

    With simulate=True the scripted cloudburst curve is used regardless of
    live weather, so the flood scenario can be demonstrated on a dry day.
    The source is reported as "simulated_storm" so the UI can label it.
    """
    if simulate:
        return {"rainfall_mm_hr": _scripted_fallback_rainfall(horizon_min), "source": "simulated_storm"}

    series = _fetch_live_precipitation_series()

    if series:
        target_time = datetime.now(timezone.utc) + timedelta(minutes=horizon_min)
        closest = min(series, key=lambda s: abs((s["time"] - target_time).total_seconds()))
        # Open-Meteo reports precipitation as mm accumulated per 15-minute
        # bucket; multiply by 4 to express it as a standard mm/hr rate.
        intensity = round(closest["precip_mm_per_15min"] * 4.0, 2)
        return {"rainfall_mm_hr": intensity, "source": "live_open_meteo"}

    return {"rainfall_mm_hr": _scripted_fallback_rainfall(horizon_min), "source": "simulated_fallback"}


@router.get("/inundation-grid", response_model=Dict[str, Any])
def get_nowcast_inundation_grid(
    horizon_min: int = Query(
        0, ge=0, le=180, description="Forecast horizon minutes (0, 15, 30, ..., 180)"
    ),
    simulate: bool = Query(
        False, description="Use the scripted cloudburst instead of live weather (demo mode)"
    ),
):
    """
    Returns time-scrubbed street inundation and drainage surcharge states as GeoJSON.
    Includes extruded manhole columns (ColumnLayer) and color-coded road paths (PathLayer).
    """
    rainfall_result = get_rainfall_intensity_for_horizon(horizon_min, simulate=simulate)
    rain_mm_hr = rainfall_result["rainfall_mm_hr"]
    rainfall_source = rainfall_result["source"]
    hydraulic_res = hydraulic_solver.solve_drainage_network(
        nodes=SAMPLE_NODES,
        conduits=SAMPLE_CONDUITS,
        rainfall_intensity_mm_hr=rain_mm_hr,
        horizon_min=horizon_min,
    )

    node_states = hydraulic_res["nodes"]
    conduit_states = hydraulic_res["conduits"]

    # Compute road flood depths
    road_inundations = hydraulic_solver.map_node_depths_to_roads(
        roads=SAMPLE_ROADS,
        nodes=SAMPLE_NODES,
        node_results=node_states,
        horizon_min=horizon_min,
    )
    road_depth_map = {r["road_segment_id"]: r for r in road_inundations}

    # Assemble GeoJSON FeatureCollection
    features: List[Dict[str, Any]] = []

    # 1. Road Segments (Deck.gl PathLayer)
    for road in SAMPLE_ROADS:
        rid = road["id"]
        flood = road_depth_map.get(rid, {"water_depth_cm": 0.0, "status": "PASSABLE"})
        d = float(flood["water_depth_cm"])

        # Deck.gl RGB color coding:
        # Green (<10cm) -> Amber (10-25cm) -> Deep Red (>25cm)
        if d < 10.0:
            color = [16, 185, 129, 230]       # Green #10B981
            status = "PASSABLE"
        elif d <= 25.0:
            color = [245, 158, 11, 230]      # Amber #F59E0B
            status = "SLOW"
        else:
            color = [239, 68, 68, 240]        # Red #EF4444
            status = "IMPASSABLE"

        features.append({
            "type": "Feature",
            "properties": {
                "layer_type": "ROAD_SEGMENT",
                "road_id": rid,
                "road_name": road["road_name"],
                "water_depth_cm": d,
                "status": status,
                "color": color,
                "flow_velocity_ms": flood.get("flow_velocity_ms", 0.0),
                "z_elevation": road["z_elevation"],
            },
            "geometry": {
                "type": "LineString",
                "coordinates": road["coordinates"],
            },
        })

    # 2. Drainage Manholes (Deck.gl ColumnLayer - 3D Extrusion)
    for node in SAMPLE_NODES:
        nid = node["id"]
        n_state = node_states.get(nid, {"hgl": node["z_invert"], "surcharge_flow_m3s": 0.0, "street_depth_cm": 0.0, "is_surcharging": False})
        
        depth_cm = n_state["street_depth_cm"]
        # Extrusion height proportional to surcharge overflow head
        elevation_height = max(10.0, depth_cm * 4.0)

        col_color = [14, 165, 233, 220] if not n_state["is_surcharging"] else [239, 68, 68, 240]

        features.append({
            "type": "Feature",
            "properties": {
                "layer_type": "DRAIN_NODE",
                "node_id": nid,
                "node_code": node["node_code"],
                "hgl": n_state["hgl"],
                "z_ground": node["z_ground"],
                "z_invert": node["z_invert"],
                "basin_area": node["basin_area_m2"],
                "surcharge_flow_m3s": n_state["surcharge_flow_m3s"],
                "street_depth_cm": depth_cm,
                "is_surcharging": n_state["is_surcharging"],
                "elevation": elevation_height,
                "color": col_color,
            },
            "geometry": {
                "type": "Point",
                "coordinates": node["coords"],
            },
        })

    return {
        "type": "FeatureCollection",
        "horizon_min": horizon_min,
        "rainfall_intensity_mm_hr": rain_mm_hr,
        "rainfall_source": rainfall_source,
        "total_flooded_roads": len([r for r in road_inundations if r["status"] != "PASSABLE"]),
        "features": features,
    }


@router.get("/summary-stats")
def get_nowcast_summary(
    simulate: bool = Query(
        False, description="Use the scripted cloudburst instead of live weather (demo mode)"
    ),
):
    """
    Returns time-series curve of peak rainfall and flood severity over the 3-hour forecast horizon.
    """
    timeline = []
    for t in range(0, 195, 15):
        rainfall_result = get_rainfall_intensity_for_horizon(t, simulate=simulate)
        rain = rainfall_result["rainfall_mm_hr"]

        # Run the same hydraulic solver as the inundation grid so the
        # timeline chart and the map can never contradict each other.
        hydraulic_res = hydraulic_solver.solve_drainage_network(
            nodes=SAMPLE_NODES,
            conduits=SAMPLE_CONDUITS,
            rainfall_intensity_mm_hr=rain,
            horizon_min=t,
        )
        road_inundations = hydraulic_solver.map_node_depths_to_roads(
            roads=SAMPLE_ROADS,
            nodes=SAMPLE_NODES,
            node_results=hydraulic_res["nodes"],
            horizon_min=t,
        )
        max_flood = max((r["water_depth_cm"] for r in road_inundations), default=0.0)

        if max_flood > settings.MAX_PASSABLE_DEPTH_CM:
            status = "IMPASSABLE"
        elif max_flood >= settings.SLOWDOWN_DEPTH_CM:
            status = "SLOW"
        else:
            status = "CLEAR"

        timeline.append({
            "horizon_min": t,
            "rainfall_mm_hr": rain,
            "rainfall_source": rainfall_result["source"],
            "max_flood_depth_cm": max_flood,
            "status": status,
        })

    return {
        "forecast_horizon_hours": 3.0,
        "step_interval_min": 15,
        "timeline": timeline,
    }
