// src/pages/api/submit-antrag.ts
// Speichert Anträge in Supabase, sendet E-Mails via Gmail SMTP (nodemailer)
//
// Erforderliche Umgebungsvariablen:
//   SUPABASE_URL          — Project URL aus Supabase Dashboard
//   SUPABASE_SERVICE_KEY  — service_role key
//   SMTP_HOST             — smtp.gmail.com
//   SMTP_PORT             — 587
//   SMTP_USER             — Gmail-Adresse
//   SMTP_PASS             — Gmail App-Passwort (16 Zeichen)
//   VEREIN_EMAIL          — Empfänger-E-Mail des Vereins
//   FROM_EMAIL            — Absender-E-Mail (gleich wie SMTP_USER)
//   ADMIN_URL             — URL zum Admin-Portal

export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const data = await request.json();

    const SUPABASE_URL   = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY   = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST      = import.meta.env.SMTP_HOST      || 'smtp.gmail.com';
    const SMTP_PORT      = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER      = import.meta.env.SMTP_USER;
    const SMTP_PASS      = import.meta.env.SMTP_PASS;
    const VEREIN_EMAIL   = import.meta.env.VEREIN_EMAIL   || SMTP_USER;
    const FROM_EMAIL     = import.meta.env.FROM_EMAIL     || SMTP_USER;
    const ADMIN_URL      = import.meta.env.ADMIN_URL      || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/antraege-2025';

    // ── Antrag-ID & Zeitstempel ───────────────────────────────
    const antragId = `ASN-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
    const now = new Date();
    const eingegangen = now.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    });

    // ── In Supabase speichern ─────────────────────────────────
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

    // ── E-Mails senden via nodemailer ─────────────────────────
    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: false, // STARTTLS on port 587
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      // Benachrichtigung an Verein — bewusst KEINE sensiblen Daten
      const vereinsMailText = `Hallo,

ein neuer Mitgliedsantrag wartet auf Bearbeitung.

Antragsteller: ${data.anrede} ${data.vorname} ${data.nachname}
Abteilung:     ${data.abteilung_label} - ${data.kategorie_label}
Eingegangen:   ${eingegangen}
Antrag-ID:     ${antragId}

Bitte im Verwaltungsportal einloggen:
${ADMIN_URL}

Diese E-Mail enthaelt bewusst keine persoenlichen oder Bankdaten.
Alle Daten sind sicher im Verwaltungsportal abrufbar.`;

      // Bestaetigung an Antragsteller
      const bestaetigungsMailText = `Hallo ${data.vorname} ${data.nachname},

vielen Dank fuer Deinen Mitgliedsantrag beim ASN Pfeil Phoenix e.V.!

Wir haben Deinen Antrag erhalten und werden ihn zeitnah bearbeiten.
Du erhaeltst eine weitere Nachricht, sobald Deine Mitgliedschaft bestaetigt wurde.

Deine Angaben:
- Abteilung:  ${data.abteilung_label}
- Kategorie:  ${data.kategorie_label}
- Beitrag:    ${data.betrag_jaehrlich} EUR / Jahr
- Eintritt:   ${data.eintrittsdatum}
- Antrag-ID:  ${antragId}

Bei Fragen: ${VEREIN_EMAIL}

Mit sportlichen Gruessen
Der Vorstand des ASN Pfeil Phoenix e.V.
Marienbergstrasse 41, 90411 Nuernberg`;

      await Promise.allSettled([
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: VEREIN_EMAIL,
          subject: `Neuer Mitgliedsantrag: ${data.vorname} ${data.nachname} (${data.abteilung_label})`,
          text: vereinsMailText,
        }),
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: 'Dein Mitgliedsantrag beim ASN Pfeil Phoenix - Bestaetigung',
          text: bestaetigungsMailText,
        }),
      ]);
    }

    return new Response(JSON.stringify({ success: true, antragId }), { status: 200, headers });
  } catch (err) {
    console.error('Antragsfehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
