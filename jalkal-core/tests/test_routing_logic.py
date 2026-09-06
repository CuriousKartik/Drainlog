"""
Unit test for depth-penalized emergency routing logic.
"""

import unittest
import math


def calculate_depth_penalty(water_depth_cm: float) -> float:
    if water_depth_cm < 10.0:
        return 1.0
    elif water_depth_cm <= 25.0:
        return 3.5
    else:
        return float("inf")


class TestRoutingPenalties(unittest.TestCase):
    def test_penalties(self):
        # Free flow
        self.assertEqual(calculate_depth_penalty(5.0), 1.0)
        self.assertEqual(calculate_depth_penalty(9.9), 1.0)

        # Slowdown
        self.assertEqual(calculate_depth_penalty(10.0), 3.5)
        self.assertEqual(calculate_depth_penalty(20.0), 3.5)
        self.assertEqual(calculate_depth_penalty(25.0), 3.5)

        # Barrier / Impassable
        self.assertEqual(calculate_depth_penalty(25.1), float("inf"))
        self.assertEqual(calculate_depth_penalty(40.0), float("inf"))

    def test_cost_calculation(self):
        road_length = 500.0
        # Clean road
        cost_clean = road_length * calculate_depth_penalty(4.0)
        self.assertEqual(cost_clean, 500.0)

        # Flooded road (20cm)
        cost_slow = road_length * calculate_depth_penalty(20.0)
        self.assertEqual(cost_slow, 1750.0)

        # Impassable road (35cm)
        cost_barrier = road_length * calculate_depth_penalty(35.0)
        self.assertTrue(math.isinf(cost_barrier))


if __name__ == "__main__":
    unittest.main()

