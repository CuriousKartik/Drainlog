"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, triggerRefresh } = useSimulation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [toolsOpen, setToolsOpen] = useState<boolean>(true);

  // Restore persistent state from localStorage on client mount
  useEffect(() => {
    try {
      const savedOpen = localStorage.getItem("jk_sidebar_open");
      if (savedOpen === "true") setIsOpen(true);
      const savedTools = localStorage.getItem("jk_tools_open");
      if (savedTools !== null) setToolsOpen(savedTools === "true");
    } catch (e) {}
  }, []);

  const handleSetOpen = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem("jk_sidebar_open", String(open));
    } catch (e) {}
  };

  const handleToggleTools = () => {
    setToolsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("jk_tools_open", String(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isInitialMount = useRef(true);

  // Close sidebar on Escape key press, or toggle with F key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleSetOpen(false);
      } else if (
        (e.key === "f" || e.key === "F") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (document.activeElement as HTMLElement)?.tagName
        )
      ) {
        e.preventDefault();
        handleSetOpen(!isOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Manage accessibility focus
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isOpen) {
      closeButtonRef.current?.focus();
    } else {
      toggleButtonRef.current?.focus();
    }
  }, [isOpen]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", badge: "LIVE" },
    { label: "Radar Nowcast", href: "/nowcast", badge: "LIVE" },
    { label: "Causal Pipeline", href: "/causal-chain", badge: "LIVE" },
    { label: "Drainage GIS Map", href: "/drainage-graph", badge: "LIVE" },
    { label: "Conduit Transect", href: "/hydraulic-transect", badge: "LIVE" },
    { label: "Safe Routing", href: "/routing", badge: "LIVE" },
    { label: "Reports & History", href: "/reports", badge: "LIVE" },
    { label: "Navigation API", href: "/api-docs", badge: "LIVE" },
    { label: "Model Parameters", href: "/settings", badge: "LIVE" },
  ];

  return (
    <>
      {/* Fixed Toggle Button (Shown when sidebar is closed) */}
      {!isOpen && (
        <button
          ref={toggleButtonRef}
          onClick={() => handleSetOpen(true)}
          aria-label="Open sidebar"
          aria-expanded={false}
          title="Open Navigation"
          className="fixed top-2.5 left-3 z-[1500] w-[44px] h-[44px] rounded-md bg-white border border-border-light shadow-sm hover:bg-cream-alt flex items-center justify-center text-text-primary transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-black"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Semi-transparent Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={() => handleSetOpen(false)}
          className="fixed inset-0 bg-black/40 z-[2000] transition-opacity backdrop-blur-[1px]"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 2000,
          }}
          aria-hidden="true"
        />
      )}

      {/* Off-Canvas Sidebar */}
      <aside
        ref={sidebarRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 2100,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
        className="w-72 max-w-[85vw] border-r border-border-light p-4 flex flex-col justify-between bg-cream shadow-2xl overflow-y-auto z-[2100]"
      >
        <div className="space-y-4">
          {/* Workspace Card Header with Close (X) Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="bg-white border border-border-light rounded-md p-2.5 flex items-center gap-3 flex-1 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-accent-black text-white flex items-center justify-center font-bold text-xs font-mono shrink-0">
                JK
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-text-primary text-xs truncate">
                  Delhi Basin
                </div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider truncate">
                  CONNAUGHT & MINTO
                </div>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={() => handleSetOpen(false)}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="w-8 h-8 rounded-md bg-white border border-border-light hover:bg-cream-alt text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-accent-black"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
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

          {/* Navigation Menu under Single Collapsible Button */}
          <div className="pt-1">
            <button
              onClick={handleToggleTools}
              className={`w-full flex items-center justify-between p-2.5 rounded-md border text-xs font-bold font-mono transition-all whitespace-nowrap bg-white text-text-primary shadow-sm hover:bg-cream-alt ${
                toolsOpen ? "border-accent-black" : "border-border-light hover:border-border-medium"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E8E5A] shrink-0 inline-block" />
                <span className="whitespace-nowrap">SCIENTIFIC TOOLS</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-green-100 text-green-800 font-bold whitespace-nowrap">
                  9 LIVE
                </span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-text-secondary transition-transform duration-200 shrink-0 ${toolsOpen ? "rotate-180" : "rotate-0"}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {toolsOpen && (
              <nav className="mt-2 space-y-1 pl-2 border-l-2 border-border-medium">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        if (typeof window !== "undefined" && window.innerWidth < 1024) {
                          handleSetOpen(false);
                        }
                      }}
                      className={`sidebar-item flex items-center justify-between py-1.5 px-2 rounded text-xs ${isActive ? "active font-bold bg-white" : "hover:bg-cream-alt"}`}
                    >
                      <span>{item.label}</span>
                      <span className="text-[9px] bg-green-100 text-green-800 px-1 rounded font-mono">
                        LIVE
                      </span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </div>

        {/* User Profile Card */}
        <div className="pt-4 border-t border-border-light flex items-center justify-between bg-white border border-border-light rounded-md p-2.5">
          <Link
            href="/settings?tab=account"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                handleSetOpen(false);
              }
            }}
            className="flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition-opacity"
          >
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
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                handleSetOpen(false);
              }
            }}
            className="label-mono text-[10px] hover:text-text-primary cursor-pointer shrink-0"
          >
            CFG
          </Link>
        </div>
      </aside>
    </>
  );
}
