"use client";

import React, { useState, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
// @ts-ignore
import { BitmapLayer } from "@deck.gl/layers";
// @ts-ignore
import { TileLayer } from "@deck.gl/geo-layers";

interface MapViewportProps {
  geojsonData: any;
  routeData: any;
  onSelectNode: (node: any) => void;
}

const INITIAL_VIEW_STATE = {
  longitude: 77.2230,
  latitude: 28.6335,
  zoom: 15,
  pitch: 0,
  bearing: 0,
  maxZoom: 20,
  minZoom: 10,
};

export default function MapViewport({
  geojsonData,
  routeData,
  onSelectNode,
}: MapViewportProps) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);

  // Extract features by layer type
  const { roads, manholes } = useMemo(() => {
    const rList: any[] = [];
    const mList: any[] = [];

    if (geojsonData?.features) {
      for (const f of geojsonData.features) {
        if (f.properties?.layer_type === "ROAD_SEGMENT") {
          rList.push(f);
        } else if (f.properties?.layer_type === "DRAIN_NODE") {
          mList.push(f);
        }
      }
    }
    return { roads: rList, manholes: mList };
  }, [geojsonData]);

  // Extract routes from routeData
  const routes = useMemo(() => {
    if (!routeData?.features) return [];
    return routeData.features.filter((f: any) => f.geometry?.type === "LineString");
  }, [routeData]);

  const layers = [
    // 0. High-Resolution Aerial Satellite Basemap (Esri World Imagery)
    new TileLayer({
      id: "esri-satellite-tiles",
      data: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: (props: any) => {
        const {
          bbox: { west, south, east, north },
        } = props.tile;

        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    }),

    // 1. Pass 1: Street Flood Inundation Margin / Curb Halo (Reference Image Style)
    new PathLayer({
      id: "road-inundation-halo-layer",
      data: roads,
      pickable: false,
      widthScale: 1,
      widthMinPixels: 14,
      widthMaxPixels: 28,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: (d: any) => {
        const depth = d.properties.water_depth_cm;
        if (depth > 25.0) return [0, 180, 216, 140];
        if (depth > 10.0) return [0, 180, 216, 110];
        return [0, 180, 216, 80];
      },
      getWidth: (d: any) => (d.properties.water_depth_cm > 25.0 ? 24 : 16),
      jointRounded: true,
      capRounded: true,
    }),

    // 2. Pass 2: Street Network Core Inundation Channel
    new PathLayer({
      id: "road-inundation-layer",
      data: roads,
      pickable: true,
      widthScale: 1,
      widthMinPixels: 4,
      widthMaxPixels: 9,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: (d: any) => {
        const depth = d.properties.water_depth_cm;
        if (depth < 10.0) return [16, 185, 129, 245];     // #10B981 Emerald Green
        if (depth <= 25.0) return [245, 158, 11, 245];    // #F59E0B Amber Yellow
        return [239, 68, 68, 255];                        // #EF4444 Crimson Red
      },
      getWidth: (d: any) => (d.properties.water_depth_cm > 25.0 ? 7 : 5),
      jointRounded: true,
      capRounded: true,
      onHover: (info: any) => setHoverInfo(info),
      updateTriggers: {
        getColor: [geojsonData],
        getWidth: [geojsonData],
      },
    }),

    // 3. Hydraulic Drainage Inlets (Flat Circular Nodes with Ring Status)
    new ScatterplotLayer({
      id: "manhole-markers-layer",
      data: manholes,
      pickable: true,
      opacity: 0.95,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 6,
      radiusMaxPixels: 12,
      getPosition: (d: any) => d.geometry.coordinates,
      getFillColor: (d: any) =>
        d.properties.is_surcharging ? [239, 68, 68, 240] : [14, 165, 233, 230],
      getLineColor: [255, 255, 255, 255],
      getLineWidth: 2,
      onClick: (info: any) => {
        if (info.object) {
          onSelectNode(info.object.properties);
        }
      },
      onHover: (info: any) => setHoverInfo(info),
      updateTriggers: {
        getFillColor: [geojsonData],
      },
    }),

    // Surcharged Outer Warning Rings
    new ScatterplotLayer({
      id: "manhole-warning-rings-layer",
      data: manholes.filter((m: any) => m.properties.is_surcharging),
      pickable: false,
      opacity: 0.85,
      stroked: true,
      filled: false,
      radiusScale: 1,
      radiusMinPixels: 14,
      radiusMaxPixels: 22,
      getPosition: (d: any) => d.geometry.coordinates,
      getLineColor: [239, 68, 68, 220],
      getLineWidth: 2.5,
    }),

    // 4. Baseline Route (Brick Red)
    new PathLayer({
      id: "route-baseline-layer",
      data: routes.filter((r: any) => r.properties.route_type === "BASELINE_UNPROTECTED"),
      pickable: true,
      widthScale: 1,
      widthMinPixels: 4,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: [239, 68, 68, 220],
      getWidth: 4,
      onHover: (info: any) => setHoverInfo(info),
    }),

    // 5. Flood-Safe Detour Route (Vibrant Cyan Bypass)
    new PathLayer({
      id: "route-safe-layer",
      data: routes.filter((r: any) => r.properties.route_type === "FLOOD_SAFE_RECOMMENDED"),
      pickable: true,
      widthScale: 1,
      widthMinPixels: 6,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: [0, 229, 255, 255], // Glowing cyan safe detour
      getWidth: 6,
      onHover: (info: any) => setHoverInfo(info),
    }),

    // 6. Hazard Pinpoints
    new ScatterplotLayer({
      id: "hazard-pins-layer",
      data: routeData?.features?.filter((f: any) => f.geometry?.type === "Point") || [],
      pickable: true,
      opacity: 0.95,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 6,
      radiusMaxPixels: 14,
      getPosition: (d: any) => d.geometry.coordinates,
      getFillColor: [239, 68, 68, 255],
      getLineColor: [255, 255, 255, 255],
      getLineWidth: 2,
      onHover: (info: any) => setHoverInfo(info),
    }),
  ];

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden rounded-2xl border border-border-light">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      />

      {/* Floating Hover Tooltip (Superform Card Style) */}
      {hoverInfo && hoverInfo.object && (
        <div
          className="absolute z-50 pointer-events-none bg-white border border-border-light px-3.5 py-2.5 rounded-md shadow-md text-xs font-mono text-text-primary"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 14 }}
        >
          {hoverInfo.object.properties?.layer_type === "ROAD_SEGMENT" && (
            <div>
              <div className="font-semibold text-text-primary text-xs">
                {hoverInfo.object.properties.road_name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-text-secondary">Water Depth:</span>
                <span
                  className={`font-bold ${
                    hoverInfo.object.properties.water_depth_cm > 25
                      ? "text-[#D64545]"
                      : hoverInfo.object.properties.water_depth_cm > 10
                      ? "text-accent-orange"
                      : "text-status-success-text"
                  }`}
                >
                  {hoverInfo.object.properties.water_depth_cm} cm
                </span>
              </div>
              <div className="text-text-muted mt-0.5 text-[11px] uppercase tracking-wider">
                Status: {hoverInfo.object.properties.status}
              </div>
            </div>
          )}

          {hoverInfo.object.properties?.layer_type === "DRAIN_NODE" && (
            <div>
              <div className="font-bold text-accent-black text-xs uppercase tracking-wide">
                Inlet: {hoverInfo.object.properties.node_code}
              </div>
              <div className="mt-1 text-text-secondary">
                HGL Head:{" "}
                <span className="font-bold text-text-primary">
                  {hoverInfo.object.properties.hgl} m
                </span>
              </div>
              <div className="text-text-secondary">
                Ground Z: {hoverInfo.object.properties.z_ground} m
              </div>
              <div className="text-text-secondary">
                Surcharge Flow:{" "}
                <span className="font-bold text-[#D64545]">
                  {hoverInfo.object.properties.surcharge_flow_m3s} m³/s
                </span>
              </div>
              <div className="text-[10px] text-text-muted mt-1 italic">
                Click column for hydraulic diagnostic
              </div>
            </div>
          )}

          {hoverInfo.object.properties?.feature_type === "FLOOD_CHOKEPOINT" && (
            <div>
              <div className="font-bold text-[#D64545] text-xs flex items-center gap-1 uppercase tracking-wide">
                [HAZARD] Choke-Point
              </div>
              <div className="text-text-primary font-medium mt-0.5">
                {hoverInfo.object.properties.road_name}
              </div>
              <div className="text-text-secondary text-[11px]">
                Depth: {hoverInfo.object.properties.water_depth_cm} cm (Impassable)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aerial Ribbon Map Legend */}
      <div className="absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-sm border border-border-light rounded-lg p-3.5 shadow-md text-xs font-mono space-y-2">
        <div className="label-mono font-bold text-accent-black uppercase text-[10px] tracking-wider border-b border-border-light pb-1">
          Aerial Flood Telemetry
        </div>
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-2.5 rounded bg-[#00B4D8]/60 border border-[#00B4D8] inline-block" />
            <span className="text-text-secondary text-[11px]">Water Margin / Curb Halo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-sm bg-[#10B981] inline-block" />
            <span className="text-text-secondary text-[11px]">&lt; 10 cm (Passable)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1.5 rounded-sm bg-[#F59E0B] inline-block" />
            <span className="text-text-secondary text-[11px]">10–25 cm (Caution)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-2 rounded-sm bg-[#EF4444] inline-block" />
            <span className="text-text-secondary text-[11px]">&gt; 25 cm (Impassable)</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-border-light">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] border-2 border-white inline-block shadow-sm" />
            <span className="text-text-secondary text-[11px]">Manhole Station Inlet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 rounded-sm bg-[#00E5FF] inline-block" />
            <span className="text-text-secondary text-[11px]">Flood-Safe Detour</span>
          </div>
        </div>
      </div>
    </div>
  );
}
