export type ApiFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Point" | "LineString";
    coordinates: number[] | number[][];
  };
};

export interface FeatureCollection {
  type: "FeatureCollection";
  features: ApiFeature[];
  [key: string]: unknown;
}

export type RainfallSource = "live_open_meteo" | "simulated_fallback" | "simulated_storm";

export interface InundationResponse extends FeatureCollection {
  horizon_min: number;
  rainfall_intensity_mm_hr: number;
  rainfall_source: RainfallSource;
  total_flooded_roads: number;
}

export interface SummaryTimelineEntry {
  horizon_min: number;
  rainfall_mm_hr: number;
  rainfall_source: RainfallSource;
  max_flood_depth_cm: number;
  status: "CLEAR" | "SLOW" | "IMPASSABLE";
}

export interface SummaryStatsResponse {
  forecast_horizon_hours: number;
  step_interval_min: number;
  timeline: SummaryTimelineEntry[];
}

export interface RouteResponse extends FeatureCollection {
  metadata: {
    safe_route_found: boolean;
    baseline_distance_km: number;
    safe_distance_km: number;
    distance_delta_km: number;
    baseline_est_time_min: number;
    safe_est_time_min: number;
    hazards_avoided_count: number;
    max_avoided_flood_depth_cm: number;
    summary: string;
  };
}

export interface SafeRouteRequest {
  start_lon: number;
  start_lat: number;
  end_lon: number;
  end_lat: number;
  horizon_min: number;
  vehicle_type: string;
  simulate?: boolean;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getInundationGrid(horizonMin: number, simulate = false, signal?: AbortSignal) {
  const simulateParam = simulate ? "&simulate=true" : "";
  return request<InundationResponse>(
    `/api/v1/nowcast/inundation-grid?horizon_min=${horizonMin}${simulateParam}`,
    { signal },
  );
}

export function getSummaryStats(simulate = false, signal?: AbortSignal) {
  const simulateParam = simulate ? "?simulate=true" : "";
  return request<SummaryStatsResponse>(`/api/v1/nowcast/summary-stats${simulateParam}`, { signal });
}

export function getSafeRoute(payload: SafeRouteRequest, signal?: AbortSignal) {
  return request<RouteResponse>("/api/v1/routing/safe-route", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function dispatchRouteAlert(payload: { route_id: string; recipient_phone: string; message: string }) {
  return request<{ status: string }>("/api/v1/routing/dispatch-alert", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
