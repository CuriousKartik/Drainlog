"""
Unit test for Marshall-Palmer Z-R conversion formula.
Z = 200 * R^1.6
"""

import math
import unittest


def dbz_to_rainfall_rate(dbz: float, a: float = 200.0, b: float = 1.6) -> float:
    if dbz < 15.0:
        return 0.0
    linear_z = 10.0 ** (dbz / 10.0)
    r = (linear_z / a) ** (1.0 / b)
    return float(r)


def rainfall_rate_to_dbz(r_mm_hr: float, a: float = 200.0, b: float = 1.6) -> float:
    if r_mm_hr <= 0.0:
        return 0.0
    z = a * (r_mm_hr ** b)
    return 10.0 * math.log10(z)


class TestMarshallPalmer(unittest.TestCase):
    def test_zr_conversion(self):
        # 50 mm/hr torrential rain should be ~50-55 dBZ
        dbz_50 = rainfall_rate_to_dbz(50.0)
        self.assertGreater(dbz_50, 48.0)
        self.assertLess(dbz_50, 56.0)

        # Invert back to rainfall rate
        r_reconstructed = dbz_to_rainfall_rate(dbz_50)
        self.assertAlmostEqual(r_reconstructed, 50.0, places=2)

    def test_noise_thresholding(self):
        # Below 15 dBZ should be thresholded to 0.0 mm/hr
        r_noise = dbz_to_rainfall_rate(12.0)
        self.assertEqual(r_noise, 0.0)


if __name__ == "__main__":
    unittest.main()

