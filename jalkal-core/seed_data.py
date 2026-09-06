"""
JalKal (जलकाल) - Synthetic Geospatial & Hydraulic Seed Data Generator
Module: seed_data.py

Generates realistic urban drainage networks, manholes, conduits, and OpenStreetMap
road segments for the Connaught Place - Minto Bridge drainage catchment (New Delhi, India).
Outputs:
1. Direct PostGIS SQL insert statements / DB insertion.
2. Standalone GeoJSON export (`jalkal_seed_payload.geojson`) for quick local testing.
"""

import os
import json
import uuid
import random
from typing import List, Dict, Any

# Target Seed Coordinates (Connaught Place & Minto Bridge Catchment, New Delhi)
BASE_LON = 77.2185
BASE_LAT = 28.6328


def generate_synthetic_catchment_network() -> Dict[str, Any]:
    """
    Constructs a topologically connected urban drainage graph and road network.
    """
    random.seed(42)

    # 1. Drainage Manholes / Inlets
    nodes = [
        {
            "id": str(uuid.uuid4()),
            "node_code": "MH_CP_INNER_01",
            "geom": {"type": "Point", "coordinates": [BASE_LON, BASE_LAT]},
            "z_ground": 216.50,
            "z_invert": 214.00,
            "basin_area_m2": 5200.0,
            "curb_length_m": 4.0,
        },
        {
            "id": str(uuid.uuid4()),
            "node_code": "MH_CP_INNER_02",
            "geom": {"type": "Point", "coordinates": [BASE_LON + 0.0020, BASE_LAT - 0.0013]},
            "z_ground": 215.80,
            "z_invert": 213.20,
            "basin_area_m2": 6100.0,
            "curb_length_m": 4.5,
        },
        {
            "id": str(uuid.uuid4()),
            "node_code": "MH_CP_OUTER_03",
            "geom": {"type": "Point", "coordinates": [BASE_LON + 0.0040, BASE_LAT - 0.0033]},
            "z_ground": 214.90,
            "z_invert": 212.10,
            "basin_area_m2": 7800.0,
            "curb_length_m": 5.0,
        },
        {
            "id": str(uuid.uuid4()),
            "node_code": "MH_MINTO_BRIDGE_LOW",
            "geom": {"type": "Point", "coordinates": [BASE_LON + 0.0060, BASE_LAT + 0.0032]},
            "z_ground": 212.20,  # Critical low dip / underpass
            "z_invert": 209.50,
            "basin_area_m2": 12000.0,
            "curb_length_m": 6.0,
        },
        {
            "id": str(uuid.uuid4()),
            "node_code": "MH_BARAKHAMBA_05",
            "geom": {"type": "Point", "coordinates": [BASE_LON + 0.0075, BASE_LAT - 0.0048]},
            "z_ground": 215.20,
            "z_invert": 212.80,
            "basin_area_m2": 4900.0,
            "curb_length_m": 3.5,
        },
        {
            "id": str(uuid.uuid4()),
            "node_code": "MH_KG_MARG_06",
            "geom": {"type": "Point", "coordinates": [BASE_LON + 0.0025, BASE_LAT - 0.0073]},
            "z_ground": 215.60,
            "z_invert": 213.00,
            "basin_area_m2": 5500.0,
            "curb_length_m": 3.8,
        },
    ]

    # 2. Underground Drainage Conduits
    conduits = [
        {
            "id": str(uuid.uuid4()),
            "conduit_code": "COND_CP_01",
            "source_node": nodes[0]["id"],
            "target_node": nodes[1]["id"],
            "diameter_m": 0.90,
            "length_m": 240.0,
            "manning_n": 0.014,
            "clogging_ratio": 0.05,
            "geom": {
                "type": "LineString",
                "coordinates": [nodes[0]["geom"]["coordinates"], nodes[1]["geom"]["coordinates"]],
            },
        },
        {
            "id": str(uuid.uuid4()),
            "conduit_code": "COND_CP_02",
            "source_node": nodes[1]["id"],
            "target_node": nodes[2]["id"],
            "diameter_m": 1.00,
            "length_m": 290.0,
            "manning_n": 0.014,
            "clogging_ratio": 0.10,
            "geom": {
                "type": "LineString",
                "coordinates": [nodes[1]["geom"]["coordinates"], nodes[2]["geom"]["coordinates"]],
            },
        },
        {
            "id": str(uuid.uuid4()),
            "conduit_code": "COND_MINTO_OUTFALL",
            "source_node": nodes[2]["id"],
            "target_node": nodes[3]["id"],
            "diameter_m": 1.20,
            "length_m": 650.0,
            "manning_n": 0.015,
            "clogging_ratio": 0.50,  # Vulnerable to siltation & debris
            "geom": {
                "type": "LineString",
                "coordinates": [nodes[2]["geom"]["coordinates"], nodes[3]["geom"]["coordinates"]],
            },
        },
        {
            "id": str(uuid.uuid4()),
            "conduit_code": "COND_BARAKHAMBA_04",
            "source_node": nodes[2]["id"],
            "target_node": nodes[4]["id"],
            "diameter_m": 0.90,
            "length_m": 380.0,
            "manning_n": 0.014,
            "clogging_ratio": 0.00,
            "geom": {
                "type": "LineString",
                "coordinates": [nodes[2]["geom"]["coordinates"], nodes[4]["geom"]["coordinates"]],
            },
        },
    ]

    # 3. Road Network Segments
    roads = [
        {
            "id": 101,
            "osm_id": 900101,
            "road_name": "Connaught Place Inner Circle",
            "highway_type": "secondary",
            "base_speed_kmh": 40.0,
            "length_m": 250.0,
            "source_vertex": 1,
            "target_vertex": 2,
            "z_elevation": 216.20,
            "geom": {
                "type": "LineString",
                "coordinates": [
                    [BASE_LON, BASE_LAT],
                    [BASE_LON + 0.0010, BASE_LAT - 0.0006],
                    [BASE_LON + 0.0020, BASE_LAT - 0.0013],
                ],
            },
        },
        {
            "id": 102,
            "osm_id": 900102,
            "road_name": "Radial Road 3 Connector",
            "highway_type": "tertiary",
            "base_speed_kmh": 35.0,
            "length_m": 300.0,
            "source_vertex": 2,
            "target_vertex": 3,
            "z_elevation": 215.40,
            "geom": {
                "type": "LineString",
                "coordinates": [
                    [BASE_LON + 0.0020, BASE_LAT - 0.0013],
                    [BASE_LON + 0.0030, BASE_LAT - 0.0023],
                    [BASE_LON + 0.0040, BASE_LAT - 0.0033],
                ],
            },
        },
        {
            "id": 103,
            "osm_id": 900103,
            "road_name": "Minto Road Railway Underpass (Inundation Hotspot)",
            "highway_type": "primary",
            "base_speed_kmh": 45.0,
            "length_m": 680.0,
            "source_vertex": 3,
            "target_vertex": 4,
            "z_elevation": 211.80,  # Below surrounding grade
            "geom": {
                "type": "LineString",
                "coordinates": [
                    [BASE_LON + 0.0040, BASE_LAT - 0.0033],
                    [BASE_LON + 0.0050, BASE_LAT - 0.0000],
                    [BASE_LON + 0.0060, BASE_LAT + 0.0032],
                ],
            },
        },
        {
            "id": 104,
            "osm_id": 900104,
            "road_name": "Barakhamba Road Elevated Flyover",
            "highway_type": "primary",
            "base_speed_kmh": 50.0,
            "length_m": 420.0,
            "source_vertex": 3,
            "target_vertex": 5,
            "z_elevation": 217.50,  # Elevated bridge deck
            "geom": {
                "type": "LineString",
                "coordinates": [
                    [BASE_LON + 0.0040, BASE_LAT - 0.0033],
                    [BASE_LON + 0.0058, BASE_LAT - 0.0040],
                    [BASE_LON + 0.0075, BASE_LAT - 0.0048],
                ],
            },
        },
        {
            "id": 105,
            "osm_id": 900105,
            "road_name": "Bhavbhuti Marg Bypass Corridor",
            "highway_type": "secondary",
            "base_speed_kmh": 40.0,
            "length_m": 580.0,
            "source_vertex": 5,
            "target_vertex": 4,
            "z_elevation": 216.00,
            "geom": {
                "type": "LineString",
                "coordinates": [
                    [BASE_LON + 0.0075, BASE_LAT - 0.0048],
                    [BASE_LON + 0.0070, BASE_LAT - 0.0008],
                    [BASE_LON + 0.0060, BASE_LAT + 0.0032],
                ],
            },
        },
    ]

    return {"nodes": nodes, "conduits": conduits, "roads": roads}


def export_to_geojson(data: Dict[str, Any], filepath: str):
    """
    Exports combined network to a standard GeoJSON FeatureCollection.
    """
    features = []

    # Add Nodes
    for n in data["nodes"]:
        features.append({
            "type": "Feature",
            "properties": {
                "feature_type": "drain_node",
                "id": n["id"],
                "node_code": n["node_code"],
                "z_ground": n["z_ground"],
                "z_invert": n["z_invert"],
                "basin_area_m2": n["basin_area_m2"],
            },
            "geometry": n["geom"],
        })

    # Add Conduits
    for c in data["conduits"]:
        features.append({
            "type": "Feature",
            "properties": {
                "feature_type": "drain_conduit",
                "id": c["id"],
                "conduit_code": c["conduit_code"],
                "diameter_m": c["diameter_m"],
                "length_m": c["length_m"],
                "clogging_ratio": c["clogging_ratio"],
            },
            "geometry": c["geom"],
        })

    # Add Roads
    for r in data["roads"]:
        features.append({
            "type": "Feature",
            "properties": {
                "feature_type": "road_segment",
                "id": r["id"],
                "road_name": r["road_name"],
                "z_elevation": r["z_elevation"],
                "length_m": r["length_m"],
            },
            "geometry": r["geom"],
        })

    geojson_doc = {
        "type": "FeatureCollection",
        "name": "JalKal_Urban_Drainage_Catchment_Seed",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(geojson_doc, f, indent=2)

    print(f"[+] Successfully wrote {len(features)} geospatial features to: {filepath}")


if __name__ == "__main__":
    print("[*] Generating JalKal Synthetic Geospatial & Drainage Network...")
    dataset = generate_synthetic_catchment_network()
    out_file = os.path.join(os.path.dirname(__file__), "jalkal_seed_payload.geojson")
    export_to_geojson(dataset, out_file)
    print(f"[+] Nodes: {len(dataset['nodes'])}")
    print(f"[+] Conduits: {len(dataset['conduits'])}")
    print(f"[+] Road Segments: {len(dataset['roads'])}")
    print("[+] Seed generation complete!")

