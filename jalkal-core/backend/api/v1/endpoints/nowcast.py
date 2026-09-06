"""
JalKal (जलकाल) - Nowcast API Endpoints
Module: backend/api/v1/endpoints/nowcast.py

Serves dynamic street-level inundation maps and drainage network hydraulic state
for forecast horizons T+0 to T+180 min (at 15-min intervals).
"""

from typing import Dict, Any, List, Optional
import math
from fastapi import APIRouter, Query, HTTPException
from backend.services.hydrology_service import hydrology_service
from backend.services.hydraulic_solver import hydraulic_solver

router = APIRouter()

# In-memory realistic Delhi urban drainage & road sample topology for immediate execution
SAMPLE_NODES = [
    {"id": "node-1", "node_code": "MH_CP_INNER_01", "coords": [77.2185, 28.6328], "z_ground": 216.5, "z_invert": 214.0, "basin_area_m2": 5200.0, "curb_length_m": 4.0},
    {"id": "node-2", "node_code": "MH_CP_INNER_02", "coords": [77.2205, 28.6315], "z_ground": 215.8, "z_invert": 213.2, "basin_area_m2": 6100.0, "curb_length_m": 4.5},
    {"id": "node-3", "node_code": "MH_CP_OUTER_03", "coords": [77.2225, 28.6295], "z_ground": 214.9, "z_invert": 212.1, "basin_area_m2": 7800.0, "curb_length_m": 5.0},
    {"id": "node-4", "node_code": "MH_MINTO_BRIDGE", "coords": [77.2245, 28.6360], "z_ground": 212.2, "z_invert": 209.5, "basin_area_m2": 12000.0, "curb_length_m": 6.0},
    {"id": "node-5", "node_code": "MH_BARAKHAMBA_05", "coords": [77.2260, 28.6280], "z_ground": 215.2, "z_invert": 212.8, "basin_area_m2": 4900.0, "curb_length_m": 3.5},
    {"id": "node-6", "node_code": "MH_KG_MARG_06", "coords": [77.2210, 28.6255], "z_ground": 215.6, "z_invert": 213.0, "basin_area_m2": 5500.0, "curb_length_m": 3.8},
]

SAMPLE_CONDUITS = [
    {"id": "cond-1", "conduit_code": "COND_CP_01", "source_node": "node-1", "target_node": "node-2", "coords": [[77.2185, 28.6328], [77.2205, 28.6315]], "diameter_m": 0.90, "length_m": 240.0, "slope": 0.005, "clogging_ratio": 0.0},
    {"id": "cond-2", "conduit_code": "COND_CP_02", "source_node": "node-2", "target_node": "node-3", "coords": [[77.2205, 28.6315], [77.2225, 28.6295]], "diameter_m": 1.00, "length_m": 290.0, "slope": 0.006, "clogging_ratio": 0.0},
    {"id": "cond-3", "conduit_code": "COND_MINTO_CULVERT", "source_node": "node-3", "target_node": "node-4", "coords": [[77.2225, 28.6295], [77.2245, 28.6360]], "diameter_m": 1.20, "length_m": 650.0, "slope": 0.004, "clogging_ratio": 0.45},
    {"id": "cond-4", "conduit_code": "COND_BARA_04", "source_node": "node-3", "target_node": "node-5", "coords": [[77.2225, 28.6295], [77.2260, 28.6280]], "diameter_m": 0.90, "length_m": 380.0, "slope": 0.005, "clogging_ratio": 0.0},
    {"id": "cond-5", "conduit_code": "COND_KG_05", "source_node": "node-2", "target_node": "node-6", "coords": [[77.2205, 28.6315], [77.2210, 28.6255]], "diameter_m": 0.85, "length_m": 320.0, "slope": 0.005, "clogging_ratio": 0.0},
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


def get_rainfall_intensity_for_horizon(horizon_min: int) -> float:
    """
    Simulates a convective monsoon storm trajectory across the 0-180 min forecast horizon:
    Peak intensity at T+45m to T+60m (~65-75 mm/hr cloudburst).
    """
    if horizon_min < 0:
        return 0.0
    # Bell-shaped storm hydrograph
    peak_time = 45.0
    width = 30.0
    intensity = 78.0 * math.exp(-((horizon_min - peak_time) ** 2) / (2 * (width ** 2)))
    return round(max(5.0, intensity), 2)


@router.get("/inundation-grid", response_model=Dict[str, Any])
def get_nowcast_inundation_grid(
    horizon_min: int = Query(
        0, ge=0, le=180, description="Forecast horizon minutes (0, 15, 30, ..., 180)"
    )
):
    """
    Returns time-scrubbed street inundation and drainage surcharge states as GeoJSON.
    Includes extruded manhole columns (ColumnLayer) and color-coded road paths (PathLayer).
    """
    rain_mm_hr = get_rainfall_intensity_for_horizon(horizon_min)
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
        "total_flooded_roads": len([r for r in road_inundations if r["status"] != "PASSABLE"]),
        "features": features,
    }


@router.get("/summary-stats")
def get_nowcast_summary():
    """
    Returns time-series curve of peak rainfall and flood severity over the 3-hour forecast horizon.
    """
    timeline = []
    for t in range(0, 195, 15):
        rain = get_rainfall_intensity_for_horizon(t)
        # Surcharge begins when rain exceeds typical pipe capacity (~35 mm/hr)
        max_flood = max(0.0, round((rain - 32.0) * 0.9, 1)) if rain > 32.0 else 2.5
        timeline.append({
            "horizon_min": t,
            "rainfall_mm_hr": rain,
            "max_flood_depth_cm": max_flood,
            "status": "IMPASSABLE" if max_flood > 25.0 else ("SLOW" if max_flood > 10.0 else "CLEAR"),
        })

    return {
        "forecast_horizon_hours": 3.0,
        "step_interval_min": 15,
        "timeline": timeline,
    }

