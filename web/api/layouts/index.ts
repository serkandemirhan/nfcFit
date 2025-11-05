import { getSupabase, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../_supabase.js';

const normalizeLayout = (row: any) => ({
  id: row.id,
  name: row.name,
  imageUrl: row.imageUrl ?? row.imageurl ?? null,
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return err(res, 405, 'Method not allowed');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('layouts').select('*').order('name');
  if (error) return err(res, 500, error.message);
  return ok(res, (data || []).map(normalizeLayout));
}
