import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Privacyverklaring",
  description: "Hoe BeautyPass omgaat met je persoonsgegevens.",
  alternates: { canonical: "https://www.beautypass.nl/privacy" },
};

const UPDATED = "10 oktober 2026";
const CONTACT = "hallo@beautypass.nl";

export default function Privacy() {
  return (
    <main className="legal">
      <header className="legal-top"><Logo /></header>
      <article className="legal-body">
        <p className="legal-eyebrow">Laatst bijgewerkt: {UPDATED}</p>
        <h1>Privacy<em>verklaring</em></h1>
        <p className="legal-lead">
          BeautyPass gaat zorgvuldig om met je gegevens. We verzamelen alleen wat nodig is om je op de wachtlijst te zetten en,
          later, je membership en afspraken te regelen. We verkopen je gegevens nooit.
        </p>

        <h2>Wie zijn wij</h2>
        <p>
          BeautyPass (Amsterdam) is verantwoordelijk voor de verwerking van je persoonsgegevens zoals beschreven in deze verklaring.
          Vragen? Mail naar <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>Welke gegevens we verwerken</h2>
        <ul>
          <li><b>Wachtlijst:</b> je voornaam, e-mailadres, en als je dat invult je telefoonnummer. Daarnaast via welke link of campagne je ons vond en of je via een vriendin bent uitgenodigd.</li>
          <li><b>Account en membership</b> (na lancering): naam, e-mailadres, postcode, je membership, credits, afspraken, opmerkingen bij een afspraak en beoordelingen.</li>
          <li><b>Technisch:</b> gegevens die nodig zijn om de site veilig te laten werken, zoals een inlogcookie. We gebruiken op dit moment geen advertentie- of trackingcookies.</li>
        </ul>

        <h2>Waarom we die gegevens gebruiken</h2>
        <ul>
          <li>Je informeren over de lancering van BeautyPass en je een plek aanbieden (op basis van je toestemming).</li>
          <li>Je wachtlijstpositie en uitnodigingen bijhouden.</li>
          <li>Na aanmelding als lid: je membership, credits en afspraken uitvoeren (uitvoering van de overeenkomst). De salon waar je boekt ziet je naam, de behandeling en je opmerking.</li>
          <li>Voldoen aan wettelijke verplichtingen, zoals de fiscale bewaarplicht voor betalingen.</li>
        </ul>

        <h2>Hoe lang we gegevens bewaren</h2>
        <p>
          Wachtlijstgegevens bewaren we tot de lancering en uiterlijk 12 maanden daarna, tenzij je eerder lid wordt of je afmeldt.
          Accountgegevens bewaren we zolang je lid bent en daarna maximaal 2 jaar. Betaalgegevens bewaren we 7 jaar vanwege de fiscale bewaarplicht.
        </p>

        <h2>Met wie we gegevens delen</h2>
        <p>We werken met een beperkt aantal dienstverleners die je gegevens alleen in onze opdracht verwerken:</p>
        <ul>
          <li><b>Supabase</b>: database en inloggen (servers in de EU).</li>
          <li><b>Vercel</b>: hosting van de website.</li>
          <li><b>Salons</b>: alleen de gegevens die nodig zijn voor een afspraak die jij boekt.</li>
        </ul>
        <p>Met al deze partijen hebben we afspraken gemaakt over beveiliging en geheimhouding.</p>

        <h2>Je rechten</h2>
        <p>
          Je mag je gegevens inzien, laten aanpassen of laten verwijderen, je toestemming intrekken en bezwaar maken tegen de verwerking.
          Ook kun je je gegevens opvragen om mee te nemen naar een andere partij. Stuur hiervoor een e-mail naar <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
          we reageren binnen 4 weken. Ben je niet tevreden over hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de{" "}
          <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">Autoriteit Persoonsgegevens</a>.
        </p>

        <h2>Beveiliging</h2>
        <p>
          Gegevens worden versleuteld verstuurd. Toegang is per rol beperkt: een salon ziet alleen zijn eigen afspraken, en binnen ons team
          heeft alleen wie het nodig heeft toegang tot ledengegevens.
        </p>

        <h2>Wijzigingen</h2>
        <p>Als we deze verklaring aanpassen, zie je dat hier aan de datum bovenaan. Bij grote wijzigingen laten we het je per e-mail weten.</p>

        <p className="legal-back"><a href="/">Terug naar BeautyPass</a></p>
      </article>
    </main>
  );
}
