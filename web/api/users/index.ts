import { getSupabase, readJson, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../_supabase.js';
import bcrypt from 'bcryptjs';

const normalizeUser = (row: any) => ({
  id: row.id,
  name: row.name,
  username: row.username,
  email: row.email ?? row.Email ?? null,
  avatarUrl: row.avatarUrl ?? row.avatarurl ?? null,
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('users').select('*').order('name');
    if (error) return err(res, 500, error.message);
    return ok(res, (data || []).map(normalizeUser));
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const { name, username, email, avatarUrl, password } = body || {};
    if (!name || !username || !avatarUrl) return err(res, 400, 'Missing fields');

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const id = `u-${Math.random().toString(16).slice(2, 10)}`;
    const { data, error } = await supabase
      .from('users')
      .insert({ id, name, username, email, avatarurl: avatarUrl, passwordhash: passwordHash })
      .select('*')
      .single();
    if (error) {
      if ((error as any).code === '23505') return err(res, 409, 'Username already exists');
      return err(res, 500, error.message);
    }
    return ok(res, normalizeUser(data), 201);
  }

  res.setHeader('Allow', 'GET,POST');
  return err(res, 405, 'Method not allowed');
}
