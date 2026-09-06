"use client";

import React from "react";

export function LoadingCard({ message = "Computing 2D Saint-Venant hydraulic balance..." }: { message?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center bg-white border border-border-light rounded-lg">
      <div className="w-8 h-8 rounded-full border-2 border-border-medium border-t-accent-black animate-spin mb-4" />
      <div className="label-mono mb-1">Processing Telemetry</div>
      <p className="text-xs text-text-secondary font-mono">{message}</p>
    </div>
  );
}

export function EmptyStateCard({
  title = "No Inundation Recorded",
  description = "All catchments within this basin are currently operating below street surcharge thresholds.",
  actionText,
  onAction,
}: {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center bg-white border border-border-light rounded-lg">
      <div className="w-10 h-10 rounded-pill bg-cream-alt flex items-center justify-center mb-3 font-mono font-bold text-xs text-text-secondary border border-border-light">
        0
      </div>
      <h3 className="font-bold text-sm text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm mb-4 font-sans">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-secondary text-xs py-2 px-4">
          {actionText}
        </button>
      )}
    </div>
  );
}

export function ErrorStateCard({
  title = "Hydraulic Solver Error",
  description = "A communication or convergence anomaly occurred while evaluating node pressure heads.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <div className="card flex flex-col items-center justify-center p-12 text-center bg-white border border-status-error-text/30 rounded-lg">
      <div className="badge-error text-xs mb-3 py-1 px-3">
        [FAULT DETECTED]
      </div>
      <h3 className="font-bold text-sm text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm mb-4 font-mono">{description}</p>
      <button onClick={onRetry} className="btn-primary text-xs py-2 px-4">
        RETRY CALCULATION
      </button>
    </div>
  );
}

