"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, triggerRefresh, activeNodesCount } = useSimulation();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", badge: null },
    { label: "Radar Nowcast", href: "/nowcast", badge: "0-3H" },
    { label: "Drainage GIS Map", href: "/drainage-graph", badge: `${activeNodesCount} MH` },
    { label: "Safe Routing", href: "/routing", badge: null },
    { label: "Reports & History", href: "/reports", badge: null },
    { label: "Model Parameters", href: "/settings", badge: null },
  ];

  return (
    <aside className="w-64 border-r border-border-light p-4 flex flex-col justify-between shrink-0 bg-cream min-h-[calc(100vh-64px)]">
      <div className="space-y-4">
        {/* Workspace Card */}
        <div className="bg-white border border-border-light rounded-md p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent-black text-white flex items-center justify-center font-bold text-xs font-mono">
            JK
          </div>
          <div className="overflow-hidden">
            <div className="font-semibold text-text-primary text-xs truncate">
              Main Space
            </div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider truncate">
              DELHI CATCHMENT (SIH)
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={triggerRefresh}
          className="w-full bg-accent-black text-white rounded-md py-2.5 px-3 flex items-center justify-between text-xs font-semibold hover:opacity-85 transition-opacity font-mono"
        >
          <span>SIMULATE STORM</span>
          <span className="w-5 h-5 rounded bg-[#262626] text-text-muted text-[10px] flex items-center justify-center font-mono">
            c
          </span>
        </button>

        {/* Navigation Menu */}
        <div className="pt-2">
          <div className="label-mono px-3 mb-2">
            Workspace
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-item flex items-center justify-between ${isActive ? "active" : ""}`}
                >
                  <span className="text-xs">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-cream-alt px-1.5 py-0.5 rounded text-text-muted font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="pt-4 border-t border-border-light flex items-center justify-between bg-white border border-border-light rounded-md p-2.5">
        <Link href="/settings?tab=account" className="flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 rounded-full bg-accent-orange-light text-accent-orange flex items-center justify-center font-bold text-xs border border-accent-orange/30 shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="truncate">
            <div className="text-xs font-medium text-text-primary truncate">
              {user.name}
            </div>
            <div className="text-[10px] text-text-muted truncate">
              {user.organization}
            </div>
          </div>
        </Link>
        <Link
          href="/settings"
          className="label-mono text-[10px] hover:text-text-primary cursor-pointer shrink-0"
        >
          CFG
        </Link>
      </div>
    </aside>
  );
}

