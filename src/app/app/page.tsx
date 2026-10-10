import Link from "next/link";
import { getContext } from "@/lib/auth";
import { dateShort, time } from "@/lib/format";
import { DateBox } from "@/components/DateBox";
import { StatusBadge } from "@/components/Badge";
import { loadMembership } from "./data";

export default async function MemberHome() {
  const { supabase, user, profile } = await getContext();
  const { membership, balance } = await loadMembership(supabase, user.id);
  const { data: upcoming } = await supabase
    .from("bookings").select("id, starts_at, status, salons(name, district), treatments(name)")
    .eq("user_id", user.id).eq("status", "booked").gte("starts_at", new Date().toISOString()).order("starts_at").limit(3);
  const monthly = membership?.plans?.monthly_credits ?? 0;
  const pct = monthly ? Math.min(100, Math.round((balance / monthly) * 100)) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hoi {profile?.first_name || "daar"}, <em>welkom.</em></h1>
          <p>Hier zie je je tegoed en je volgende afspraken.</p>
        </div>
        {membership?.status === "active" && <Link href="/app/boeken" className="btn">Boek een behandeling</Link>}
      </div>

      {!membership && (
        <div className="card dark">
          <h2>Kies je membership</h2>
          <p className="muted" style={{ margin: "8px 0 18px" }}>Je hebt nog geen membership. Kies er een en boek daarna je eerste behandeling.</p>
          <Link href="/app/membership" className="btn secondary">Bekijk memberships</Link>
        </div>
      )}

      {membership?.status === "pending" && (
        <div className="card">
          <div className="card-head"><h2>Je aanvraag is ontvangen</h2><StatusBadge status="pending" /></div>
          <p className="muted">Je hebt gekozen voor <b>{membership.plans?.name}</b>. Zodra je membership actief is, verschijnen hier je credits en kun je boeken.</p>
        </div>
      )}

      {membership && membership.status !== "pending" && (
        <div className="grid two">
          <div className="card dark">
            <div className="stat">
              <div className="label">Jouw tegoed</div>
              <div className="value">{balance} credits</div>
              <div className="sub" style={{ color: "rgba(251,247,242,.7)" }}>
                {membership.plans?.name} · {monthly} credits per maand
                {membership.current_period_end && <> · nieuwe credits op {dateShort(membership.current_period_end)}</>}
              </div>
            </div>
            <div className="bar" style={{ marginTop: 18 }}><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Membership</h2><StatusBadge status={membership.status} /></div>
            <p className="muted">
              {membership.founding_number ? <>Founding member <b>Nº {String(membership.founding_number).padStart(3, "0")}</b> · </> : null}
              Lid sinds {membership.started_at ? dateShort(membership.started_at) : "binnenkort"}
            </p>
            <p className="small muted" style={{ marginTop: 10 }}>Tot de helft van je maandtegoed gaat mee naar de volgende maand.</p>
          </div>
        </div>
      )}

      <section className="section">
        <h2>Volgende afspraken</h2>
        {upcoming && upcoming.length > 0 ? (
          <div className="list">
            {upcoming.map((b: any) => (
              <div className="row-item" key={b.id}>
                <DateBox iso={b.starts_at} />
                <div className="grow"><b>{b.treatments?.name}</b><div className="small muted">{b.salons?.name} · {b.salons?.district} · {time(b.starts_at)}</div></div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty">Je hebt nog geen geplande afspraken.</div>
        )}
      </section>
    </>
  );
}
