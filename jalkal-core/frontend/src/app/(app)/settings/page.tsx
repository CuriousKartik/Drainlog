"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSimulation } from "@/context/SimulationContext";
import { LoadingCard, ErrorStateCard } from "@/components/StateFeedback";

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "parameters";

  const {
    parameters,
    updateParameters,
    resetParameters,
    peakWaterDepthCm,
    user,
    updateUser,
    dataSources,
    reconnectSource,
    isSimulating,
    hasError,
    triggerRefresh,
  } = useSimulation();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Account form fields
  const [name, setName] = useState(user.name);
  const [organization, setOrganization] = useState(user.organization);
  const [email, setEmail] = useState(user.email);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passError, setPassError] = useState<string | null>(null);

  if (isSimulating) {
    return <LoadingCard message="Updating hydraulic simulation constants and reloading DAG..." />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title="Settings Sync Error"
        description="Could not persist model constants to backend configuration."
        onRetry={triggerRefresh}
      />
    );
  }

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    if (newPass && newPass !== confirmPass) {
      setPassError("New password and confirmation do not match.");
      return;
    }
    updateUser({ name, organization, email });
    setSaveToast("Account profile updated successfully.");
    setTimeout(() => setSaveToast(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="heading-display text-4xl text-text-primary tracking-tight">
          System Settings
        </h1>
        <p className="text-text-secondary text-sm mt-1 font-sans">
          Configure hydraulic engineering parameters, agency credentials, and geospatial telemetry feeds.
        </p>
      </div>

      {saveToast && (
        <div className="p-3 bg-status-success-bg border border-status-success-text/30 text-status-success-text rounded-md text-xs font-mono">
          {saveToast}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-border-light gap-2 font-mono text-xs">
        <button
          onClick={() => setActiveTab("parameters")}
          className={`pb-3 px-4 font-semibold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === "parameters"
              ? "border-accent-orange text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Model Parameters
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`pb-3 px-4 font-semibold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === "account"
              ? "border-accent-orange text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Account Profile
        </button>
        <button
          onClick={() => setActiveTab("datasources")}
          className={`pb-3 px-4 font-semibold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === "datasources"
              ? "border-accent-orange text-text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Data Sources
        </button>
      </div>

      {/* TAB 1: Model Parameters */}
      {activeTab === "parameters" && (
        <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-border-light pb-3">
            <div>
              <h2 className="font-bold text-base text-text-primary">
                Hydraulic Simulation Parameters
              </h2>
              <p className="text-xs text-text-secondary mt-0.5 font-sans">
                Modifying these parameters immediately live-recomputes all street water depths.
              </p>
            </div>
            <button
              onClick={resetParameters}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              RESET DEFAULTS
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {/* Pipe Clogging Coefficient alpha */}
            <div className="space-y-2 p-4 bg-cream-alt rounded-md border border-border-light">
              <div className="flex justify-between items-center">
                <label className="font-bold text-text-primary">
                  Conduit Clogging Ratio (alpha)
                </label>
                <span className="font-bold text-accent-orange text-sm">
                  {parameters.cloggingRatio.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary font-sans">
                Fraction of drainage conduit cross-section obstructed by silt and debris [0.0 = clear, 1.0 = blocked].
              </p>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={parameters.cloggingRatio}
                onChange={(e) => updateParameters({ cloggingRatio: parseFloat(e.target.value) })}
                className="w-full accent-accent-orange cursor-pointer"
              />
            </div>

            {/* Inlet Capacity */}
            <div className="space-y-2 p-4 bg-cream-alt rounded-md border border-border-light">
              <div className="flex justify-between items-center">
                <label className="font-bold text-text-primary">
                  Inlet Intake Capacity (m³/s)
                </label>
                <span className="font-bold text-text-primary text-sm">
                  {parameters.inletCapacity.toFixed(1)} m³/s
                </span>
              </div>
              <p className="text-[11px] text-text-secondary font-sans">
                Nominal stormwater runoff intake capacity per street catch-basin before orifice overflow occurs.
              </p>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.2"
                value={parameters.inletCapacity}
                onChange={(e) => updateParameters({ inletCapacity: parseFloat(e.target.value) })}
                className="w-full accent-accent-black cursor-pointer"
              />
            </div>

            {/* DEM Resolution */}
            <div className="space-y-2 p-4 bg-cream-alt rounded-md border border-border-light">
              <label className="font-bold text-text-primary block">
                Topographic DEM Resolution
              </label>
              <p className="text-[11px] text-text-secondary font-sans">
                CartoDEM cell grid resolution for street depression storage analysis.
              </p>
              <select
                value={parameters.demResolution}
                onChange={(e) => updateParameters({ demResolution: parseInt(e.target.value) })}
                className="w-full bg-white border border-border-medium rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none"
              >
                <option value={5}>5-Meter High-Precision LiDAR / Drone Grid</option>
                <option value={10}>10-Meter CartoDEM (Standard Municipal)</option>
                <option value={30}>30-Meter SRTM Coarse Grid</option>
              </select>
            </div>

            {/* Radar Refresh Interval */}
            <div className="space-y-2 p-4 bg-cream-alt rounded-md border border-border-light">
              <label className="font-bold text-text-primary block">
                Radar Ingest Interval
              </label>
              <p className="text-[11px] text-text-secondary font-sans">
                Doppler weather radar volume scan recurrence rate from IMD / NCMRWF.
              </p>
              <select
                value={parameters.radarInterval}
                onChange={(e) => updateParameters({ radarInterval: parseInt(e.target.value) })}
                className="w-full bg-white border border-border-medium rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none"
              >
                <option value={5}>5 Minutes (Rapid DWR Volume Scan)</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes (Standard Operational)</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-white border border-border-medium rounded-md flex justify-between items-center">
            <div>
              <div className="text-xs font-bold text-text-primary">
                Live Recomputed Peak Water Depth:
              </div>
              <div className="text-[11px] text-text-secondary">
                Under current alpha = {parameters.cloggingRatio.toFixed(2)} and intake cap = {parameters.inletCapacity.toFixed(1)} m³/s
              </div>
            </div>
            <div className="heading-display text-2xl text-accent-orange">
              {peakWaterDepthCm.toFixed(1)} cm
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Account Profile */}
      {activeTab === "account" && (
        <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-6">
          <div className="border-b border-border-light pb-3">
            <h2 className="font-bold text-base text-text-primary">
              Operator Agency Profile
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-sans">
              Manage your credentials and municipal jurisdiction details.
            </p>
          </div>

          {passError && (
            <div className="p-3 rounded-md bg-status-error-bg border border-status-error-text/30 text-status-error-text text-xs">
              {passError}
            </div>
          )}

          <form onSubmit={handleSaveAccount} className="space-y-4 font-mono text-xs max-w-md">
            <div>
              <label className="label-mono block mb-1">Operator Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2 text-text-primary focus:outline-none focus:border-accent-black"
                required
              />
            </div>

            <div>
              <label className="label-mono block mb-1">Agency Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2 text-text-primary focus:outline-none focus:border-accent-black"
                required
              />
            </div>

            <div>
              <label className="label-mono block mb-1">Jurisdiction / Department</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2 text-text-primary focus:outline-none focus:border-accent-black"
                required
              />
            </div>

            <div className="pt-2 border-t border-border-light space-y-3">
              <div className="label-mono">Change Password (Optional)</div>
              <div>
                <label className="text-[11px] text-text-secondary block mb-1">New Password</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2 text-text-primary focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-secondary block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  className="w-full bg-cream-alt border border-border-medium rounded-md px-3.5 py-2 text-text-primary focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary text-xs py-2.5 px-6 font-semibold">
              SAVE CHANGES
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Data Sources */}
      {activeTab === "datasources" && (
        <div className="card bg-white border border-border-light rounded-lg p-6 shadow-sm space-y-6">
          <div className="border-b border-border-light pb-3">
            <h2 className="font-bold text-base text-text-primary">
              Geospatial Telemetry Data Sources
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 font-sans">
              Live status of external meteorological radar, elevation rasters, and municipal GIS layers.
            </p>
          </div>

          <div className="space-y-4 font-mono text-xs">
            {/* Radar Feed */}
            <div className="p-4 bg-cream-alt rounded-md border border-border-light flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <div className="font-bold text-text-primary">{dataSources.radar.name}</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Protocol: NetCDF4 / HDF5 Doppler Stream • Latency: {dataSources.radar.latency_ms} ms
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    dataSources.radar.status === "CONNECTED"
                      ? "badge-success text-[10px]"
                      : "badge-warning text-[10px]"
                  }
                >
                  {dataSources.radar.status}
                </span>
                <button
                  onClick={() => reconnectSource("radar")}
                  className="btn-secondary text-[10px] py-1 px-3"
                >
                  PING FEED
                </button>
              </div>
            </div>

            {/* DEM Raster */}
            <div className="p-4 bg-cream-alt rounded-md border border-border-light flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <div className="font-bold text-text-primary">{dataSources.dem.name}</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Protocol: Cloud-Optimized GeoTIFF (COG) • Latency: {dataSources.dem.latency_ms} ms
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    dataSources.dem.status === "CONNECTED"
                      ? "badge-success text-[10px]"
                      : "badge-warning text-[10px]"
                  }
                >
                  {dataSources.dem.status}
                </span>
                <button
                  onClick={() => reconnectSource("dem")}
                  className="btn-secondary text-[10px] py-1 px-3"
                >
                  PING FEED
                </button>
              </div>
            </div>

            {/* Shapefile */}
            <div className="p-4 bg-cream-alt rounded-md border border-border-light flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <div className="font-bold text-text-primary">{dataSources.shapefile.name}</div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  Protocol: PostGIS 3.4 Spatial Layer • Latency: {dataSources.shapefile.latency_ms} ms
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    dataSources.shapefile.status === "CONNECTED"
                      ? "badge-success text-[10px]"
                      : "badge-warning text-[10px]"
                  }
                >
                  {dataSources.shapefile.status}
                </span>
                <button
                  onClick={() => reconnectSource("shapefile")}
                  className="btn-secondary text-[10px] py-1 px-3"
                >
                  PING FEED
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingCard message="Loading settings..." />}>
      <SettingsContent />
    </Suspense>
  );
}


