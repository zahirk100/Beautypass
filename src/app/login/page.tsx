import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { resetPassword, signIn, signUp } from "../actions";

export const metadata = { title: "Inloggen" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const mode = sp.mode === "signup" ? "signup" : sp.mode === "reset" ? "reset" : "login";
  const next = sp.next ?? "/start";

  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo light />
        <h1>Je beauty&shy;routine, <em>geregeld.</em></h1>
        <p className="muted" style={{ position: "relative", zIndex: 1, color: "rgba(251,247,242,.7)" }}>
          Eén login voor members, salons en het BeautyPass-team.
        </p>
      </aside>
      <main className="auth-form">
        <div className="box">
          <div className="tabs">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={mode === "login" ? "on" : ""}>Inloggen</Link>
            <Link href="/login?mode=signup" className={mode === "signup" ? "on" : ""}>Account aanmaken</Link>
          </div>
          <Flash params={sp} />

          {mode === "login" && (
            <form action={signIn} className="grid">
              <input type="hidden" name="next" value={next} />
              <label className="field">E-mailadres<input type="email" name="email" autoComplete="email" required /></label>
              <label className="field">Wachtwoord<input type="password" name="password" autoComplete="current-password" required /></label>
              <Submit className="btn block">Inloggen</Submit>
              <Link href="/login?mode=reset" className="small muted" style={{ textAlign: "center" }}>Wachtwoord vergeten?</Link>
            </form>
          )}

          {mode === "signup" && (
            <form action={signUp} className="grid">
              <div className="grid two" style={{ gap: 12 }}>
                <label className="field">Voornaam<input name="first_name" autoComplete="given-name" required /></label>
                <label className="field">Achternaam<input name="last_name" autoComplete="family-name" /></label>
              </div>
              <label className="field">E-mailadres<input type="email" name="email" autoComplete="email" required /></label>
              <label className="field">Wachtwoord <span className="hint">minimaal 8 tekens</span><input type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
              <Submit className="btn block">Account aanmaken</Submit>
              <p className="small muted">Werk je bij een salon? Maak hier een account aan. Het BeautyPass-team koppelt je daarna aan je salon.</p>
            </form>
          )}

          {mode === "reset" && (
            <form action={resetPassword} className="grid">
              <p className="muted small">Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord in te stellen.</p>
              <label className="field">E-mailadres<input type="email" name="email" autoComplete="email" required /></label>
              <Submit className="btn block">Stuur link</Submit>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
