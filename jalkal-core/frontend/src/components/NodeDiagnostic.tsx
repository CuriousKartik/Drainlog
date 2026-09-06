"use client";

import React from "react";
import { X, Activity, Droplets, Gauge, AlertOctagon, Check } from "lucide-react";

interface NodeDiagnosticProps {
  node: any;
  onClose: () => void;
  onCalibrateClogging?: (conduitCode: string, ratio: number) => void;
}

export default function NodeDiagnostic({
  node,
  onClose,
  onCalibrateClogging,
}: NodeDiagnosticProps) {
  if (!node) return null;

  const hgl = Number(node.hgl || 215.0);
  const zGround = Number(node.z_ground || 214.5);
  const zInvert = Number(node.z_invert || 212.0);
  const surchargeQ = Number(node.surcharge_flow_m3s || 0.0);
  const streetDepthCm = Number(node.street_depth_cm || 0.0);
  const isSurcharging = node.is_surcharging || hgl > zGround;

  const totalDepth = Math.max(0.1, zGround - zInvert);
  const waterLevelAboveInvert = Math.max(0, hgl - zInvert);
  const percentage = Math.min(100, Math.round((waterLevelAboveInvert / totalDepth) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-mono">
      <div className="bg-white border border-border-light rounded-lg w-full max-w-lg p-6 shadow-xl relative text-xs">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-text-secondary hover:text-text-primary rounded-full hover:bg-cream-alt transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-border-light pb-4">
          <div className="w-10 h-10 rounded-pill bg-cream-alt flex items-center justify-center text-text-primary">
            <Gauge className="w-5 h-5 text-accent-orange" />
          </div>
          <div>
            <div className="label-mono">
              Hydraulic Diagnostic
            </div>
            <div className="text-base font-bold text-text-primary flex items-center gap-2">
              <span>{node.node_code || "MH_DIAGNOSTIC_NODE"}</span>
              {isSurcharging ? (
                <span className="badge-error text-[10px]">
                  <AlertOctagon className="w-3 h-3" /> SURCHARGING
                </span>
              ) : (
                <span className="badge-success text-[10px]">
                  <Check className="w-3 h-3" /> NORMAL
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Editorial Subtitle */}
        <div className="mt-3 text-text-secondary">
          <p className="heading-editorial text-xs">
            Dynamic Saint-Venant GNN surrogate reading for catchment inlet.
          </p>
        </div>

        {/* Water Level Profile */}
        <div className="my-4 bg-cream-alt p-4 rounded-md border border-border-light flex items-center gap-6">
          {/* Vertical Manhole Profile */}
          <div className="relative w-12 h-36 bg-white rounded-md border border-border-medium overflow-hidden flex flex-col justify-end shrink-0">
            <div
              className={`w-full transition-all duration-300 ${
                isSurcharging ? "bg-[#D64545]" : "bg-accent-orange"
              }`}
              style={{ height: `${percentage}%` }}
            />
            {/* Ground Rim Line */}
            <div className="absolute top-4 left-0 right-0 border-t border-dashed border-text-primary pointer-events-none" />
          </div>

          {/* Elevation Metrics */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center text-text-secondary">
              <span>Hydraulic Grade Line (HGL):</span>
              <span className="font-bold text-text-primary">{hgl.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center text-text-secondary">
              <span>Ground Elevation (z_ground):</span>
              <span className="font-medium text-text-primary">{zGround.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center text-text-secondary">
              <span>Invert Elevation (z_invert):</span>
              <span className="font-medium text-text-secondary">{zInvert.toFixed(2)} m</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border-medium">
              <span className="font-medium text-text-primary">Surface Surcharge Head:</span>
              <span
                className={`font-bold ${
                  hgl > zGround ? "text-[#D64545]" : "text-status-success-text"
                }`}
              >
                {hgl > zGround ? `+${(hgl - zGround).toFixed(2)} m` : "0.00 m"}
              </span>
            </div>
          </div>
        </div>

        {/* Discharge Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-3 rounded-md border border-border-light">
            <div className="label-mono flex items-center gap-1.5 text-[10px]">
              <Droplets className="w-3.5 h-3.5 text-accent-orange" /> Surcharge Flow (Q)
            </div>
            <div className="text-xl font-bold text-text-primary mt-1">
              {surchargeQ.toFixed(3)} <span className="text-xs text-text-muted font-normal">m³/s</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5">
              C_d · A · √(2gΔh)
            </div>
          </div>

          <div className="bg-white p-3 rounded-md border border-border-light">
            <div className="label-mono flex items-center gap-1.5 text-[10px]">
              <Activity className="w-3.5 h-3.5 text-text-primary" /> Street Depth
            </div>
            <div
              className={`text-xl font-bold mt-1 ${
                streetDepthCm > 25.0
                  ? "text-[#D64545]"
                  : streetDepthCm > 10.0
                  ? "text-accent-orange"
                  : "text-status-success-text"
              }`}
            >
              {streetDepthCm.toFixed(1)} <span className="text-xs text-text-muted font-normal">cm</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 uppercase">
              {streetDepthCm > 25 ? "Impassable" : streetDepthCm > 10 ? "Slow" : "Passable"}
            </div>
          </div>
        </div>

        {/* CCTV Dynamic Calibration Trigger */}
        <div className="bg-cream-alt p-3.5 rounded-md border border-border-light flex items-center justify-between">
          <div>
            <div className="font-semibold text-text-primary text-xs">CCTV Dynamic Feedback</div>
            <div className="text-[11px] text-text-secondary">
              Simulate edge traffic camera setting clogging factor α = 0.65
            </div>
          </div>
          <button
            onClick={() => {
              if (onCalibrateClogging) {
                onCalibrateClogging(node.node_code, 0.65);
              }
              onClose();
            }}
            className="btn-secondary text-[11px] py-1.5 px-3.5 shrink-0"
          >
            Trigger α=0.65
          </button>
        </div>
      </div>
    </div>
  );
}
