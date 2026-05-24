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
  preis?: number;
  voucherCode?: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const preis = data.preis ?? 99;
    const preisStr = preis === 0 ? 'Kostenlos' : `${preis.toFixed(2).replace('.', ',')} €`;

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
      .text('für die Anmeldung zum Sommer-Fußballcamp 2026 stellen wir Ihnen hiermit folgende Kosten in Rechnung:');

    // ── Line items table ─────────────────────────────────────
    const tableY = doc.y + 12;
    doc.rect(50, tableY, pageW, 22).fill(navy);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
    doc.text('Anzahl', 54, tableY + 7, { width: 40 });
    doc.text('Bezeichnung', 100, tableY + 7, { width: 230 });
    doc.text('Einzelpreis', 335, tableY + 7, { width: 90, align: 'right' });
    doc.text('Gesamtpreis', 430, tableY + 7, { width: 115, align: 'right' });

    const rowY = tableY + 22;
    const voucherNote = data.voucherCode ? ` | Gutschein: ${data.voucherCode}` : '';
    const discountNote = preis > 0 && preis < 99 ? ' | 10% Geschwisterrabatt' : '';
    doc.fillColor('black').font('Helvetica').fontSize(9);
    doc.text('1', 54, rowY + 8, { width: 40 });
    doc.font('Helvetica-Bold').text('Sommer-Fußballcamp 2026', 100, rowY + 5, { width: 230 });
    doc.font('Helvetica').fontSize(8).fillColor(mid)
      .text(`3.–7. Aug. 2026, 9–12 Uhr | Team: ${data.team} | Trikot: ${data.trikotGroesse}${discountNote}${voucherNote}`, 100, rowY + 17, { width: 230 });
    doc.fillColor('black').fontSize(9)
      .text(preisStr, 335, rowY + 8, { width: 90, align: 'right' })
      .text(preisStr, 430, rowY + 8, { width: 115, align: 'right' });
    doc.moveTo(50, rowY + 36).lineTo(545, rowY + 36).strokeColor(light).stroke();

    // ── Totals ───────────────────────────────────────────────
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

    // ── Due date / free notice ────────────────────────────────
    doc.fillColor('black').font('Helvetica').fontSize(10);
    if (preis === 0) {
      doc.text('Diese Anmeldung ist aufgrund des Trainer-Bonus kostenfrei. Es ist keine Zahlung erforderlich.', 50, totRowY + 36);
    } else {
      doc.text('Der Rechnungsbetrag ist ohne Abzug bis zum ', 50, totRowY + 36, { continued: true })
        .font('Helvetica-Bold').text('10. Juni 2026', { continued: true })
        .font('Helvetica').text(' zu begleichen.');
    }

    // ── Payment info box (only if not free) ───────────────────
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
        .text(`Verwendungszweck: ${data.rechnungNummer} – ${data.vorname} ${data.nachname}`, 62, payY + 60);
    }

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

    // Support both old single-player and new multi-player payload
    const spieler = data.spieler || [{
      vorname: data.vorname, nachname: data.nachname,
      geburtsdatum: data.geburtsdatum, geschlecht: data.geschlecht,
      team: data.team, trikot_groesse: data.trikot_groesse,
      erziehungsberechtigter: data.erziehungsberechtigter,
      voucher_code: null, preis: 99, spieler_nr: 1,
    }];

    const familieGruppeId = spieler.length > 1
      ? `FAM-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`
      : null;

    const firstAnmeldungId = `CAMP-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;

    // ── Process each player ───────────────────────────────────
    const processedPlayers: any[] = [];

    for (let i = 0; i < spieler.length; i++) {
      const s = spieler[i];

      // Get invoice number
      const counterRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_invoice_counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ counter_id: 'camp_2026' }),
      });
      let invoiceNum = 0;
      if (counterRes.ok) {
        invoiceNum = await counterRes.json();
      } else {
        const readRes = await fetch(`${SUPABASE_URL}/rest/v1/invoice_counter?id=eq.camp_2026&select=counter`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        if (readRes.ok) {
          const rows = await readRes.json();
          invoiceNum = (rows[0]?.counter || 0) + 1;
          await fetch(`${SUPABASE_URL}/rest/v1/invoice_counter?id=eq.camp_2026`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ counter: invoiceNum }),
          });
        }
      }

      const rechnungNummer = `FS-2026-${String(invoiceNum).padStart(3, '0')}`;
      const anmeldungId = i === 0 ? firstAnmeldungId
        : `CAMP-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;

      const anmeldung = {
        anmeldung_id:             anmeldungId,
        eingegangen_am:           now.toISOString(),
        vorname:                  s.vorname,
        nachname:                 s.nachname,
        geburtsdatum:             s.geburtsdatum || null,
        geschlecht:               s.geschlecht || null,
        strasse:                  data.strasse || null,
        plz:                      data.plz || null,
        ort:                      data.ort || null,
        telefon:                  data.telefon || null,
        email:                    data.email || null,
        team:                     s.team || null,
        trikot_groesse:           s.trikot_groesse || null,
        sonstiges:                i === 0 ? (data.sonstiges || null) : null,
        erziehungsberechtigter:   s.erziehungsberechtigter || null,
        rechnung_nummer:          rechnungNummer,
        rechnung_datum:           rechnungDatum,
        voucher_code:             s.voucher_code || null,
        preis:                    s.preis ?? 99,
        familie_gruppe_id:        familieGruppeId,
        spieler_nr:               i + 1,
        status:                   'angemeldet',
      };

      const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/camp_anmeldungen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify(anmeldung),
      });

      if (!supabaseRes.ok) {
        const err = await supabaseRes.text();
        throw new Error(`Supabase Fehler (Spieler ${i+1}): ${err}`);
      }

      // Generate PDF
      const pdf = await generateInvoicePDF({
        rechnungNummer, rechnungDatum,
        vorname: s.vorname, nachname: s.nachname,
        erziehungsberechtigter: s.erziehungsberechtigter || null,
        strasse: data.strasse || '', plz: data.plz || '', ort: data.ort || '',
        team: s.team || '', trikotGroesse: s.trikot_groesse || '',
        anmeldungId, preis: s.preis ?? 99, voucherCode: s.voucher_code || null,
      });

      processedPlayers.push({ ...anmeldung, pdf, rechnungNummer });
    }

    // ── Send emails ───────────────────────────────────────────
    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT, secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const hauptSpieler = processedPlayers[0];
      const spielerListe = processedPlayers.map((p, i) =>
        `  ${i+1}. ${p.vorname} ${p.nachname} | ${p.team} | ${p.trikot_groesse} | ${p.preis === 0 ? 'Kostenlos' : p.preis + ' EUR'} | ${p.rechnung_nummer}`
      ).join('\n');

      const totalPreis = processedPlayers.reduce((sum, p) => sum + (parseFloat(p.preis) || 0), 0);

      const attachments = processedPlayers.map(p => ({
        filename: `Rechnung-${p.rechnung_nummer}.pdf`,
        content: p.pdf,
        contentType: 'application/pdf',
      }));

      const results = await Promise.allSettled([
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: VEREIN_EMAIL,
          subject: `Neue Camp-Anmeldung: ${hauptSpieler.vorname} ${hauptSpieler.nachname} (${spieler.length} Spieler) — ${hauptSpieler.rechnung_nummer}`,
          text: `Neue Camp-Anmeldung eingegangen.\n\nAnmelder: ${hauptSpieler.vorname} ${hauptSpieler.nachname}\nSpieler:\n${spielerListe}\n\nGesamt: ${totalPreis.toFixed(2)} EUR\nEingegangen: ${eingegangen}\n\nAlle Details im Verwaltungsportal:\n${ADMIN_URL}`,
        }),
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: `Anmeldung Sommer-Fussballcamp 2026 bestätigt — ${processedPlayers.map(p => p.rechnung_nummer).join(', ')}`,
          text: `Hallo ${hauptSpieler.vorname},\n\nvielen Dank fuer die Anmeldung zum Sommer-Fussballcamp 2026!\n\nAngemeldete Spieler:\n${spielerListe}\n\nGesamtbetrag: ${totalPreis.toFixed(2)} EUR\n${totalPreis > 0 ? `\nBitte ueberweise den Betrag bis zum 10. Juni 2026 an:\nIBAN: DE12 7605 0101 0001 4302 77\nVerwendungszweck: ${processedPlayers.filter(p => p.preis > 0).map(p => p.rechnung_nummer).join(', ')}` : ''}\n\nDas Camp findet vom 3. bis 7. August 2026 statt (taeglich 9-12 Uhr).\n\nMit sportlichen Gruessen\nASN Pfeil Phoenix Fussballabteilung`,
          attachments,
        }),
      ]);

      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Email ${i} failed:`, r.reason);
        else console.log(`Email ${i} sent OK`);
      });
    }

    return new Response(JSON.stringify({ success: true, anmeldungId: firstAnmeldungId }), { status: 200, headers });
  } catch (err) {
    console.error('Camp-Anmeldefehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
