// src/pages/api/foerdermitglied-reject.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { antrag_id, grund } = await request.json();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
    const SMTP_HOST = import.meta.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(import.meta.env.SMTP_PORT || '587');
    const SMTP_USER = import.meta.env.SMTP_USER;
    const SMTP_PASS = import.meta.env.SMTP_PASS;
    const FROM_EMAIL = import.meta.env.FROM_EMAIL || SMTP_USER;
    const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

    const appRes = await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}&select=*`, { headers: sbHeaders });
    const rows = await appRes.json();
    if (!rows.length) return new Response(JSON.stringify({ error: 'Nicht gefunden.' }), { status: 404, headers });
    const applicant = rows[0];

    await fetch(`${SUPABASE_URL}/rest/v1/foerdermitglieder?antrag_id=eq.${antrag_id}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'abgelehnt', abgelehnt_grund: grund || null }),
    });

    if (SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: false, auth: { user: SMTP_USER, pass: SMTP_PASS } });
      await transporter.sendMail({
        from: `"ASN Pfeil Phoenix" <${FROM_EMAIL}>`, to: applicant.email,
        subject: 'Dein Antrag auf Foerdermitgliedschaft',
        text: `Hallo ${applicant.vorname} ${applicant.nachname},\n\nleider koennen wir deinen Antrag auf Foerdermitgliedschaft derzeit nicht genehmigen.${grund ? `\n\nBegruendung: ${grund}` : ''}\n\nBei Fragen wende dich gerne an den Vorstand.\n\nMit sportlichen Gruessen\nDer Vorstand des ASN Pfeil Phoenix e.V.`,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Interner Serverfehler.' }), { status: 500, headers });
  }
};
