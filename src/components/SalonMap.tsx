"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapSalon = { id: string; name: string; lat: number; lng: number; label?: string };

/** Light map with a pin per salon and (optionally) the member's own location. */
export default function SalonMap({ salons, me, height = 420 }: { salons: MapSalon[]; me?: { lat: number; lng: number } | null; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([salons.map((s) => s.id), me]);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map = L.map(el.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      const points: [number, number][] = [];
      salons.forEach((s) => {
        const icon = L.divIcon({ className: "bp-pin", html: `<span>${s.label ?? ""}</span>`, iconSize: [34, 34], iconAnchor: [17, 34] });
        const marker = L.marker([s.lat, s.lng], { icon, title: s.name }).addTo(map!);
        const a = document.createElement("a");
        a.href = `/app/boeken/${s.id}`;
        a.textContent = s.name;
        a.className = "bp-pop";
        marker.bindPopup(a);
        points.push([s.lat, s.lng]);
      });
      if (me) {
        L.marker([me.lat, me.lng], { icon: L.divIcon({ className: "bp-me", html: "<span></span>", iconSize: [18, 18] }), title: "Jij" }).addTo(map);
        points.push([me.lat, me.lng]);
      }
      if (points.length) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
      else map.setView([52.3676, 4.9041], 12);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} className="map" style={{ height }} role="region" aria-label="Kaart met salons" />;
}
