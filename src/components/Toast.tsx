"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function Toast({ kind, message }: { kind: "ok" | "error"; message: string }) {
  const [visible, setVisible] = useState(true);
  const path = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    setVisible(true);
    // Clean the message out of the URL so a refresh doesn't show it again
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("error");
    const q = next.toString();
    window.history.replaceState(null, "", `${path}${q ? `?${q}` : ""}`);
    const t = setTimeout(() => setVisible(false), kind === "ok" ? 3500 : 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  if (!visible) return null;
  return (
    <div className={`toast ${kind}`} role={kind === "error" ? "alert" : "status"} onClick={() => setVisible(false)}>
      <span className="toast-ic" aria-hidden="true">{kind === "ok" ? "✓" : "!"}</span>
      <span>{message}</span>
    </div>
  );
}
