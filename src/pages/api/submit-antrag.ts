// src/pages/api/submit-antrag.ts
// Speichert Anträge in Supabase, sendet nur Benachrichtigungs-E-Mails (keine sensiblen Daten per Mail)
//
// Erforderliche Umgebungsvariablen:
//   SUPABASE_URL          — Project URL aus Supabase Dashboard
//   SUPABASE_SERVICE_KEY  — service_role key (nicht der anon key!)
//   RESEND_API_KEY        — API-Schlüssel von resend.com
//   VEREIN_EMAIL          — E-Mail des Vereins
//   FROM_EMAIL            — Verifizierte Absenderadresse in Resend
//   ADMIN_URL             — Vollständige URL zum Admin-Panel

export const prerender = false;
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const data = await request.json();
    const SUPABASE_URL   = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY   = import.meta.env.SUPABASE_SERVICE_KEY;
    const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
    const VEREIN_EMAIL   = import.meta.env.VEREIN_EMAIL || 'vorstand@asn-pfeil-phoenix.de';
    const FROM_EMAIL     = import.meta.env.FROM_EMAIL   || 'antrag@asn-pfeil-phoenix.de';
    const ADMIN_URL      = import.meta.env.ADMIN_URL    || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/antraege-2025';

    const antragId = `ASN-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
    const now = new Date();
    const eingegangen = now.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    });

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Supabase nicht konfiguriert.');
    }

    const antrag = {
      antrag_id:               antragId,
      eingegangen_am:          now.toISOString(),
      anrede:                  data.anrede,
      vorname:                 data.vorname,
      nachname:                data.nachname,
      strasse:                 data.strasse,
      plz:                     data.plz,
      ort:                     data.ort,
      geburtsdatum:            data.geburtsdatum,
      telefon:                 data.telefon || null,
      email:                   data.email,
      eintrittsdatum:          data.eintrittsdatum,
      abteilung:               data.abteilung,
      abteilung_label:         data.abteilung_label,
      kategorie:               data.kategorie,
      kategorie_label:         data.kategorie_label,
      betrag_jaehrlich:        data.betrag_jaehrlich,
      arbeitsdienst_pauschale: data.arbeitsdienst_pauschale ?? 0,
      zahlungsart:             data.but_gutschein ? 'BuT-Gutschein' : 'SEPA-Lastschrift',
      kontoinhaber:            data.but_gutschein ? null : (data.kontoinhaber || null),
      iban:                    data.but_gutschein ? null : (data.iban || null),
      but_gutschein:           data.but_gutschein ?? false,
      recht_am_bild:           data.recht_am_bild ?? false,
      sonstiges:               data.sonstiges || null,
      satzung_anerkannt:       true,
      status:                  'offen',
    };

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/antraege`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(antrag),
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      throw new Error(`Supabase Fehler: ${err}`);
    }

    if (RESEND_API_KEY) {
      await Promise.allSettled([
        // Benachrichtigung an Verein — bewusst KEINE sensiblen Daten
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [VEREIN_EMAIL],
            subject: `Neuer Mitgliedsantrag: ${data.vorname} ${data.nachname} (${data.abteilung_label})`,
            text: `Hallo,

ein neuer Mitgliedsantrag wartet auf Bearbeitung.

Antragsteller: ${data.anrede} ${data.vorname} ${data.nachname}
Abteilung:     ${data.abteilung_label} — ${data.kategorie_label}
Eingegangen:   ${eingegangen}
Antrag-ID:     ${antragId}

Bitte im Verwaltungsportal einloggen:
${ADMIN_URL}

Diese E-Mail enthält bewusst keine persönlichen oder Bankdaten.
Alle Daten sind sicher im Verwaltungsportal abrufbar.`,
          }),
        }),
        // Bestätigung an Antragsteller
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [data.email],
            subject: 'Dein Mitgliedsantrag beim ASN Pfeil Phönix – Bestätigung',
            text: `Hallo ${data.vorname} ${data.nachname},

vielen Dank für Deinen Mitgliedsantrag beim ASN Pfeil Phönix e.V.!

Wir haben Deinen Antrag erhalten und werden ihn zeitnah bearbeiten.
Du erhältst eine weitere Nachricht, sobald Deine Mitgliedschaft bestätigt wurde.

Deine Angaben:
- Abteilung:  ${data.abteilung_label}
- Kategorie:  ${data.kategorie_label}
- Beitrag:    ${data.betrag_jaehrlich} € / Jahr
- Eintritt:   ${data.eintrittsdatum}
- Antrag-ID:  ${antragId}

Bei Fragen: ${VEREIN_EMAIL}

Mit sportlichen Grüßen
Der Vorstand des ASN Pfeil Phönix e.V.
Marienbergstraße 41, 90411 Nürnberg`,
          }),
        }),
      ]);
    }

    return new Response(JSON.stringify({ success: true, antragId }), { status: 200, headers });
  } catch (err) {
    console.error('Antragsfehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
