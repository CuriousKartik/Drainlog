# JalKal (जलकाल) - Urban Flood Nowcasting and Safe Navigation Engine
## Smart India Hackathon | Ministry of Earth Sciences / NCMRWF | Problem Statement: SIH26085

JalKal is an urban drainage and flood nowcasting system designed for street-level water depth prediction (0 to 3 hour forecast horizon) and flood-safe emergency routing.

The project combines meteorological radar extrapolation, drainage network hydraulics, edge camera calibration, and depth-penalized graph routing to assist municipal operators and emergency responders during heavy rainfall events.

---

## 1. Problem Overview

Urban flooding in Indian cities during monsoon cloudbursts presents three specific engineering challenges:

1. **Slow Simulation Times**: Standard 1D/2D hydrodynamic solvers (such as EPA-SWMM) take 10 to 30 minutes to solve full Saint-Venant shallow water equations across large urban catchments. This is too slow for real-time emergency vehicle dispatch.
2. **Unmodeled Drainage Blockages**: Underground drainage conduits in real urban areas are frequently obstructed by accumulated silt and debris. Models that assume clean, unobstructed pipes consistently underestimate street flooding.
3. **Uncoordinated Navigation**: Emergency services (such as ambulances and fire engines) use standard road navigation engines that optimize purely for shortest distance, directing vehicles into flooded underpasses where engines hydro-lock and stall.

---

## 2. System Architecture

The system is structured as four decoupled modules:

### A. Atmospheric Nowcasting Module (`ml_engine/radar_nowcast.py`)
- Accepts 4 sequential Doppler Weather Radar (DWR) reflectivity scans (spatial grid: 64x64).
- Uses a 2D ConvLSTM sequence-to-sequence model to extrapolate radar cloud movement across 12 future time steps (T+15 min to T+180 min at 15-minute increments).
- Applies the empirical Marshall-Palmer relationship to convert radar reflectivity ($Z$ in dBZ) into surface rainfall intensity ($R$ in mm/hr):
  $$Z = 200 \cdot R^{1.6} \iff R = \left(\frac{10^{\frac{Z}{10}}}{200}\right)^{\frac{1}{1.6}}$$

### B. Surrogate Drainage Hydraulics (`ml_engine/gnn_surrogate.py`)
- Represents the municipal storm drainage system as a directed graph where nodes are catch-basins / manholes and edges are underground conduits.
- Node features: ground elevation ($z_{\text{ground}}$), invert elevation ($z_{\text{invert}}$), sub-catchment basin area, and surface inflow ($Q_{\text{in}}$).
- Edge features: pipe diameter, conduit length, bed slope, Manning roughness coefficient ($n$), and clogging ratio ($\alpha$).
- A message-passing neural network predicts the Hydraulic Grade Line ($HGL$) and pipe conveyance ($Q$) in approximately 30 ms.
- If $HGL > z_{\text{ground}}$, excess surcharge water spills onto the street via the standard orifice equation:
  $$Q_{\text{surcharge}} = C_d \cdot A_{\text{manhole}} \cdot \sqrt{2g(HGL - z_{\text{ground}})}$$
- Includes a deterministic Manning equation solver as a fallback baseline.

### C. Edge Camera Calibration (`ml_engine/cctv_waterline_yolo.py`)
- Analyzes video frames from municipal traffic CCTV cameras positioned near known flood hot spots.
- Identifies vehicle tire waterlines. If wheel occlusion exceeds 40% (corresponding to approximately 25 cm of street water depth), the script posts a calibration event to the backend API.
- The backend updates the clogging ratio ($\alpha$) of the associated downstream drainage conduit to 0.65, recalibrating the hydraulic model with ground truth.

### D. Depth-Penalized Emergency Routing (`backend/services/routing_service.py`)
- Built on NetworkX / OpenStreetMap road topologies.
- Evaluates road segment edge impedance using dynamic flood depths:
  - Water depth < 10 cm: Penalty factor = 1.0 (free flow)
  - 10 cm <= Water depth <= 25 cm: Penalty factor = 3.5 (slowdown due to high water)
  - Water depth > 25 cm: Impassable barrier (weight set to infinity for civilian vehicles and ambulances)
- Calculates both the standard shortest path and the recommended flood-safe detour.

---

## 3. Repository Layout

```
jalkal-core/
├── docker-compose.yml          # Container configuration for PostGIS, Redis, Backend, and Frontend
├── run_demo.py                 # Standalone live demonstration server with pre-loaded scenario
├── seed_data.py                # Synthetic dataset generator for Delhi Connaught Place / Minto Bridge
├── database/
│   └── 01_init_postgis.sql     # Database schema, spatial indexes, and pgRouting topology setup
├── ml_engine/
│   ├── radar_nowcast.py        # ConvLSTM precipitation nowcaster
│   ├── gnn_surrogate.py        # Graph neural network surrogate for hydraulic pipe flow
│   └── cctv_waterline_yolo.py  # CCTV waterline detection and clogging calibration script
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI application entry point
│   ├── core/config.py          # Application configuration settings
│   ├── db/session.py           # Database connection and session management
│   ├── models/spatial_models.py# SQLAlchemy spatial ORM models
│   ├── services/
│   │   ├── hydrology_service.py# SCS-CN runoff infiltration and Manning equations
│   │   ├── hydraulic_solver.py # Hydraulic solver coordinator
│   │   └── routing_service.py  # Depth-penalized A* pathfinding
│   └── api/v1/endpoints/
│       ├── nowcast.py          # Time-series inundation GeoJSON endpoints
│       ├── routing.py          # Route comparison and SMS dispatch endpoints
│       └── calibration.py      # CCTV telemetry calibration endpoint
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── components/
        │   ├── MapViewport.tsx     # Map rendering with road inundation paths and manholes
        │   ├── TimeScrubber.tsx    # 0 to 180 minute time slider with playback controls
        │   ├── RouteInspector.tsx  # Route comparison panel with baseline vs safe metrics
        │   └── NodeDiagnostic.tsx  # Manhole hydraulic elevation and surcharge modal
        └── app/
            ├── page.tsx            # Main operational dashboard
            ├── layout.tsx          # HTML root layout and font declarations
            └── globals.css         # Styling rules and design variables
```

---

## 4. Setup and Execution

### Option A: Run Standalone Demo Server (Recommended for Quick Demonstration)
The repository includes a standalone demo server that requires only Python and runs without external dependencies:

```bash
python run_demo.py
```

Once running, open your web browser at:
`http://localhost:3000`

The demo server includes:
- Pre-loaded Connaught Place & Minto Bridge drainage network data.
- Interactive time horizon scrubber (0 to 180 minutes).
- Four-step guided walkthrough buttons for presentations (`1. Baseline Cloudburst`, `2. CCTV AI Ingest`, `3. GNN Simulation`, `4. Safe A* Detour`).
- Real-time road inundation classification and safe detour computation.

### Option B: Run Full Docker Stack
To run the full stack with PostgreSQL/PostGIS, Redis, FastAPI, and Next.js:

```bash
docker-compose up -d
```

Service endpoints:
- Dashboard: `http://localhost:3000`
- FastAPI Documentation (Swagger UI): `http://localhost:8000/docs`
- PostGIS Database: `localhost:5432`
- Redis: `localhost:6379`

### Option C: Run Automated Tests
Unit tests for hydrology formulas, CCTV logic, Marshall-Palmer conversions, and routing cost calculations can be run using:

```bash
python -m unittest discover tests
```

---

## 5. API Reference

| HTTP Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/nowcast/inundation-grid?horizon_min=45` | Returns GeoJSON of road segment water depths and manhole surcharges for a given forecast minute. |
| GET | `/api/v1/nowcast/summary-stats` | Returns peak rainfall and inundation timeline across the 0-180 min forecast horizon. |
| POST | `/api/v1/routing/safe-route` | Calculates baseline shortest route versus flood-safe detour based on current inundation levels. |
| POST | `/api/v1/calibration/clogging` | Ingests camera or sensor telemetry to update conduit clogging factor alpha. |
| POST | `/api/v1/routing/dispatch-alert` | Dispatches route advisory instructions via SMS to emergency vehicle drivers. |
