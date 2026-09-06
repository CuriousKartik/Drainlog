"""
JalKal (जलकाल) - Deterministic Hydrology & Hydraulic Equations
Module: backend/services/hydrology_service.py

Contains core hydraulic and hydrologic physics routines:
1. SCS Curve Number (SCS-CN) Runoff Infiltration (USDA-NRCS)
2. Manning Conduit Conveyance with dynamic clogging factor (1 - alpha)
3. Curb Inlet Orifice and Weir Transition Hydraulic Equations
"""

from typing import Tuple, Dict, Any
import math


class HydrologyService:
    """
    Deterministic hydrologic and hydraulic calculations.
    """

    def __init__(self, g: float = 9.80665):
        self.g = g

    def compute_scs_runoff(
        self, rainfall_depth_mm: float, curve_number: float = 98.0
    ) -> float:
        """
        Computes direct surface runoff depth (Q in mm) using the SCS-CN method.
        
        S = (25400 / CN) - 254
        I_a = 0.2 * S  (Initial abstraction)
        Q = (P - I_a)^2 / (P - I_a + S)   for P > I_a, else 0.0

        :param rainfall_depth_mm: Accumulated or hourly rainfall (mm)
        :param curve_number: CN integer/float in [30, 100], 98 for asphalt roads
        :return: Runoff depth in mm
        """
        if curve_number >= 100.0:
            return max(0.0, rainfall_depth_mm)

        # Potential maximum soil/surface retention (mm)
        s_retention = (25400.0 / curve_number) - 254.0
        # Initial abstraction (interception, depression storage, initial infiltration)
        i_a = 0.2 * s_retention

        if rainfall_depth_mm <= i_a:
            return 0.0

        p_minus_ia = rainfall_depth_mm - i_a
        q_runoff_mm = (p_minus_ia**2) / (p_minus_ia + s_retention)
        return float(q_runoff_mm)

    def calculate_catchment_peak_inflow(
        self,
        rainfall_intensity_mm_hr: float,
        catchment_area_m2: float,
        runoff_coeff: float = 0.90,
    ) -> float:
        """
        Computes peak surface runoff inflow Q_in (m3/s) draining into an inlet manhole
        using the Rational Method:
            Q = (C * I * A) / 3,600,000
        where:
            C: Runoff coefficient [0.0 - 1.0] (0.90 for dense urban pavement)
            I: Rainfall intensity (mm/hr)
            A: Sub-catchment area (m2)
        """
        return (runoff_coeff * rainfall_intensity_mm_hr * catchment_area_m2) / 3600000.0

    def compute_manning_full_conduit_capacity(
        self,
        diameter_m: float,
        slope: float,
        manning_n: float = 0.014,
        clogging_ratio: float = 0.0,
    ) -> float:
        """
        Computes circular conduit gravity conveyance capacity (m3/s) via Manning's Equation:
            Q = (1 / n) * A * (R_h)^(2/3) * (S_0)^(1/2) * (1 - alpha)
        where:
            A = pi * D^2 / 4
            R_h = Hydraulic Radius = D / 4
            alpha = Dynamic clogging ratio in [0.0, 1.0]
        """
        if diameter_m <= 0.0 or slope <= 0.0 or manning_n <= 0.0:
            return 0.0

        clogging_factor = max(0.0, min(1.0, clogging_ratio))
        area = math.pi * (diameter_m / 2.0) ** 2
        r_h = diameter_m / 4.0

        q_clean = (1.0 / manning_n) * area * (r_h ** (2.0 / 3.0)) * math.sqrt(slope)
        # Reduced cross-section & increased friction impedance under clogging
        q_effective = q_clean * (1.0 - clogging_factor)
        return float(q_effective)

    def compute_curb_inlet_capture(
        self,
        water_depth_m: float,
        curb_length_m: float = 3.0,
        curb_height_m: float = 0.15,
        cw_weir: float = 1.60,
        cd_orifice: float = 0.62,
    ) -> Tuple[float, str]:
        """
        Calculates street stormwater capture into inlet manhole transitioning between
        free weir overflow and submerged orifice inlet flow.
        
        Case 1: Depth <= Curb Opening Height (Free Weir Flow)
            Q_capture = C_w * L * h^(3/2)
        Case 2: Depth > Curb Opening Height (Submerged Orifice Flow)
            Q_capture = C_d * A_orifice * sqrt(2 * g * (h - h_curb/2))
        """
        if water_depth_m <= 0.0:
            return 0.0, "DRY"

        if water_depth_m <= curb_height_m:
            # Free weir crest
            q_weir = cw_weir * curb_length_m * (water_depth_m**1.5)
            return float(q_weir), "WEIR_FLOW"
        else:
            # Orifice flow through submerged curb opening
            orifice_area = curb_length_m * curb_height_m
            effective_head = max(0.01, water_depth_m - (curb_height_m / 2.0))
            q_orifice = cd_orifice * orifice_area * math.sqrt(2.0 * self.g * effective_head)
            return float(q_orifice), "ORIFICE_FLOW"

    def compute_manhole_surcharge_depth(
        self,
        q_surcharge_m3s: float,
        street_storage_area_m2: float = 400.0,
        time_step_sec: float = 900.0,  # 15 minutes
    ) -> float:
        """
        Converts excess surcharged volumetric overflow into accumulated surface water depth (cm).
        Delta_h (m) = (Q_excess * Delta_t) / Street_Effective_Ponding_Area
        """
        if q_surcharge_m3s <= 0.0 or street_storage_area_m2 <= 0.0:
            return 0.0

        volume_m3 = q_surcharge_m3s * time_step_sec
        depth_m = volume_m3 / street_storage_area_m2
        depth_cm = depth_m * 100.0
        return float(round(depth_cm, 2))


hydrology_service = HydrologyService()

