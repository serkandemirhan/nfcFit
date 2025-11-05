import { getSupabase, readJson, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../../_supabase.js';
import bcrypt from 'bcryptjs';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return err(res, 405, 'Method not allowed');
  }
  const supabase = getSupabase();
  const { id } = req.query as { id: string };
  const body = await readJson(req);
  let tempPassword: string | null = null;
  let newPassword: string | null = body?.newPassword || null;
  if (!newPassword) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    tempPassword = Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    newPassword = tempPassword;
  }
  if (newPassword.length < 6) return err(res, 422, 'Password must be at least 6 characters');
  const pw = Buffer.from(String(newPassword), 'utf8').subarray(0, 72).toString('utf8');
  const passwordHash = bcrypt.hashSync(pw, 10);
  const { error } = await supabase.from('users').update({ passwordhash: passwordHash }).eq('id', id);
  if (error) return err(res, 500, error.message);
  return ok(res, { ok: true, temporaryPassword: tempPassword });
}
