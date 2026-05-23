// src/pages/api/submit-camp.ts
// Generates a PDF invoice (FS-2026-NNN) using pdfmake and sends as attachment
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import PdfPrinter from 'pdfmake';

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

function generateInvoicePDF(data: {
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
}): Buffer {
  const printer = new PdfPrinter(fonts);

  const empfaenger = data.erziehungsberechtigter
    ? `${data.erziehungsberechtigter}\n${data.vorname} ${data.nachname} (Teilnehmer)\n${data.strasse}\n${data.plz} ${data.ort}`
    : `${data.vorname} ${data.nachname}\n${data.strasse}\n${data.plz} ${data.ort}`;

  const docDefinition: any = {
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    pageMargins: [50, 50, 50, 50],
    content: [
      // Header row
      {
        columns: [
          {
            stack: [
              {
                table: {
                  body: [[{ text: 'ASN-PFEIL-PHÖNIX e.V.', bold: true, fontSize: 13, color: '#0f2972', margin: [6, 4, 6, 4] }]],
                },
                layout: { hLineColor: () => '#0f2972', vLineColor: () => '#0f2972', hLineWidth: () => 2, vLineWidth: () => 2 },
              },
            ],
            width: '*',
          },
          {
            text: 'ASN Pfeil Phönix e.V.\nMarienbergstraße 41\n90411 Nürnberg',
            alignment: 'right', fontSize: 9, color: '#444',
            width: 180,
          },
        ],
        marginBottom: 30,
      },
      // Recipient
      { text: empfaenger, marginBottom: 25, lineHeight: 1.4 },
      // Meta table (right-aligned)
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 220,
            table: {
              widths: ['auto', '*'],
              body: [
                [{ text: 'Datum', color: '#444' }, { text: data.rechnungDatum, bold: true }],
                [{ text: 'Rechnungs-Nr.', color: '#444' }, { text: data.rechnungNummer, bold: true }],
                [{ text: 'Anmeldung-ID', color: '#444' }, { text: data.anmeldungId, bold: true, fontSize: 8 }],
              ],
            },
            layout: 'noBorders',
          },
        ],
        marginBottom: 20,
      },
      // Title
      { text: `Rechnung Nr. ${data.rechnungNummer}`, fontSize: 13, bold: true, marginBottom: 4 },
      { text: 'Bitte bewahren Sie diese Rechnung mindestens zwei Jahre in Ihren Unterlagen auf.', fontSize: 8, color: '#555', marginBottom: 16 },
      { text: 'für die Anmeldung zum Sommer-Fußballcamp 2025 stellen wir Ihnen hiermit folgende Kosten in Rechnung:', marginBottom: 16, lineHeight: 1.4 },
      // Line items table
      {
        table: {
          widths: [40, '*', 70, 70],
          headerRows: 1,
          body: [
            [
              { text: 'Anzahl', bold: true, color: 'white', fillColor: '#0f2972', margin: [4, 6, 4, 6] },
              { text: 'Bezeichnung', bold: true, color: 'white', fillColor: '#0f2972', margin: [4, 6, 4, 6] },
              { text: 'Einzelpreis', bold: true, color: 'white', fillColor: '#0f2972', alignment: 'right', margin: [4, 6, 4, 6] },
              { text: 'Gesamtpreis', bold: true, color: 'white', fillColor: '#0f2972', alignment: 'right', margin: [4, 6, 4, 6] },
            ],
            [
              { text: '1', margin: [4, 6, 4, 6] },
              {
                stack: [
                  { text: 'Sommer-Fußballcamp 2025', bold: true },
                  { text: `3. – 7. August 2025, 9–12 Uhr täglich | Team: ${data.team} | Trikot: ${data.trikotGroesse}`, fontSize: 8, color: '#555' },
                ],
                margin: [4, 6, 4, 6],
              },
              { text: '99,00 €', alignment: 'right', margin: [4, 6, 4, 6] },
              { text: '99,00 €', alignment: 'right', margin: [4, 6, 4, 6] },
            ],
          ],
        },
        layout: { hLineColor: () => '#e4e6ee', vLineColor: () => 'white' },
        marginBottom: 16,
      },
      // Totals
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 220,
            table: {
              widths: ['*', 80],
              body: [
                [{ text: 'Nettobetrag', margin: [4, 4, 4, 4] }, { text: '99,00 €', alignment: 'right', margin: [4, 4, 4, 4] }],
                [{ text: 'MwSt. (befreit)', margin: [4, 4, 4, 4] }, { text: '0,00 €', alignment: 'right', margin: [4, 4, 4, 4] }],
                [
                  { text: 'Rechnungsbetrag', bold: true, color: 'white', fillColor: '#0f2972', fontSize: 11, margin: [4, 6, 4, 6] },
                  { text: '99,00 €', bold: true, color: 'white', fillColor: '#0f2972', fontSize: 11, alignment: 'right', margin: [4, 6, 4, 6] },
                ],
              ],
            },
            layout: { hLineColor: () => '#e4e6ee', vLineColor: () => '#e4e6ee' },
          },
        ],
        marginBottom: 16,
      },
      { text: 'Der Rechnungsbetrag ist ohne Abzug bis zum 10. Juni 2025 zu begleichen.', marginBottom: 24 },
      // Payment info box
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'Bankverbindung', bold: true, color: '#0f2972', marginBottom: 6 },
              { text: 'Kontoinhaber: ASN Pfeil Phönix e.V.', lineHeight: 1.6 },
              { text: 'Bank: Stadtsparkasse Nürnberg', lineHeight: 1.6 },
              { text: 'IBAN: DE12 7605 0101 0001 4302 77', lineHeight: 1.6 },
              { text: `Verwendungszweck: ${data.rechnungNummer} – ${data.vorname} ${data.nachname}`, bold: true, lineHeight: 1.6 },
            ],
            fillColor: '#f0f3fc',
            margin: [12, 12, 12, 12],
          }]],
        },
        layout: { hLineColor: () => '#0f2972', vLineColor: () => '#0f2972', hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0, vLineWidth: (i: number, node: any) => (i === 0) ? 3 : 0 },
        marginBottom: 40,
      },
      // Footer
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: '#e4e6ee' }], marginBottom: 8 },
      { text: 'ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de', fontSize: 8, color: '#888', alignment: 'center' },
    ],
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  }) as unknown as Buffer;
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

    // ── Generate invoice PDF ──────────────────────────────────
    const invoicePdf = await generateInvoicePDF({
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

      const results = await Promise.allSettled([
        // Admin notification
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: VEREIN_EMAIL,
          subject: `Neue Camp-Anmeldung: ${data.vorname} ${data.nachname} (${data.team}) — ${rechnungNummer}`,
          text: `Neue Camp-Anmeldung eingegangen.\n\nName: ${data.vorname} ${data.nachname}\nTeam: ${data.team}\nTrikot: ${data.trikot_groesse}\nEingegangen: ${eingegangen}\nRechnung-Nr.: ${rechnungNummer}\nAnmeldung-ID: ${anmeldungId}\n\nAlle Details im Verwaltungsportal:\n${ADMIN_URL}`,
        }),
        // Confirmation + PDF invoice to participant
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: `Anmeldung Sommer-Fussballcamp 2025 bestätigt — Rechnung ${rechnungNummer}`,
          text: `Hallo ${data.vorname},\n\nvielen Dank fuer deine Anmeldung zum Sommer-Fussballcamp 2025!\n\nDeine Rechnung (${rechnungNummer}) ist als PDF im Anhang.\nBitte ueberweise 99 EUR bis zum 10. Juni 2025 an:\nIBAN: DE12 7605 0101 0001 4302 77\nVerwendungszweck: ${rechnungNummer} - ${data.vorname} ${data.nachname}\n\nDas Camp findet vom 3. bis 7. August 2025 statt (taeglich 9-12 Uhr).\n\nMit sportlichen Gruessen\nASN Pfeil Phoenix Fussballabteilung`,
          attachments: [{
            filename: `Rechnung-${rechnungNummer}.pdf`,
            content: invoicePdf,
            contentType: 'application/pdf',
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
