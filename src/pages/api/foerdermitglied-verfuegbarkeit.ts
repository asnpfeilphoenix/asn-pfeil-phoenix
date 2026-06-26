// src/pages/api/foerdermitglied-verfuegbarkeit.ts
// Parking-space availability only. The annual fee is NOT managed here —
// it lives in public/data/beitraege.csv (abteilung='foerdermitglied'),
// read client-side, consistent with every other membership fee in this project.
export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.SUPABASE_SERVICE_KEY;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_foerdermitglied_verfuegbarkeit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: '{}',
    });
    const avail = await res.json();

    return new Response(JSON.stringify(avail), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fehler beim Laden.' }), { status: 500, headers });
  }
};
