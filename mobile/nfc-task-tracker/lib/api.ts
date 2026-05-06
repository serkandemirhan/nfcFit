import { supabase } from './supabase';

// UUID generation function
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'canceled';

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  locationid?: string | null;
  userid?: string | null;
  createdat?: string | null;
  duedate?: string | null;
  lastcompletedat?: string | null;
  completionnotes?: string | null;
  repeat_frequency?: number | null;
  repeat_unit?: string | null;
  active?: boolean | null;
  nextdueat?: string | null;
};

export type TaskUpdateInput = Partial<
  Pick<
    Task,
    | 'title'
    | 'description'
    | 'duedate'
    | 'locationid'
    | 'status'
    | 'completionnotes'
    | 'userid'
    | 'repeat_unit'
    | 'repeat_frequency'
  >
> & {
  duedate?: string | null;
};

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  duedate?: string | null;
  locationid?: string | null;
  userid?: string | null;
  repeat_unit?: 'hours' | 'days' | null;
  repeat_frequency?: number | null;
  status?: TaskStatus;
};

export type Card = {
  id: string;
  secretcode?: string | null;
  uid?: string | null;
  assignedlocationid?: string | null;
  alias?: string | null;
  createdat?: string | null;
  assigneduserid?: string | null;
  assignedtaskid?: string | null;
};

export type Layout = {
  id: string;
  name: string;
  imageurl?: string | null;
};

export type Location = {
  id: string;
  name: string;
  layoutid: string;
  nfccardid?: string | null;
  x?: number | null;
  y?: number | null;
};

export type AppUser = {
  id: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  avatarurl?: string | null;
  passwordhash?: string | null;
};

export type Tag = {
  id: string;
  name: string;
  color?: string | null;
  createdat?: string | null;
};

export type TaskTag = {
  taskid: string;
  tagid: string;
};

export type NfcScanTask = {
  task_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  due_date?: string | null;
  location_id: string;
  location_name: string;
  card_id: string;
  card_alias?: string | null;
  security_mode?: string | null;
};

const STATUS_ALIASES: Record<string, TaskStatus> = {
  not_started: 'not_started',
  'not started': 'not_started',
  'yapılacak': 'not_started',
  'yapilacak': 'not_started',
  in_progress: 'in_progress',
  'in progress': 'in_progress',
  'devam ediyor': 'in_progress',
  completed: 'completed',
  tamamlandı: 'completed',
  tamamlandi: 'completed',
  done: 'completed',
  canceled: 'canceled',
  cancelled: 'canceled',
  iptal: 'canceled',
};

function normalizeStatus(value?: string | null): TaskStatus {
  if (!value) return 'not_started';
  const key = value.toLowerCase();
  return STATUS_ALIASES[key] ?? 'not_started';
}

function mapTask(row: any): Task {
  return {
    ...row,
    status: normalizeStatus(row.status),
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .or('active.is.null,active.eq.true')
    .order('duedate', { ascending: true })
    .order('createdat', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function fetchTaskById(id: string) {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapTask(data) : null;
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateTask(id: string, payload: TaskUpdateInput) {
  const { error } = await supabase.from('tasks').update(payload).eq('id', id);
  if (error) throw error;
}

export async function createTask(payload: TaskCreateInput) {
  const taskId = generateUUID();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      id: taskId,
      ...payload,
      status: payload.status ?? 'not_started',
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTask(data);
}

export async function verifyTag(tagText: string) {
  const { data, error } = await supabase.rpc('verify_tag', { tag_text: tagText });
  if (error) throw error;
  return (data ?? []) as { task_id: string; allowed: boolean }[];
}

export async function verifyNfcScan(payload: {
  uid: string;
  secretcode?: string | null;
  userid?: string | null;
}) {
  const { data, error } = await supabase.rpc('verify_nfc_scan', {
    p_uid: payload.uid,
    p_secretcode: payload.secretcode ?? null,
    p_userid: payload.userid ?? null,
  });
  if (error) throw error;
  return (data ?? []) as NfcScanTask[];
}

export async function completeTaskFromNfc(payload: {
  taskId: string;
  uid: string;
  secretcode?: string | null;
  userid?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc('complete_task_from_nfc', {
    p_task_id: payload.taskId,
    p_uid: payload.uid,
    p_secretcode: payload.secretcode ?? null,
    p_userid: payload.userid ?? null,
    p_notes: payload.notes ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as Task[]).map(mapTask);
}

export async function fetchCards() {
  const { data, error } = await supabase.from('cards').select('*').order('alias', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Card[];
}

export async function fetchCardById(id: string) {
  const { data, error } = await supabase.from('cards').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Card | null;
}

export async function createCard(payload: { uid: string; alias?: string; secretcode?: string }) {
  const { data, error } = await supabase.from('cards').insert(payload).select().single();
  if (error) throw error;
  return data as Card;
}

export async function updateCard(id: string, payload: Partial<Pick<Card, 'alias' | 'assignedlocationid'>>) {
  const { error } = await supabase.from('cards').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchLayouts() {
  const { data, error } = await supabase.from('layouts').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Layout[];
}

export async function fetchLocations() {
  const { data, error } = await supabase.from('locations').select('*');
  if (error) throw error;
  return (data ?? []) as Location[];
}

export async function fetchLayoutById(id: string) {
  const { data, error } = await supabase.from('layouts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Layout | null;
}

export async function fetchLocationsByLayout(layoutId: string) {
  const { data, error } = await supabase.from('locations').select('*').eq('layoutid', layoutId);
  if (error) throw error;
  return (data ?? []) as Location[];
}

export async function updateLayout(id: string, payload: Partial<Pick<Layout, 'name' | 'imageurl'>>) {
  const { error } = await supabase.from('layouts').update(payload).eq('id', id);
  if (error) throw error;
}

export async function fetchUsers() {
  const { data, error } = await supabase.from('users').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

export async function updateUserPassword(id: string, newPassword: string) {
  const { error } = await supabase.from('users').update({ passwordhash: newPassword }).eq('id', id);
  if (error) throw error;
}

export async function deleteUserById(id: string) {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
}

// Tag functions
export async function fetchTags() {
  const { data, error } = await supabase.from('tags').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function fetchTagById(id: string) {
  const { data, error } = await supabase.from('tags').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Tag | null;
}

export async function createTag(payload: { name: string; color?: string | null }) {
  const tagId = generateUUID();
  const { data, error } = await supabase
    .from('tags')
    .insert({
      id: tagId,
      ...payload,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(id: string, payload: { name?: string; color?: string | null }) {
  const { error } = await supabase.from('tags').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}

// Task-Tag relationship functions
export async function fetchTaskTags(taskId: string) {
  const { data, error } = await supabase
    .from('task_tags')
    .select('tagid, tags(*)')
    .eq('taskid', taskId);
  if (error) throw error;
  return ((data ?? []) as any[]).map((item) => item.tags as Tag);
}

export async function fetchAllTaskTags() {
  const { data, error } = await supabase.from('task_tags').select('taskid, tagid');
  if (error) throw error;
  return (data ?? []) as TaskTag[];
}

export async function addTagToTask(taskId: string, tagId: string) {
  const { error } = await supabase.from('task_tags').insert({ taskid: taskId, tagid: tagId });
  if (error) throw error;
}

export async function removeTagFromTask(taskId: string, tagId: string) {
  const { error } = await supabase
    .from('task_tags')
    .delete()
    .eq('taskid', taskId)
    .eq('tagid', tagId);
  if (error) throw error;
}

export async function setTaskTags(taskId: string, tagIds: string[]) {
  // First, remove all existing tags
  await supabase.from('task_tags').delete().eq('taskid', taskId);

  // Then, add new tags
  if (tagIds.length > 0) {
    const taskTags = tagIds.map((tagId) => ({ taskid: taskId, tagid: tagId }));
    const { error } = await supabase.from('task_tags').insert(taskTags);
    if (error) throw error;
  }
}
