import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const hits = new Map(); // simple in-memory limiter: 40 req / 10s / user (use Redis when running >1 replica)
function limited(id) {
  const now = Date.now();
  const arr = (hits.get(id) || []).filter((t) => now - t < 10000);
  arr.push(now); hits.set(id, arr);
  return arr.length > 40;
}
// Identity always comes from the session, never from the request body.
export function route(fn) {
  return async (req) => {
    try {
      const sb = await createServerClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (limited(user.id)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const out = await fn({ user, body, req, admin: createAdminClient() });
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  };
}
export async function roomByCode(admin, code) {
  const { data, error } = await admin.from('game_rooms').select('*').eq('room_code', String(code).toUpperCase()).single();
  if (error || !data) throw new Error('Room not found');
  return data;
}
export const must = ({ error, data }) => { if (error) throw new Error(error.message); return data; };
