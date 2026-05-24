"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  label: string;
  title: string;
  place: string;
  time: string;
  lat: number;
  lng: number;
  color: string;
};

type Props = {
  markers: MapMarker[];
  className?: string;
};

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

function makeIcon(color: string) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};
      border:3px solid rgba(255,255,255,.85);
      box-shadow:0 2px 8px rgba(0,0,0,.45);
    "></div>`,
  });
}

export default function DayRouteMap({ markers, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || markers.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    const points: L.LatLngExpression[] = [];

    for (const m of markers) {
      const pos: L.LatLngExpression = [m.lat, m.lng];
      points.push(pos);

      L.marker(pos, { icon: makeIcon(m.color) })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:sans-serif;font-size:13px;line-height:1.5;">
            <strong style="color:${m.color};">${m.label}</strong><br/>
            <b>${m.title}</b><br/>
            <span style="opacity:.7;">${m.place}</span><br/>
            <span style="opacity:.6;font-size:11px;">${m.time}</span>
          </div>`,
          { className: "et-map-popup" },
        );
    }

    if (points.length >= 2) {
      L.polyline(points, {
        color: "rgba(168,212,104,.6)",
        weight: 3,
        dashArray: "8,6",
      }).addTo(map);
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markers]);

  if (markers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: 220, borderRadius: 12, overflow: "hidden" }}
    />
  );
}
