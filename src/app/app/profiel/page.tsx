import { getContext } from "@/lib/auth";
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { changePassword, updateProfile } from "../actions";

export const metadata = { title: "Profiel" };

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { user, profile } = await getContext();
  return (
    <>
      <div className="page-head"><div><h1>Je <em>profiel</em></h1><p>{user.email}</p></div></div>
      <Flash params={sp} />
      <div className="grid two">
        <form action={updateProfile} className="card grid">
          <h2>Gegevens</h2>
          <label className="field">Voornaam<input name="first_name" defaultValue={profile?.first_name ?? ""} required /></label>
          <label className="field">Achternaam<input name="last_name" defaultValue={profile?.last_name ?? ""} /></label>
          <label className="field">Mobiel<input name="phone" type="tel" defaultValue={profile?.phone ?? ""} /></label>
          <label className="field">Postcode <span className="hint">om salons bij jou in de buurt te tonen</span><input name="postcode" defaultValue={profile?.postcode ?? ""} placeholder="1072 LN" /></label>
          <p className="small muted">Salons zien alleen je voornaam en de eerste letter van je achternaam.</p>
          <div><Submit>Opslaan</Submit></div>
        </form>
        <form action={changePassword} className="card grid">
          <h2>Wachtwoord</h2>
          <label className="field">Nieuw wachtwoord <span className="hint">minimaal 8 tekens</span><input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <div><Submit className="btn secondary">Wachtwoord wijzigen</Submit></div>
        </form>
      </div>
    </>
  );
}
