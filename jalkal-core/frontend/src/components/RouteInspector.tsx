"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Send,
  CheckCircle2,
  AlertTriangle,
  Siren,
} from "lucide-react";

interface RouteInspectorProps {
  routeData: any;
  onRecalculateRoute: (origin: string, dest: string) => void;
  isLoading: boolean;
}

export default function RouteInspector({
  routeData,
  onRecalculateRoute,
  isLoading,
}: RouteInspectorProps) {
  const [phone, setPhone] = useState<string>("+91 98101 23456");
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const meta = routeData?.metadata || {
    safe_route_found: true,
    baseline_distance_km: 1.23,
    safe_distance_km: 1.70,
    distance_delta_km: 0.47,
    baseline_est_time_min: 2.1,
    safe_est_time_min: 2.8,
    hazards_avoided_count: 1,
    max_avoided_flood_depth_cm: 38.0,
    summary: "Safe route avoids 38cm deep flood at Minto Underpass Subway.",
  };

  const handleDispatchSMS = () => {
    setDispatchStatus("SENDING");
    setTimeout(() => {
      setDispatchStatus("SENT");
      setTimeout(() => setDispatchStatus(null), 3000);
    }, 800);
  };

  return (
    <div className="bg-white border border-border-light rounded-lg p-5 shadow-sm flex flex-col gap-4 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-pill bg-cream-alt flex items-center justify-center text-text-primary">
            <Siren className="w-4 h-4 text-accent-orange" />
          </div>
          <div>
            <div className="font-bold text-text-primary text-sm tracking-tight">
              Route Inspector
            </div>
            <div className="label-mono text-[10px]">
              Depth-Penalized A* Dynamic Routing
            </div>
          </div>
        </div>
      </div>

      {/* Preset Waypoints */}
      <div className="grid grid-cols-2 gap-2 bg-cream-alt p-3 rounded-md border border-border-light">
        <div>
          <span className="label-mono text-[10px]">Origin</span>
          <div className="text-text-primary font-medium truncate mt-0.5 text-xs">
            Connaught Circus Inner
          </div>
        </div>
        <div>
          <span className="label-mono text-[10px]">Destination</span>
          <div className="text-text-primary font-medium truncate mt-0.5 text-xs">
            LNJP Hospital / Minto N
          </div>
        </div>
      </div>

      {/* Side-by-side Route Comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Baseline Route Card */}
        <div className="bg-white border border-border-medium rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#D64545] font-semibold mb-1 text-[11px]">
              <span className="flex items-center gap-1 uppercase tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5" /> Baseline
              </span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {meta.baseline_distance_km} <span className="text-xs text-text-muted font-normal">km</span>
            </div>
            <div className="text-text-secondary text-[11px] mt-0.5">
              Est: <span className="font-medium text-text-primary">{meta.baseline_est_time_min} min</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border-light text-[#D64545] text-[11px] font-medium flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Traverses {meta.max_avoided_flood_depth_cm}cm Water
          </div>
        </div>

        {/* Flood-Safe Detour Card */}
        <div className="bg-status-success-bg border border-[#C5E8D6] rounded-md p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-status-success-text font-semibold mb-1 text-[11px]">
              <span className="flex items-center gap-1 uppercase tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5" /> Safe Detour
              </span>
            </div>
            <div className="text-2xl font-bold text-status-success-text">
              {meta.safe_distance_km} <span className="text-xs text-text-muted font-normal">km</span>
            </div>
            <div className="text-text-secondary text-[11px] mt-0.5">
              Est: <span className="font-medium text-text-primary">{meta.safe_est_time_min} min</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#C5E8D6] text-status-success-text text-[11px] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            0 Choke-Points (+{meta.distance_delta_km} km)
          </div>
        </div>
      </div>

      {/* Editorial Briefing Accent */}
      <div className="bg-cream-alt p-3 rounded-md border border-border-light">
        <span className="label-mono text-[10px] block mb-1">Tactical Advisory</span>
        <p className="heading-editorial text-text-primary text-xs leading-relaxed">
          &ldquo;{meta.summary}&rdquo;
        </p>
      </div>

      {/* Dispatch SMS */}
      <div className="pt-2 border-t border-border-light flex flex-col gap-2">
        <label className="label-mono text-[10px]">
          Dispatch Route via SMS (Emergency Driver)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-white border border-border-medium rounded-pill px-3 py-2 text-text-primary w-full text-xs focus:outline-none focus:border-accent-black transition-colors"
            placeholder="Driver Phone"
          />
          <button
            onClick={handleDispatchSMS}
            disabled={dispatchStatus === "SENDING"}
            className="btn-primary text-xs shrink-0 py-2 px-4"
          >
            {dispatchStatus === "SENDING" ? (
              <span>SENDING...</span>
            ) : dispatchStatus === "SENT" ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> SENT
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> DISPATCH
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
