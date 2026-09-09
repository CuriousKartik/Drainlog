"""
JalKal (जलकाल) - Hybrid Dual-Mode Hydraulic Solver
Module: backend/services/hydraulic_solver.py

Coordinates high-speed urban inundation simulation across forecast horizons (T+0 to T+180 min).
Uses:
1. Primary: Fast GNN Hydraulic Surrogate (PyTorch Geometric GCN/GAT, <50ms execution)
2. Deterministic Fallback: Topologically-routed Manning Gravity Conveyance Solver
   (accumulates upstream flow into downstream nodes and surcharges overloaded conduits)
"""

from typing import List, Dict, Any, Optional, Tuple
import math

from backend.services.hydrology_service import hydrology_service
from backend.core.config import settings

# Attempt to import GNN surrogate model
try:
    import torch
    from ml_engine.gnn_surrogate import HydraulicGNN
    HAS_TORCH_GNN = True
except ImportError:
    HAS_TORCH_GNN = False


class HydraulicSolver:
    """
    Dual-mode solver that maps rainfall nowcast intensity grids to street-level flood depths.
    """

    def __init__(self):
        self.gnn_model: Optional[Any] = None
        if HAS_TORCH_GNN:
            try:
                self.gnn_model = HydraulicGNN()
                self.gnn_model.eval()
            except Exception:
                self.gnn_model = None

    def solve_drainage_network(
        self,
        nodes: List[Dict[str, Any]],
        conduits: List[Dict[str, Any]],
        rainfall_intensity_mm_hr: float,
        horizon_min: int,
    ) -> Dict[str, Any]:
        """
        Solves network state for a single time horizon step.
        """
        node_results = {}
        conduit_results = {}

        # 1. Compute catchment surface inflow for all nodes
        for node in nodes:
            basin_area = float(node.get("basin_area_m2", 4000.0))
            c_coeff = float(node.get("c_runoff", 0.90))
            q_in = hydrology_service.calculate_catchment_peak_inflow(
                rainfall_intensity_mm_hr=rainfall_intensity_mm_hr,
                catchment_area_m2=basin_area,
                runoff_coeff=c_coeff,
            )
            node["current_q_inflow"] = q_in

        # 2. Execute GNN or Manning DAG
        if self.gnn_model is not None and len(nodes) > 0 and len(conduits) > 0:
            try:
                node_results, conduit_results = self._solve_via_gnn(nodes, conduits)
            except Exception:
                node_results, conduit_results = self._solve_via_manning_dag(nodes, conduits)
        else:
            node_results, conduit_results = self._solve_via_manning_dag(nodes, conduits)

        return {
            "horizon_min": horizon_min,
            "rainfall_intensity_mm_hr": rainfall_intensity_mm_hr,
            "nodes": node_results,
            "conduits": conduit_results,
        }

    def _solve_via_gnn(
        self, nodes: List[Dict[str, Any]], conduits: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Executes GNN surrogate forward pass.
        """
        node_id_to_idx = {n["id"]: idx for idx, n in enumerate(nodes)}

        # Build node feature tensor: [z_ground, z_invert, basin_area, q_inflow]
        node_feats = []
        for n in nodes:
            node_feats.append([
                float(n.get("z_ground", 12.0)),
                float(n.get("z_invert", 10.0)),
                float(n.get("basin_area_m2", 4000.0)),
                float(n.get("current_q_inflow", 0.3)),
            ])
        node_tensor = torch.tensor(node_feats, dtype=torch.float32)

        # Build edge index & edge feature tensor: [diameter, slope, length, manning_n, clogging_ratio]
        edge_srcs, edge_dsts = [], []
        edge_feats = []
        for c in conduits:
            src_idx = node_id_to_idx.get(c["source_node"])
            dst_idx = node_id_to_idx.get(c["target_node"])
            if src_idx is not None and dst_idx is not None:
                edge_srcs.append(src_idx)
                edge_dsts.append(dst_idx)
                edge_feats.append([
                    float(c.get("diameter_m", 0.90)),
                    float(c.get("slope", 0.005)),
                    float(c.get("length_m", 100.0)),
                    float(c.get("manning_n", 0.014)),
                    float(c.get("clogging_ratio", 0.0)),
                ])

        if len(edge_srcs) == 0:
            return self._solve_via_manning_dag(nodes, conduits)

        edge_index = torch.tensor([edge_srcs, edge_dsts], dtype=torch.long)
        edge_tensor = torch.tensor(edge_feats, dtype=torch.float32)

        with torch.no_grad():
            hgl, q_pipe, q_sur = self.gnn_model(node_tensor, edge_index, edge_tensor)

        node_results = {}
        for idx, n in enumerate(nodes):
            nid = str(n["id"])
            hgl_val = float(hgl[idx].item())
            zg = float(n.get("z_ground", 12.0))
            q_surcharge = float(q_sur[idx].item())
            # Water depth pooled on adjacent surface (cm)
            street_depth_cm = hydrology_service.compute_manhole_surcharge_depth(
                q_surcharge_m3s=q_surcharge, street_storage_area_m2=450.0
            )
            node_results[nid] = {
                "hgl": round(hgl_val, 3),
                "z_ground": zg,
                "surcharge_flow_m3s": round(q_surcharge, 4),
                "street_depth_cm": street_depth_cm,
                "is_surcharging": bool(hgl_val > zg),
            }

        conduit_results = {}
        for idx, c in enumerate(conduits):
            cid = str(c["id"])
            flow = float(q_pipe[idx].item()) if idx < len(q_pipe) else 0.0
            conduit_results[cid] = {
                "flow_rate_m3s": round(flow, 4),
                "clogging_ratio": float(c.get("clogging_ratio", 0.0)),
            }

        self._validate_gnn_output(node_results, conduit_results)
        return node_results, conduit_results

    def _validate_gnn_output(
        self, node_results: Dict[str, Any], conduit_results: Dict[str, Any]
    ) -> None:
        """
        Rejects GNN output that runs without crashing but is physically
        implausible -- which is exactly what an UNTRAINED model produces
        (random weights still produce numbers, just meaningless ones).
        Raising here means the caller's existing try/except automatically
        falls back to the deterministic Manning DAG solver instead of
        silently serving nonsense as if it were a real prediction.
        """
        for nid, r in node_results.items():
            hgl = r["hgl"]
            zg = r["z_ground"]
            if math.isnan(hgl) or math.isinf(hgl):
                raise ValueError(f"GNN produced non-finite HGL for node {nid}")
            # A manhole's water level should never be wildly far from its own
            # ground elevation for a network this size -- if it is, the model
            # isn't representing real hydraulics.
            if abs(hgl - zg) > 5.0:
                raise ValueError(f"GNN HGL implausible for node {nid}: {hgl} vs ground {zg}")
            if r["surcharge_flow_m3s"] < 0.0:
                raise ValueError(f"GNN produced negative surcharge flow for node {nid}")

        for cid, r in conduit_results.items():
            if r["flow_rate_m3s"] < 0.0:
                raise ValueError(f"GNN produced negative pipe flow for conduit {cid}")

    def _solve_via_manning_dag(
        self, nodes: List[Dict[str, Any]], conduits: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Deterministic gravity conveyance solver using Manning's equation.

        Nodes are processed in topological order so each one receives the
        accumulated flow of everything upstream, not just its own local
        catchment inflow. A node surcharges when its total arriving flow
        exceeds the combined effective capacity of ALL of its outgoing
        conduits; conveyed flow is split between parallel conduits in
        proportion to their capacity. Terminal nodes (no outgoing conduit)
        act as free outfalls where flow leaves the modelled network.
        """
        node_by_id = {n["id"]: n for n in nodes}
        outgoing: Dict[Any, List[Dict[str, Any]]] = {n["id"]: [] for n in nodes}
        in_degree: Dict[Any, int] = {n["id"]: 0 for n in nodes}
        for c in conduits:
            src, dst = c["source_node"], c["target_node"]
            if src in outgoing and dst in in_degree:
                outgoing[src].append(c)
                in_degree[dst] += 1

        # Kahn topological ordering; any nodes left inside a cycle are
        # appended in input order and solved with whatever flow has arrived.
        queue = [n["id"] for n in nodes if in_degree[n["id"]] == 0]
        topo_order: List[Any] = []
        remaining = dict(in_degree)
        qi = 0
        while qi < len(queue):
            nid = queue[qi]
            qi += 1
            topo_order.append(nid)
            for c in outgoing[nid]:
                remaining[c["target_node"]] -= 1
                if remaining[c["target_node"]] == 0:
                    queue.append(c["target_node"])
        if len(topo_order) < len(nodes):
            seen = set(topo_order)
            topo_order.extend(n["id"] for n in nodes if n["id"] not in seen)

        arrived: Dict[Any, float] = {n["id"]: 0.0 for n in nodes}
        node_results: Dict[str, Any] = {}
        conduit_results: Dict[str, Any] = {}

        for nid in topo_order:
            n = node_by_id[nid]
            zg = float(n.get("z_ground", 12.0))
            zi = float(n.get("z_invert", 10.0))
            q_local = float(n.get("current_q_inflow", 0.0))
            q_total = q_local + arrived[nid]

            pipes = outgoing[nid]
            if pipes:
                caps = [
                    hydrology_service.compute_manning_full_conduit_capacity(
                        diameter_m=float(p.get("diameter_m", 0.8)),
                        slope=float(p.get("slope", 0.005)),
                        manning_n=float(p.get("manning_n", 0.014)),
                        clogging_ratio=float(p.get("clogging_ratio", 0.0)),
                    )
                    for p in pipes
                ]
                total_cap = sum(caps)
                q_conveyed = min(q_total, total_cap)
                for pipe, cap in zip(pipes, caps):
                    share = q_conveyed * (cap / total_cap) if total_cap > 0.0 else 0.0
                    arrived[pipe["target_node"]] += share
                    conduit_results[str(pipe["id"])] = {
                        "flow_rate_m3s": round(share, 4),
                        "capacity_m3s": round(cap, 4),
                        "utilization": round(share / cap, 3) if cap > 0.0 else 1.0,
                        "clogging_ratio": float(pipe.get("clogging_ratio", 0.0)),
                    }

                # Accumulated inflow beyond combined conveyance -> surcharge
                q_excess = max(0.0, q_total - total_cap)
                depth_cm = hydrology_service.compute_manhole_surcharge_depth(
                    q_surcharge_m3s=q_excess, street_storage_area_m2=450.0
                )
                if q_excess > 0.0:
                    hgl = zg + (depth_cm / 100.0)
                else:
                    fill_ratio = min(1.0, q_total / total_cap) if total_cap > 0.0 else 1.0
                    hgl = zi + (zg - zi) * fill_ratio
                node_results[str(nid)] = {
                    "hgl": round(hgl, 3),
                    "z_ground": zg,
                    "surcharge_flow_m3s": round(q_excess, 4),
                    "street_depth_cm": depth_cm,
                    "is_surcharging": bool(q_excess > 0.0),
                }
            else:
                # Terminal outfall: accumulated flow discharges out of the
                # modelled network instead of ponding.
                node_results[str(nid)] = {
                    "hgl": zi,
                    "z_ground": zg,
                    "surcharge_flow_m3s": 0.0,
                    "street_depth_cm": 0.0,
                    "is_surcharging": False,
                    "outfall_discharge_m3s": round(q_total, 4),
                }

        return node_results, conduit_results

    @staticmethod
    def _distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Approximate equirectangular ground distance in metres."""
        dx = (lon1 - lon2) * 111320.0 * math.cos(math.radians((lat1 + lat2) / 2.0))
        dy = (lat1 - lat2) * 110540.0
        return math.hypot(dx, dy)

    # Radius around a surcharging manhole within which its ponded water can
    # reach an adjacent street segment.
    POOLING_RADIUS_M = 250.0

    def map_node_depths_to_roads(
        self,
        roads: List[Dict[str, Any]],
        nodes: List[Dict[str, Any]],
        node_results: Dict[str, Any],
        horizon_min: int,
    ) -> List[Dict[str, Any]]:
        """
        Maps nodal surcharges to nearby street segments, computing road water depth
        and routing traversal statuses ('PASSABLE', 'SLOW', 'IMPASSABLE').

        Uses ponded water-surface elevations: a surcharging node ponds water up
        to (z_ground + street depth). A road within POOLING_RADIUS_M of such a
        node is inundated by however far that water surface stands above the
        road's own elevation. A road higher than the pond surface stays dry, so
        an elevated flyover no longer inherits depth from the sump below it,
        while a low underpass floods deeper than the manhole rim itself.
        """
        road_inundations = []

        # (lon, lat, water surface elevation, ground elevation) for every
        # surcharging node with ponded water.
        ponds = []
        for n in nodes:
            result = node_results.get(str(n["id"]))
            if result is None or result["street_depth_cm"] <= 0.0:
                continue
            lon, lat = n["coords"]
            z_ground = float(n.get("z_ground", 12.0))
            surface = z_ground + result["street_depth_cm"] / 100.0
            ponds.append((lon, lat, surface, z_ground))

        for r in roads:
            rid = r["id"]
            coords = r.get("coordinates", [])
            z_road = r.get("z_elevation")

            depth_cm = 0.0
            for lon, lat, surface, z_ground in ponds:
                if not coords:
                    continue
                dist_m = min(
                    self._distance_m(lon, lat, cx, cy) for cx, cy in coords
                )
                if dist_m > self.POOLING_RADIUS_M:
                    continue
                # Without road elevation data, assume the road sits at the
                # manhole rim level and inherits the full ponded depth.
                z_eff = float(z_road) if z_road is not None else z_ground
                depth_cm = max(depth_cm, (surface - z_eff) * 100.0)

            depth_cm = round(max(0.0, depth_cm), 1)

            # Inundation safety thresholding
            if depth_cm < settings.SLOWDOWN_DEPTH_CM:
                status = "PASSABLE"
                hazard_penalty = 1.0
            elif depth_cm <= settings.MAX_PASSABLE_DEPTH_CM:
                status = "SLOW"
                # Quadratic impedance penalty as water approaches vehicle exhaust
                hazard_penalty = round(1.0 + 2.5 * ((depth_cm - 10.0) / 15.0), 2)
            else:
                status = "IMPASSABLE"
                hazard_penalty = 9999.0  # Barrier for civilian vehicles

            road_inundations.append({
                "road_segment_id": rid,
                "timestamp_horizon_min": horizon_min,
                "water_depth_cm": depth_cm,
                "flow_velocity_ms": round(0.2 + 0.05 * math.sqrt(depth_cm), 2),
                "status": status,
                "hazard_penalty": hazard_penalty,
            })

        return road_inundations


hydraulic_solver = HydraulicSolver()