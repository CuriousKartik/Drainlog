"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { getInundationGrid, type InundationResponse } from "@/services/api";

export interface ModelParameters {
  cloggingRatio: number;      // alpha: 0.0 to 1.0
  inletCapacity: number;      // m3/s: max inlet intake
  demResolution: number;      // meters: 5, 10, 30
  radarInterval: number;      // minutes: 5, 10, 15
  manningN: number;           // roughness n: 0.012 to 0.024
  curbHeight: number;         // meters: 0.10 to 0.25
}

export interface UserProfile {
  name: string;
  email: string;
  organization: string;
  role: string;
}

export interface NodeHydraulics {
  id: string;
  node_code: string;
  name: string;
  x: number;
  y: number;
  z_ground: number;
  z_invert: number;
  basin_area: number;
  hgl: number;
  surcharge_m3s: number;
  street_depth_cm: number;
  is_surcharging: boolean;
}

export interface RoadHydraulics {
  id: string;
  name: string;
  base_elevation: number;
  water_depth_cm: number;
  status: "PASSABLE" | "SLOW" | "IMPASSABLE";
  speed_kmh: number;
}

interface SimulationContextType {
  // Auth
  isAuthenticated: boolean;
  user: UserProfile;
  login: (email: string, pass: string) => boolean;
  signup: (name: string, email: string, org: string, pass: string) => boolean;
  logout: () => void;
  updateUser: (data: Partial<UserProfile>) => void;

  // Model parameters (tunable)
  parameters: ModelParameters;
  updateParameters: (params: Partial<ModelParameters>) => void;
  resetParameters: () => void;

  // Time & Hydrology State
  horizonMin: number;
  setHorizonMin: (h: number) => void;
  rainfallRate: number;
  rainfallSource: "live_open_meteo" | "simulated_fallback" | null;
  geojsonData: InundationResponse | null;
  nodes: NodeHydraulics[];
  roads: RoadHydraulics[];
  selectedNode: NodeHydraulics | null;
  setSelectedNode: (node: NodeHydraulics | null) => void;

  // Live Metrics
  peakWaterDepthCm: number;
  impassableRoadsCount: number;
  detourFeasibilityRate: number;
  activeNodesCount: number;

  // Telemetry Sources
  dataSources: {
    radar: { name: string; status: "CONNECTED" | "RECONNECTING" | "OFFLINE"; latency_ms: number; last_ping: string };
    dem: { name: string; status: "CONNECTED" | "RECONNECTING" | "OFFLINE"; latency_ms: number; last_ping: string };
    shapefile: { name: string; status: "CONNECTED" | "RECONNECTING" | "OFFLINE"; latency_ms: number; last_ping: string };
  };
  reconnectSource: (source: "radar" | "dem" | "shapefile") => void;

  // State Simulation (Loading / Error / Empty for testing)
  isSimulating: boolean;
  hasError: boolean;
  triggerRefresh: () => void;
  setHasError: (err: boolean) => void;
}

const DEFAULT_PARAMS: ModelParameters = {
  cloggingRatio: 0.45,
  inletCapacity: 3.4,
  demResolution: 10,
  radarInterval: 15,
  manningN: 0.014,
  curbHeight: 0.15,
};

const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

function toNode(feature: InundationResponse["features"][number], index: number): NodeHydraulics {
  const properties = feature.properties;
  const code = stringValue(properties.node_code, `NODE_${index + 1}`);

  return {
    id: stringValue(properties.node_id, `node-${index + 1}`),
    node_code: code,
    name: code,
    // The graph panel has its own local canvas coordinates; the map consumes
    // the actual GeoJSON geometry from the API response.
    x: 120 + (index % 3) * 250 + (index > 2 ? 70 : 0),
    y: 110 + Math.floor(index / 3) * 150 + (index % 3) * 35,
    z_ground: numberValue(properties.z_ground),
    z_invert: numberValue(properties.z_invert),
    basin_area: numberValue(properties.basin_area),
    hgl: numberValue(properties.hgl),
    surcharge_m3s: numberValue(properties.surcharge_flow_m3s),
    street_depth_cm: numberValue(properties.street_depth_cm),
    is_surcharging: properties.is_surcharging === true,
  };
}

function toRoad(feature: InundationResponse["features"][number], index: number): RoadHydraulics {
  const properties = feature.properties;
  const rawStatus = stringValue(properties.status, "PASSABLE");
  const status: RoadHydraulics["status"] = ["PASSABLE", "SLOW", "IMPASSABLE"].includes(rawStatus)
    ? rawStatus as RoadHydraulics["status"]
    : "PASSABLE";

  return {
    id: stringValue(properties.road_id, `road-${index + 1}`),
    name: stringValue(properties.road_name, "Unnamed road"),
    base_elevation: numberValue(properties.z_elevation),
    water_depth_cm: numberValue(properties.water_depth_cm),
    status,
    speed_kmh: status === "IMPASSABLE" ? 0 : status === "SLOW" ? 14 : 40,
  };
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile>({
    name: "Kartikey Gupta",
    email: "kartikey@moes.gov.in",
    organization: "Delhi Municipal Corporation / MoES",
    role: "Hydraulic Systems Specialist",
  });

  // Parameters
  const [parameters, setParameters] = useState<ModelParameters>(DEFAULT_PARAMS);

  // Time Horizon
  const [horizonMin, setHorizonMin] = useState<number>(45);
  const [rainfallRate, setRainfallRate] = useState<number>(0);
  const [rainfallSource, setRainfallSource] = useState<"live_open_meteo" | "simulated_fallback" | null>(null);
  const [geojsonData, setGeojsonData] = useState<InundationResponse | null>(null);
  const [nodes, setNodes] = useState<NodeHydraulics[]>([]);
  const [roads, setRoads] = useState<RoadHydraulics[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeHydraulics | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [refreshVersion, setRefreshVersion] = useState<number>(0);

  // Telemetry Sources
  const [dataSources, setDataSources] = useState<SimulationContextType["dataSources"]>({
    radar: { name: "IMD / NCMRWF Doppler Weather Radar (Palam)", status: "CONNECTED" as const, latency_ms: 18, last_ping: "Just now" },
    dem: { name: "CartoDEM High-Res Topographic Grid (10m)", status: "CONNECTED" as const, latency_ms: 42, last_ping: "3 min ago" },
    shapefile: { name: "MCD Storm Sewer Network Shapefile (v2.4)", status: "CONNECTED" as const, latency_ms: 25, last_ping: "Just now" },
  });

  // Synchronize the dashboard with the FastAPI hydraulic solver whenever the
  // forecast horizon changes or an operator requests a refresh.
  useEffect(() => {
    const controller = new AbortController();
    setIsSimulating(true);
    setHasError(false);

    getInundationGrid(horizonMin, controller.signal)
      .then((response) => {
        setGeojsonData(response);
        setRainfallRate(response.rainfall_intensity_mm_hr);
        setRainfallSource(response.rainfall_source);
        setNodes(response.features
          .filter((feature) => feature.properties.layer_type === "DRAIN_NODE")
          .map(toNode));
        setRoads(response.features
          .filter((feature) => feature.properties.layer_type === "ROAD_SEGMENT")
          .map(toRoad));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Unable to load inundation grid", error);
        setHasError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSimulating(false);
      });

    return () => controller.abort();
  }, [horizonMin, refreshVersion]);

  // Aggregate stats
  const peakWaterDepthCm = useMemo(() => {
    return Math.max(0, ...roads.map((r) => r.water_depth_cm));
  }, [roads]);

  const impassableRoadsCount = useMemo(() => {
    return roads.filter((r) => r.status === "IMPASSABLE").length;
  }, [roads]);

  const detourFeasibilityRate = useMemo(() => {
    // 100% if the elevated bypass returned by the server remains passable.
    const safeRoad = roads.find((r) => r.name.includes("Barakhamba"));
    return safeRoad && safeRoad.status === "PASSABLE" ? 100.0 : 0.0;
  }, [roads]);

  const activeNodesCount = nodes.length;

  // Actions
  const updateParameters = (newParams: Partial<ModelParameters>) => {
    setParameters((prev) => ({ ...prev, ...newParams }));
  };

  const resetParameters = () => {
    setParameters(DEFAULT_PARAMS);
  };

  const updateUser = (data: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...data }));
  };

  const login = (email: string, pass: string) => {
    if (email && pass.length >= 6) {
      setIsAuthenticated(true);
      setUser((prev) => ({ ...prev, email }));
      return true;
    }
    return false;
  };

  const signup = (name: string, email: string, org: string, pass: string) => {
    if (name && email && pass.length >= 6) {
      setIsAuthenticated(true);
      setUser({ name, email, organization: org || "Delhi Municipal Corporation", role: "Operator" });
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const reconnectSource = (source: "radar" | "dem" | "shapefile") => {
    setDataSources((prev) => ({
      ...prev,
      [source]: { ...prev[source], status: "RECONNECTING" },
    }));

    setTimeout(() => {
      setDataSources((prev) => ({
        ...prev,
        [source]: { ...prev[source], status: "CONNECTED", last_ping: "Just now" },
      }));
    }, 1200);
  };

  const triggerRefresh = () => {
    setRefreshVersion((version) => version + 1);
  };

  return (
    <SimulationContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        signup,
        logout,
        updateUser,
        parameters,
        updateParameters,
        resetParameters,
        horizonMin,
        setHorizonMin,
        rainfallRate,
        rainfallSource,
        geojsonData,
        nodes,
        roads,
        selectedNode,
        setSelectedNode,
        peakWaterDepthCm,
        impassableRoadsCount,
        detourFeasibilityRate,
        activeNodesCount,
        dataSources,
        reconnectSource,
        isSimulating,
        hasError,
        triggerRefresh,
        setHasError,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
}

