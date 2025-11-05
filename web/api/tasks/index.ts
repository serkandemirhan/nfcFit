import { getSupabase, readJson, ok, err, ApiRequest, ApiResponse, ensureOriginAllowed } from '../_supabase.js';

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

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('tasks').select('*').order('createdat', { ascending: false });
    if (error) return err(res, 500, error.message);
    return ok(res, (data || []).map(normalizeTask));
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const { title, description, status, locationId, userId, dueDate, repeat } = body || {};
    if (!title || !locationId || !userId || !dueDate) return err(res, 400, 'Missing fields');

    const id = `t-${Math.random().toString(16).slice(2, 10)}`;
    const now = new Date().toISOString();
    const dueIso = new Date(dueDate).toISOString();
    const repeatDb = toDbRepeat(repeat);
    const hasRepeat = !!(repeatDb.repeat_frequency && repeatDb.repeat_unit);
    const nextDueAt = hasRepeat ? dueIso : null;
    const statusToSave = status ?? (hasRepeat ? 'Devam Ediyor' : 'Yapılacak');

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        id,
        title,
        description,
        status: statusToSave,
        locationid: locationId,
        userid: userId,
        createdat: now,
        duedate: dueIso,
        nextdueat: nextDueAt,
        ...repeatDb,
      })
      .select('*')
      .single();
    if (error) return err(res, 500, error.message);
    return ok(res, normalizeTask(data), 201);
  }

  if (req.method === 'PUT') {
    const body = await readJson(req);
    const { id, title, description, status, locationId, userId, dueDate, repeat, nextDueAt } = body || {};
    if (!id) return err(res, 400, 'Task id is required');

    const repeatDb = repeat !== undefined ? toDbRepeat(repeat) : null;
    const hasRepeat = !!(repeatDb && repeatDb.repeat_frequency && repeatDb.repeat_unit);
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
    if (nextDueAt !== undefined || hasRepeat || repeat === null) {
      update.nextdueat = hasRepeat
        ? (nextDueAt ? new Date(nextDueAt).toISOString() : (dueDate ? new Date(dueDate).toISOString() : null))
        : null;
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

  res.setHeader('Allow', 'GET,POST,PUT');
  return err(res, 405, 'Method not allowed');
}
