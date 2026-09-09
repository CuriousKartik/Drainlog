"""
Tests for the scripted-storm demo mode (simulate=True).

The nowcast endpoints prefer live weather, which makes the flood scenario
undemonstrable on a dry day; simulate=True must force the scripted
cloudburst without touching the network, and must be labelled as such.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.api.v1.endpoints import nowcast


class TestSimulationMode(unittest.TestCase):
    def setUp(self):
        # Guarantee the live weather API is never consulted in these tests.
        self._orig_fetch = nowcast._fetch_live_precipitation_series
        nowcast._fetch_live_precipitation_series = lambda: self.fail(
            "simulate=True must not hit the live weather API"
        )

    def tearDown(self):
        nowcast._fetch_live_precipitation_series = self._orig_fetch

    def test_simulate_returns_scripted_storm(self):
        result = nowcast.get_rainfall_intensity_for_horizon(45, simulate=True)
        self.assertEqual(result["source"], "simulated_storm")
        # Scripted cloudburst peaks at 78 mm/hr at T+45.
        self.assertAlmostEqual(result["rainfall_mm_hr"], 78.0, places=1)

    def test_simulated_grid_floods_minto_at_peak(self):
        grid = nowcast.get_nowcast_inundation_grid(horizon_min=45, simulate=True)
        self.assertEqual(grid["rainfall_source"], "simulated_storm")
        self.assertGreaterEqual(grid["total_flooded_roads"], 1)

        statuses = {
            f["properties"]["road_name"]: f["properties"]["status"]
            for f in grid["features"]
            if f["properties"]["layer_type"] == "ROAD_SEGMENT"
        }
        self.assertEqual(statuses["Minto Underpass Subway (Choke Point)"], "IMPASSABLE")
        self.assertEqual(statuses["Barakhamba Elevated Flyover (Safe Bypass)"], "PASSABLE")

    def test_simulated_summary_has_storm_arc(self):
        summary = nowcast.get_nowcast_summary(simulate=True)
        by_horizon = {s["horizon_min"]: s for s in summary["timeline"]}
        self.assertEqual(by_horizon[45]["status"], "IMPASSABLE")
        self.assertEqual(by_horizon[0]["status"], "CLEAR")
        self.assertEqual(by_horizon[180]["status"], "CLEAR")


if __name__ == "__main__":
    unittest.main()
