"use client";
import { useState } from "react";

export type PickerDay = { key: string; label: string; long: string; slots: { id: string; time: string }[] };

/** Day tabs + time buttons, all inside the booking form (no page reload, keeps the chosen treatment). */
export function SlotPicker({ days }: { days: PickerDay[] }) {
  const [active, setActive] = useState(days[0]?.key);
  const [chosen, setChosen] = useState<string | null>(null);
  if (days.length === 0) return <p className="muted">Er zijn op dit moment geen vrije tijden. Kijk later nog eens, of probeer een andere salon.</p>;
  const day = days.find((d) => d.key === active) ?? days[0];
  return (
    <>
      <div className="chips" style={{ marginBottom: 14 }} role="tablist" aria-label="Kies een dag">
        {days.map((d) => (
          <button type="button" key={d.key} role="tab" aria-selected={d.key === day.key}
            className={`chip${d.key === day.key ? " on" : ""}`} style={{ cursor: "pointer" }} onClick={() => setActive(d.key)}>
            {d.label} · {d.slots.length}
          </button>
        ))}
      </div>
      <p className="cap" style={{ fontWeight: 600, marginBottom: 8 }}>{day.long}</p>
      <div className="slot-grid">
        {day.slots.map((s) => (
          <label key={s.id} className="slot-option">
            <input type="radio" name="slot" value={s.id} required checked={chosen === s.id} onChange={() => setChosen(s.id)} />
            <span>{s.time}</span>
          </label>
        ))}
      </div>
      {chosen && !day.slots.some((s) => s.id === chosen) && (
        <p className="small muted" style={{ marginTop: 10 }}>Je hebt al een tijd op een andere dag gekozen.</p>
      )}
    </>
  );
}
