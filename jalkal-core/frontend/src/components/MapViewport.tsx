"use client";

import React, { useState, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, ColumnLayer, ScatterplotLayer, BitmapLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";

interface MapViewportProps {
  geojsonData: any;
  routeData: any;
  onSelectNode: (node: any) => void;
}

const INITIAL_VIEW_STATE = {
  longitude: 77.2215,
  latitude: 28.6315,
  zoom: 14.8,
  pitch: 45,
  bearing: -12,
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

  // Superform Palette (No Neons):
  // Safe (<10cm): #1E8E5A (Forest Green) -> [30, 142, 90]
  // Warning (10-25cm): #E8863A (Superform Orange) -> [232, 134, 58]
  // Impassable (>25cm): #D64545 (Brick Red) -> [214, 69, 69]
  // Base Neutral: #111111 (Charcoal) -> [17, 17, 17]

  const layers = [
    // 0. City street basemap (CARTO Positron raster tiles) so the drainage
    // network renders over a recognizable map instead of a blank canvas.
    new TileLayer({
      id: "basemap-layer",
      data: "https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png",
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

    // 1. Street Network Inundation Layer
    new PathLayer({
      id: "road-inundation-layer",
      data: roads,
      pickable: true,
      widthScale: 1,
      widthMinPixels: 4,
      widthMaxPixels: 10,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: (d: any) => {
        const depth = d.properties.water_depth_cm;
        if (depth < 10.0) return [30, 142, 90, 230];       // #1E8E5A
        if (depth <= 25.0) return [232, 134, 58, 235];     // #E8863A
        return [214, 69, 69, 245];                         // #D64545
      },
      getWidth: (d: any) => (d.properties.water_depth_cm > 25.0 ? 8 : 5),
      onHover: (info: any) => setHoverInfo(info),
      updateTriggers: {
        getColor: [geojsonData],
        getWidth: [geojsonData],
      },
    }),

    // 2. 3D Architectural Manhole Cylinders (Charcoal / Terracotta)
    new ColumnLayer({
      id: "manhole-columns-layer",
      data: manholes,
      pickable: true,
      diskResolution: 20,
      radius: 18,
      elevationScale: 2.2,
      getPosition: (d: any) => d.geometry.coordinates,
      getFillColor: (d: any) =>
        d.properties.is_surcharging ? [214, 69, 69, 235] : [17, 17, 17, 210],
      getElevation: (d: any) => Math.max(14, d.properties.elevation || 14),
      onClick: (info: any) => {
        if (info.object) {
          onSelectNode(info.object.properties);
        }
      },
      onHover: (info: any) => setHoverInfo(info),
      updateTriggers: {
        getElevation: [geojsonData],
        getFillColor: [geojsonData],
      },
    }),

    // 3. Baseline Route (Brick Red)
    new PathLayer({
      id: "route-baseline-layer",
      data: routes.filter((r: any) => r.properties.route_type === "BASELINE_UNPROTECTED"),
      pickable: true,
      widthScale: 1,
      widthMinPixels: 4,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: [214, 69, 69, 220],
      getWidth: 4,
      onHover: (info: any) => setHoverInfo(info),
    }),

    // 4. Flood-Safe Detour Route (Deep Charcoal / Green)
    new PathLayer({
      id: "route-safe-layer",
      data: routes.filter((r: any) => r.properties.route_type === "FLOOD_SAFE_RECOMMENDED"),
      pickable: true,
      widthScale: 1,
      widthMinPixels: 6,
      getPath: (d: any) => d.geometry.coordinates,
      getColor: [17, 17, 17, 255], // Clean bold black route
      getWidth: 6,
      onHover: (info: any) => setHoverInfo(info),
    }),

    // 5. Hazard Pinpoints (Subtle terracotta dots)
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
      getFillColor: [214, 69, 69, 255],
      getLineColor: [250, 247, 240, 255],
      getLineWidth: 2,
      onHover: (info: any) => setHoverInfo(info),
    }),
  ];

  return (
    <div className="relative w-full h-full bg-[#F5F1E8] overflow-hidden rounded-2xl border border-border-light">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      />

      {/* Basemap attribution */}
      <div className="absolute bottom-1 right-2 z-40 text-[9px] text-text-muted font-sans pointer-events-none">
        © OpenStreetMap contributors © CARTO
      </div>

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

      {/* Superform Map Legend */}
      <div className="absolute top-4 right-4 z-40 bg-white border border-border-light rounded-md p-3.5 shadow-sm text-xs font-mono space-y-2">
        <div className="label-mono font-semibold">
          Street Inundation
        </div>
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1E8E5A] inline-block" />
            <span className="text-text-secondary text-[11px]">&lt; 10 cm (Passable)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-orange inline-block" />
            <span className="text-text-secondary text-[11px]">10–25 cm (Slowdown)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D64545] inline-block" />
            <span className="text-text-secondary text-[11px]">&gt; 25 cm (Impassable)</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-border-light">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent-black inline-block" />
            <span className="text-text-secondary text-[11px]">Drainage Inlets (3D)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-accent-black inline-block" />
            <span className="text-text-secondary text-[11px]">Safe Detour Route</span>
          </div>
        </div>
      </div>
    </div>
  );
}
