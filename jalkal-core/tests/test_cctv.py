"""
Unit test for CCTV Waterline & Clogging Calibration feedback loop.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from ml_engine.cctv_waterline_yolo import CCTVWaterlineCalibrator


class TestCCTVWaterline(unittest.TestCase):
    def test_occlusion_and_threshold(self):
        calibrator = CCTVWaterlineCalibrator(
            backend_url="http://localhost:8000",
            occlusion_threshold=0.40,
        )
        
        # Test simulated camera frame evaluation
        result = calibrator.process_cctv_frame(
            frame=None,
            camera_id="CAM_TEST_MINTO",
            associated_conduit_code="COND_MINTO_01",
        )
        self.assertIn("wheel_occlusion_fraction", result)
        self.assertIn("estimated_water_depth_cm", result)
        self.assertGreaterEqual(result["estimated_water_depth_cm"], 20.0)
        self.assertEqual(result["new_clogging_factor"], 0.65)


if __name__ == "__main__":
    unittest.main()

