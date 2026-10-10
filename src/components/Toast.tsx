"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function Toast({ kind, message }: { kind: "ok" | "error"; message: string }) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const path = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get(kind);

  // Runs for every redirect that carries a message, also when it is the same text as last time
  useEffect(() => {
    if (fromUrl === null) return;
    setVisible(true);
    // Clean the message out of the URL so a refresh doesn't show it again
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("error");
    const q = next.toString();
    window.history.replaceState(null, "", `${path}${q ? `?${q}` : ""}`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), kind === "ok" ? 3500 : 7000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, fromUrl, params]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!visible) return null;
  return (
    <div className={`toast ${kind}`} role={kind === "error" ? "alert" : "status"} onClick={() => setVisible(false)}>
      <span className="toast-ic" aria-hidden="true">{kind === "ok" ? "✓" : "!"}</span>
      <span>{message}</span>
    </div>
  );
}
