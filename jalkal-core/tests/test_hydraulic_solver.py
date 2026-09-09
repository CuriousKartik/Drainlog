"""
Regression tests for the Manning network solver flood calculation.

Guards against the defects that previously made the backend incapable of
predicting any street flooding:
  1. upstream conduit flow was never accumulated into downstream nodes,
  2. nodes with multiple outgoing conduits silently dropped all but one,
  3. road depths were inherited from the nearest node regardless of
     elevation, letting elevated bypasses flood while sumps stayed dry.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.services.hydraulic_solver import hydraulic_solver

HEAVY_RAIN_MM_HR = 100.0


def build_test_network():
    """
    A -> B -> C -> D chain with a parallel B -> D relief branch.
    C is a low sump drained only by an undersized, heavily clogged trunk,
    so under heavy rain the accumulated flow must surcharge at C.
    """
    nodes = [
        {"id": "A", "coords": [77.2000, 28.6000], "z_ground": 216.0, "z_invert": 214.0, "basin_area_m2": 6000.0},
        {"id": "B", "coords": [77.2100, 28.6000], "z_ground": 214.0, "z_invert": 212.0, "basin_area_m2": 6000.0},
        {"id": "C", "coords": [77.2200, 28.6000], "z_ground": 210.0, "z_invert": 208.0, "basin_area_m2": 12000.0},
        {"id": "D", "coords": [77.2300, 28.6000], "z_ground": 208.0, "z_invert": 206.0, "basin_area_m2": 0.0},
    ]
    conduits = [
        {"id": "p1", "source_node": "A", "target_node": "B", "diameter_m": 0.9, "slope": 0.005, "clogging_ratio": 0.0},
        {"id": "p2", "source_node": "B", "target_node": "C", "diameter_m": 0.9, "slope": 0.005, "clogging_ratio": 0.0},
        {"id": "p2b", "source_node": "B", "target_node": "D", "diameter_m": 0.6, "slope": 0.004, "clogging_ratio": 0.0},
        {"id": "p3", "source_node": "C", "target_node": "D", "diameter_m": 0.6, "slope": 0.002, "clogging_ratio": 0.6},
    ]
    return nodes, conduits


class TestNetworkFlowRouting(unittest.TestCase):
    def test_zero_rainfall_stays_dry(self):
        nodes, conduits = build_test_network()
        res = hydraulic_solver.solve_drainage_network(nodes, conduits, 0.0, 0)
        for state in res["nodes"].values():
            self.assertFalse(state["is_surcharging"])
            self.assertEqual(state["street_depth_cm"], 0.0)

    def test_flow_accumulates_downstream(self):
        nodes, conduits = build_test_network()
        res = hydraulic_solver.solve_drainage_network(nodes, conduits, HEAVY_RAIN_MM_HR, 45)

        local_inflow = {n["id"]: n["current_q_inflow"] for n in nodes}
        # The head conduit carries exactly A's local runoff...
        self.assertAlmostEqual(
            res["conduits"]["p1"]["flow_rate_m3s"], local_inflow["A"], places=3
        )
        # ...while B's main outgoing pipe must carry MORE than B's own local
        # runoff, because A's flow arrives on top of it.
        self.assertGreater(res["conduits"]["p2"]["flow_rate_m3s"], local_inflow["B"])

    def test_parallel_conduits_all_computed(self):
        nodes, conduits = build_test_network()
        res = hydraulic_solver.solve_drainage_network(nodes, conduits, HEAVY_RAIN_MM_HR, 45)
        # B has two outgoing conduits; both must be solved and carry flow.
        self.assertIn("p2", res["conduits"])
        self.assertIn("p2b", res["conduits"])
        self.assertGreater(res["conduits"]["p2"]["flow_rate_m3s"], 0.0)
        self.assertGreater(res["conduits"]["p2b"]["flow_rate_m3s"], 0.0)
        self.assertEqual(len(res["conduits"]), len(conduits))

    def test_clogged_sump_surcharges_under_heavy_rain(self):
        nodes, conduits = build_test_network()
        res = hydraulic_solver.solve_drainage_network(nodes, conduits, HEAVY_RAIN_MM_HR, 45)

        # The undersized clogged trunk out of C is overwhelmed by the
        # accumulated inflow: C ponds water on the street.
        c_state = res["nodes"]["C"]
        self.assertTrue(c_state["is_surcharging"])
        self.assertGreater(c_state["street_depth_cm"], 10.0)
        self.assertGreater(c_state["hgl"], c_state["z_ground"])

        # Upstream nodes have ample capacity and stay dry.
        self.assertFalse(res["nodes"]["A"]["is_surcharging"])
        self.assertFalse(res["nodes"]["B"]["is_surcharging"])

        # The terminal outfall discharges freely instead of ponding.
        d_state = res["nodes"]["D"]
        self.assertFalse(d_state["is_surcharging"])
        self.assertEqual(d_state["street_depth_cm"], 0.0)
        self.assertGreater(d_state["outfall_discharge_m3s"], 0.0)

    def test_road_depths_respect_elevation(self):
        nodes, conduits = build_test_network()
        res = hydraulic_solver.solve_drainage_network(nodes, conduits, HEAVY_RAIN_MM_HR, 45)

        roads = [
            # Underpass dip right beside the surcharging sump C.
            {"id": "r-low", "z_elevation": 210.3, "coordinates": [[77.2195, 28.6000], [77.2200, 28.6000]]},
            # Elevated flyover beside the same sump: above the pond surface.
            {"id": "r-high", "z_elevation": 215.0, "coordinates": [[77.2200, 28.6005], [77.2205, 28.6005]]},
            # Low road but far outside the pooling radius of any node.
            {"id": "r-far", "z_elevation": 209.0, "coordinates": [[77.2600, 28.6400], [77.2610, 28.6400]]},
        ]
        result = {
            r["road_segment_id"]: r
            for r in hydraulic_solver.map_node_depths_to_roads(roads, nodes, res["nodes"], 45)
        }

        self.assertGreater(result["r-low"]["water_depth_cm"], 25.0)
        self.assertEqual(result["r-low"]["status"], "IMPASSABLE")
        self.assertEqual(result["r-high"]["water_depth_cm"], 0.0)
        self.assertEqual(result["r-high"]["status"], "PASSABLE")
        self.assertEqual(result["r-far"]["water_depth_cm"], 0.0)


class TestSampleScenario(unittest.TestCase):
    """End-to-end check on the bundled Connaught Place / Minto network."""

    def test_minto_underpass_floods_at_cloudburst_peak(self):
        from backend.api.v1.endpoints.nowcast import (
            SAMPLE_NODES,
            SAMPLE_CONDUITS,
            SAMPLE_ROADS,
        )

        res = hydraulic_solver.solve_drainage_network(SAMPLE_NODES, SAMPLE_CONDUITS, 78.0, 45)
        roads = {
            r["road_segment_id"]: r
            for r in hydraulic_solver.map_node_depths_to_roads(
                SAMPLE_ROADS, SAMPLE_NODES, res["nodes"], 45
            )
        }

        # The Minto sump surcharges and its underpass becomes impassable...
        self.assertTrue(res["nodes"]["node-4"]["is_surcharging"])
        self.assertEqual(roads[103]["status"], "IMPASSABLE")
        # ...while the elevated flyover detour stays open.
        self.assertEqual(roads[104]["status"], "PASSABLE")
        self.assertEqual(roads[105]["status"], "PASSABLE")


if __name__ == "__main__":
    unittest.main()
