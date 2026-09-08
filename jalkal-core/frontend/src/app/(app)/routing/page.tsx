"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { dispatchRouteAlert, getSafeRoute, type RouteResponse } from "@/services/api";
import RouteInspector from "@/components/RouteInspector";
import MapViewport from "@/components/MapViewport";
import { LoadingCard, ErrorStateCard } from "@/components/StateFeedback";

const WAYPOINTS: Record<string, [number, number]> = {
  CP_INNER: [77.2185, 28.6328],
  BARAKHAMBA: [77.2260, 28.6280],
  KG_MARG: [77.2210, 28.6255],
  LNJP_HOSPITAL: [77.2245, 28.6360],
  NEW_DELHI_RLY: [77.2245, 28.6360],
  RAM_MANOHAR: [77.2245, 28.6360],
};

export default function RoutingPage() {
  const {
    horizonMin,
    geojsonData,
    peakWaterDepthCm,
    isSimulating,
    hasError,
    triggerRefresh,
  } = useSimulation();

  const [origin, setOrigin] = useState<string>("CP_INNER");
  const [destination, setDestination] = useState<string>("LNJP_HOSPITAL");
  const [vehicleType, setVehicleType] = useState<string>("AMBULANCE");
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isRouting, setIsRouting] = useState<boolean>(true);
  const [routeError, setRouteError] = useState<string | null>(null);

  const loadRoute = useCallback(async () => {
    const [startLon, startLat] = WAYPOINTS[origin];
    const [endLon, endLat] = WAYPOINTS[destination];
    setIsRouting(true);
    setRouteError(null);

    try {
      setRouteData(await getSafeRoute({
        start_lon: startLon,
        start_lat: startLat,
        end_lon: endLon,
        end_lat: endLat,
        horizon_min: horizonMin,
        vehicle_type: vehicleType,
      }));
    } catch (error) {
      console.error("Unable to calculate safe route", error);
      setRouteError("The server could not calculate a flood-safe route for these points.");
    } finally {
      setIsRouting(false);
    }
  }, [destination, horizonMin, origin, vehicleType]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  const handleDispatch = async (phone: string) => {
    if (!routeData) throw new Error("Calculate a route before dispatching it.");
    await dispatchRouteAlert({
      route_id: `route-${horizonMin}-${origin}-${destination}`,
      recipient_phone: phone,
      message: routeData.metadata.summary,
    });
  };

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

  if (routeError && !routeData) {
    return <ErrorStateCard title="Route Calculation Failed" description={routeError} onRetry={loadRoute} />;
  }

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
          <span className="badge-success">
            CLEARANCE: {routeData?.metadata.safe_route_found ? "100.0%" : "UNAVAILABLE"}
          </span>
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
            onRecalculateRoute={loadRoute}
            onDispatchRoute={handleDispatch}
            isLoading={isRouting}
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

