// src/pages/api/foerdermitglied-approve.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

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

    doc.rect(50, 50, 200, 30).stroke(navy);
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(13).text('ASN-PFEIL-PHÖNIX e.V.', 58, 59);
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('Marienbergstraße 41', 350, 50, { width: 195, align: 'right' })
      .text('90411 Nürnberg', { width: 195, align: 'right' });

    doc.fillColor(orange).font('Helvetica-Bold').fontSize(22).text('PARKAUSWEIS', 50, 110);
    doc.fillColor(navy).font('Helvetica').fontSize(11).text(opts.permitCode, 50, 138);

    const isExpired = opts.gueltigBis ? new Date(opts.gueltigBis) < new Date() : false;
    doc.rect(50, 165, 495, 26).fill(isExpired ? '#fee2e2' : '#dcfce7');
    doc.fillColor(isExpired ? '#991b1b' : '#166534').font('Helvetica-Bold').fontSize(11)
      .text(isExpired ? '✗ ABGELAUFEN' : '✓ GÜLTIG', 60, 173);

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
    doc.font('Helvetica').fontSize(8.5).text(
      'Die Parkberechtigung ist ein Vorteil der Mitgliedschaft beim ASN Pfeil Phönix e.V. und kein eigenständiges Produkt. ' +
      'Fahrzeuge ohne gültigen Parkausweis oder auf falschem Stellplatz können kostenpflichtig abgeschleppt werden. ' +
      'Bei Ablauf der Mitgliedschaft verliert dieser Ausweis automatisch seine Gültigkeit.',
      65, noticeY + 26, { width: 460, lineGap: 1 }
    );

    doc.moveTo(50, 740).lineTo(545, 740).strokeColor(light).stroke();
    doc.fillColor(mid).font('Helvetica').fontSize(8)
      .text('ASN Pfeil Phönix e.V. · Marienbergstraße 41 · 90411 Nürnberg · www.asn-pfeil-phoenix.de', 50, 748, { align: 'center', width: 495 });
    doc.end();
  });
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { antrag_id } = await request.json();
    if (!antrag_id) return new Response(JSON.stringify({ error: 'antrag_id fehlt.' }), { status: 400, headers });

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

    // Fetch the applicant
    const appRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}&select=*`, { headers: sbHeaders });
    const appRows = await appRes.json();
    if (!appRows.length) return new Response(JSON.stringify({ error: 'Antrag nicht gefunden.' }), { status: 404, headers });
    const applicant = appRows[0];

    // Fetch config
    const configRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglied_config?id=eq.config&select=*`, { headers: sbHeaders });
    const config = (await configRes.json())[0];
    const maxPlaetze = config?.max_plaetze ?? 15;
    const gueltigJahr = config?.gueltig_jahr ?? new Date().getFullYear();

    // Determine occupied parking spaces
    const occRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?status=eq.genehmigt&select=parkplatz_nummer`, { headers: sbHeaders });
    const occupiedRows = await occRes.json();
    const occupied = new Set(occupiedRows.map((r: any) => r.parkplatz_nummer).filter((n: any) => n != null));

    let assignedSpace: number | null = null;
    for (let i = 1; i <= maxPlaetze; i++) {
      if (!occupied.has(i)) { assignedSpace = i; break; }
    }

    const now = new Date();
    const gueltigVon = now.toISOString().split('T')[0];
    const gueltigBis = `${gueltigJahr}-12-31`;

    if (assignedSpace === null) {
      // No space available -> waitlist
      await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}`, {
        method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'warteliste' }),
      });

      if (SMTP_USER && SMTP_PASS) {
        const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
        await transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`, to: applicant.email,
          subject: 'Dein Antrag auf Foerdermitgliedschaft - Warteliste',
          text: `Hallo ${applicant.vorname} ${applicant.nachname},\n\ndein Antrag wurde geprueft und grundsaetzlich genehmigt. Aktuell sind jedoch alle Parkplaetze belegt. Du wurdest auf die Warteliste gesetzt und wirst benachrichtigt, sobald ein Platz frei wird.\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.`,
        });
      }
      return new Response(JSON.stringify({ success: true, status: 'warteliste' }), { status: 200, headers });
    }

    // Generate permit code
    const counterRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_invoice_counter`, {
      method: 'POST', headers: sbHeaders, body: JSON.stringify({ counter_id: `foerdermitglied_${gueltigJahr}` }),
    });
    let counterNum = 1;
    if (counterRes.ok) counterNum = await counterRes.json();
    const permitCode = `FM-${gueltigJahr}-${String(counterNum).padStart(3, '0')}`;

    await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: 'genehmigt', parkplatz_nummer: assignedSpace, permit_code: permitCode,
        gueltig_von: gueltigVon, gueltig_bis: gueltigBis, genehmigt_am: now.toISOString(),
      }),
    });

    const pdf = await generatePermitPDF({
      permitCode, name: `${applicant.anrede || ''} ${applicant.vorname} ${applicant.nachname}`.trim(),
      kennzeichen: applicant.kennzeichen, parkplatzLabel: `Nr. ${assignedSpace}`,
      gueltigVon, gueltigBis, checkUrl: `${CHECK_URL}?code=${permitCode}`,
    });

    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await transporter.sendMail({
        from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`, to: applicant.email,
        subject: `Foerdermitgliedschaft genehmigt - Parkausweis ${permitCode}`,
        text: `Hallo ${applicant.vorname} ${applicant.nachname},\n\nherzlichen Glueckwunsch! Dein Antrag auf Foerdermitgliedschaft wurde genehmigt.\n\nDir wurde der Parkplatz Nr. ${assignedSpace} fest zugewiesen.\nGueltig: ${fmtDate(gueltigVon)} bis ${fmtDate(gueltigBis)}\n\nDeinen digitalen Parkausweis findest du als PDF im Anhang. Bitte fuehre ihn gut sichtbar im Fahrzeug mit.\n\nHinweis: Die Parkberechtigung ist ein Vorteil der Mitgliedschaft und kein eigenstaendiges Produkt.\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.`,
        attachments: [{ filename: `Parkausweis-${permitCode}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
    }

    return new Response(JSON.stringify({ success: true, status: 'genehmigt', parkplatz_nummer: assignedSpace, permit_code: permitCode }), { status: 200, headers });
  } catch (err) {
    console.error('Foerdermitglied-Approve-Fehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler.' }), { status: 500, headers });
  }
};
