"""
Runs the real CCTVWaterlineCalibrator against actual image files, so you can
confirm YOLO detection + occlusion estimation are working on genuine photos
instead of the hardcoded 0.48/0.52 fallback values.

Usage:
    python test_cctv_real.py test_images/flooded_street_1.jpg
    python test_cctv_real.py test_images/*.jpg
"""
import sys
import glob
import json

sys.path.insert(0, ".")

import cv2
from ml_engine.cctv_waterline_yolo import CCTVWaterlineCalibrator, HAS_YOLO, HAS_OPENCV

print(f"HAS_YOLO     = {HAS_YOLO}")
print(f"HAS_OPENCV   = {HAS_OPENCV}")
print()

if not HAS_YOLO:
    print("ultralytics is not installed/importable -- pip install ultralytics")
    sys.exit(1)
if not HAS_OPENCV:
    print("opencv is not installed/importable -- pip install opencv-python-headless")
    sys.exit(1)

# Point this at your local backend if you want to test the full calibration
# webhook too; if the backend isn't running, dispatch_clogging_calibration
# will just log "LOGGED_OFFLINE" instead of failing.
calibrator = CCTVWaterlineCalibrator(backend_url="http://localhost:8000")

image_paths = []
for arg in sys.argv[1:]:
    image_paths.extend(glob.glob(arg))

if not image_paths:
    print("No images found. Usage: python test_cctv_real.py test_images/*.jpg")
    sys.exit(1)

for path in image_paths:
    frame = cv2.imread(path)
    if frame is None:
        print(f"[SKIP] Could not read image: {path}")
        continue

    print(f"--- {path} ---")
    result = calibrator.process_cctv_frame(
        frame=frame,
        camera_id="CAM_TEST_01",
        associated_conduit_code="COND_TEST",
    )
    print(json.dumps(result, indent=2))
    print()