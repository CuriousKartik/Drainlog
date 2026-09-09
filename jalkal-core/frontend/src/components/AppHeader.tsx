"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";

export default function AppHeader() {
  const pathname = usePathname();
  const { logout, triggerRefresh, isSimulating, peakWaterDepthCm, dataSources } = useSimulation();

  const getPageTitle = () => {
    if (pathname?.includes("/dashboard")) return "Dashboard Overview";
    if (pathname?.includes("/nowcast")) return "Radar Nowcast & Timeline";
    if (pathname?.includes("/drainage-graph")) return "Drainage Network Graph";
    if (pathname?.includes("/routing")) return "Emergency Navigation";
    if (pathname?.includes("/reports")) return "Hydrology Reports & Export";
    if (pathname?.includes("/settings")) return "System Parameters & Settings";
    return "Operations Command";
  };

  return (
    <header className="h-16 border-b border-border-light pl-16 pr-8 flex items-center justify-between bg-cream shrink-0">
      {/* Brand & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-accent-black flex items-center justify-center text-white font-bold text-xs font-mono">
            JK
          </div>
          <span className="heading-display text-lg uppercase tracking-tight text-accent-black">
            JALKAL
          </span>
        </Link>
        <span className="text-border-medium font-mono">/</span>
        <span className="label-mono text-text-primary text-[11px] font-semibold">
          {getPageTitle()}
        </span>
      </div>

      {/* Real-Time Telemetry Indicator */}
      <div className="hidden md:flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-border-light rounded-pill">
          <span className="w-2 h-2 rounded-full bg-[#1E8E5A] inline-block" />
          <span className="text-text-secondary text-[11px]">RADAR FEED: ACTIVE</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-border-light rounded-pill">
          <span className="text-text-secondary text-[11px]">MAX PONDING:</span>
          <span className="font-bold text-text-primary text-[11px]">
            {peakWaterDepthCm.toFixed(1)} cm
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3 font-mono">
        <button
          onClick={triggerRefresh}
          className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
          title="Refresh Simulation State"
        >
          <span>{isSimulating ? "COMPUTING..." : "SYNC"}</span>
        </button>

        <Link
          href="/reports"
          className="btn-secondary text-xs py-2 px-4 hidden sm:inline-flex"
        >
          EXPORT
        </Link>

        <button
          onClick={logout}
          className="btn-secondary text-xs py-2 px-3 hover:text-[#D64545]"
          title="Sign Out"
        >
          EXIT
        </button>
      </div>
    </header>
  );
}

