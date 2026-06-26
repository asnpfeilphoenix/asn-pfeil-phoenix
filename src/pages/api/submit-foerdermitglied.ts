// src/pages/api/submit-foerdermitglied.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const data = await request.json();

    const SUPABASE_URL  = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY  = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST     = import.meta.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT     = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER     = import.meta.env.SMTP_USER;
    const SMTP_PASS     = import.meta.env.SMTP_PASS;
    const FROM_EMAIL    = import.meta.env.FROM_EMAIL || SMTP_USER;
    const VEREIN_EMAIL  = import.meta.env.VEREIN_EMAIL || SMTP_USER;
    const FM_ADMIN_URL  = import.meta.env.FM_ADMIN_URL || 'https://asn-pfeil-phoenix.vercel.app/verwaltung/foerdermitglieder';

    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase nicht konfiguriert.');

    const now = new Date();
    const antragId = `FMA-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;

    // Fee is determined client-side from public/data/beitraege.csv and sent
    // in the payload — same pattern as every other membership form here.
    const jahresbeitrag = data.betrag_jaehrlich ?? 150;

    const row = {
      antrag_id: antragId,
      eingegangen_am: now.toISOString(),
      anrede: data.anrede || null,
      vorname: data.vorname, nachname: data.nachname,
      strasse: data.strasse || null, plz: data.plz || null, ort: data.ort || null,
      telefon: data.telefon || null, email: data.email,
      kennzeichen: data.kennzeichen,
      fahrzeug_marke: data.fahrzeug_marke || null, fahrzeug_modell: data.fahrzeug_modell || null, fahrzeug_farbe: data.fahrzeug_farbe || null,
      kontoinhaber: data.kontoinhaber || null, iban: data.iban || null,
      betrag_jaehrlich: jahresbeitrag,
      status: 'beantragt',
      satzung_anerkannt: data.satzung_anerkannt ?? false,
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!insertRes.ok) throw new Error(`Supabase Fehler: ${await insertRes.text()}`);

    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await Promise.allSettled([
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: VEREIN_EMAIL,
          subject: `Neuer Foerdermitglied-Antrag: ${data.vorname} ${data.nachname}`,
          text: `Neuer Antrag auf Foerdermitgliedschaft.\n\nName: ${data.anrede || ''} ${data.vorname} ${data.nachname}\nKennzeichen: ${data.kennzeichen}\nEingegangen: ${now.toLocaleString('de-DE')}\nAntrag-ID: ${antragId}\n\nZur Pruefung im Verwaltungsportal:\n${FM_ADMIN_URL}`,
        }),
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: 'Dein Antrag auf Foerdermitgliedschaft - Bestaetigung',
          text: `Hallo ${data.vorname} ${data.nachname},\n\nvielen Dank fuer deinen Antrag auf Foerdermitgliedschaft beim ASN Pfeil Phoenix e.V.!\n\nDein Antrag wird durch den Vorstand gemaess Paragraph 4 der Satzung geprueft. Du erhaeltst eine weitere E-Mail, sobald eine Entscheidung getroffen wurde. Bei Genehmigung erhaeltst du deinen digitalen Parkausweis als PDF.\n\nDeine Angaben:\n- Kennzeichen: ${data.kennzeichen}\n- Jahresbeitrag: ${jahresbeitrag} EUR\n- Antrag-ID: ${antragId}\n\nHinweis: Die Parkberechtigung ist ein Vorteil der Mitgliedschaft und kein eigenstaendiges Produkt.\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.`,
        }),
      ]);
    }

    return new Response(JSON.stringify({ success: true, antragId }), { status: 200, headers });
  } catch (err) {
    console.error('Foerdermitglied-Fehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
