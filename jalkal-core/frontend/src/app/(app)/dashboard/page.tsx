"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSimulation } from "@/context/SimulationContext";
import { LoadingCard, ErrorStateCard, EmptyStateCard } from "@/components/StateFeedback";

export default function DashboardPage() {
  const {
    peakWaterDepthCm,
    detourFeasibilityRate,
    activeNodesCount,
    impassableRoadsCount,
    roads,
    parameters,
    rainfallRate,
    isSimulating,
    hasError,
    triggerRefresh,
    setHasError,
  } = useSimulation();

  const [filter, setFilter] = useState<string>("ALL");

  if (isSimulating) {
    return <LoadingCard message="Solving 2D Saint-Venant hydraulic network and road impedance..." />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title="Telemetry Pipeline Disruption"
        description="Could not aggregate hydraulic state from edge sensors. Check server logs."
        onRetry={() => triggerRefresh()}
      />
    );
  }

  const filteredRoads = roads.filter((r) => {
    if (filter === "IMPASSABLE") return r.status === "IMPASSABLE";
    if (filter === "SLOW") return r.status === "SLOW";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-4xl text-text-primary tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-sans">
            Real-time urban catchment status, peak ponding depths, and route clearance across the Delhi basin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/nowcast" className="btn-secondary text-xs py-2 px-4">
            RADAR NOWCAST
          </Link>
          <Link href="/routing" className="btn-primary text-xs py-2 px-4">
            SAFE DETOURS
          </Link>
        </div>
      </div>

      {/* 5 Summary KPI Cards (Superform Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
        <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm">
          <div className="label-mono text-[10px]">ACTIVE CATCHMENTS</div>
          <div className="heading-display text-3xl text-text-primary mt-1">6</div>
          <div className="text-[11px] text-text-secondary mt-0.5">Connaught Basin</div>
        </div>

        <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm">
          <div className="label-mono text-[10px]">ALERT LEVEL</div>
          <div className="mt-1">
            {peakWaterDepthCm > 25 ? (
              <span className="badge-error text-xs">CRITICAL</span>
            ) : peakWaterDepthCm > 10 ? (
              <span className="badge-warning text-xs">ELEVATED</span>
            ) : (
              <span className="badge-success text-xs">NORMAL</span>
            )}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">
            {impassableRoadsCount} choked streets
          </div>
        </div>

        <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm">
          <div className="label-mono text-[10px]">PEAK FLOOD DEPTH</div>
          <div className="heading-display text-3xl text-text-primary mt-1">
            {peakWaterDepthCm.toFixed(1)}
            <span className="text-sm font-normal text-text-muted font-mono ml-1">cm</span>
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">Minto Underpass</div>
        </div>

        <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm">
          <div className="label-mono text-[10px]">ROUTE CLEARANCE</div>
          <div className="heading-display text-3xl text-status-success-text mt-1">
            {detourFeasibilityRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">Safe Detour Active</div>
        </div>

        <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm">
          <div className="label-mono text-[10px]">MONITORING NODES</div>
          <div className="heading-display text-3xl text-text-primary mt-1">
            {activeNodesCount}
          </div>
          <div className="text-[11px] text-text-secondary mt-0.5">GNN Telemetry</div>
        </div>
      </div>

      {/* Two Side-by-Side Cards: Hydraulic Briefing & Model Constants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Briefing Card */}
        <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm text-text-primary">Hydraulic Briefing</span>
              <span className="badge-warning text-[10px]">T+45M FORECAST</span>
            </div>
            <p className="heading-editorial text-text-primary text-base leading-relaxed">
              &ldquo;Precipitation rate reached {rainfallRate.toFixed(1)} mm/hr. Minto Underpass conduit has exceeded full-pipe gravity capacity under clogging factor alpha = {parameters.cloggingRatio.toFixed(2)}, generating +{(peakWaterDepthCm / 100).toFixed(2)}m surcharge above road elevation.&rdquo;
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-dashed border-border-light space-y-2">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">
              SURFACE HYDROLOGY ENGINE • AUTOMATIC ADVISORY
            </div>
            <div className="text-[11px] text-accent-orange font-semibold uppercase">
              [ADVISORY] AMBULANCE CORRIDOR REDIRECTED TO ELEVATED BARAKHAMBA FLYOVER.
            </div>
          </div>
        </div>

        {/* Model Execution & Active Parameters Card */}
        <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-sm text-text-primary">Model Run Parameters</span>
              <Link href="/settings" className="label-mono text-[10px] hover:text-text-primary underline">
                EDIT PARAMETERS
              </Link>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1.5 border-b border-border-light">
                <span className="text-text-secondary">Conduit Clogging Ratio (alpha):</span>
                <span className="font-bold text-text-primary">{parameters.cloggingRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border-light">
                <span className="text-text-secondary">Inlet Conveyance Cap:</span>
                <span className="font-bold text-text-primary">{parameters.inletCapacity.toFixed(1)} m³/s</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border-light">
                <span className="text-text-secondary">Manning Roughness (n):</span>
                <span className="font-bold text-text-primary">{parameters.manningN}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-secondary">DEM Cell Resolution:</span>
                <span className="font-bold text-text-primary">{parameters.demResolution} m</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-light flex justify-between text-xs text-text-muted">
            <span>GNN Inference: &lt;35ms</span>
            <span>Solver: Dual-Mode (GNN / Manning)</span>
          </div>
        </div>
      </div>

      {/* Street Segments Inundation Table */}
      <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-light pb-4">
          <div>
            <h2 className="font-bold text-base text-text-primary">
              Monitored Street Inundation Logs
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-sans">
              Dynamic water depths computed along primary Delhi transit corridors.
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`btn-secondary text-[11px] py-1 px-3 ${filter === "ALL" ? "bg-cream-alt" : ""}`}
            >
              ALL ({roads.length})
            </button>
            <button
              onClick={() => setFilter("IMPASSABLE")}
              className={`btn-secondary text-[11px] py-1 px-3 ${filter === "IMPASSABLE" ? "bg-cream-alt text-[#D64545]" : ""}`}
            >
              IMPASSABLE ({roads.filter((r) => r.status === "IMPASSABLE").length})
            </button>
            <button
              onClick={() => setFilter("SLOW")}
              className={`btn-secondary text-[11px] py-1 px-3 ${filter === "SLOW" ? "bg-cream-alt text-accent-orange" : ""}`}
            >
              SLOW ({roads.filter((r) => r.status === "SLOW").length})
            </button>
          </div>
        </div>

        {filteredRoads.length === 0 ? (
          <EmptyStateCard
            title="No Matching Streets"
            description="No road segments match the selected status filter."
            actionText="RESET FILTER"
            onAction={() => setFilter("ALL")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-border-light text-text-secondary text-[10px] uppercase">
                  <th className="py-2.5 px-3">Segment Name</th>
                  <th className="py-2.5 px-3">Road Grade Elevation</th>
                  <th className="py-2.5 px-3">Water Depth</th>
                  <th className="py-2.5 px-3">Effective Speed</th>
                  <th className="py-2.5 px-3 text-right">Traversability</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoads.map((r) => (
                  <tr key={r.id} className="border-b border-border-light hover:bg-cream-alt/60 transition-colors">
                    <td className="py-3 px-3 font-semibold text-text-primary">
                      {r.name}
                    </td>
                    <td className="py-3 px-3 text-text-secondary">
                      {r.base_elevation.toFixed(1)} m AMSL
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span
                        className={
                          r.water_depth_cm > 25
                            ? "text-[#D64545]"
                            : r.water_depth_cm > 10
                            ? "text-accent-orange"
                            : "text-status-success-text"
                        }
                      >
                        {r.water_depth_cm.toFixed(1)} cm
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text-secondary">
                      {r.speed_kmh} km/h
                    </td>
                    <td className="py-3 px-3 text-right">
                      {r.status === "IMPASSABLE" && (
                        <span className="badge-error text-[10px]">IMPASSABLE (&gt;25cm)</span>
                      )}
                      {r.status === "SLOW" && (
                        <span className="badge-warning text-[10px]">SLOW (10-25cm)</span>
                      )}
                      {r.status === "PASSABLE" && (
                        <span className="badge-success text-[10px]">PASSABLE (&lt;10cm)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

