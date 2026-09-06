"use client";

import React, { useState } from "react";
import { useSimulation, NodeHydraulics } from "@/context/SimulationContext";
import NodeDiagnostic from "@/components/NodeDiagnostic";
import { LoadingCard, ErrorStateCard } from "@/components/StateFeedback";

export default function DrainageGraphPage() {
  const {
    nodes,
    parameters,
    updateParameters,
    selectedNode,
    setSelectedNode,
    isSimulating,
    hasError,
    triggerRefresh,
  } = useSimulation();

  if (isSimulating) {
    return <LoadingCard message="Constructing underground drainage directed acyclic graph..." />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title="Graph Topology Error"
        description="Could not resolve node-conduit connectivity. Please retry."
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
            Drainage Network Graph
          </h1>
          <p className="text-text-secondary text-sm mt-1 font-sans">
            Underground stormwater conduits, manhole invert elevations, and Saint-Venant continuity surcharge heads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-success text-xs">GNN SURROGATE SOLVER</span>
          <span className="badge-warning text-xs">ALPHA = {parameters.cloggingRatio.toFixed(2)}</span>
        </div>
      </div>

      {/* Visual Drainage Network Graph (Interactive SVG Canvas) */}
      <div className="card bg-white border border-border-light rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border-light pb-3">
          <div>
            <h2 className="font-bold text-base text-text-primary">
              Topological Drainage Graph Layout
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-sans">
              Click any manhole node to inspect Hydraulic Grade Line (HGL) vs Ground Surface elevation.
            </p>
          </div>
          <div className="label-mono text-[10px]">CLICK TO INSPECT NODE</div>
        </div>

        <div className="relative w-full h-[380px] bg-cream-alt rounded-md border border-border-light overflow-hidden">
          <svg width="100%" height="100%" viewBox="0 0 840 360" className="block">
            <defs>
              <pattern id="graph-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#ECE7DC" stroke-width="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#graph-grid)" />

            {/* Underground Conduits (Pipes) */}
            <g id="conduit-lines">
              <line x1="150" y1="120" x2="280" y2="170" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
              <line x1="280" y1="170" x2="390" y2="240" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
              {/* Clogged Culvert into Minto */}
              <line
                x1="390"
                y1="240"
                x2="550"
                y2="120"
                stroke={parameters.cloggingRatio > 0.3 ? "#D64545" : "#111111"}
                strokeWidth={parameters.cloggingRatio > 0.3 ? "7" : "5"}
                strokeLinecap="round"
              />
              <line x1="390" y1="240" x2="570" y2="280" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
              <line x1="570" y1="280" x2="690" y2="200" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
              <line x1="690" y1="200" x2="550" y2="120" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
            </g>

            {/* Manhole Inlets */}
            {nodes.map((n) => {
              const cx = (n.x / 900) * 800 + 40;
              const cy = (n.y / 420) * 320 + 20;
              const isSelected = selectedNode?.id === n.id;

              return (
                <g
                  key={n.id}
                  onClick={() => setSelectedNode(n)}
                  className="cursor-pointer group"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={n.is_surcharging ? 14 : 11}
                    fill={n.is_surcharging ? "#D64545" : "#111111"}
                    stroke={isSelected ? "#E8863A" : "#FAF7F0"}
                    strokeWidth={isSelected ? 4 : 2}
                  />
                  <text
                    x={cx}
                    y={cy + 24}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="700"
                    fill={n.is_surcharging ? "#D64545" : "#111111"}
                  >
                    {n.node_code.replace("MH_", "")}
                  </text>
                  <text
                    x={cx}
                    y={cy + 36}
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="monospace"
                    fill="#6B6B6B"
                  >
                    HGL: {n.hgl.toFixed(1)}m
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Quick instructions floating badge */}
          <div className="absolute bottom-3 left-3 bg-white border border-border-light rounded-md px-3 py-1.5 text-[11px] font-mono shadow-sm">
            <span className="text-text-secondary">Selected Node: </span>
            <span className="font-bold text-text-primary">
              {selectedNode ? selectedNode.node_code : "None (Click any manhole)"}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Manhole Infiltration & Pressure Head Table */}
      <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border-light pb-3">
          <div>
            <h2 className="font-bold text-base text-text-primary">
              Hydraulic Nodes Diagnostic Inventory
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-sans">
              Saint-Venant surcharge calculations computed by the offline-trained Hydraulic GNN surrogate model.
            </p>
          </div>
          <span className="label-mono text-[10px]">{nodes.length} INLETS MONITORED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-light text-text-secondary text-[10px] uppercase">
                <th className="py-2.5 px-3">Node Code</th>
                <th className="py-2.5 px-3">Sub-Catchment Area</th>
                <th className="py-2.5 px-3">Ground Z</th>
                <th className="py-2.5 px-3">Invert Z</th>
                <th className="py-2.5 px-3">Predicted HGL</th>
                <th className="py-2.5 px-3">Surcharge (Q)</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr
                  key={n.id}
                  className={`border-b border-border-light hover:bg-cream-alt/60 transition-colors ${
                    n.is_surcharging ? "bg-status-error-bg/30" : ""
                  }`}
                >
                  <td className="py-3 px-3 font-semibold text-text-primary">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full inline-block ${
                          n.is_surcharging ? "bg-[#D64545]" : "bg-accent-black"
                        }`}
                      />
                      <span>{n.node_code}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-text-secondary">{n.basin_area} m²</td>
                  <td className="py-3 px-3 text-text-secondary">{n.z_ground.toFixed(2)} m</td>
                  <td className="py-3 px-3 text-text-secondary">{n.z_invert.toFixed(2)} m</td>
                  <td className="py-3 px-3 font-bold text-text-primary">
                    {n.hgl.toFixed(2)} m
                  </td>
                  <td className="py-3 px-3 font-bold">
                    {n.surcharge_m3s > 0 ? (
                      <span className="text-[#D64545]">{n.surcharge_m3s.toFixed(3)} m³/s</span>
                    ) : (
                      <span className="text-text-muted">0.000 m³/s</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedNode(n)}
                      className="btn-secondary text-[10px] py-1 px-3"
                    >
                      INSPECT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

