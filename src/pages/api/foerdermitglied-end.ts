// src/pages/api/foerdermitglied-end.ts
// Ends a membership, frees the parking space, and auto-promotes the oldest waitlisted applicant
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import SVGtoPDF from 'svg-to-pdfkit';
import logoSvg from '../../assets/asn-logo.svg?raw';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function generatePermitPDF(opts: {
  permitCode: string; name: string; kennzeichen: string; parkplatzLabel: string;
  gueltigVon: string | null; gueltigBis: string | null; checkUrl: string;
}): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(opts.checkUrl, { width: 220, margin: 1 });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const navy = '#0f2972', orange = '#E8780A', mid = '#4a4f5c', light = '#e4e6ee';
    doc.fillColor(navy);
    SVGtoPDF(doc, logoSvg, 50, 42, { width: 61.5, height: 62, preserveAspectRatio: 'xMidYMid meet' });
    doc.fillColor(mid).font('Helvetica').fontSize(8).text('Marienbergstraße 41', 350, 50, { width: 195, align: 'right' }).text('90411 Nürnberg', { width: 195, align: 'right' });
    doc.fillColor(orange).font('Helvetica-Bold').fontSize(22).text('PARKAUSWEIS', 50, 110);
    doc.fillColor(navy).font('Helvetica').fontSize(11).text(opts.permitCode, 50, 138);
    const isExpired = opts.gueltigBis ? new Date(opts.gueltigBis) < new Date() : false;
    doc.rect(50, 165, 495, 26).fill(isExpired ? '#fee2e2' : '#dcfce7');
    doc.fillColor(isExpired ? '#991b1b' : '#166534').font('Helvetica-Bold').fontSize(11).text(isExpired ? '✗ ABGELAUFEN' : '✓ GÜLTIG', 60, 173);
    const boxY = 210;
    doc.rect(50, boxY, 495, 160).fillAndStroke('#f8f9fc', light);
    doc.fillColor(mid).font('Helvetica').fontSize(9).text('NAME', 70, boxY + 18);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(14).text(opts.name, 70, boxY + 32);
    doc.fillColor(mid).font('Helvetica').fontSize(9).text('KENNZEICHEN', 70, boxY + 64);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(16).text(opts.kennzeichen, 70, boxY + 78);
    doc.fillColor(mid).font('Helvetica').fontSize(9).text('PARKPLATZ', 70, boxY + 112);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text(opts.parkplatzLabel, 70, boxY + 126);
    doc.fillColor(mid).font('Helvetica').fontSize(9).text('GÜLTIGKEIT', 320, boxY + 18);
    doc.fillColor('black').font('Helvetica-Bold').fontSize(12).text(`${fmtDate(opts.gueltigVon)}  bis  ${fmtDate(opts.gueltigBis)}`, 320, boxY + 32, { width: 200 });
    doc.image(qrBuffer, 410, boxY + 50, { width: 90 });
    doc.link(410, boxY + 50, 90, 90, opts.checkUrl);
    doc.fillColor(mid).font('Helvetica').fontSize(7).text('Zur Prüfung scannen', 405, boxY + 143, { width: 100, align: 'center' });
    const noticeY = boxY + 180;
    doc.rect(50, noticeY, 495, 70).fillAndStroke('#fffbeb', '#fde68a');
    doc.fillColor('#78350f').font('Helvetica-Bold').fontSize(8).text('WICHTIGER HINWEIS', 65, noticeY + 12);
    doc.fillColor('#78350f').font('Helvetica').fontSize(8.5).text(
      `Dieser Ausweis berechtigt ausschließlich zum Parken auf dem zugewiesenen Stellplatz ${opts.parkplatzLabel}. Das Parken auf anderen Stellplätzen ist nicht gestattet. ` +
      'Die Parkberechtigung ist ein Vorteil der Mitgliedschaft beim ASN Pfeil Phönix e.V. und kein eigenständiges Produkt. ' +
      'Fahrzeuge ohne gültigen Parkausweis oder auf falschem Stellplatz können kostenpflichtig abgeschleppt werden. ' +
      'Bei Ablauf der Mitgliedschaft verliert dieser Ausweis automatisch seine Gültigkeit.',
      65, noticeY + 26, { width: 460, lineGap: 1 }
    );
    doc.moveTo(50, 740).lineTo(545, 740).strokeColor(light).stroke();
    doc.fillColor(mid).font('Helvetica').fontSize(8).text('ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de', 50, 748, { align: 'center', width: 495 });
    doc.end();
  });
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { antrag_id } = await request.json();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST = import.meta.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER = import.meta.env.SMTP_USER;
    const SMTP_PASS = import.meta.env.SMTP_PASS;
    const FROM_EMAIL = import.meta.env.FROM_EMAIL || SMTP_USER;
    const CHECK_URL = import.meta.env.PARKAUSWEIS_CHECK_URL || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/parkausweis-check';
    const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

    // End the membership
    await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'beendet', beendet_am: new Date().toISOString() }),
    });

    // Find oldest waitlisted applicant
    const wlRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?status=eq.warteliste&order=eingegangen_am.asc&limit=1&select=*`, { headers: sbHeaders });
    const wlRows = await wlRes.json();
    if (!wlRows.length) return new Response(JSON.stringify({ success: true, promoted: false }), { status: 200, headers });

    const promoted = wlRows[0];

    // Determine a free parking space
    const configRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglied_config?id=eq.config&select=*`, { headers: sbHeaders });
    const config = (await configRes.json())[0];
    const maxPlaetze = config?.max_plaetze ?? 15;
    const gueltigJahr = config?.gueltig_jahr ?? new Date().getFullYear();

    const occRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?status=eq.genehmigt&select=parkplatz_nummer`, { headers: sbHeaders });
    const occupied = new Set((await occRes.json()).map((r: any) => r.parkplatz_nummer).filter((n: any) => n != null));
    let freeSpace: number | null = null;
    for (let i = 1; i <= maxPlaetze; i++) { if (!occupied.has(i)) { freeSpace = i; break; } }
    if (freeSpace === null) return new Response(JSON.stringify({ success: true, promoted: false, reason: 'no_space' }), { status: 200, headers });

    const now = new Date();
    const gueltigVon = now.toISOString().split('T')[0];
    const gueltigBis = `${gueltigJahr}-12-31`;

    const counterRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_invoice_counter`, {
      method: 'POST', headers: sbHeaders, body: JSON.stringify({ counter_id: `foerdermitglied_${gueltigJahr}` }),
    });
    let counterNum = 1;
    if (counterRes.ok) counterNum = await counterRes.json();
    const permitCode = `FM-${gueltigJahr}-${String(counterNum).padStart(3, '0')}`;

    await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${promoted.antrag_id}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: 'genehmigt', parkplatz_nummer: freeSpace, permit_code: permitCode,
        gueltig_von: gueltigVon, gueltig_bis: gueltigBis, genehmigt_am: now.toISOString(),
        warteliste_benachrichtigt_am: now.toISOString(),
      }),
    });

    if (SMTP_USER && SMTP_PASS) {
      const pdf = await generatePermitPDF({
        permitCode, name: `${promoted.anrede || ''} ${promoted.vorname} ${promoted.nachname}`.trim(),
        kennzeichen: promoted.kennzeichen, parkplatzLabel: `Nr. ${freeSpace}`,
        gueltigVon, gueltigBis, checkUrl: `${CHECK_URL}?code=${permitCode}`,
      });
      const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await transporter.sendMail({
        from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`, to: promoted.email,
        subject: `Ein Parkplatz ist frei geworden - Parkausweis ${permitCode}`,
        text: `Hallo ${promoted.vorname} ${promoted.nachname},\n\nein Parkplatz ist frei geworden! Du stehst nicht mehr auf der Warteliste - dir wurde der Parkplatz Nr. ${freeSpace} fest zugewiesen.\n\nGueltig: ${fmtDate(gueltigVon)} bis ${fmtDate(gueltigBis)}\n\nDeinen digitalen Parkausweis findest du als PDF im Anhang.\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.`,
        attachments: [{ filename: `Parkausweis-${permitCode}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
    }

    return new Response(JSON.stringify({ success: true, promoted: true, promoted_name: `${promoted.vorname} ${promoted.nachname}`, parkplatz_nummer: freeSpace }), { status: 200, headers });
  } catch (err) {
    console.error('Foerdermitglied-End-Fehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler.' }), { status: 500, headers });
  }
};
