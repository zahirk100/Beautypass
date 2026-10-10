export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Laden" style={{ display: "grid", gap: 16 }}>
      <div className="skel" style={{ height: 44, width: "55%" }} />
      <div className="skel" style={{ height: 150 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="skel" style={{ height: 110 }} />
        <div className="skel" style={{ height: 110 }} />
      </div>
      <div className="skel" style={{ height: 220 }} />
    </div>
  );
}
