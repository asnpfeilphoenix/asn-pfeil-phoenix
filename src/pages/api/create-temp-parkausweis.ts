// src/pages/api/create-temp-parkausweis.ts
export const prerender = false;
import type { APIRoute } from 'astro';

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
    const data = await request.json();
    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

    const callerEmail = await verifyForderAdmin(request, SUPABASE_URL, SUPABASE_KEY);
    if (!callerEmail) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers });
    const sbHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

    const year = new Date().getFullYear();
    const counterRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_invoice_counter`, {
      method: 'POST', headers: sbHeaders, body: JSON.stringify({ counter_id: `temp_parkausweis_${year}` }),
    });
    let counterNum = 1;
    if (counterRes.ok) counterNum = await counterRes.json();
    else {
      // Ensure the counter row exists, then retry once
      await fetch(`${SUPABASE_URL}/rest/v1/invoice_counter`, {
        method: 'POST', headers: { ...sbHeaders, 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ id: `temp_parkausweis_${year}`, year, counter: 0 }),
      });
      const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_invoice_counter`, {
        method: 'POST', headers: sbHeaders, body: JSON.stringify({ counter_id: `temp_parkausweis_${year}` }),
      });
      if (retryRes.ok) counterNum = await retryRes.json();
    }

    const permitCode = `TEMP-${year}-${String(counterNum).padStart(3, '0')}`;

    const row = {
      permit_code: permitCode,
      erstellt_am: new Date().toISOString(),
      erstellt_von: callerEmail,
      name: data.name,
      adresse: data.adresse || null,
      kennzeichen: data.kennzeichen,
      grund: data.grund || null,
      gueltig_von: data.gueltig_von,
      gueltig_bis: data.gueltig_bis,
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/temp_parkausweise`, {
      method: 'POST', headers: { ...sbHeaders, 'Prefer': 'return=minimal' }, body: JSON.stringify(row),
    });
    if (!insertRes.ok) throw new Error(await insertRes.text());

    return new Response(JSON.stringify({ success: true, permit_code: permitCode }), { status: 200, headers });
  } catch (err) {
    console.error('Temp-Parkausweis-Fehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Serverfehler.' }), { status: 500, headers });
  }
};
