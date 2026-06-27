// src/pages/api/foerdermitglied-reassign.ts
// Lets an admin manually assign or change the specific parking space
// for an already-approved Fördermitglied, then regenerates and resends the permit.
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
    const { antrag_id, new_parkplatz_nummer } = await request.json();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const newSpace = parseInt(new_parkplatz_nummer);
    if (!antrag_id || !newSpace || newSpace < 1) {
      return new Response(JSON.stringify({ error: 'antrag_id und eine gültige Platznummer sind erforderlich.' }), { status: 400, headers });
    }

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST = import.meta.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER = import.meta.env.SMTP_USER;
    const SMTP_PASS = import.meta.env.SMTP_PASS;
    const FROM_EMAIL = import.meta.env.FROM_EMAIL || SMTP_USER;
    const CHECK_URL = import.meta.env.PARKAUSWEIS_CHECK_URL || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/parkausweis-check';
    const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

    // Fetch the applicant
    const appRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}&select=*`, { headers: sbHeaders });
    const appRows = await appRes.json();
    if (!appRows.length) return new Response(JSON.stringify({ error: 'Antrag nicht gefunden.' }), { status: 404, headers });
    const applicant = appRows[0];
    if (applicant.status !== 'genehmigt') {
      return new Response(JSON.stringify({ error: 'Nur genehmigten Mitgliedern kann ein Platz zugewiesen werden.' }), { status: 400, headers });
    }

    // Check max_plaetze
    const configRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglied_config?id=eq.config&select=max_plaetze`, { headers: sbHeaders });
    const config = (await configRes.json())[0];
    const maxPlaetze = config?.max_plaetze ?? 15;
    if (newSpace > maxPlaetze) {
      return new Response(JSON.stringify({ error: `Platznummer darf maximal ${maxPlaetze} sein.` }), { status: 400, headers });
    }

    // Check the target space isn't already taken by someone else
    const occRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?status=eq.genehmigt&parkplatz_nummer=eq.${newSpace}&antrag_id=neq.${antrag_id}&select=vorname,nachname`, { headers: sbHeaders });
    const occRows = await occRes.json();
    if (occRows.length) {
      return new Response(JSON.stringify({ error: `Platz Nr. ${newSpace} ist bereits an ${occRows[0].vorname} ${occRows[0].nachname} vergeben.` }), { status: 409, headers });
    }

    // Update
    await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ parkplatz_nummer: newSpace }),
    });

    // Regenerate + resend permit
    if (SMTP_USER && SMTP_PASS && applicant.permit_code) {
      const pdf = await generatePermitPDF({
        permitCode: applicant.permit_code,
        name: `${applicant.anrede || ''} ${applicant.vorname} ${applicant.nachname}`.trim(),
        kennzeichen: applicant.kennzeichen, parkplatzLabel: `Nr. ${newSpace}`,
        gueltigVon: applicant.gueltig_von, gueltigBis: applicant.gueltig_bis,
        checkUrl: `${CHECK_URL}?code=${applicant.permit_code}`,
      });
      const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await transporter.sendMail({
        from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`, to: applicant.email,
        subject: `Dein Parkausweis wurde aktualisiert - neuer Stellplatz Nr. ${newSpace}`,
        text: `Hallo ${applicant.vorname} ${applicant.nachname},\n\ndir wurde ein neuer Stellplatz zugewiesen: Nr. ${newSpace}.\n\nDeinen aktualisierten Parkausweis findest du als PDF im Anhang. Der bisherige Ausweis mit der alten Platznummer ist nicht mehr gueltig.\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.`,
        attachments: [{ filename: `Parkausweis-${applicant.permit_code}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
    }

    return new Response(JSON.stringify({ success: true, parkplatz_nummer: newSpace }), { status: 200, headers });
  } catch (err: any) {
    console.error('Foerdermitglied-Reassign-Fehler:', err);
    return new Response(JSON.stringify({ error: err.message || 'Interner Serverfehler.' }), { status: 500, headers });
  }
};
