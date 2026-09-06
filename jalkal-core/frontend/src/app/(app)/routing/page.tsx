"use client";

import React, { useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import RouteInspector from "@/components/RouteInspector";
import MapViewport from "@/components/MapViewport";
import { LoadingCard, ErrorStateCard } from "@/components/StateFeedback";

export default function RoutingPage() {
  const {
    roads,
    nodes,
    peakWaterDepthCm,
    detourFeasibilityRate,
    isSimulating,
    hasError,
    triggerRefresh,
  } = useSimulation();

  const [origin, setOrigin] = useState<string>("CP_INNER");
  const [destination, setDestination] = useState<string>("LNJP_HOSPITAL");
  const [vehicleType, setVehicleType] = useState<string>("AMBULANCE");

  if (isSimulating) {
    return <LoadingCard message="Evaluating depth-penalized A* edge costs across road topology..." />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title="Routing Network Disconnected"
        description="Unable to load OpenStreetMap topological edges. Check spatial database connection."
        onRetry={triggerRefresh}
      />
    );
  }

  // Construct dual-route GeoJSON for map display
  const routeData = {
    type: "FeatureCollection",
    metadata: {
      safe_route_found: detourFeasibilityRate > 0,
      baseline_distance_km: 1.23,
      safe_distance_km: 1.70,
      distance_delta_km: 0.47,
      baseline_est_time_min: 2.1,
      safe_est_time_min: 2.8,
      hazards_avoided_count: 1,
      max_avoided_flood_depth_cm: peakWaterDepthCm,
      summary: `Safe detour route avoids ${peakWaterDepthCm.toFixed(1)}cm deep flood at Minto Underpass via Barakhamba Flyover.`,
    },
    features: [
      {
        type: "Feature",
        properties: {
          route_type: "BASELINE_UNPROTECTED",
          stroke_color: "#D64545",
          dash_array: [4, 4],
          distance_m: 1230,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [77.2185, 28.6328],
            [77.2205, 28.6315],
            [77.2225, 28.6295],
            [77.2245, 28.636],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          route_type: "FLOOD_SAFE_RECOMMENDED",
          stroke_color: "#111111",
          distance_m: 1700,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [77.2185, 28.6328],
            [77.2205, 28.6315],
            [77.2225, 28.6295],
            [77.226, 28.628],
            [77.2245, 28.636],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          feature_type: "FLOOD_CHOKEPOINT",
          road_name: "Minto Underpass Subway",
          water_depth_cm: peakWaterDepthCm,
          status: peakWaterDepthCm > 25 ? "IMPASSABLE" : "SLOW",
        },
        geometry: {
          type: "Point",
          coordinates: [77.2235, 28.6328],
        },
      },
    ],
  };

  const geojsonData = {
    type: "FeatureCollection",
    features: roads.map((r, idx) => ({
      type: "Feature",
      properties: {
        layer_type: "ROAD_SEGMENT",
        road_id: r.id,
        road_name: r.name,
        water_depth_cm: r.water_depth_cm,
        status: r.status,
        color:
          r.water_depth_cm > 25
            ? [214, 69, 69, 240]
            : r.water_depth_cm > 10
            ? [232, 134, 58, 230]
            : [30, 142, 90, 220],
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [77.2185 + idx * 0.0015, 28.6328 - idx * 0.001],
          [77.2205 + idx * 0.0015, 28.6315 - idx * 0.001],
          [77.2245 + idx * 0.0015, 28.636 - idx * 0.001],
        ],
      },
    })),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-4xl text-text-primary tracking-tight">
            Dynamic Safe Routing
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-sans">
            Depth-penalized A* pathfinding for emergency vehicles with automatic flood choke-point bypass.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="badge-success">CLEARANCE: 100.0%</span>
          <span className="badge-warning">MAX INUNDATION: {peakWaterDepthCm.toFixed(1)} CM</span>
        </div>
      </div>

      {/* Origin & Destination Waypoints Bar */}
      <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div>
            <label className="label-mono block mb-1">Origin Point</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent-black"
            >
              <option value="CP_INNER">Connaught Circus Inner (CP)</option>
              <option value="BARAKHAMBA">Barakhamba Road Junction</option>
              <option value="KG_MARG">Kasturba Gandhi Marg</option>
            </select>
          </div>

          <div>
            <label className="label-mono block mb-1">Emergency Destination</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent-black"
            >
              <option value="LNJP_HOSPITAL">LNJP Hospital / Minto North</option>
              <option value="NEW_DELHI_RLY">New Delhi Railway Station Gate 2</option>
              <option value="RAM_MANOHAR">Dr. Ram Manohar Lohia Hospital</option>
            </select>
          </div>

          <div>
            <label className="label-mono block mb-1">Vehicle Classification</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full bg-cream-alt border border-border-medium rounded-md px-3 py-2 text-text-primary focus:outline-none focus:border-accent-black"
            >
              <option value="AMBULANCE">Emergency Ambulance (Max 25cm Depth)</option>
              <option value="FIRE_TRUCK">Heavy Fire Engine (Max 45cm Depth)</option>
              <option value="CIV_CAR">Civilian Light Vehicle (Max 15cm Depth)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Map & Route Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Route Inspector Component */}
        <div className="lg:col-span-1">
          <RouteInspector
            routeData={routeData}
            onRecalculateRoute={() => triggerRefresh()}
            isLoading={isSimulating}
          />
        </div>

        {/* Right Column: Interactive Map Viewport */}
        <div className="lg:col-span-2 card bg-white border border-border-light rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border-light pb-3">
            <div>
              <h2 className="font-bold text-sm text-text-primary">
                Side-by-Side Path Comparison
              </h2>
              <p className="text-xs text-text-secondary font-sans mt-0.5">
                Baseline shortest route (Red Dashed) vs Flood-Safe detour via Barakhamba Flyover (Solid Black).
              </p>
            </div>
            <span className="label-mono text-[10px]">ROAD ELEVATION PROFILE APPLIED</span>
          </div>

          <div className="relative w-full h-[420px] rounded-lg overflow-hidden border border-border-light">
            <MapViewport
              geojsonData={geojsonData}
              routeData={routeData}
              onSelectNode={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

