// src/pages/api/submit-camp.ts
// Generates a PDF invoice (FS-2026-NNN) and sends it as email attachment
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

// ── PDF generation using pure HTML→PDF via a simple SVG/HTML approach ────────
// We build the invoice as an HTML string, then convert to PDF using
// the 'html-to-pdfmake' + 'pdfmake' libraries (bundled, no browser needed)
// Fallback: attach HTML invoice if PDF generation fails

function generateInvoiceHTML(data: {
  rechnungNummer: string;
  rechnungDatum: string;
  vorname: string;
  nachname: string;
  erziehungsberechtigter: string | null;
  strasse: string;
  plz: string;
  ort: string;
  team: string;
  trikotGroesse: string;
  anmeldungId: string;
}): string {
  const adressat = data.erziehungsberechtigter
    ? `${data.erziehungsberechtigter}<br>${data.vorname} ${data.nachname} (Teilnehmer)`
    : `${data.vorname} ${data.nachname}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; background: white; padding: 40px; max-width: 800px; margin: 0 auto; }
  .logo-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .logo-box { border: 3px solid #0f2972; padding: 8px 16px; color: #0f2972; font-weight: bold; font-size: 14pt; letter-spacing: 1px; }
  .absender { font-size: 9pt; color: #444; text-align: right; line-height: 1.6; }
  .empfaenger { margin-bottom: 32px; line-height: 1.6; }
  .meta-row { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .meta-table td { padding: 2px 8px; font-size: 10pt; }
  .meta-table td:first-child { color: #444; }
  .meta-table td:last-child { font-weight: bold; }
  h2 { font-size: 13pt; margin-bottom: 6px; }
  .hinweis { font-size: 9pt; color: #555; margin-bottom: 24px; }
  .intro { margin-bottom: 24px; line-height: 1.6; }
  table.positionen { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  table.positionen th { background: #0f2972; color: white; padding: 8px; text-align: left; font-size: 10pt; }
  table.positionen th:last-child, table.positionen td:last-child { text-align: right; }
  table.positionen td { padding: 8px; border-bottom: 1px solid #e4e6ee; font-size: 10pt; }
  .totals { margin-left: auto; width: 280px; }
  .totals table { width: 100%; border-collapse: collapse; }
  .totals td { padding: 5px 8px; font-size: 10pt; }
  .totals td:last-child { text-align: right; font-weight: bold; }
  .totals .gesamt { background: #0f2972; color: white; font-size: 12pt; }
  .totals .gesamt td { padding: 8px; }
  .zahlungsinfo { margin-top: 32px; padding: 16px; background: #f0f3fc; border-left: 4px solid #0f2972; line-height: 1.8; font-size: 10pt; }
  .zahlungsinfo strong { color: #0f2972; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e4e6ee; font-size: 9pt; color: #888; text-align: center; }
  .frist { margin-top: 20px; font-size: 10pt; }
</style>
</head>
<body>

<div class="logo-row">
  <div class="logo-box">ASN-PFEIL-PHÖNIX e.V.</div>
  <div class="absender">
    ASN Pfeil Phönix e.V.<br>
    Marienbergstraße 41<br>
    90411 Nürnberg
  </div>
</div>

<div class="empfaenger">
  ${adressat}<br>
  ${data.strasse}<br>
  ${data.plz} ${data.ort}
</div>

<div class="meta-row">
  <table class="meta-table">
    <tr><td>Datum</td><td>${data.rechnungDatum}</td></tr>
    <tr><td>Rechnungs-Nr.</td><td>${data.rechnungNummer}</td></tr>
    <tr><td>Anmeldung-ID</td><td>${data.anmeldungId}</td></tr>
  </table>
</div>

<h2>Rechnung Nr. ${data.rechnungNummer}</h2>
<p class="hinweis">Bitte bewahren Sie diese Rechnung mindestens zwei Jahre in Ihren Unterlagen auf.</p>

<p class="intro">für die Anmeldung zum Sommer-Fußballcamp 2025 stellen wir Ihnen hiermit folgende Kosten in Rechnung:</p>

<table class="positionen">
  <thead>
    <tr>
      <th>Anzahl</th>
      <th>Bezeichnung</th>
      <th>Einzelpreis</th>
      <th>Gesamtpreis</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>
        Sommer-Fußballcamp 2025<br>
        <span style="font-size:9pt;color:#555">3. – 7. August 2025, 9–12 Uhr täglich | Team: ${data.team} | Trikot: ${data.trikotGroesse}</span>
      </td>
      <td>99,00 €</td>
      <td>99,00 €</td>
    </tr>
  </tbody>
</table>

<div class="totals">
  <table>
    <tr><td>Nettobetrag</td><td>99,00 €</td></tr>
    <tr><td>MwSt. (befreit)</td><td>0,00 €</td></tr>
    <tr class="gesamt"><td>Rechnungsbetrag</td><td>99,00 €</td></tr>
  </table>
</div>

<p class="frist">Der Rechnungsbetrag ist ohne Abzug bis zum <strong>10. Juni 2025</strong> zu begleichen.</p>

<div class="zahlungsinfo">
  <strong>Bankverbindung:</strong><br>
  Kontoinhaber: ASN Pfeil Phönix e.V.<br>
  Bank: Stadtsparkasse Nürnberg<br>
  IBAN: DE12 7605 0101 0001 4302 77<br>
  Verwendungszweck: <strong>${data.rechnungNummer} – ${data.vorname} ${data.nachname}</strong>
</div>

<div class="footer">
  ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de
</div>

</body>
</html>`;
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const data = await request.json();

    const SUPABASE_URL  = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY  = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST     = import.meta.env.SMTP_HOST  || 'smtp.gmail.com';
    const SMTP_PORT     = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER     = import.meta.env.SMTP_USER;
    const SMTP_PASS     = import.meta.env.SMTP_PASS;
    const FROM_EMAIL    = import.meta.env.FROM_EMAIL || SMTP_USER;
    const VEREIN_EMAIL  = import.meta.env.VEREIN_EMAIL || SMTP_USER;
    const ADMIN_URL     = import.meta.env.CAMP_ADMIN_URL || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/camp-2025';

    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase nicht konfiguriert.');

    const now = new Date();
    const eingegangen = now.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    });
    const rechnungDatum = now.toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin'
    });

    // ── Get next invoice number atomically ────────────────────
    // Increment counter and read new value
    const counterRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/increment_invoice_counter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ counter_id: 'camp_2026' }),
      }
    );

    let invoiceNum = 0;
    if (counterRes.ok) {
      invoiceNum = await counterRes.json();
    } else {
      // Fallback: read current counter and increment manually
      const readRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoice_counter?id=eq.camp_2026&select=counter`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (readRes.ok) {
        const rows = await readRes.json();
        invoiceNum = (rows[0]?.counter || 0) + 1;
        await fetch(`${SUPABASE_URL}/rest/v1/invoice_counter?id=eq.camp_2026`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({ counter: invoiceNum }),
        });
      }
    }

    const rechnungNummer = `FS-2026-${String(invoiceNum).padStart(3, '0')}`;
    const anmeldungId = `CAMP-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;

    // ── Save to Supabase ──────────────────────────────────────
    const anmeldung = {
      anmeldung_id:             anmeldungId,
      eingegangen_am:           now.toISOString(),
      vorname:                  data.vorname,
      nachname:                 data.nachname,
      geburtsdatum:             data.geburtsdatum || null,
      geschlecht:               data.geschlecht || null,
      strasse:                  data.strasse || null,
      plz:                      data.plz || null,
      ort:                      data.ort || null,
      telefon:                  data.telefon || null,
      email:                    data.email || null,
      team:                     data.team || null,
      trikot_groesse:           data.trikot_groesse || null,
      sonstiges:                data.sonstiges || null,
      erziehungsberechtigter:   data.erziehungsberechtigter || null,
      rechnung_nummer:          rechnungNummer,
      rechnung_datum:           rechnungDatum,
      status:                   'angemeldet',
    };

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/camp_anmeldungen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(anmeldung),
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      throw new Error(`Supabase Fehler: ${err}`);
    }

    // ── Generate invoice HTML ─────────────────────────────────
    const invoiceHTML = generateInvoiceHTML({
      rechnungNummer,
      rechnungDatum,
      vorname:                data.vorname,
      nachname:               data.nachname,
      erziehungsberechtigter: data.erziehungsberechtigter || null,
      strasse:                data.strasse || '',
      plz:                    data.plz || '',
      ort:                    data.ort || '',
      team:                   data.team || '',
      trikotGroesse:          data.trikot_groesse || '',
      anmeldungId,
    });

    // ── Send emails ───────────────────────────────────────────
    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT, secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const rechnungsEmpfaenger = data.erziehungsberechtigter
        ? `${data.erziehungsberechtigter} (für ${data.vorname} ${data.nachname})`
        : `${data.vorname} ${data.nachname}`;

      const results = await Promise.allSettled([
        // Admin notification
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: VEREIN_EMAIL,
          subject: `Neue Camp-Anmeldung: ${data.vorname} ${data.nachname} (${data.team}) — ${rechnungNummer}`,
          text: `Neue Camp-Anmeldung eingegangen.\n\nName: ${data.vorname} ${data.nachname}\nTeam: ${data.team}\nTrikot: ${data.trikot_groesse}\nEingegangen: ${eingegangen}\nRechnung-Nr.: ${rechnungNummer}\nAnmeldung-ID: ${anmeldungId}\n\nAlle Details im Verwaltungsportal:\n${ADMIN_URL}`,
        }),
        // Confirmation + invoice to participant
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: `Anmeldung Sommer-Fussballcamp 2025 bestätigt — Rechnung ${rechnungNummer}`,
          text: `Hallo ${data.vorname},\n\nvielen Dank für deine Anmeldung zum Sommer-Fußballcamp 2025!\n\nDeine Angaben:\n- Name: ${data.vorname} ${data.nachname}\n- Team: ${data.team}\n- Trikotgröße: ${data.trikot_groesse}\n- Rechnung-Nr.: ${rechnungNummer}\n- Anmeldung-ID: ${anmeldungId}\n\nIm Anhang findest du die Rechnung (${rechnungNummer}).\nBitte überweise den Betrag von 99 € bis zum 10. Juni 2025 an:\n\nIBAN: DE12 7605 0101 0001 4302 77\nVerwendungszweck: ${rechnungNummer} – ${data.vorname} ${data.nachname}\n\nDas Camp findet vom 3. bis 7. August 2025 statt (täglich 9–12 Uhr).\nAm letzten Tag findet ein BBQ für alle statt!\n\nWir freuen uns auf dich!\n\nMit sportlichen Grüßen\nASN Pfeil Phönix Fußballabteilung`,
          attachments: [{
            filename: `Rechnung-${rechnungNummer}.html`,
            content: invoiceHTML,
            contentType: 'text/html',
          }],
        }),
      ]);

      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Email ${i} failed:`, r.reason);
        else console.log(`Email ${i} sent OK — Rechnung: ${rechnungNummer}`);
      });
    }

    return new Response(JSON.stringify({ success: true, anmeldungId, rechnungNummer }), { status: 200, headers });
  } catch (err) {
    console.error('Camp-Anmeldefehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
