import { getSupabase, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../_supabase.js';

const normalizeCard = (row: any) => ({
  id: row.id,
  secretCode: row.secretCode ?? row.secretcode,
  uid: row.uid ?? row.UID ?? null,
  assignedLocationId: row.assignedLocationId ?? row.assignedlocationid ?? null,
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return err(res, 405, 'Method not allowed');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('cards').select('*').order('id');
  if (error) return err(res, 500, error.message);
  return ok(res, (data || []).map(normalizeCard));
}
