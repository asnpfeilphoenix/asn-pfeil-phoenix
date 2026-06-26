// src/pages/api/create-temp-parkausweis.ts
export const prerender = false;
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const data = await request.json();
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
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
      erstellt_von: data.erstellt_von || null,
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
