// src/pages/api/foerdermitglied-reject.ts
export const prerender = false;
import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';

async function verifyForderAdmin(request: Request, SUPABASE_URL: string, SERVICE_KEY: string): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user.email) return null;
  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_roles?email=eq.${encodeURIComponent(user.email)}&select=abteilungen`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  const rows = await roleRes.json();
  const tags = rows[0]?.abteilungen || [];
  if (!tags.includes('all') && !tags.includes('foerdermitglieder')) return null;
  return user.email;
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { antrag_id, grund } = await request.json();
    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

    const callerEmail = await verifyForderAdmin(request, SUPABASE_URL, SUPABASE_KEY);
    if (!callerEmail) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers });

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
      body: JSON.stringify({ status: 'abgelehnt', abgelehnt_grund: grund || null, abgelehnt_von: callerEmail }),
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
