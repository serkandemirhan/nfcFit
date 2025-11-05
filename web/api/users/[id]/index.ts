import { getSupabase, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../../_supabase.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  const supabase = getSupabase();
  const { id } = req.query as { id: string };
  if (req.method === 'DELETE') {
    // Check tasks referencing the user
    const { data: t, error: te } = await supabase.from('tasks').select('id').eq('userid', id).limit(1);
    if (te) return err(res, 500, te.message);
    if (t && t.length > 0) return err(res, 409, 'User has tasks and cannot be deleted');
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return err(res, 500, error.message);
    return ok(res, null, 204);
  }
  res.setHeader('Allow', 'DELETE');
  return err(res, 405, 'Method not allowed');
}
