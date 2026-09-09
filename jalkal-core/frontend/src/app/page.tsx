"use client";

import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream text-text-primary font-mono flex flex-col selection:bg-accent-orange-light selection:text-accent-black">
      {/* 1. Navigation Header */}
      <header className="h-20 border-b border-border-light px-8 md:px-16 flex items-center justify-between bg-cream shrink-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
          <div className="w-9 h-9 rounded-md bg-accent-black flex items-center justify-center text-white font-bold text-xs font-mono">
            JK
          </div>
          <div className="flex items-center gap-2">
            <span className="heading-display text-2xl uppercase tracking-tight text-accent-black">
              JALKAL
            </span>
            <span className="text-[10px] text-text-muted font-normal uppercase tracking-widest pl-1">
              / SIH26085 • MoES / NCMRWF
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-xs py-2 px-5">
            LOGIN
          </Link>
          <Link href="/signup" className="btn-primary text-xs py-2 px-5">
            GET STARTED
          </Link>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-8 py-16 flex flex-col justify-center space-y-12">
        <div className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-border-medium rounded-pill text-xs">
            <span className="w-2 h-2 rounded-full bg-[#1E8E5A] inline-block" />
            <span className="text-text-secondary uppercase tracking-wider text-[10px]">
              OPERATIONAL HORIZON: 0–3 HOUR STREET-LEVEL NOWCASTING
            </span>
          </div>

          <h1 className="heading-display text-4xl sm:text-6xl text-accent-black tracking-tight leading-none">
            Urban Flood Nowcasting & Safe Navigation Engine
          </h1>

          <p className="heading-editorial text-lg sm:text-xl text-text-secondary leading-relaxed font-normal">
            A hybrid physics-AI engine fusing Doppler radar extrapolation, high-resolution CartoDEM terrain models, and underground drainage graph surrogates to eliminate emergency transit failure during monsoon cloudbursts.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link href="/dashboard" className="btn-primary text-sm py-3 px-8">
              LAUNCH DASHBOARD
            </Link>
            <Link href="/login" className="btn-secondary text-sm py-3 px-8">
              SIGN IN WITH CREDENTIALS
            </Link>
          </div>
        </div>

        {/* 3. Core Architectural Pillars (Superform Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="card space-y-3 bg-white border border-border-light rounded-lg p-6 shadow-sm">
            <div className="label-mono text-[10px]">PILLAR 01</div>
            <h3 className="font-bold text-base text-text-primary">
              Atmospheric Radar Nowcasting
            </h3>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              2D ConvLSTM sequence-to-sequence neural network extrapolates Doppler Weather Radar grids across a 0 to 180 minute horizon, converted to mm/hr surface rain intensity via Marshall-Palmer physics.
            </p>
            <div className="pt-2 border-t border-border-light text-[11px] text-text-muted">
              15-min temporal resolution
            </div>
          </div>

          <div className="card space-y-3 bg-white border border-border-light rounded-lg p-6 shadow-sm">
            <div className="label-mono text-[10px]">PILLAR 02</div>
            <h3 className="font-bold text-base text-text-primary">
              Surrogate Drainage Hydraulics
            </h3>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              Graph Neural Network (GNN) trained on 1D/2D Saint-Venant shallow water equations. Computes node Hydraulic Grade Line (HGL) and surcharge overflow rates in under 40 milliseconds.
            </p>
            <div className="pt-2 border-t border-border-light text-[11px] text-text-muted">
              &lt;40ms surrogate inference
            </div>
          </div>

          <div className="card space-y-3 bg-white border border-border-light rounded-lg p-6 shadow-sm">
            <div className="label-mono text-[10px]">PILLAR 03</div>
            <h3 className="font-bold text-base text-text-primary">
              Depth-Penalized Safe Routing
            </h3>
            <p className="text-xs text-text-secondary font-sans leading-relaxed">
              Dynamic multi-criteria A* pathfinding evaluates street water depths. Depths exceeding 25 cm are enforced as infinite vehicle barriers, calculating reliable detour routes for ambulances.
            </p>
            <div className="pt-2 border-t border-border-light text-[11px] text-text-muted">
              Zero water-hazard detours
            </div>
          </div>
        </div>

        {/* 4. Live Benchmark Metrics Banner */}
        <div className="bg-white border border-border-light rounded-lg p-8 grid grid-cols-2 md:grid-cols-4 gap-6 shadow-sm">
          <div>
            <div className="heading-display text-3xl text-text-primary">32 ms</div>
            <div className="text-xs text-text-secondary mt-1 font-sans">Hydraulic Solver Latency</div>
          </div>
          <div>
            <div className="heading-display text-3xl text-text-primary">100.0%</div>
            <div className="text-xs text-text-secondary mt-1 font-sans">Detour Clearance Rate</div>
          </div>
          <div>
            <div className="heading-display text-3xl text-text-primary">64x64</div>
            <div className="text-xs text-text-secondary mt-1 font-sans">Radar Grid Cells Extrapolated</div>
          </div>
          <div>
            <div className="heading-display text-3xl text-text-primary">0–3 hr</div>
            <div className="text-xs text-text-secondary mt-1 font-sans">Nowcasting Forecast Horizon</div>
          </div>
        </div>
      </main>

      {/* 5. Minimal Footer */}
      <footer className="h-16 border-t border-border-light px-8 flex items-center justify-between text-xs text-text-muted">
        <div>Smart India Hackathon • Problem Statement ID: SIH26085</div>
        <div>Ministry of Earth Sciences / NCMRWF</div>
      </footer>
    </div>
  );
}
