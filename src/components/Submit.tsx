"use client";
import { useEffect, useId, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

// With `confirm`, the first tap arms the button and shows the question; the second tap submits.
// This replaces window.confirm, which iOS Safari can suppress so that nothing seems to happen.
export function Submit({ children, className = "btn", confirm }: { children: React.ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);
  const hintId = useId();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  // Text buttons read "Ja, opzeggen"; icon buttons keep their icon and only change colour
  const label = typeof children === "string" && children.length > 2 ? `Ja, ${children.charAt(0).toLowerCase()}${children.slice(1)}` : children;
  return (
    <>
      <button
        type="submit"
        className={`${className}${armed ? " armed" : ""}`}
        disabled={pending}
        aria-describedby={armed ? hintId : undefined}
        onClick={(e) => {
          if (confirm && !armed) {
            e.preventDefault();
            setArmed(true);
            // Keep the button clear of the hint bar at the bottom of the screen
            const r = e.currentTarget.getBoundingClientRect();
            if (r.bottom > window.innerHeight - 190) e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }}
      >
        {pending ? "Even geduld…" : armed ? label : children}
      </button>
      {armed && !pending && createPortal(
        // Rendered in <body>: an animated ancestor (transform) would otherwise trap the fixed position
        <span id={hintId} className="confirm-hint" role="status">{confirm} Tik nogmaals om te bevestigen.</span>,
        document.body,
      )}
    </>
  );
}
