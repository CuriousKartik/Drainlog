"use client";

import React, { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, CloudRain, Clock } from "lucide-react";

interface TimeScrubberProps {
  currentHorizon: number;
  onChangeHorizon: (horizon: number) => void;
  rainfallRate: number;
}

const HORIZONS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];

export default function TimeScrubber({
  currentHorizon,
  onChangeHorizon,
  rainfallRate,
}: TimeScrubberProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        const next = currentHorizon + 15;
        onChangeHorizon(next > 180 ? 0 : next);
      }, 1800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentHorizon, onChangeHorizon]);

  return (
    <div className="bg-white border border-border-light rounded-lg p-4 shadow-sm flex flex-col gap-3 font-mono">
      {/* Upper Status Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cream-alt flex items-center justify-center text-text-primary">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="label-mono">
              Temporal Horizon
            </div>
            <div className="text-base font-bold text-text-primary flex items-center gap-2">
              <span>T + {currentHorizon} MIN</span>
              <span className="text-[11px] px-2 py-0.5 rounded-pill bg-cream-alt text-text-secondary font-medium">
                {currentHorizon === 0 ? "LIVE RADAR" : `+${(currentHorizon / 60).toFixed(2)} HRS`}
              </span>
            </div>
          </div>
        </div>

        {/* Rain Intensity Gauge */}
        <div className="flex items-center gap-2.5 bg-cream-alt px-3.5 py-1.5 rounded-pill border border-border-light">
          <CloudRain className={`w-4 h-4 ${rainfallRate > 50 ? "text-accent-orange" : "text-text-primary"}`} />
          <div className="text-xs">
            <span className="text-text-secondary uppercase text-[10px] mr-1.5">Rain Rate:</span>
            <span className="font-bold text-text-primary">
              {rainfallRate.toFixed(1)} mm/hr
            </span>
          </div>
          {rainfallRate > 60 && (
            <span className="badge-warning text-[10px] py-0 px-2">
              CLOUDBURST
            </span>
          )}
        </div>
      </div>

      {/* Slider Controls & Tick Marks */}
      <div className="space-y-2 pt-1 border-t border-border-light">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-pill bg-accent-black text-white hover:opacity-85 transition-opacity flex items-center justify-center shrink-0"
            title={isPlaying ? "Pause Simulation" : "Play Simulation"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              onChangeHorizon(0);
            }}
            className="w-8 h-8 rounded-pill bg-white border border-border-medium hover:bg-cream-alt text-text-secondary flex items-center justify-center shrink-0 transition-colors"
            title="Reset to T+0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={0}
            max={180}
            step={15}
            value={currentHorizon}
            onChange={(e) => {
              setIsPlaying(false);
              onChangeHorizon(Number(e.target.value));
            }}
            className="w-full h-1.5 bg-border-medium rounded-pill appearance-none cursor-pointer accent-accent-orange"
          />
        </div>

        {/* Step intervals markers */}
        <div className="flex justify-between px-16 text-[11px] text-text-secondary">
          {HORIZONS.map((h) => (
            <button
              key={h}
              onClick={() => {
                setIsPlaying(false);
                onChangeHorizon(h);
              }}
              className={`hover:text-text-primary transition-colors ${
                currentHorizon === h ? "text-accent-orange font-bold underline underline-offset-4" : ""
              }`}
            >
              +{h}m
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
