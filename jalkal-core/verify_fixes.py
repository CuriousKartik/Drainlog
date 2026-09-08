"""
Standalone check for the two hydraulic_solver.py fixes:
  1. Nearest-node road mapping + relative elevation baseline
  2. GNN output sanity guard

Run from the project root:
    python verify_fixes.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.services.hydraulic_solver import hydraulic_solver
from backend.api.v1.endpoints.nowcast import SAMPLE_NODES, SAMPLE_CONDUITS, SAMPLE_ROADS

print("=" * 60)
print("CHECK 1: Full pipeline with real sample data")
print("=" * 60)

result = hydraulic_solver.solve_drainage_network(
    nodes=SAMPLE_NODES,
    conduits=SAMPLE_CONDUITS,
    rainfall_intensity_mm_hr=150.0,   # heavy monsoon burst
    horizon_min=45,
)

roads = hydraulic_solver.map_node_depths_to_roads(
    roads=SAMPLE_ROADS,
    nodes=SAMPLE_NODES,
    node_results=result["nodes"],
    horizon_min=45,
)

for r in roads:
    print(f"  Road {r['road_segment_id']:>4} -> {r['water_depth_cm']:>6} cm  [{r['status']}]")

print()
print("PASS condition: roads should now show DIFFERENT depths based on")
print("proximity to surcharging nodes, not one identical number for all.")
print()

print("=" * 60)
print("CHECK 2: GNN sanity guard rejects implausible output")
print("=" * 60)

bad_output = {
    "node-1": {"hgl": 9999.0, "z_ground": 216.5, "surcharge_flow_m3s": 0.2,
               "street_depth_cm": 5.0, "is_surcharging": True}
}
try:
    hydraulic_solver._validate_gnn_output(bad_output, {})
    print("  FAIL: implausible output was NOT rejected")
except ValueError as e:
    print(f"  PASS: correctly rejected -> {e}")

good_output = {
    "node-1": {"hgl": 215.0, "z_ground": 216.5, "surcharge_flow_m3s": 0.1,
               "street_depth_cm": 2.0, "is_surcharging": False}
}
try:
    hydraulic_solver._validate_gnn_output(good_output, {})
    print("  PASS: plausible output correctly accepted")
except ValueError as e:
    print(f"  FAIL: plausible output was wrongly rejected -> {e}")