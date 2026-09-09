"use client";

import React, { useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import TimeScrubber from "@/components/TimeScrubber";
import MapViewport from "@/components/MapViewport";
import NodeDiagnostic from "@/components/NodeDiagnostic";
import { LoadingCard, ErrorStateCard } from "@/components/StateFeedback";

export default function NowcastPage() {
  const {
    horizonMin,
    setHorizonMin,
    rainfallRate,
    rainfallSource,
    geojsonData,
    nodes,
    selectedNode,
    setSelectedNode,
    parameters,
    updateParameters,
    isSimulating,
    hasError,
    triggerRefresh,
  } = useSimulation();

  if (isSimulating) {
    return <LoadingCard message="Extrapolating ConvLSTM Doppler radar reflectivity tensors..." />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title="Radar Ingest Anomaly"
        description="Unable to sync 15-minute Doppler radar reflectivity grids from IMD/NCMRWF feed."
        onRetry={triggerRefresh}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-4xl text-text-primary tracking-tight">
            Radar Nowcast & Timeline
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-sans">
            Spatio-temporal rainfall extrapolation (0 to 180 min horizon) and street ponding dynamics.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="badge-success">DWR PALAM CONNECTED</span>
          <span className="badge-warning">CONVLSTM INFERENCE ACTIVE</span>
        </div>
      </div>

      {/* Interactive Time Scrubber Card */}
      <TimeScrubber
        currentHorizon={horizonMin}
        onChangeHorizon={setHorizonMin}
        rainfallRate={rainfallRate}
      />

      {/* Precipitation & Catchment Inundation Map */}
      <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border-light pb-3">
          <div>
            <h2 className="font-bold text-base text-text-primary">
              Precipitation Grid & Street Depth Map
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-sans">
              Computed at T+{horizonMin}m forecast slice under Marshall-Palmer conversion: Z = 200 · R^1.6
            </p>
          </div>
          <div className="text-xs text-text-secondary font-mono">
            Intensity: <b className="text-text-primary">{rainfallRate.toFixed(1)} mm/hr</b>
            {rainfallSource && <span className="ml-2">[{rainfallSource === "live_open_meteo" ? "LIVE" : "FALLBACK"}]</span>}
          </div>
        </div>

        <div className="relative w-full h-[480px] rounded-lg overflow-hidden border border-border-light">
          <MapViewport
            geojsonData={geojsonData}
            routeData={null}
            onSelectNode={(nodeProps) => {
              const matched = nodes.find((n) => n.node_code === nodeProps.node_code);
              setSelectedNode(matched || null);
            }}
          />
        </div>
      </div>

      {/* Convective Storm Profile Breakdown */}
      <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border-light pb-3">
          <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide">
            3-Hour Storm Profile & Hydrograph Curve
          </h3>
          <span className="label-mono text-[10px]">15-MIN INTERVALS</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-13 gap-2 text-center text-xs font-mono">
          {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map((step) => {
            const stepRain = Math.max(4.0, Math.round(78.5 * Math.exp(-Math.pow(step - 45.0, 2) / 1800.0) * 10) / 10);
            const isCurrent = step === horizonMin;
            return (
              <button
                key={step}
                onClick={() => setHorizonMin(step)}
                className={`p-2.5 rounded-md border text-left transition-all ${
                  isCurrent
                    ? "bg-accent-black text-white border-accent-black"
                    : "bg-cream-alt border-border-light hover:border-border-medium"
                }`}
              >
                <div className="text-[10px] text-text-muted">+{step}m</div>
                <div className="font-bold mt-1">{stepRain.toFixed(0)}</div>
                <div className="text-[9px] text-text-secondary truncate">mm/h</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hydraulic Node Modal */}
      {selectedNode && (
        <NodeDiagnostic
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onCalibrateClogging={(code, ratio) => updateParameters({ cloggingRatio: ratio })}
        />
      )}
    </div>
  );
}

