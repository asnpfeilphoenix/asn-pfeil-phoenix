// src/pages/api/admin-accounts.ts
// Manage admin accounts: Supabase Auth user + admin_roles row together.
// Restricted to callers whose admin_roles.abteilungen includes 'all'.
export const prerender = false;
import type { APIRoute } from 'astro';

async function verifyCallerIsAll(request: Request, SUPABASE_URL: string, SERVICE_KEY: string): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const email = user.email;
  if (!email) return null;

  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_roles?email=eq.${encodeURIComponent(email)}&select=abteilungen`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  const rows = await roleRes.json();
  const tags = rows[0]?.abteilungen || [];
  if (!tags.includes('all')) return null;
  return email;
}

export const GET: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  const SUPABASE_URL = import.meta.env.SUPABASE_URL;
  const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

  const caller = await verifyCallerIsAll(request, SUPABASE_URL, SERVICE_KEY);
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers });

  try {
    const sbHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    const rolesRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_roles?select=*&order=email.asc`, { headers: sbHeaders });
    const roles = await rolesRes.json();

    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: sbHeaders });
    const usersData = await usersRes.json();
    const users = usersData.users || [];

    const merged = roles.map((r: any) => {
      const u = users.find((u: any) => u.email?.toLowerCase() === r.email.toLowerCase());
      return {
        ...r,
        auth_user_id: u?.id || null,
        last_sign_in_at: u?.last_sign_in_at || null,
        has_auth_account: !!u,
      };
    });

    return new Response(JSON.stringify({ success: true, admins: merged }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fehler beim Laden.' }), { status: 500, headers });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  const SUPABASE_URL = import.meta.env.SUPABASE_URL;
  const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

  const caller = await verifyCallerIsAll(request, SUPABASE_URL, SERVICE_KEY);
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers });

  try {
    const { name, email, password, abteilungen } = await request.json();
    if (!email || !password || password.length < 8) {
      return new Response(JSON.stringify({ error: 'E-Mail und ein Passwort mit mindestens 8 Zeichen sind erforderlich.' }), { status: 400, headers });
    }

    const sbHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST', headers: sbHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(createData.msg || createData.error_description || 'Erstellen fehlgeschlagen — existiert die E-Mail bereits?');
    }

    const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_roles?on_conflict=email`, {
      method: 'POST', headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ email, name: name || null, abteilungen: abteilungen || [] }),
    });
    if (!roleRes.ok) throw new Error(await roleRes.text());

    return new Response(JSON.stringify({ success: true, user_id: createData.id }), { status: 200, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Interner Serverfehler.' }), { status: 500, headers });
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  const SUPABASE_URL = import.meta.env.SUPABASE_URL;
  const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

  const caller = await verifyCallerIsAll(request, SUPABASE_URL, SERVICE_KEY);
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers });

  try {
    const { email, name, abteilungen, password, user_id } = await request.json();
    if (!email) return new Response(JSON.stringify({ error: 'E-Mail fehlt.' }), { status: 400, headers });

    const sbHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    if (name !== undefined || abteilungen !== undefined) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_roles?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ...(name !== undefined ? { name } : {}), ...(abteilungen !== undefined ? { abteilungen } : {}) }),
      });
      if (!res.ok) throw new Error(await res.text());
    }

    if (password) {
      if (password.length < 8) return new Response(JSON.stringify({ error: 'Passwort muss mindestens 8 Zeichen haben.' }), { status: 400, headers });
      if (!user_id) return new Response(JSON.stringify({ error: 'Kein Auth-Konto für diese E-Mail gefunden.' }), { status: 400, headers });
      const pwRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
        method: 'PUT', headers: sbHeaders, body: JSON.stringify({ password }),
      });
      if (!pwRes.ok) throw new Error(await pwRes.text());
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Interner Serverfehler.' }), { status: 500, headers });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };
  const SUPABASE_URL = import.meta.env.SUPABASE_URL;
  const SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

  const caller = await verifyCallerIsAll(request, SUPABASE_URL, SERVICE_KEY);
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers });

  try {
    const { email, user_id } = await request.json();
    if (!email) return new Response(JSON.stringify({ error: 'E-Mail fehlt.' }), { status: 400, headers });

    if (email.toLowerCase() === caller.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Du kannst dein eigenes Konto hier nicht löschen.' }), { status: 400, headers });
    }

    const sbHeaders = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

    if (user_id) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, { method: 'DELETE', headers: sbHeaders });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/admin_roles?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE', headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Interner Serverfehler.' }), { status: 500, headers });
  }
};
