"""
JalKal (जलकाल) - Hybrid Dual-Mode Hydraulic Solver
Module: backend/services/hydraulic_solver.py

Coordinates high-speed urban inundation simulation across forecast horizons (T+0 to T+180 min).
Uses:
1. Primary: Fast GNN Hydraulic Surrogate (PyTorch Geometric GCN/GAT, <50ms execution)
2. Deterministic Fallback: Directed Acyclic Graph (DAG) Manning Gravity Conveyance Solver
"""

from typing import List, Dict, Any, Optional
import math
import numpy as np

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

        return node_results, conduit_results

    def _solve_via_manning_dag(
        self, nodes: List[Dict[str, Any]], conduits: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Deterministic hydraulic conveyance calculation using Manning's equation.
        """
        conduit_map = {}
        for c in conduits:
            src = c["source_node"]
            conduit_map[src] = c

        node_results = {}
        conduit_results = {}

        for n in nodes:
            nid = str(n["id"])
            zg = float(n.get("z_ground", 12.0))
            zi = float(n.get("z_invert", 10.0))
            q_in = float(n.get("current_q_inflow", 0.3))

            # Find downstream pipe
            downstream_pipe = conduit_map.get(n["id"])
            if downstream_pipe:
                cap = hydrology_service.compute_manning_full_conduit_capacity(
                    diameter_m=float(downstream_pipe.get("diameter_m", 0.8)),
                    slope=float(downstream_pipe.get("slope", 0.005)),
                    manning_n=float(downstream_pipe.get("manning_n", 0.014)),
                    clogging_ratio=float(downstream_pipe.get("clogging_ratio", 0.0)),
                )
                cid = str(downstream_pipe["id"])
                actual_flow = min(q_in, cap)
                conduit_results[cid] = {
                    "flow_rate_m3s": round(actual_flow, 4),
                    "capacity_m3s": round(cap, 4),
                    "clogging_ratio": float(downstream_pipe.get("clogging_ratio", 0.0)),
                }

                # If inflow exceeds pipe gravity capacity -> Surcharge overflow
                q_excess = max(0.0, q_in - cap)
                depth_cm = hydrology_service.compute_manhole_surcharge_depth(
                    q_surcharge_m3s=q_excess, street_storage_area_m2=450.0
                )
                hgl = zg + (depth_cm / 100.0) if q_excess > 0.0 else zi + (zg - zi) * 0.75
                node_results[nid] = {
                    "hgl": round(hgl, 3),
                    "z_ground": zg,
                    "surcharge_flow_m3s": round(q_excess, 4),
                    "street_depth_cm": depth_cm,
                    "is_surcharging": bool(q_excess > 0.0),
                }
            else:
                # Terminal outfall
                node_results[nid] = {
                    "hgl": zi,
                    "z_ground": zg,
                    "surcharge_flow_m3s": 0.0,
                    "street_depth_cm": 0.0,
                    "is_surcharging": False,
                }

        return node_results, conduit_results

    def map_node_depths_to_roads(
        self,
        roads: List[Dict[str, Any]],
        node_results: Dict[str, Any],
        horizon_min: int,
    ) -> List[Dict[str, Any]]:
        """
        Maps nodal surcharges to nearby street segments, computing road water depth
        and routing traversal statuses ('PASSABLE', 'SLOW', 'IMPASSABLE').
        """
        road_inundations = []
        node_depths = [v["street_depth_cm"] for v in node_results.values()]
        avg_depth = float(np.mean(node_depths)) if node_depths else 0.0

        for r in roads:
            rid = r["id"]
            # Dynamic elevation dip effect: lower road segments pool more floodwater
            z_road = float(r.get("z_elevation", 10.0))
            elevation_delta = max(0.0, 11.5 - z_road)
            depth_cm = round(avg_depth * (1.0 + 0.3 * elevation_delta), 1)

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

