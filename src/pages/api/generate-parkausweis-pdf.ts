// src/pages/api/generate-parkausweis-pdf.ts
// Generates a parking permit PDF with QR code, for both regular (FM-) and temporary (TEMP-) permits
export const prerender = false;
import type { APIRoute } from 'astro';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import SVGtoPDF from 'svg-to-pdfkit';
import logoSvg from '../../assets/asn-logo.svg?raw';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function generatePermitPDF(opts: {
  permitCode: string;
  name: string;
  kennzeichen: string;
  parkplatzLabel: string; // e.g. "Nr. 7" or "Unreservierter Stellplatz"
  parkplatzNummer: number | null; // null for temp / unassigned
  isTemp: boolean;
  gueltigVon: string | null;
  gueltigBis: string | null;
  adresse?: string;
  grund?: string;
  checkUrl: string;
}): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(opts.checkUrl, { width: 220, margin: 1 });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0f2972';
    const orange = '#E8780A';
    const mid = '#4a4f5c';
    const light = '#e4e6ee';

    // Header
    doc.fillColor(navy);
    SVGtoPDF(doc, logoSvg, 50, 42, { width: 61.5, height: 62, preserveAspectRatio: 'xMidYMid meet' });
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('Marienbergstraße 41', 350, 50, { width: 195, align: 'right' })
      .text('90411 Nürnberg', { width: 195, align: 'right' });

    // Title
    doc.moveDown(4);
    doc.fillColor(orange).font('Helvetica-Bold').fontSize(22).text('PARKAUSWEIS', 50, 110);
    doc.fillColor(navy).font('Helvetica').fontSize(11).text(opts.permitCode, 50, 138);

    if (opts.isTemp) {
      doc.roundedRect(50, 156, 165, 18, 9).fill(orange);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5).text('SPENDEN-DANKESCHÖN', 50, 161, { width: 165, align: 'center' });
    }

    // Status bar — pushed down when the donor badge is present, to avoid overlap
    const statusBarY = opts.isTemp ? 188 : 165;
    const isExpired = opts.gueltigBis ? new Date(opts.gueltigBis) < new Date() : false;
    doc.rect(50, statusBarY, 495, 26).fill(isExpired ? '#fee2e2' : '#dcfce7');
    doc.fillColor(isExpired ? '#991b1b' : '#166534').font('Helvetica-Bold').fontSize(11)
      .text(isExpired ? '✗ ABGELAUFEN' : '✓ GÜLTIG', 60, statusBarY + 8);

    // Details box
    const boxY = statusBarY + 45;
    doc.rect(50, boxY, 495, 160).fillAndStroke('#f8f9fc', light);
    doc.fillColor(mid).font('Helvetica').fontSize(9).text('NAME', 70, boxY + 18);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(14).text(opts.name, 70, boxY + 32);

    doc.fillColor(mid).font('Helvetica').fontSize(9).text('KENNZEICHEN', 70, boxY + 64);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(16).text(opts.kennzeichen, 70, boxY + 78);

    doc.fillColor(mid).font('Helvetica').fontSize(9).text('PARKPLATZ', 70, boxY + 112);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text(opts.parkplatzLabel, 70, boxY + 126);

    doc.fillColor(mid).font('Helvetica').fontSize(9).text('GÜLTIGKEIT', 320, boxY + 18);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(12)
      .text(`${fmtDate(opts.gueltigVon)}  bis  ${fmtDate(opts.gueltigBis)}`, 320, boxY + 32, { width: 200 });

    if (opts.grund) {
      doc.fillColor(mid).font('Helvetica').fontSize(9).text('ANLASS', 320, boxY + 64);
      doc.fillColor('black').font('Helvetica').fontSize(11).text(opts.grund, 320, boxY + 78, { width: 80 });
    }

    // QR code — positioned well within the detail box, clear of the notice box below
    doc.image(qrBuffer, 410, boxY + 50, { width: 90 });
    doc.link(410, boxY + 50, 90, 90, opts.checkUrl);
    doc.fillColor(mid).font('Helvetica').fontSize(7).text('Zur Prüfung scannen', 405, boxY + 143, { width: 100, align: 'center' });

    // Important notice — wording differs for donor thank-you vs. Fördermitglied permits
    const noticeY = boxY + 180;
    doc.rect(50, noticeY, 495, 70).fillAndStroke('#fffbeb', '#fde68a');
    doc.fillColor('#78350f').font('Helvetica-Bold').fontSize(8).text('WICHTIGER HINWEIS', 65, noticeY + 12);

    const noticeText = opts.isTemp
      ? 'Dieser Parkausweis ist ein Dankeschön des ASN Pfeil Phönix e.V. für Ihre Spende an den Verein und kein Mitgliedschaftsnachweis. ' +
        'Er berechtigt zum Parken auf einem freien, nicht reservierten Stellplatz auf dem Vereinsgelände — bitte keine nummerierten oder ' +
        'anderweitig gekennzeichneten Plätze nutzen, da diese festen Mitgliedern zugewiesen sind. Nach Ablauf des Gültigkeitszeitraums ' +
        'verliert dieser Ausweis automatisch seine Gültigkeit.'
      : `Dieser Ausweis berechtigt ausschließlich zum Parken auf dem zugewiesenen Stellplatz ${opts.parkplatzNummer ? 'Nr. ' + opts.parkplatzNummer : ''}. ` +
        'Das Parken auf anderen Stellplätzen ist nicht gestattet. Die Parkberechtigung ist ein Vorteil der Mitgliedschaft beim ASN Pfeil ' +
        'Phönix e.V. und kein eigenständiges Produkt. Fahrzeuge ohne gültigen Parkausweis oder auf falschem Stellplatz können ' +
        'kostenpflichtig abgeschleppt werden. Bei Ablauf der Mitgliedschaft verliert dieser Ausweis automatisch seine Gültigkeit.';

    doc.fillColor('#78350f').font('Helvetica').fontSize(8.5).text(noticeText, 65, noticeY + 26, { width: 460, lineGap: 1 });

    // Footer
    doc.moveTo(50, 740).lineTo(545, 740).strokeColor(light).stroke();
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de', 50, 748, { align: 'center', width: 495 });

    doc.end();
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const code = url.searchParams.get('code');
    if (!code) return new Response(JSON.stringify({ error: 'Code fehlt.' }), { status: 400 });

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
    const CHECK_URL = import.meta.env.PARKAUSWEIS_CHECK_URL || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/parkausweis-check';

    const isTemp = code.startsWith('TEMP-');
    const table = isTemp ? 'temp_parkausweise' : 'foerdermitglieder';

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?permit_code=eq.${encodeURIComponent(code)}&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error('Supabase error');
    const rows = await res.json();
    if (!rows.length) return new Response(JSON.stringify({ error: 'Nicht gefunden.' }), { status: 404 });
    const r = rows[0];

    const pdf = await generatePermitPDF({
      permitCode: r.permit_code,
      name: isTemp ? r.name : `${r.anrede || ''} ${r.vorname} ${r.nachname}`.trim(),
      kennzeichen: r.kennzeichen,
      parkplatzLabel: isTemp ? 'Unreservierter Stellplatz' : (r.parkplatz_nummer ? `Nr. ${r.parkplatz_nummer}` : '—'),
      parkplatzNummer: isTemp ? null : (r.parkplatz_nummer ?? null),
      isTemp,
      gueltigVon: r.gueltig_von, gueltigBis: r.gueltig_bis,
      adresse: isTemp ? r.adresse : `${r.strasse || ''}, ${r.plz || ''} ${r.ort || ''}`,
      grund: isTemp ? r.grund : undefined,
      checkUrl: `${CHECK_URL}?code=${r.permit_code}`,
    });

    return new Response(pdf, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Parkausweis-${r.permit_code}.pdf"` },
    });
  } catch (err) {
    console.error('Parkausweis PDF error:', err);
    return new Response(JSON.stringify({ error: 'Fehler bei der PDF-Erstellung.' }), { status: 500 });
  }
};

export { generatePermitPDF };
