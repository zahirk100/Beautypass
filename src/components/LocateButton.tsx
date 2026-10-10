"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Asks the browser for the current location and puts it in the URL (?lat=&lng=). */
export function LocateButton() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "denied">("idle");

  return (
    <button
      type="button"
      className="btn secondary small"
      disabled={state === "busy"}
      onClick={() => {
        if (!navigator.geolocation) return setState("denied");
        setState("busy");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const next = new URLSearchParams(params.toString());
            next.set("lat", pos.coords.latitude.toFixed(5));
            next.set("lng", pos.coords.longitude.toFixed(5));
            next.set("sort", "distance");
            setState("idle");
            router.push(`${path}?${next.toString()}`);
          },
          () => setState("denied"),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
        );
      }}
    >
      {state === "busy" ? "Locatie zoeken…" : state === "denied" ? "Locatie niet beschikbaar" : "◎ Gebruik mijn locatie"}
    </button>
  );
}
