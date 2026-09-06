"""
JalKal (जलकाल) - Dynamic Flood-Penalized Routing Service
Module: backend/services/routing_service.py

Implements depth-weighted A* algorithm on urban road networks (NetworkX / OSMnx).
Dynamic Cost Function:
    Cost(e) = Length(e) * Penalty(water_depth)
    - depth < 10 cm: Penalty = 1.0 (Nominal free flow)
    - 10 cm <= depth <= 25 cm: Penalty = 3.5 (Severe engine/traction slowdown)
    - depth > 25 cm: Penalty = Infinity (Strictly impassable barrier)

Outputs dual comparison:
1. Baseline Route (Shortest distance, potentially traversing dangerous floodwaters)
2. Safe Detour Route (Avoids impassable choke-points, minimizing emergency transit delay)
"""

from typing import List, Dict, Any, Tuple, Optional
import math
import networkx as nx


class DynamicRoutingService:
    """
    Emergency evacuation and safe ambulance routing engine.
    """

    def __init__(self):
        self.graph = nx.DiGraph()

    def build_graph_from_roads(
        self,
        roads: List[Dict[str, Any]],
        inundation_logs: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> nx.DiGraph:
        """
        Builds NetworkX directed graph from road segments with real-time flood weights.
        :param roads: List of road segment dictionaries with coords, length, vertices.
        :param inundation_logs: Mapping of road_id -> {water_depth_cm, status, hazard_penalty}
        """
        g = nx.DiGraph()
        inundation_logs = inundation_logs or {}

        for r in roads:
            rid = r["id"]
            u = r.get("source_vertex", r.get("u"))
            v = r.get("target_vertex", r.get("v"))
            length = float(r.get("length_m", 100.0))
            coords = r.get("coordinates", [])

            # Fetch flood state
            flood_info = inundation_logs.get(rid, {"water_depth_cm": 0.0, "status": "PASSABLE"})
            depth_cm = float(flood_info["water_depth_cm"])

            # Compute dynamic penalty
            if depth_cm < 10.0:
                penalty = 1.0
                is_passable = True
            elif depth_cm <= 25.0:
                penalty = 3.5
                is_passable = True
            else:
                penalty = float("inf")
                is_passable = False

            # Add forward edge
            g.add_node(u, pos=coords[0] if coords else (0, 0))
            g.add_node(v, pos=coords[-1] if coords else (0, 0))

            g.add_edge(
                u,
                v,
                road_id=rid,
                road_name=r.get("road_name", "Street"),
                length=length,
                water_depth_cm=depth_cm,
                penalty=penalty,
                safe_weight=length * penalty if is_passable else 1e9,
                baseline_weight=length,
                is_passable=is_passable,
                coords=coords,
            )

            # Bidirectional accessibility for typical urban emergency access
            g.add_edge(
                v,
                u,
                road_id=rid,
                road_name=r.get("road_name", "Street"),
                length=length,
                water_depth_cm=depth_cm,
                penalty=penalty,
                safe_weight=length * penalty if is_passable else 1e9,
                baseline_weight=length,
                is_passable=is_passable,
                coords=list(reversed(coords)) if coords else [],
            )

        self.graph = g
        return g

    def find_nearest_node(self, coord: Tuple[float, float]) -> Optional[Any]:
        """
        Finds graph vertex closest to target (longitude, latitude) Euclidean distance.
        """
        lon, lat = coord
        best_node = None
        min_dist = float("inf")

        for node, data in self.graph.nodes(data=True):
            pos = data.get("pos")
            if pos and len(pos) >= 2:
                d = (pos[0] - lon) ** 2 + (pos[1] - lat) ** 2
                if d < min_dist:
                    min_dist = d
                    best_node = node

        return best_node

    def compute_dual_route(
        self,
        start_coord: Tuple[float, float],
        end_coord: Tuple[float, float],
    ) -> Dict[str, Any]:
        """
        Calculates both Baseline Route and Flood-Safe Route between given coordinates.
        Returns detailed GeoJSON FeatureCollection with comparison metrics.
        """
        start_node = self.find_nearest_node(start_coord)
        end_node = self.find_nearest_node(end_coord)

        if start_node is None or end_node is None:
            raise ValueError("Start or End coordinates cannot be resolved to road network.")

        def heuristic(u: Any, v: Any) -> float:
            pos_u = self.graph.nodes[u].get("pos", (0, 0))
            pos_v = self.graph.nodes[v].get("pos", (0, 0))
            # Euclidean distance approximation in meters (~111,000m per degree)
            dx = (pos_u[0] - pos_v[0]) * 111320.0 * math.cos(math.radians(pos_u[1]))
            dy = (pos_u[1] - pos_v[1]) * 110540.0
            return math.hypot(dx, dy)

        # 1. Baseline Route (Shortest path ignoring flood depths)
        baseline_path = []
        baseline_length_m = 0.0
        baseline_coords = []
        baseline_hazards = []

        try:
            baseline_nodes = nx.astar_path(
                self.graph,
                source=start_node,
                target=end_node,
                heuristic=heuristic,
                weight="baseline_weight",
            )
            for i in range(len(baseline_nodes) - 1):
                u, v = baseline_nodes[i], baseline_nodes[i + 1]
                edge_data = self.graph[u][v]
                baseline_length_m += edge_data["length"]
                baseline_coords.extend(edge_data.get("coords", []))
                if edge_data["water_depth_cm"] > 10.0:
                    baseline_hazards.append({
                        "road_id": edge_data["road_id"],
                        "road_name": edge_data["road_name"],
                        "water_depth_cm": edge_data["water_depth_cm"],
                        "coords": edge_data.get("coords", []),
                    })
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            baseline_nodes = []

        # 2. Flood-Safe Route (Enforces depth-penalties and barriers)
        safe_length_m = 0.0
        safe_coords = []
        safe_path_exists = True

        try:
            safe_nodes = nx.astar_path(
                self.graph,
                source=start_node,
                target=end_node,
                heuristic=heuristic,
                weight="safe_weight",
            )
            for i in range(len(safe_nodes) - 1):
                u, v = safe_nodes[i], safe_nodes[i + 1]
                edge_data = self.graph[u][v]
                if not edge_data["is_passable"]:
                    safe_path_exists = False
                safe_length_m += edge_data["length"]
                safe_coords.extend(edge_data.get("coords", []))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            safe_path_exists = False
            safe_nodes = []

        # Deduplicate consecutive coordinates
        def clean_line(pts: List[List[float]]) -> List[List[float]]:
            cleaned = []
            for p in pts:
                if not cleaned or cleaned[-1] != p:
                    cleaned.append(p)
            return cleaned

        baseline_coords = clean_line(baseline_coords)
        safe_coords = clean_line(safe_coords)

        # Baseline speed = 40 km/h (11.1 m/s), flooded speeds reduced
        baseline_time_sec = baseline_length_m / 11.11
        safe_time_sec = safe_length_m / 11.11 if safe_path_exists else 0.0

        max_avoided_depth = (
            max([h["water_depth_cm"] for h in baseline_hazards]) if baseline_hazards else 0.0
        )

        geojson_response = {
            "type": "FeatureCollection",
            "metadata": {
                "safe_route_found": safe_path_exists,
                "baseline_distance_km": round(baseline_length_m / 1000.0, 2),
                "safe_distance_km": round(safe_length_m / 1000.0, 2),
                "distance_delta_km": round((safe_length_m - baseline_length_m) / 1000.0, 2),
                "baseline_est_time_min": round(baseline_time_sec / 60.0, 1),
                "safe_est_time_min": round(safe_time_sec / 60.0, 1),
                "hazards_avoided_count": len(baseline_hazards),
                "max_avoided_flood_depth_cm": max_avoided_depth,
                "summary": (
                    f"Flood-Safe Route: +{round((safe_length_m - baseline_length_m)/1000.0, 2)} km detour, "
                    f"avoids {max_avoided_depth} cm flood choke-point across {len(baseline_hazards)} inundated streets."
                    if safe_path_exists and len(baseline_hazards) > 0
                    else "Direct route is completely flood-free and safe."
                ),
            },
            "features": [
                # Baseline Route Feature
                {
                    "type": "Feature",
                    "properties": {
                        "route_type": "BASELINE_UNPROTECTED",
                        "stroke_color": "#EF4444",  # Red
                        "dash_array": [4, 4],
                        "distance_m": baseline_length_m,
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": baseline_coords,
                    },
                },
                # Safe Route Feature
                {
                    "type": "Feature",
                    "properties": {
                        "route_type": "FLOOD_SAFE_RECOMMENDED",
                        "stroke_color": "#10B981",  # Green
                        "distance_m": safe_length_m,
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": safe_coords,
                    },
                },
            ],
        }

        # Add hazard choke-point markers
        for h in baseline_hazards:
            mid_pt = h["coords"][len(h["coords"]) // 2] if h["coords"] else [0, 0]
            geojson_response["features"].append({
                "type": "Feature",
                "properties": {
                    "feature_type": "FLOOD_CHOKEPOINT",
                    "road_name": h["road_name"],
                    "water_depth_cm": h["water_depth_cm"],
                    "status": "IMPASSABLE" if h["water_depth_cm"] > 25.0 else "SLOW",
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": mid_pt,
                },
            })

        return geojson_response


routing_service = DynamicRoutingService()

