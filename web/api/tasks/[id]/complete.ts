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
  active: row.active ?? true,
  attachments: [],
});

const addFrequency = (value: string | null, repeat: { frequency: number; unit: string } | null) => {
  if (!value || !repeat) return null;
  const date = new Date(value);
  if (repeat.unit === 'days') {
    date.setDate(date.getDate() + repeat.frequency);
  } else if (repeat.unit === 'hours') {
    date.setHours(date.getHours() + repeat.frequency);
  }
  return date.toISOString();
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!ensureOriginAllowed(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return err(res, 405, 'Method not allowed');
  }

  const supabase = getSupabase();
  const { id } = req.query as { id: string };
  const body = await readJson(req);
  const nowIso = new Date().toISOString();

  const { data: task, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (fetchError) return err(res, 500, fetchError.message);
  if (!task) return err(res, 404, 'Task not found');

  const repeat = task.repeat_frequency && task.repeat_unit ? { frequency: task.repeat_frequency, unit: task.repeat_unit } : null;
  const baseDue = (task.nextdueat || task.nextDueAt || task.duedate || task.dueDate) ?? nowIso;
  const nextDueAt = addFrequency(baseDue, repeat);
  const isRepeating = !!nextDueAt;

  const update: Record<string, any> = {
    lastcompletedat: nowIso,
    completionnotes: body?.notes || null,
    nextdueat: nextDueAt,
    duedate: nextDueAt ?? task.duedate ?? task.dueDate,
  };

  if (isRepeating) {
    update.status = task.status ?? 'Devam Ediyor';
    update.active = true;
  } else {
    update.status = 'Tamamlandı';
    update.active = false;
  }

  const { error: updateError, data: updatedTask } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) return err(res, 500, updateError.message);

  await supabase.from('task_logs').insert({
    taskid: id,
    status: 'completed',
    notes: body?.notes || null,
    completedat: nowIso,
    createdby: body?.userId || null,
  });

  return ok(res, normalizeTask(updatedTask));
}
