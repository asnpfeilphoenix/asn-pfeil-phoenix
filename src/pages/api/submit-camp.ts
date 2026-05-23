// src/pages/api/submit-camp.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

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

    const anmeldungId = `CAMP-${Date.now()}-${Math.random().toString(36).substr(2,5).toUpperCase()}`;
    const now = new Date();
    const eingegangen = now.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
    });

    const anmeldung = {
      anmeldung_id:   anmeldungId,
      eingegangen_am: now.toISOString(),
      vorname:        data.vorname,
      nachname:       data.nachname,
      geburtsdatum:   data.geburtsdatum || null,
      geschlecht:     data.geschlecht || null,
      strasse:        data.strasse || null,
      plz:            data.plz || null,
      ort:            data.ort || null,
      telefon:        data.telefon || null,
      email:          data.email || null,
      team:           data.team || null,
      trikot_groesse: data.trikot_groesse || null,
      sonstiges:      data.sonstiges || null,
      status:         'angemeldet',
    };

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/camp_anmeldungen`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(anmeldung),
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      throw new Error(`Supabase Fehler: ${err}`);
    }

    if (SMTP_USER && SMTP_PASS) {
      console.log('Sending emails via SMTP:', SMTP_HOST, SMTP_PORT, SMTP_USER);
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT, secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const results = await Promise.allSettled([
        transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: VEREIN_EMAIL,
          subject: `Neue Camp-Anmeldung: ${data.vorname} ${data.nachname} (${data.team})`,
          text: `Neue Camp-Anmeldung eingegangen.\n\nName: ${data.vorname} ${data.nachname}\nTeam: ${data.team}\nEingegangen: ${eingegangen}\nAnmeldung-ID: ${anmeldungId}\n\nAlle Details im Verwaltungsportal:\n${ADMIN_URL}`,
        }),
        ...(data.email ? [transporter.sendMail({
          from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`,
          to: data.email,
          subject: 'Anmeldung Sommer-Fussballcamp 2025 - Bestaetigung',
          text: `Hallo ${data.vorname},\n\nvielen Dank fuer deine Anmeldung zum Sommer-Fussballcamp 2025!\n\nDeine Angaben:\n- Name: ${data.vorname} ${data.nachname}\n- Team: ${data.team}\n- Trikotgroesse: ${data.trikot_groesse || '—'}\n- Anmeldung-ID: ${anmeldungId}\n\nDas Camp findet vom 3. bis 7. August 2025 statt (9-12 Uhr).\nAnmeldeschluss: 10. Juni 2025.\n\nWir melden uns in Kuerze mit weiteren Informationen.\n\nMit sportlichen Gruessen\nASN Pfeil Phoenix Fussballabteilung`,
        })] : []),
      ]);
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Email ${i} failed:`, r.reason);
        else console.log(`Email ${i} sent:`, r.value?.messageId);
      });
    } else {
      console.warn('SMTP not configured — SMTP_USER:', !!SMTP_USER, 'SMTP_PASS:', !!SMTP_PASS);
    }

    return new Response(JSON.stringify({ success: true, anmeldungId }), { status: 200, headers });
  } catch (err) {
    console.error('Camp-Anmeldefehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};
