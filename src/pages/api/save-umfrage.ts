// src/pages/api/save-umfrage.ts
export const prerender = false;
import type { APIRoute } from 'astro';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const body = await request.json();
    const { code: existingCode, answers, status = 'in_progress' } = body;

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase nicht konfiguriert.');

    const now = new Date().toISOString();

    if (existingCode) {
      // Update existing row
      const payload: any = { ...answers, aktualisiert_am: now, status };
      if (status === 'submitted') payload.abgeschlossen_am = now;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/umfrage_antworten?code=eq.${existingCode}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(`Update fehlgeschlagen: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true, code: existingCode }), { status: 200, headers });
    } else {
      // Create new row
      let code = generateCode();
      // Ensure uniqueness (retry once if collision)
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/umfrage_antworten?code=eq.${code}&select=code`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (checkRes.ok) {
        const rows = await checkRes.json();
        if (rows.length > 0) code = generateCode();
      }

      const payload = {
        code,
        ...answers,
        eingegangen_am: now,
        aktualisiert_am: now,
        status,
        ...(status === 'submitted' ? { abgeschlossen_am: now } : {}),
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/umfrage_antworten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Insert fehlgeschlagen: ${await res.text()}`);
      return new Response(JSON.stringify({ success: true, code }), { status: 200, headers });
    }
  } catch (err) {
    console.error('Umfrage-Fehler:', err);
    return new Response(JSON.stringify({ error: 'Interner Fehler. Bitte erneut versuchen.' }), { status: 500, headers });
  }
};

// GET: load existing answers by code
export const GET: APIRoute = async ({ url }) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const code = url.searchParams.get('code');
    if (!code) return new Response(JSON.stringify({ error: 'Code fehlt.' }), { status: 400, headers });

    const SUPABASE_URL = import.meta.env.SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/umfrage_antworten?code=eq.${code.toUpperCase()}&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error('Laden fehlgeschlagen');
    const rows = await res.json();
    if (!rows.length) return new Response(JSON.stringify({ error: 'Code nicht gefunden.' }), { status: 404, headers });
    if (rows[0].status === 'submitted') return new Response(JSON.stringify({ error: 'Diese Umfrage wurde bereits abgeschlossen.' }), { status: 410, headers });
    return new Response(JSON.stringify({ success: true, data: rows[0] }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Laden fehlgeschlagen.' }), { status: 500, headers });
  }
};
