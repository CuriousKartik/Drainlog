"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

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

const BASE_NODES_DATA = [
  { id: "node-1", node_code: "MH_CP_INNER_01", name: "CP Inner Circle North", x: 180, y: 140, z_ground: 216.5, z_invert: 214.0, basin_area: 5200 },
  { id: "node-2", node_code: "MH_CP_INNER_02", name: "CP Radial Node 3", x: 310, y: 190, z_ground: 215.8, z_invert: 213.2, basin_area: 6100 },
  { id: "node-3", node_code: "MH_CP_OUTER_03", name: "Outer Circle Junction", x: 420, y: 270, z_ground: 214.9, z_invert: 212.1, basin_area: 7800 },
  { id: "node-4", node_code: "MH_MINTO_BRIDGE_LOW", name: "Minto Railway Underpass Dip", x: 580, y: 130, z_ground: 211.8, z_invert: 209.2, basin_area: 12400 },
  { id: "node-5", node_code: "MH_BARAKHAMBA_05", name: "Barakhamba Elevated Deck", x: 600, y: 330, z_ground: 217.5, z_invert: 214.8, basin_area: 4900 },
  { id: "node-6", node_code: "MH_BHAVBHUTI_06", name: "Bhavbhuti Marg Bypass", x: 720, y: 220, z_ground: 216.0, z_invert: 213.5, basin_area: 5800 },
];

const BASE_ROADS_DATA = [
  { id: "road-1", name: "Connaught Circus Inner", base_elevation: 216.2, nominal_speed: 40 },
  { id: "road-2", name: "Radial Road 3 Connector", base_elevation: 215.4, nominal_speed: 35 },
  { id: "road-3", name: "Minto Underpass Subway (Choke-Point)", base_elevation: 211.8, nominal_speed: 45 },
  { id: "road-4", name: "Barakhamba Elevated Flyover (Detour)", base_elevation: 217.5, nominal_speed: 50 },
  { id: "road-5", name: "Bhavbhuti Marg Bypass Corridor", base_elevation: 216.0, nominal_speed: 40 },
];

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
  const [selectedNode, setSelectedNode] = useState<NodeHydraulics | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Telemetry Sources
  const [dataSources, setDataSources] = useState({
    radar: { name: "IMD / NCMRWF Doppler Weather Radar (Palam)", status: "CONNECTED" as const, latency_ms: 18, last_ping: "Just now" },
    dem: { name: "CartoDEM High-Res Topographic Grid (10m)", status: "CONNECTED" as const, latency_ms: 42, last_ping: "3 min ago" },
    shapefile: { name: "MCD Storm Sewer Network Shapefile (v2.4)", status: "CONNECTED" as const, latency_ms: 25, last_ping: "Just now" },
  });

  // Calculate live rainfall rate based on horizon
  const rainfallRate = useMemo(() => {
    return Math.max(4.0, Math.round(78.5 * Math.exp(-Math.pow(horizonMin - 45.0, 2) / 1800.0) * 10) / 10);
  }, [horizonMin]);

  // Reactive Hydraulic Solver: Recomputes node HGL & street inundation whenever
  // parameters (cloggingRatio, inletCapacity, etc.) or rainfall change!
  const { nodes, roads } = useMemo(() => {
    const alpha = parameters.cloggingRatio;
    const capacityFactor = parameters.inletCapacity / 3.4;

    // Compute Minto underpass depth: heavily influenced by alpha (clogging) and capacity
    let underpassDepth = 3.0;
    if (rainfallRate > 18.0) {
      const netInflow = (rainfallRate - 18.0 * capacityFactor);
      underpassDepth = Math.max(2.0, Math.round((netInflow * 0.72) * (1.0 + alpha * 1.2) * 10) / 10);
    }

    const radialDepth = Math.max(1.0, Math.round(underpassDepth * 0.42 * (1.0 + alpha * 0.3) * 10) / 10);
    const innerDepth = Math.max(1.0, Math.round(4.5 * (rainfallRate / 60.0) * 10) / 10);
    const flyoverDepth = 0.5; // Elevated flyover never accumulates significant water
    const bhavbhutiDepth = Math.max(1.0, Math.round(2.8 * (rainfallRate / 50.0) * 10) / 10);

    const updatedNodes: NodeHydraulics[] = BASE_NODES_DATA.map((n) => {
      let streetDepth = 0.0;
      let hgl = n.z_invert + 1.2;

      if (n.id === "node-4") {
        streetDepth = underpassDepth;
        hgl = n.z_ground + streetDepth / 100.0;
      } else if (n.id === "node-3") {
        streetDepth = radialDepth;
        hgl = n.z_ground + (streetDepth > 10 ? (streetDepth - 10) / 100.0 : -0.2);
      } else if (n.id === "node-2") {
        streetDepth = innerDepth;
        hgl = n.z_invert + (n.z_ground - n.z_invert) * 0.7;
      } else {
        streetDepth = 2.0;
        hgl = n.z_invert + 1.5;
      }

      const isSurcharging = hgl > n.z_ground;
      const surchargeFlow = isSurcharging
        ? Math.round(0.62 * (Math.PI * 0.3 * 0.3) * Math.sqrt(2 * 9.81 * Math.max(0.01, hgl - n.z_ground)) * 1000) / 1000
        : 0.0;

      return {
        ...n,
        hgl: Math.round(hgl * 100) / 100,
        surcharge_m3s: surchargeFlow,
        street_depth_cm: streetDepth,
        is_surcharging: isSurcharging,
      };
    });

    const depths = [innerDepth, radialDepth, underpassDepth, flyoverDepth, bhavbhutiDepth];

    const updatedRoads: RoadHydraulics[] = BASE_ROADS_DATA.map((r, idx) => {
      const d = depths[idx];
      let status: "PASSABLE" | "SLOW" | "IMPASSABLE" = "PASSABLE";
      let speed = r.nominal_speed;

      if (d > 25.0) {
        status = "IMPASSABLE";
        speed = 0;
      } else if (d >= 10.0) {
        status = "SLOW";
        speed = Math.round(r.nominal_speed * 0.35);
      }

      return {
        id: r.id,
        name: r.name,
        base_elevation: r.base_elevation,
        water_depth_cm: d,
        status,
        speed_kmh: speed,
      };
    });

    return { nodes: updatedNodes, roads: updatedRoads };
  }, [parameters, rainfallRate]);

  // Aggregate stats
  const peakWaterDepthCm = useMemo(() => {
    return Math.max(...roads.map((r) => r.water_depth_cm));
  }, [roads]);

  const impassableRoadsCount = useMemo(() => {
    return roads.filter((r) => r.status === "IMPASSABLE").length;
  }, [roads]);

  const detourFeasibilityRate = useMemo(() => {
    // 100% if safe elevated route is passable
    const safeRoad = roads.find((r) => r.id === "road-4");
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
    setIsSimulating(true);
    setHasError(false);
    setTimeout(() => {
      setIsSimulating(false);
    }, 600);
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

