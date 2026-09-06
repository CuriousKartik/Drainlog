"use client";

import React, { useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { LoadingCard, ErrorStateCard } from "@/components/StateFeedback";

export default function ReportsPage() {
  const {
    rainfallRate,
    peakWaterDepthCm,
    parameters,
    nodes,
    roads,
    isSimulating,
    hasError,
    triggerRefresh,
  } = useSimulation();

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  if (isSimulating) {
    return <LoadingCard message="Compiling municipal hydrology audit and CSV export..." />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title="Report Generation Failed"
        description="Could not compile temporal summaries from current database horizon."
        onRetry={triggerRefresh}
      />
    );
  }

  const exportCSV = () => {
    const rows = [
      ["Segment_ID", "Road_Name", "Base_Elevation_AMSL", "Predicted_Depth_CM", "Status", "Safe_Speed_KMH"],
      ...roads.map((r) => [r.id, `"${r.name}"`, r.base_elevation, r.water_depth_cm, r.status, r.speed_kmh]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JalKal_Inundation_Report_T45m.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadNotice("CSV report exported successfully.");
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  const exportGeoJSON = () => {
    const geojson = {
      type: "FeatureCollection",
      name: "JalKal_Delhi_Inundation_Export",
      metadata: {
        timestamp: new Date().toISOString(),
        rainfall_intensity_mm_hr: rainfallRate,
        clogging_factor_alpha: parameters.cloggingRatio,
      },
      features: roads.map((r, idx) => ({
        type: "Feature",
        properties: {
          road_id: r.id,
          road_name: r.name,
          water_depth_cm: r.water_depth_cm,
          status: r.status,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [77.2185 + idx * 0.0015, 28.6328 - idx * 0.001],
            [77.2245 + idx * 0.0015, 28.636 - idx * 0.001],
          ],
        },
      })),
    };

    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonStr);
    link.setAttribute("download", `JalKal_Catchment_Layers.geojson`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadNotice("GeoJSON feature collection exported successfully.");
    setTimeout(() => setDownloadNotice(null), 3500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-4xl text-text-primary tracking-tight">
            Reports & Export
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-sans">
            Auto-generated municipal briefings, historical runoff curves, and GIS spatial data exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs py-2 px-4 font-mono">
            DOWNLOAD CSV
          </button>
          <button onClick={exportGeoJSON} className="btn-primary text-xs py-2 px-4 font-mono">
            EXPORT GEOJSON
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3 bg-status-success-bg border border-status-success-text/30 text-status-success-text rounded-md text-xs font-mono">
          {downloadNotice}
        </div>
      )}

      {/* Editorial Weekly / Tactical Briefing Card */}
      <div className="card bg-white border border-border-light rounded-lg p-8 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-border-light pb-4">
          <div>
            <div className="label-mono text-[10px]">EXECUTIVE ADVISORY</div>
            <h2 className="font-bold text-lg text-text-primary mt-0.5">
              Monsoon Storm Inundation Briefing
            </h2>
          </div>
          <span className="badge-warning text-xs">EVENT LOG: DELHI-CP-2026</span>
        </div>

        <p className="heading-editorial text-lg text-text-primary leading-relaxed">
          &ldquo;During the evaluated 0–3 hour forecast horizon, convective rainfall reached a maximum intensity of {rainfallRate.toFixed(1)} mm/hr over the Connaught Place basin. While primary residential roads sustained nominal gravity drainage, the Minto Railway Underpass accumulated a critical water depth of {peakWaterDepthCm.toFixed(1)} cm under dynamic conduit clogging ratio alpha = {parameters.cloggingRatio.toFixed(2)}. Transit dispatch models successfully routed 100.0% of simulated emergency ambulance runs over the Barakhamba Elevated Flyover, avoiding stalled vehicle risks.&rdquo;
        </p>

        <div className="pt-4 border-t border-dashed border-border-light text-xs text-text-secondary font-mono flex flex-col sm:flex-row justify-between gap-2">
          <span>REPORT SOURCE: JalKal Physics-AI Engine</span>
          <span>SPONSOR: Ministry of Earth Sciences / NCMRWF (SIH26085)</span>
        </div>
      </div>

      {/* Runoff & Conveyance Summary Table */}
      <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border-light pb-3">
          <h3 className="font-bold text-sm text-text-primary uppercase tracking-wide">
            Catchment Volumetric Infiltration Summary
          </h3>
          <span className="label-mono text-[10px]">SCS-CN METHOD (CN=98)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-light text-text-secondary text-[10px] uppercase">
                <th className="py-2.5 px-3">Parameter Description</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Standard Value</th>
                <th className="py-2.5 px-3 text-right">Effective Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-light">
                <td className="py-2.5 px-3 font-semibold">Precipitation Intensity</td>
                <td className="py-2.5 px-3 text-text-secondary">I(t)</td>
                <td className="py-2.5 px-3">{rainfallRate.toFixed(1)} mm/hr</td>
                <td className="py-2.5 px-3 text-right font-bold text-accent-orange">Cloudburst Level</td>
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2.5 px-3 font-semibold">SCS Curve Number (Asphalt Grid)</td>
                <td className="py-2.5 px-3 text-text-secondary">CN</td>
                <td className="py-2.5 px-3">98.0</td>
                <td className="py-2.5 px-3 text-right text-text-secondary">High Imperviousness</td>
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2.5 px-3 font-semibold">Dynamic Pipe Clogging Factor</td>
                <td className="py-2.5 px-3 text-text-secondary">alpha</td>
                <td className="py-2.5 px-3">{parameters.cloggingRatio.toFixed(2)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-[#D64545]">Debris Restricted</td>
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2.5 px-3 font-semibold">Inlet Intake Capacity</td>
                <td className="py-2.5 px-3 text-text-secondary">Q_cap</td>
                <td className="py-2.5 px-3">{parameters.inletCapacity.toFixed(1)} m³/s</td>
                <td className="py-2.5 px-3 text-right text-status-success-text font-bold">Operational</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Maximum Street Inundation</td>
                <td className="py-2.5 px-3 text-text-secondary">h_max</td>
                <td className="py-2.5 px-3">{peakWaterDepthCm.toFixed(1)} cm</td>
                <td className="py-2.5 px-3 text-right font-bold text-[#D64545]">Impassable Choke Point</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

