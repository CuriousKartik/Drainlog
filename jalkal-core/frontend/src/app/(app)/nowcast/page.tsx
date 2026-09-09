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
    nodes,
    roads,
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

  // Generate GeoJSON payload for MapViewport
  const geojsonData = {
    type: "FeatureCollection",
    features: [
      ...roads.map((r, idx) => ({
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
      ...nodes.map((n) => ({
        type: "Feature",
        properties: {
          layer_type: "DRAIN_NODE",
          node_id: n.id,
          node_code: n.node_code,
          hgl: n.hgl,
          z_ground: n.z_ground,
          z_invert: n.z_invert,
          surcharge_flow_m3s: n.surcharge_m3s,
          street_depth_cm: n.street_depth_cm,
          is_surcharging: n.is_surcharging,
          elevation: Math.max(14, n.street_depth_cm * 2.5),
        },
        geometry: {
          type: "Point",
          coordinates: [77.2185 + (n.x / 900) * 0.008, 28.6328 + ((420 - n.y) / 420) * 0.005],
        },
      })),
    ],
  };

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

      {/* Dynamic Inundation Hydrograph & 95% Confidence Envelope (Modern Card Style) */}
      <div className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-black/[0.05] p-7 space-y-4">
        {/* Header without hard bottom border */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h3 className="font-bold text-sm md:text-base text-text-primary tracking-tight">
              Dynamic Inundation Hydrograph &amp; 95% Confidence Envelope
            </h3>
            <p className="text-xs text-text-muted mt-0.5 font-sans">
              Coupled Saint-Venant 1D-2D hydrograph forecasting depth with ensemble variance spread
            </p>
          </div>
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-semibold px-3 py-1 rounded-full tracking-wider whitespace-nowrap inline-flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] inline-block" />
            LEAD TIME DECORRELATION
          </span>
        </div>

        {/* Smooth SVG Hydrograph Curve */}
        <div className="h-48 w-full relative">
          <svg width="100%" height="100%" viewBox="0 0 800 170" preserveAspectRatio="none" className="overflow-visible">
            <defs>
              <linearGradient id="hydroStrokeGradReact" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="45%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>

              <linearGradient id="envelopeFillGradReact" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.16" />
                <stop offset="65%" stopColor="#6366F1" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Faint Horizontal Gridlines */}
            <line x1="40" y1="25" x2="760" y2="25" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
            <line x1="40" y1="65" x2="760" y2="65" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
            <line x1="40" y1="105" x2="760" y2="105" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
            <line x1="40" y1="145" x2="760" y2="145" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />

            {/* Y-Axis Labels */}
            <text x="32" y="29" fontSize="9" fill="#9CA3AF" textAnchor="end" fontFamily="sans-serif" fontWeight="450">75cm</text>
            <text x="32" y="69" fontSize="9" fill="#9CA3AF" textAnchor="end" fontFamily="sans-serif" fontWeight="450">50cm</text>
            <text x="32" y="109" fontSize="9" fill="#9CA3AF" textAnchor="end" fontFamily="sans-serif" fontWeight="450">25cm</text>
            <text x="32" y="149" fontSize="9" fill="#9CA3AF" textAnchor="end" fontFamily="sans-serif" fontWeight="450">0cm</text>

            {/* Smoothed 95% Confidence Envelope */}
            <path
              d="M 40.0,140.0 C 50.0,136.7 80.0,130.0 100.0,120.0 C 120.0,110.0 140.0,95.8 160.0,80.0 C 180.0,64.2 200.0,28.3 220.0,25.0 C 240.0,21.7 260.0,46.7 280.0,60.0 C 300.0,73.3 320.0,94.2 340.0,105.0 C 360.0,115.8 380.0,120.0 400.0,125.0 C 420.0,130.0 440.0,132.8 460.0,135.0 C 480.0,137.2 500.0,137.2 520.0,138.0 C 540.0,138.8 560.0,139.7 580.0,140.0 C 600.0,140.3 620.0,140.0 640.0,140.0 C 660.0,140.0 680.0,140.0 700.0,140.0 C 720.0,140.0 750.0,140.0 760.0,140.0 L 760.0,155.0 C 750.0,155.0 720.0,155.0 700.0,155.0 C 680.0,155.0 660.0,155.0 640.0,155.0 C 620.0,155.0 600.0,155.0 580.0,155.0 C 560.0,155.0 540.0,155.0 520.0,155.0 C 500.0,155.0 480.0,155.0 460.0,155.0 C 440.0,155.0 420.0,155.8 400.0,155.0 C 380.0,154.2 360.0,157.5 340.0,150.0 C 320.0,142.5 300.0,124.2 280.0,110.0 C 260.0,95.8 240.0,65.0 220.0,65.0 C 200.0,65.0 180.0,98.3 160.0,110.0 C 140.0,121.7 120.0,128.7 100.0,135.0 C 80.0,141.3 50.0,145.8 40.0,148.0 Z"
              fill="url(#envelopeFillGradReact)"
              stroke="none"
            />

            {/* Smoothed Hydrograph Curve */}
            <path
              d="M 40.0,144.0 C 50.0,141.3 80.0,136.2 100.0,128.0 C 120.0,119.8 140.0,108.8 160.0,95.0 C 180.0,81.2 200.0,46.7 220.0,45.0 C 240.0,43.3 260.0,71.2 280.0,85.0 C 300.0,98.8 320.0,118.8 340.0,128.0 C 360.0,137.2 380.0,137.2 400.0,140.0 C 420.0,142.8 440.0,143.8 460.0,145.0 C 480.0,146.2 500.0,146.5 520.0,147.0 C 540.0,147.5 560.0,147.8 580.0,148.0 C 600.0,148.2 620.0,148.0 640.0,148.0 C 660.0,148.0 680.0,148.0 700.0,148.0 C 720.0,148.0 750.0,148.0 760.0,148.0"
              fill="none"
              stroke="url(#hydroStrokeGradReact)"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Peak Squall Marker (T = 45m, x = 220, y = 45) */}
            <line x1="220" y1="18" x2="220" y2="152" stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" strokeDasharray="3,3" />
            <circle cx="220" cy="45" r="12" fill="#4F46E5" fillOpacity="0.14" stroke="#4F46E5" strokeOpacity="0.3" strokeWidth="1.2" />
            <circle cx="220" cy="45" r="5.5" fill="#4F46E5" stroke="#FFFFFF" strokeWidth="2" />

            {/* Dynamic Horizon Marker */}
            {horizonMin !== 45 && (
              <>
                <line x1={40 + (horizonMin / 180) * 720} y1="18" x2={40 + (horizonMin / 180) * 720} y2="152" stroke="rgba(79,70,229,0.3)" strokeWidth="1.2" strokeDasharray="3,3" />
                <circle cx={40 + (horizonMin / 180) * 720} cy={Math.max(25, 148 - (74.2 * Math.exp(-Math.pow(horizonMin - 45.0, 2) / 1600.0) / 74.2) * 103)} r="10" fill="#6366F1" fillOpacity="0.14" stroke="#6366F1" strokeOpacity="0.3" strokeWidth="1" />
                <circle cx={40 + (horizonMin / 180) * 720} cy={Math.max(25, 148 - (74.2 * Math.exp(-Math.pow(horizonMin - 45.0, 2) / 1600.0) / 74.2) * 103)} r="4.5" fill="#4F46E5" stroke="#FFFFFF" strokeWidth="2" />
              </>
            )}
          </svg>
        </div>

        {/* Faint Time Markers */}
        <div className="flex justify-between text-xs font-normal text-text-secondary pt-1 px-1 font-sans">
          <span>T = 0m (Current)</span>
          <span>T = 45m (Peak Squall)</span>
          <span>T = 90m (Post-Frontal)</span>
          <span>T = 180m (3-Hour Window)</span>
        </div>
      </div>

      {/* 15-Minute Interval Controls */}
      <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border-light pb-3">
          <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide">
            15-Minute Discrete Forecast Intervals
          </h3>
          <span className="label-mono text-[10px]">HYDROLOGIC TIME SCRUBBER</span>
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

