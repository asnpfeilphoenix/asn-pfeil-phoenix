// src/pages/api/submit-antrag.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const data = await request.json();

    const SUPABASE_URL   = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY   = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST      = import.meta.env.SMTP_HOST   || 'smtp.gmail.com';
    const SMTP_PORT      = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER      = import.meta.env.SMTP_USER;
    const SMTP_PASS      = import.meta.env.SMTP_PASS;
    const VEREIN_EMAIL   = import.meta.env.VEREIN_EMAIL || SMTP_USER;
    const TENNIS_EMAIL   = import.meta.env.TENNIS_EMAIL || VEREIN_EMAIL;
    const FROM_EMAIL     = import.meta.env.FROM_EMAIL   || SMTP_USER;
    const ADMIN_URL      = import.meta.env.ADMIN_URL    || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/antraege-2025';

    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase nicht konfiguriert.');

    const now = new Date();
    const eingegangen = now.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    });

    const isTennisFamilie = data.abteilung === 'tennis' &&
      ['ehepaar','jugend_standard','jugend_elternteil','jugend_zweitkind'].includes(data.kategorie) &&
      data.familienmitglieder?.some((fm: any) => fm.vorname);

    const familieGruppeId = isTennisFamilie
      ? `FAM-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`
      : null;

    const antragId = `ASN-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;

    const buildAntrag = (d: any, id: string, rolle: string | null, gruppeId: string | null) => ({
      antrag_id:               id,
      eingegangen_am:          now.toISOString(),
      anrede:                  d.anrede || data.anrede,
      vorname:                 d.vorname,
      nachname:                d.nachname,
      strasse:                 data.strasse,
      plz:                     data.plz,
      ort:                     data.ort,
      geburtsdatum:            d.geburtsdatum,
      telefon:                 data.telefon || null,
      email:                   data.email,
      eintrittsdatum:          data.eintrittsdatum,
      abteilung:               data.abteilung,
      abteilung_label:         data.abteilung_label,
      kategorie:               data.kategorie,
      kategorie_label:         data.kategorie_label,
      betrag_jaehrlich:        rolle === 'hauptmitglied' || !rolle ? data.betrag_jaehrlich : 0,
      arbeitsdienst_pauschale: rolle === 'hauptmitglied' || !rolle ? (data.arbeitsdienst_pauschale ?? 0) : 0,
      zahlungsart:             data.but_gutschein ? 'BuT-Gutschein' : 'SEPA-Lastschrift',
      kontoinhaber:            data.but_gutschein ? null : (data.kontoinhaber || null),
      iban:                    data.but_gutschein ? null : (data.iban || null),
      but_gutschein:           data.but_gutschein ?? false,
      recht_am_bild:           data.recht_am_bild ?? false,
      sonstiges:               data.sonstiges || null,
      satzung_anerkannt:       true,
      status:                  'offen',
      mitgliedschaftstyp:      isTennisFamilie ? 'tennis_familie' : (data.abteilung === 'tennis' ? 'tennis_einzel' : null),
      familie_gruppe_id:       gruppeId,
      familie_rolle:           rolle,
      nationalitaet:           d.nationalitaet || null,
      geschlecht:              d.geschlecht || null,
    });

    const rows = [buildAntrag(data, antragId, isTennisFamilie ? 'hauptmitglied' : null, familieGruppeId)];

    if (isTennisFamilie && data.familienmitglieder) {
      data.familienmitglieder.forEach((fm: any, i: number) => {
        if (!fm.vorname || !fm.nachname) return;
        const fmId = `ASN-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}-FM${i+1}`;
        rows.push(buildAntrag(fm, fmId, `familienmitglied_${i+1}`, familieGruppeId));
      });
    }

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/antraege`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(rows.length === 1 ? rows[0] : rows),
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      throw new Error(`Supabase Fehler: ${err}`);
    }

    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT, secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const notifyEmail = data.abteilung === 'tennis' ? TENNIS_EMAIL : VEREIN_EMAIL;

      const familieInfo = isTennisFamilie && data.familienmitglieder?.length > 0
        ? `\nFamilienmitglieder:\n${data.familienmitglieder
            .filter((fm: any) => fm.vorname)
            .map((fm: any, i: number) => `  ${i+1}. ${fm.vorname} ${fm.nachname}, geb. ${fm.geburtsdatum || '?'}, ${fm.geschlecht || '?'}`)
            .join('\n')}\nFamiliengruppe-ID: ${familieGruppeId}`
        : '';

      await Promise.allSettled([
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: notifyEmail,
          subject: `Neuer Mitgliedsantrag: ${data.vorname} ${data.nachname} (${data.abteilung_label})`,
          text: `Hallo,\n\nein neuer Mitgliedsantrag wartet auf Bearbeitung.\n\nAntragsteller: ${data.anrede} ${data.vorname} ${data.nachname}\nAbteilung:     ${data.abteilung_label} - ${data.kategorie_label}\nEingegangen:   ${eingegangen}\nAntrag-ID:     ${antragId}${familieInfo}\n\nBitte im Verwaltungsportal einloggen:\n${ADMIN_URL}\n\nDiese E-Mail enthaelt bewusst keine persoenlichen oder Bankdaten.`,
        }),
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: 'Dein Mitgliedsantrag beim ASN Pfeil Phoenix - Bestaetigung',
          text: `Hallo ${data.vorname} ${data.nachname},\n\nvielen Dank fuer Deinen Mitgliedsantrag beim ASN Pfeil Phoenix e.V.!\n\nWir haben Deinen Antrag erhalten und werden ihn zeitnah bearbeiten.\n\nDeine Angaben:\n- Abteilung:  ${data.abteilung_label}\n- Kategorie:  ${data.kategorie_label}\n- Beitrag:    ${data.betrag_jaehrlich} EUR / Jahr\n- Eintritt:   ${data.eintrittsdatum}\n- Antrag-ID:  ${antragId}\n\nBei Fragen: ${notifyEmail}\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.\nMarienbergstrasse 41, 90411 Nuernberg`,
        }),
      ]);
    }

    return new Response(JSON.stringify({ success: true, antragId }), { status: 200, headers });
  } catch (err) {
    console.error('Antragsfehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
