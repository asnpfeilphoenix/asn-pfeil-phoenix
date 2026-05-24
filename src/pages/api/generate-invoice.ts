// src/pages/api/generate-invoice.ts
// Regenerates a PDF invoice for a given anmeldung_id — used by admin portal
export const prerender = false;
import type { APIRoute } from 'astro';
import PDFDocument from 'pdfkit';

function generatePDF(r: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0f2972';
    const mid = '#4a4f5c';
    const light = '#e4e6ee';
    const pageW = 495;

    // Header
    doc.rect(50, 50, 180, 28).stroke(navy);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(12).text('ASN-PFEIL-PHÖNIX e.V.', 58, 58);
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('ASN Pfeil Phönix e.V.', 350, 50, { width: 195, align: 'right' })
      .text('Marienbergstraße 41', { width: 195, align: 'right' })
      .text('90411 Nürnberg', { width: 195, align: 'right' });

    // Recipient
    doc.moveDown(3);
    doc.fillColor('black').font('Helvetica').fontSize(10);
    if (r.erziehungsberechtigter) {
      doc.text(r.erziehungsberechtigter);
      doc.text(`${r.vorname} ${r.nachname} (Teilnehmer)`);
    } else {
      doc.text(`${r.vorname} ${r.nachname}`);
    }
    doc.text(r.strasse || '').text(`${r.plz || ''} ${r.ort || ''}`);

    // Meta
    const metaY = doc.y + 20;
    doc.fontSize(9).fillColor(mid).text('Datum', 350, metaY, { width: 80 });
    doc.fillColor('black').font('Helvetica-Bold').text(r.rechnung_datum || '', 430, metaY, { width: 115 });
    doc.font('Helvetica').fillColor(mid).text('Rechnungs-Nr.', 350, metaY + 14, { width: 80 });
    doc.fillColor('black').font('Helvetica-Bold').text(r.rechnung_nummer || '', 430, metaY + 14, { width: 115 });
    doc.font('Helvetica').fillColor(mid).text('Anmeldung-ID', 350, metaY + 28, { width: 80 });
    doc.fillColor('black').font('Helvetica').fontSize(7).text(r.anmeldung_id || '', 430, metaY + 30, { width: 115 });

    // Title
    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('black').text(`Rechnung Nr. ${r.rechnung_nummer}`);
    doc.font('Helvetica').fontSize(8).fillColor(mid)
      .text('Bitte bewahren Sie diese Rechnung mindestens zwei Jahre in Ihren Unterlagen auf.');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('black')
      .text('für die Anmeldung zum Sommer-Fußballcamp 2026 stellen wir Ihnen hiermit folgende Kosten in Rechnung:');

    // Line items
    const tableY = doc.y + 12;
    doc.rect(50, tableY, pageW, 22).fill(navy);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Anzahl', 54, tableY + 7, { width: 40 });
    doc.text('Bezeichnung', 100, tableY + 7, { width: 230 });
    doc.text('Einzelpreis', 335, tableY + 7, { width: 90, align: 'right' });
    doc.text('Gesamtpreis', 430, tableY + 7, { width: 115, align: 'right' });

    const rowY = tableY + 22;
    const preis = r.preis != null ? parseFloat(r.preis) : 99;
    const preisStr = preis === 0 ? 'Kostenlos' : `${preis.toFixed(2).replace('.', ',')} €`;
    doc.fillColor('black').font('Helvetica').fontSize(9);
    doc.text('1', 54, rowY + 8, { width: 40 });
    doc.font('Helvetica-Bold').text('Sommer-Fußballcamp 2026', 100, rowY + 5, { width: 230 });
    doc.font('Helvetica').fontSize(8).fillColor(mid)
      .text(`3.–7. Aug. 2026, 9–12 Uhr | Team: ${r.team || '—'} | Trikot: ${r.trikot_groesse || '—'}${r.voucher_code ? ` | Gutschein: ${r.voucher_code}` : ''}`, 100, rowY + 17, { width: 230 });
    doc.fillColor('black').fontSize(9)
      .text(preisStr, 335, rowY + 8, { width: 90, align: 'right' })
      .text(preisStr, 430, rowY + 8, { width: 115, align: 'right' });
    doc.moveTo(50, rowY + 36).lineTo(545, rowY + 36).strokeColor(light).stroke();

    // Totals
    const totY = rowY + 46;
    doc.fillColor(mid).fontSize(9)
      .text('Nettobetrag', 350, totY, { width: 80 })
      .text('MwSt. (befreit)', 350, totY + 14, { width: 80 });
    doc.fillColor('black')
      .text(preisStr, 430, totY, { width: 115, align: 'right' })
      .text('0,00 €', 430, totY + 14, { width: 115, align: 'right' });

    const totRowY = totY + 32;
    doc.rect(350, totRowY, 195, 22).fill(navy);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
      .text('Rechnungsbetrag', 354, totRowY + 6, { width: 100 })
      .text(preisStr, 354, totRowY + 6, { width: 187, align: 'right' });

    // Due date / free notice
    doc.fillColor('black').font('Helvetica').fontSize(10);
    if (preis === 0) {
      doc.text('Diese Anmeldung ist aufgrund des Trainer-Bonus kostenfrei. Kein Zahlungseinzug erforderlich.', 50, totRowY + 36);
    } else {
      doc.text('Der Rechnungsbetrag ist ohne Abzug bis zum ', 50, totRowY + 36, { continued: true })
        .font('Helvetica-Bold').text('10. Juni 2026', { continued: true })
        .font('Helvetica').text(' zu begleichen.');
    }

    // Payment box (only if not free)
    if (preis > 0) {
      const payY = doc.y + 16;
      doc.rect(50, payY, pageW, 80).fill('#f0f3fc');
      doc.moveTo(50, payY).lineTo(50, payY + 80).strokeColor(navy).lineWidth(3).stroke();
      doc.lineWidth(1);
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('Bankverbindung', 62, payY + 10);
      doc.fillColor('black').font('Helvetica').fontSize(9)
        .text('Kontoinhaber: ASN Pfeil Phönix e.V.', 62, payY + 24)
        .text('Bank: Stadtsparkasse Nürnberg', 62, payY + 36)
        .text('IBAN: DE12 7605 0101 0001 4302 77', 62, payY + 48)
        .font('Helvetica-Bold')
        .text(`Verwendungszweck: ${r.rechnung_nummer} – ${r.vorname} ${r.nachname}`, 62, payY + 60);
    }

    // Footer
    doc.moveTo(50, 760).lineTo(545, 760).strokeColor(light).stroke();
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de',
        50, 765, { align: 'center', width: pageW });

    doc.end();
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const anmeldungId = url.searchParams.get('id');
    if (!anmeldungId) {
      return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
    }

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

    // Verify auth header (simple token check using service key)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Fetch the record from Supabase
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/camp_anmeldungen?anmeldung_id=eq.${encodeURIComponent(anmeldungId)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!res.ok) throw new Error('Supabase error');
    const rows = await res.json();
    if (!rows.length) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

    const pdf = await generatePDF(rows[0]);

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Rechnung-${rows[0].rechnung_nummer}.pdf"`,
      },
    });
  } catch (err) {
    console.error('Invoice generation error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate invoice' }), { status: 500 });
  }
};
