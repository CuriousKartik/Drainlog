"use client";

import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapLibreMasterViewProps {
  center?: [number, number];
  zoom?: number;
  onSelectFeature?: (feature: any) => void;
}

export default function MapLibreMasterView({
  center = [77.2230, 28.6335],
  zoom = 15.2,
  onSelectFeature,
}: MapLibreMasterViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<"satellite" | "streets">("satellite");

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // High-resolution Esri World Imagery Satellite Raster Style
    const mapStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "esri-satellite": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics",
          maxzoom: 19,
        },
        "delhi-roads": {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {
                  name: "Minto Road Railway Subway (Choke Sump)",
                  depth_cm: 28.4,
                  status: "IMPASSABLE",
                  speed_kmh: 0,
                },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [77.2246, 28.6332],
                    [77.2251, 28.6336],
                    [77.2257, 28.6340],
                    [77.2261, 28.6343],
                    [77.2265, 28.6346],
                    [77.2268, 28.6348],
                    [77.2272, 28.6350],
                    [77.2276, 28.6353],
                    [77.2284, 28.6357],
                    [77.2290, 28.6360],
                  ],
                },
              },
              {
                type: "Feature",
                properties: {
                  name: "Deen Dayal Upadhyay (DDU) Marg",
                  depth_cm: 11.2,
                  status: "CAUTION",
                  speed_kmh: 22,
                },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [77.2268, 28.6348],
                    [77.2278, 28.6344],
                    [77.2285, 28.6342],
                    [77.2298, 28.6340],
                    [77.2312, 28.6338],
                    [77.2330, 28.6335],
                  ],
                },
              },
              {
                type: "Feature",
                properties: {
                  name: "Connaught Circus Inner Ring",
                  depth_cm: 3.8,
                  status: "PASSABLE",
                  speed_kmh: 45,
                },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [77.2180, 28.6340],
                    [77.2190, 28.6342],
                    [77.2202, 28.6338],
                    [77.2207, 28.6330],
                    [77.2205, 28.6322],
                    [77.2202, 28.6315],
                    [77.2198, 28.6312],
                    [77.2185, 28.6308],
                    [77.2170, 28.6315],
                    [77.2164, 28.6328],
                    [77.2169, 28.6339],
                    [77.2180, 28.6340],
                  ],
                },
              },
            ],
          },
        },
        "delhi-nodes": {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { code: "916", name: "Minto Sump", status: "SURCHARGED", depth_cm: 28.4 },
                geometry: { type: "Point", coordinates: [77.2268, 28.6348] },
              },
              {
                type: "Feature",
                properties: { code: "912", name: "Minto Approach", status: "ELEVATED", depth_cm: 8.5 },
                geometry: { type: "Point", coordinates: [77.2248, 28.6338] },
              },
              {
                type: "Feature",
                properties: { code: "918", name: "Middle Circle", status: "NOMINAL", depth_cm: 2.1 },
                geometry: { type: "Point", coordinates: [77.2215, 28.6328] },
              },
              {
                type: "Feature",
                properties: { code: "731", name: "Yamuna Outfall", status: "OUTLET", depth_cm: 0.0 },
                geometry: { type: "Point", coordinates: [77.2340, 28.6385] },
              },
            ],
          },
        },
      },
      layers: [
        {
          id: "satellite-layer",
          type: "raster",
          source: "esri-satellite",
        },
        // Pass 1: Translucent Blue Water Margin Halo (Reference Image Style)
        {
          id: "flood-halo-layer",
          type: "line",
          source: "delhi-roads",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#00B4D8",
            "line-width": [
              "case",
              [">", ["get", "depth_cm"], 25], 26,
              [">", ["get", "depth_cm"], 10], 20,
              14
            ],
            "line-opacity": 0.48,
          },
        },
        // Pass 2: Core Water Depth Channel
        {
          id: "flood-core-layer",
          type: "line",
          source: "delhi-roads",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": [
              "case",
              [">", ["get", "depth_cm"], 25], "#EF4444",
              [">", ["get", "depth_cm"], 10], "#F59E0B",
              "#10B981"
            ],
            "line-width": [
              "case",
              [">", ["get", "depth_cm"], 25], 7,
              [">", ["get", "depth_cm"], 10], 5.5,
              4.5
            ],
            "line-opacity": 0.95,
          },
        },
        // Manhole Junction Rings
        {
          id: "manhole-nodes-layer",
          type: "circle",
          source: "delhi-nodes",
          paint: {
            "circle-radius": 7,
            "circle-color": [
              "case",
              ["==", ["get", "status"], "SURCHARGED"], "#EF4444",
              ["==", ["get", "status"], "ELEVATED"], "#F59E0B",
              "#0EA5E9"
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#FFFFFF",
          },
        },
      ],
    };

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: center,
      zoom: zoom,
      pitch: 0,
      bearing: 0,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("click", "flood-core-layer", (e) => {
      if (e.features && e.features[0]) {
        const props = e.features[0].properties;
        if (onSelectFeature) onSelectFeature(props);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [center, zoom, onSelectFeature]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-border-light bg-slate-900">
      <div ref={mapContainer} className="w-full h-full min-h-[500px]" />
    </div>
  );
}

