/* eslint-disable @next/next/no-img-element */
import { Flash } from "@/components/Flash";
import { Submit } from "@/components/Submit";
import { PhotoUpload } from "@/components/PhotoUpload";
import { placeholderStyle } from "@/lib/social";
import { getSalonContext } from "../context";
import { removeSalonPhoto, updateSalonDetails, uploadSalonPhoto } from "../actions";

export const metadata = { title: "Salonprofiel" };

export default async function SalonProfile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { supabase, salonId, isOwner } = await getSalonContext();
  const { data: s } = await supabase.from("salons").select("*").eq("id", salonId).single();
  if (!s) return null;
  const gallery: string[] = s.gallery ?? [];
  const filled = [s.cover_url, s.tagline, s.description, s.opening_hours, s.instagram || s.tiktok || s.website, gallery.length >= 3, s.latitude != null].filter(Boolean).length;
  const pct = Math.round((filled / 7) * 100);

  return (
    <>
      <div className="page-head">
        <div><h1>Salonprofiel</h1><p>Zo zien members je salon. Een volledig profiel met mooie foto&apos;s wordt vaker geboekt.</p></div>
      </div>
      <Flash params={sp} />
      {!isOwner && <div className="flash error">Alleen de eigenaar kan het profiel aanpassen.</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head" style={{ marginBottom: 8 }}><b>Profiel compleet</b><span className="badge">{pct}%</span></div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        {pct < 100 && <p className="small muted" style={{ marginTop: 8 }}>
          Nog te doen: {[!s.cover_url && "omslagfoto", !s.tagline && "slogan", !s.description && "beschrijving", !s.opening_hours && "openingstijden",
            !(s.instagram || s.tiktok || s.website) && "socials", gallery.length < 3 && "minstens 3 foto's", s.latitude == null && "postcode"].filter(Boolean).join(", ")}
        </p>}
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        <div className="grid" style={{ gap: 18 }}>
          <div className="card grid">
            <h2>Omslagfoto</h2>
            <div className="cover" style={s.cover_url ? undefined : placeholderStyle(s.name)}>
              {s.cover_url ? <img src={s.cover_url} alt={`Omslagfoto van ${s.name}`} /> : <span className="initial">{s.name.charAt(0)}</span>}
            </div>
            {isOwner && (
              <div className="inline-form" style={{ alignItems: "stretch" }}>
                <form action={uploadSalonPhoto} className="grid grow" style={{ gap: 10 }}>
                  <input type="hidden" name="kind" value="cover" />
                  <PhotoUpload label={s.cover_url ? "Nieuwe omslagfoto kiezen" : "Omslagfoto toevoegen"} />
                  <Submit>Uploaden</Submit>
                </form>
              </div>
            )}
            {isOwner && s.cover_url && (
              <form action={removeSalonPhoto}><input type="hidden" name="url" value={s.cover_url} /><Submit className="btn danger small" confirm="Omslagfoto verwijderen?">Verwijder omslagfoto</Submit></form>
            )}
          </div>

          <div className="card grid">
            <div className="card-head" style={{ marginBottom: 0 }}><h2>Galerij</h2><span className="small muted">{gallery.length}/8</span></div>
            {gallery.length > 0 ? (
              <div className="gallery">
                {gallery.map((url) => (
                  <figure key={url}>
                    <img src={url} alt="" />
                    {isOwner && <form action={removeSalonPhoto}><input type="hidden" name="url" value={url} /><Submit className="btn danger small" confirm="Deze foto verwijderen?">✕</Submit></form>}
                  </figure>
                ))}
              </div>
            ) : <p className="muted small">Laat je werk zien: nagels, het interieur, je team.</p>}
            {isOwner && gallery.length < 8 && (
              <form action={uploadSalonPhoto} className="grid" style={{ gap: 10 }}>
                <input type="hidden" name="kind" value="gallery" />
                <PhotoUpload label="Foto's toevoegen" multiple />
                <Submit className="btn secondary">Uploaden</Submit>
              </form>
            )}
          </div>
        </div>

        <form action={updateSalonDetails} className="card grid">
          <h2>Gegevens</h2>
          <fieldset disabled={!isOwner} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 14 }}>
            <label className="field">Slogan <span className="hint">korte zin onder je naam, max. 120 tekens</span><input name="tagline" defaultValue={s.tagline} maxLength={120} placeholder="Bijv. Natuurlijke nagels, met aandacht gemaakt" /></label>
            <label className="field">Over de salon<textarea name="description" defaultValue={s.description} maxLength={2000} rows={5} /></label>
            <div className="grid two" style={{ gap: 12 }}>
              <label className="field">Adres<input name="address" defaultValue={s.address} autoComplete="street-address" /></label>
              <label className="field">Wijk<input name="district" defaultValue={s.district} /></label>
            </div>
            <label className="field">Postcode <span className="hint">{s.latitude != null ? "locatie bekend ✓" : "nodig voor afstand en kaart"}</span><input name="postcode" defaultValue={s.postcode} /></label>
            <input type="hidden" name="old_postcode" value={s.postcode} />
            <label className="field">Openingstijden <span className="hint">één regel per dag of dagdeel</span>
              <textarea name="opening_hours" defaultValue={s.opening_hours} rows={4} maxLength={600} placeholder={"Di–vr 9:00–18:00\nZa 10:00–16:00\nZo & ma gesloten"} />
            </label>
            <h3 style={{ marginTop: 6 }}>Socials &amp; website</h3>
            <label className="field">Instagram<input name="instagram" defaultValue={s.instagram ? `@${s.instagram}` : ""} placeholder="@jouwsalon" autoCapitalize="none" /></label>
            <label className="field">TikTok<input name="tiktok" defaultValue={s.tiktok ? `@${s.tiktok}` : ""} placeholder="@jouwsalon" autoCapitalize="none" /></label>
            <label className="field">Website<input name="website" type="url" inputMode="url" defaultValue={s.website} placeholder="https://jouwsalon.nl" autoCapitalize="none" /></label>
          </fieldset>
          {isOwner && <div><Submit>Opslaan</Submit></div>}
        </form>
      </div>
    </>
  );
}
