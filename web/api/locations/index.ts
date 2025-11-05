import { getSupabase, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../_supabase.js';

const normalizeLocation = (row: any) => ({
  id: row.id,
  name: row.name,
  layoutId: row.layoutId ?? row.layoutid,
  nfcCardId: row.nfcCardId ?? row.nfccardid ?? null,
  x: row.x,
  y: row.y,
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return err(res, 405, 'Method not allowed');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('locations').select('*').order('name');
  if (error) return err(res, 500, error.message);
  return ok(res, (data || []).map(normalizeLocation));
}
