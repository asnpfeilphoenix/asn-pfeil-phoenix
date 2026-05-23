// src/pages/api/submit-camp.ts
// Generates a PDF invoice (FS-2026-NNN) using pdfmake and sends as attachment
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

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
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0f2972';
    const mid = '#4a4f5c';
    const light = '#e4e6ee';
    const pageW = 495; // usable width at margin 50

    // ── Header ──────────────────────────────────────────────
    doc.rect(50, 50, 180, 28).stroke(navy);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(12)
      .text('ASN-PFEIL-PHÖNIX e.V.', 58, 58);

    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('ASN Pfeil Phönix e.V.', 350, 50, { width: 195, align: 'right' })
      .text('Marienbergstraße 41', { width: 195, align: 'right' })
      .text('90411 Nürnberg', { width: 195, align: 'right' });

    // ── Recipient ────────────────────────────────────────────
    doc.moveDown(3);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    if (data.erziehungsberechtigter) {
      doc.text(data.erziehungsberechtigter);
      doc.text(`${data.vorname} ${data.nachname} (Teilnehmer)`);
    } else {
      doc.text(`${data.vorname} ${data.nachname}`);
    }
    doc.text(data.strasse).text(`${data.plz} ${data.ort}`);

    // ── Meta table ───────────────────────────────────────────
    const metaY = doc.y + 20;
    doc.fontSize(9).fillColor(mid).text('Datum', 350, metaY, { width: 80 });
    doc.fillColor('black').font('Helvetica-Bold').text(data.rechnungDatum, 430, metaY, { width: 115 });
    doc.font('Helvetica').fillColor(mid).text('Rechnungs-Nr.', 350, metaY + 14, { width: 80 });
    doc.fillColor('black').font('Helvetica-Bold').text(data.rechnungNummer, 430, metaY + 14, { width: 115 });
    doc.font('Helvetica').fillColor(mid).text('Anmeldung-ID', 350, metaY + 28, { width: 80 });
    doc.fillColor('black').font('Helvetica').fontSize(7).text(data.anmeldungId, 430, metaY + 30, { width: 115 });

    // ── Title ────────────────────────────────────────────────
    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('black')
      .text(`Rechnung Nr. ${data.rechnungNummer}`);
    doc.font('Helvetica').fontSize(8).fillColor(mid)
      .text('Bitte bewahren Sie diese Rechnung mindestens zwei Jahre in Ihren Unterlagen auf.');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('black')
      .text('für die Anmeldung zum Sommer-Fußballcamp 2025 stellen wir Ihnen hiermit folgende Kosten in Rechnung:');

    // ── Line items table ─────────────────────────────────────
    const tableY = doc.y + 12;
    // Header row
    doc.rect(50, tableY, pageW, 22).fill(navy);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Anzahl', 54, tableY + 7, { width: 40 });
    doc.text('Bezeichnung', 100, tableY + 7, { width: 230 });
    doc.text('Einzelpreis', 335, tableY + 7, { width: 90, align: 'right' });
    doc.text('Gesamtpreis', 430, tableY + 7, { width: 115, align: 'right' });

    // Data row
    const rowY = tableY + 22;
    doc.fillColor('black').font('Helvetica').fontSize(9);
    doc.text('1', 54, rowY + 8, { width: 40 });
    doc.font('Helvetica-Bold').text('Sommer-Fußballcamp 2025', 100, rowY + 5, { width: 230 });
    doc.font('Helvetica').fontSize(8).fillColor(mid)
      .text(`3.–7. Aug. 2025, 9–12 Uhr | Team: ${data.team} | Trikot: ${data.trikotGroesse}`, 100, rowY + 17, { width: 230 });
    doc.fillColor('black').fontSize(9)
      .text('99,00 €', 335, rowY + 8, { width: 90, align: 'right' })
      .text('99,00 €', 430, rowY + 8, { width: 115, align: 'right' });
    doc.moveTo(50, rowY + 36).lineTo(545, rowY + 36).strokeColor(light).stroke();

    // ── Totals ───────────────────────────────────────────────
    const totY = rowY + 46;
    doc.fillColor(mid).fontSize(9)
      .text('Nettobetrag', 350, totY, { width: 80 })
      .text('MwSt. (befreit)', 350, totY + 14, { width: 80 });
    doc.fillColor('black')
      .text('99,00 €', 430, totY, { width: 115, align: 'right' })
      .text('0,00 €', 430, totY + 14, { width: 115, align: 'right' });

    // Total row
    const totRowY = totY + 32;
    doc.rect(350, totRowY, 195, 22).fill(navy);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
      .text('Rechnungsbetrag', 354, totRowY + 6, { width: 100 })
      .text('99,00 €', 354, totRowY + 6, { width: 187, align: 'right' });

    // ── Due date ─────────────────────────────────────────────
    doc.fillColor('black').font('Helvetica').fontSize(10)
      .text('Der Rechnungsbetrag ist ohne Abzug bis zum ', 50, totRowY + 36, { continued: true })
      .font('Helvetica-Bold').text('10. Juni 2025', { continued: true })
      .font('Helvetica').text(' zu begleichen.');

    // ── Payment info box ─────────────────────────────────────
    const payY = doc.y + 16;
    doc.rect(50, payY, pageW, 80).fill('#f0f3fc');
    doc.moveTo(50, payY).lineTo(50, payY + 80).strokeColor(navy).lineWidth(3).stroke();
    doc.lineWidth(1);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(10)
      .text('Bankverbindung', 62, payY + 10);
    doc.fillColor('black').font('Helvetica').fontSize(9)
      .text('Kontoinhaber: ASN Pfeil Phönix e.V.', 62, payY + 24)
      .text('Bank: Stadtsparkasse Nürnberg', 62, payY + 36)
      .text('IBAN: DE12 7605 0101 0001 4302 77', 62, payY + 48)
      .font('Helvetica-Bold')
      .text(`Verwendungszweck: ${data.rechnungNummer} – ${data.vorname} ${data.nachname}`, 62, payY + 60);

    // ── Footer ───────────────────────────────────────────────
    doc.moveTo(50, 760).lineTo(545, 760).strokeColor(light).stroke();
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de',
        50, 765, { align: 'center', width: pageW });

    doc.end();
  });
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
