"""
Unit tests for deterministic hydrology and hydraulic formulas.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from services.hydrology_service import hydrology_service


class TestHydrologyFormulas(unittest.TestCase):
    def test_scs_runoff(self):
        # CN=98 (impervious asphalt), 50mm rain
        q_runoff = hydrology_service.compute_scs_runoff(rainfall_depth_mm=50.0, curve_number=98.0)
        self.assertGreater(q_runoff, 40.0)
        self.assertLessEqual(q_runoff, 50.0)

        # Zero rainfall should yield zero runoff
        q_zero = hydrology_service.compute_scs_runoff(rainfall_depth_mm=0.0, curve_number=98.0)
        self.assertEqual(q_zero, 0.0)

    def test_manning_conduit_capacity(self):
        # 1m diameter, 0.005 slope, n=0.014, clear pipe
        q_clean = hydrology_service.compute_manning_full_conduit_capacity(
            diameter_m=1.0, slope=0.005, manning_n=0.014, clogging_ratio=0.0
        )
        self.assertGreater(q_clean, 1.5)

        # 50% clogged pipe should have half the capacity
        q_clogged = hydrology_service.compute_manning_full_conduit_capacity(
            diameter_m=1.0, slope=0.005, manning_n=0.014, clogging_ratio=0.5
        )
        self.assertAlmostEqual(q_clogged, q_clean * 0.5, places=3)

    def test_curb_inlet_transitions(self):
        # Low depth (0.05m <= 0.15m curb) -> Weir flow
        q_weir, mode_weir = hydrology_service.compute_curb_inlet_capture(
            water_depth_m=0.05, curb_length_m=3.0, curb_height_m=0.15
        )
        self.assertEqual(mode_weir, "WEIR_FLOW")
        self.assertGreater(q_weir, 0.0)

        # High depth (0.35m > 0.15m curb) -> Submerged orifice flow
        q_orifice, mode_orifice = hydrology_service.compute_curb_inlet_capture(
            water_depth_m=0.35, curb_length_m=3.0, curb_height_m=0.15
        )
        self.assertEqual(mode_orifice, "ORIFICE_FLOW")
        self.assertGreater(q_orifice, q_weir)


if __name__ == "__main__":
    unittest.main()

