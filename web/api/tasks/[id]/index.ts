import { getSupabase, readJson, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../../_supabase.js';

const normalizeTask = (row: any) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  locationId: row.locationId ?? row.locationid,
  userId: row.userId ?? row.userid,
  createdAt: row.createdAt ?? row.createdat,
  dueDate: row.dueDate ?? row.duedate,
  nextDueAt: row.nextDueAt ?? row.nextdueat ?? null,
  lastCompletedAt: row.lastCompletedAt ?? row.lastcompletedat ?? null,
  completionNotes: row.completionNotes ?? row.completionnotes ?? null,
  repeat: row.repeat_frequency && row.repeat_unit ? { frequency: row.repeat_frequency, unit: row.repeat_unit } : null,
  attachments: [],
});

const toDbRepeat = (repeat: any) => {
  if (!repeat || !repeat.frequency || !repeat.unit) {
    return { repeat_frequency: null, repeat_unit: null };
  }
  return { repeat_frequency: repeat.frequency, repeat_unit: repeat.unit };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  const supabase = getSupabase();
  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) return err(res, 500, error.message);
    if (!data) return err(res, 404, 'Task not found');
    return ok(res, normalizeTask(data));
  }

  if (req.method === 'PUT') {
    const body = await readJson(req);
    const { title, description, status, locationId, userId, dueDate, repeat, nextDueAt } = body || {};
    const repeatDb = repeat !== undefined ? toDbRepeat(repeat) : null;

    const update: Record<string, any> = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (status !== undefined) update.status = status;
    if (locationId !== undefined) update.locationid = locationId;
    if (userId !== undefined) update.userid = userId;
    if (dueDate) update.duedate = new Date(dueDate).toISOString();
    if (repeatDb) {
      update.repeat_frequency = repeatDb.repeat_frequency;
      update.repeat_unit = repeatDb.repeat_unit;
    }
    if (nextDueAt !== undefined || repeat !== undefined) {
      update.nextdueat = nextDueAt ? new Date(nextDueAt).toISOString() : null;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return err(res, 500, error.message);
    return ok(res, normalizeTask(data));
  }

  if (req.method === 'DELETE') {
    await supabase.from('attachments').delete().eq('taskId', id);
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return err(res, 500, error.message);
    return ok(res, null, 204);
  }

  res.setHeader('Allow', 'GET,PUT,DELETE');
  return err(res, 405, 'Method not allowed');
}
