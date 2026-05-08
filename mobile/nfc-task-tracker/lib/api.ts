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
  nfc_uid?: string | null;
  ndef_payload?: string | null;
  assignedlocationid?: string | null;
  location_id?: string | null;
  alias?: string | null;
  name?: string | null;
  createdat?: string | null;
  assigneduserid?: string | null;
  assigned_user_id?: string | null;
  assignedtaskid?: string | null;
  lifecycle_status?: CardLifecycleStatus | null;
  security_mode?: string | null;
  read_counter?: number | null;
  lastscannedat?: string | null;
  last_scanned_at?: string | null;
  lastverifiedat?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  action_domain?: TagActionDomain | null;
  exercise_type_id?: string | null;
  exercise_name?: string | null;
  wellness_type_id?: string | null;
  wellness_name?: string | null;
  quantity?: number | null;
  unit?: TagUnit | null;
  calorie_estimate?: number | null;
  difficulty_level?: string | null;
};

export type CardLifecycleStatus = 'pending' | 'active' | 'lost' | 'revoked' | 'damaged';

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

export type ExerciseUnit = 'repetition' | 'seconds' | 'minutes' | 'meters';
export type WellnessUnit = 'ml' | 'cups' | 'minutes' | 'count';
export type TagUnit = ExerciseUnit | WellnessUnit;
export type TagActionDomain = 'unassigned' | 'fitness' | 'wellness';

export type ExerciseType = {
  id: string;
  name: string;
  category: 'strength' | 'core' | 'cardio' | 'mobility' | 'rehab' | 'other';
  unit: ExerciseUnit;
  default_calorie_per_unit?: number | null;
};

export type ExerciseLogResult = {
  log_id: string | null;
  tag_id: string | null;
  action_domain: TagActionDomain | null;
  exercise_type_id: string | null;
  exercise_name: string | null;
  wellness_type_id: string | null;
  wellness_name: string | null;
  quantity: number | null;
  unit: TagUnit | null;
  calorie_estimate: number | null;
  location_id: string | null;
  location_name: string | null;
  result: 'logged' | 'wellness_logged' | 'no_tag' | 'new_tag' | 'unassigned_tag' | 'inactive_tag' | 'user_mismatch' | 'error';
};

export type ExerciseLog = {
  id: string;
  user_id: string;
  tag_id?: string | null;
  exercise_type_id: string;
  exercise_name?: string | null;
  quantity: number;
  unit: ExerciseUnit;
  calorie_estimate?: number | null;
  source: 'nfc' | 'manual' | 'health_import';
  location_id?: string | null;
  createdat: string;
};

export type DailyGoalProgress = {
  user_id: string;
  exercise_type_id: string;
  exercise_name: string;
  target_quantity: number;
  unit: ExerciseUnit;
  completed_quantity: number;
  remaining_quantity: number;
};

export type UserExercise = {
  user_id: string;
  exercise_type_id: string;
  active: boolean;
  createdat?: string | null;
};

export type WellnessType = {
  id: string;
  name: string;
  category: 'hydration' | 'nutrition' | 'mindfulness' | 'movement' | 'supplement' | 'other';
  unit: WellnessUnit;
  icon?: string | null;
};

export type WellnessGoal = {
  user_id: string;
  wellness_type_id: string;
  target_quantity: number;
  unit: WellnessUnit;
  active: boolean;
};

export type WellnessLog = {
  id: string;
  user_id: string;
  wellness_type_id: string;
  wellness_name?: string | null;
  quantity: number;
  unit: WellnessUnit;
  source: 'nfc' | 'manual' | 'health_import';
  createdat: string;
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

export async function logExerciseFromNfc(payload: {
  uid: string;
  ndefPayload?: string | null;
  userId?: string | null;
  loggedAt?: string | null;
}) {
  const { data, error } = await supabase.rpc('log_exercise_from_nfc', {
    p_uid: payload.uid,
    p_ndef_payload: payload.ndefPayload ?? null,
    p_user_id: payload.userId ?? null,
    p_logged_at: payload.loggedAt ?? new Date().toISOString(),
  });
  if (error) throw error;
  return ((data ?? []) as ExerciseLogResult[])[0] ?? null;
}

export async function fetchExerciseTypes() {
  const { data, error } = await supabase.from('exercise_types').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExerciseType[];
}

export async function fetchExerciseLogs(userId = 'u1') {
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('*, exercise_types(name)')
    .eq('user_id', userId)
    .order('createdat', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    exercise_name: row.exercise_types?.name ?? row.exercise_name ?? row.exercise_type_id,
  })) as ExerciseLog[];
}

export async function fetchDailyGoalProgress(userId = 'u1') {
  const { data, error } = await supabase
    .from('daily_goal_progress')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as DailyGoalProgress[];
}

export async function fetchUserExercises(userId = 'u1') {
  const { data, error } = await supabase
    .from('user_exercises')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as UserExercise[];
}

export async function updateDailyGoal(payload: {
  userId: string;
  exerciseTypeId: string;
  targetQuantity: number;
  unit: ExerciseUnit;
}) {
  const { error } = await supabase.from('daily_goals').upsert(
    {
      user_id: payload.userId,
      exercise_type_id: payload.exerciseTypeId,
      target_quantity: payload.targetQuantity,
      unit: payload.unit,
      active: true,
    },
    { onConflict: 'user_id,exercise_type_id' }
  );
  if (error) throw error;
}

export async function fetchWellnessTypes() {
  const { data, error } = await supabase.from('wellness_types').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WellnessType[];
}

export async function fetchWellnessGoals(userId = 'u1') {
  const { data, error } = await supabase
    .from('wellness_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);
  if (error) throw error;
  return (data ?? []) as WellnessGoal[];
}

export async function fetchWellnessLogs(userId = 'u1') {
  const { data, error } = await supabase
    .from('wellness_logs')
    .select('*, wellness_types(name)')
    .eq('user_id', userId)
    .order('createdat', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    wellness_name: row.wellness_types?.name ?? row.wellness_name ?? row.wellness_type_id,
  })) as WellnessLog[];
}

export async function createWellnessLog(payload: {
  userId: string;
  wellnessTypeId: string;
  quantity: number;
  unit: WellnessUnit;
  source?: 'nfc' | 'manual' | 'health_import';
}) {
  const { data, error } = await supabase
    .from('wellness_logs')
    .insert({
      user_id: payload.userId,
      wellness_type_id: payload.wellnessTypeId,
      quantity: payload.quantity,
      unit: payload.unit,
      source: payload.source ?? 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return data as WellnessLog;
}

export async function createExerciseTag(payload: {
  name: string;
  nfcUid: string;
  ndefPayload?: string | null;
  exerciseTypeId: string;
  quantity: number;
  unit: ExerciseUnit;
  calorieEstimate?: number | null;
  isActive: boolean;
  locationId?: string | null;
  assignedUserId?: string | null;
}) {
  const tagId = generateUUID();
  const { data, error } = await supabase
    .from('exercise_tags')
    .insert({
      id: tagId,
      name: payload.name,
      nfc_uid: payload.nfcUid,
      ndef_payload: payload.ndefPayload ?? null,
      action_domain: 'fitness',
      exercise_type_id: payload.exerciseTypeId,
      wellness_type_id: null,
      quantity: payload.quantity,
      unit: payload.unit,
      calorie_estimate: payload.calorieEstimate ?? null,
      is_active: payload.isActive,
      location_id: payload.locationId ?? null,
      assigned_user_id: payload.assignedUserId ?? 'u1',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchCards() {
  const { data, error } = await supabase
    .from('exercise_tags')
    .select('*, exercise_types(name), wellness_types(name)')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    uid: row.nfc_uid,
    alias: row.name,
    assignedlocationid: row.location_id,
    active: row.is_active,
    lifecycle_status: row.is_active === false ? 'revoked' : row.action_domain === 'unassigned' ? 'pending' : 'active',
    exercise_name: row.exercise_types?.name ?? null,
    wellness_name: row.wellness_types?.name ?? null,
  })) as Card[];
}

export async function fetchCardById(id: string) {
  const { data, error } = await supabase
    .from('exercise_tags')
    .select('*, exercise_types(name), wellness_types(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    uid: data.nfc_uid,
    alias: data.name,
    assignedlocationid: data.location_id,
    active: data.is_active,
    lifecycle_status: data.is_active === false ? 'revoked' : (data as any).action_domain === 'unassigned' ? 'pending' : 'active',
    exercise_name: (data as any).exercise_types?.name ?? null,
    wellness_name: (data as any).wellness_types?.name ?? null,
  } as Card;
}

export async function createCard(payload: {
  uid: string;
  alias?: string;
  secretcode?: string;
  ndefPayload?: string | null;
  assignedUserId?: string | null;
}) {
  const tagId = generateUUID();
  const { data, error } = await supabase
    .from('exercise_tags')
    .insert({
      id: tagId,
      nfc_uid: payload.uid,
      ndef_payload: payload.ndefPayload ?? null,
      name: payload.alias || 'Yeni NFC Tag',
      action_domain: 'unassigned',
      exercise_type_id: null,
      wellness_type_id: null,
      quantity: null,
      unit: null,
      is_active: true,
      assigned_user_id: payload.assignedUserId ?? 'u1',
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    uid: data.nfc_uid,
    alias: data.name,
    assignedlocationid: data.location_id,
    active: data.is_active,
    action_domain: data.action_domain,
  } as Card;
}

export async function updateCardAction(payload: {
  id: string;
  name?: string | null;
  actionDomain: TagActionDomain;
  exerciseTypeId?: string | null;
  wellnessTypeId?: string | null;
  quantity?: number | null;
  unit?: TagUnit | null;
  calorieEstimate?: number | null;
  isActive?: boolean | null;
}) {
  const updatePayload =
    payload.actionDomain === 'fitness'
      ? {
          name: payload.name,
          action_domain: 'fitness',
          exercise_type_id: payload.exerciseTypeId,
          wellness_type_id: null,
          quantity: payload.quantity,
          unit: payload.unit,
          calorie_estimate: payload.calorieEstimate ?? null,
          is_active: payload.isActive ?? true,
        }
      : payload.actionDomain === 'wellness'
        ? {
            name: payload.name,
            action_domain: 'wellness',
            exercise_type_id: null,
            wellness_type_id: payload.wellnessTypeId,
            quantity: payload.quantity,
            unit: payload.unit,
            calorie_estimate: null,
            is_active: payload.isActive ?? true,
          }
        : {
            name: payload.name,
            action_domain: 'unassigned',
            exercise_type_id: null,
            wellness_type_id: null,
            quantity: null,
            unit: null,
            calorie_estimate: null,
            is_active: payload.isActive ?? true,
          };

  const { data, error } = await supabase
    .from('exercise_tags')
    .update(updatePayload)
    .eq('id', payload.id)
    .select('*, exercise_types(name), wellness_types(name)')
    .single();
  if (error) throw error;
  return {
    ...data,
    uid: data.nfc_uid,
    alias: data.name,
    active: data.is_active,
    lifecycle_status: data.is_active === false ? 'revoked' : data.action_domain === 'unassigned' ? 'pending' : 'active',
    exercise_name: (data as any).exercise_types?.name ?? null,
    wellness_name: (data as any).wellness_types?.name ?? null,
  } as Card;
}

export async function updateCard(
  id: string,
  payload: Partial<Pick<Card, 'alias' | 'assignedlocationid' | 'lifecycle_status' | 'active'>>
) {
  const { error } = await supabase
    .from('exercise_tags')
    .update({
      name: payload.alias,
      location_id: payload.assignedlocationid,
      is_active: payload.active,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function assignCardToLocation(payload: {
  cardId: string;
  alias?: string | null;
  nextLocationId?: string | null;
  previousLocationId?: string | null;
  lifecycleStatus?: CardLifecycleStatus | null;
}) {
  const nextLocationId = payload.nextLocationId || null;
  const nextLifecycleStatus = nextLocationId ? 'active' : payload.lifecycleStatus ?? 'pending';
  const { error: cardError } = await supabase
    .from('exercise_tags')
    .update({
      name: payload.alias,
      location_id: nextLocationId,
      is_active: nextLifecycleStatus === 'active' || nextLifecycleStatus === 'pending',
    })
    .eq('id', payload.cardId);
  if (cardError) throw cardError;
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from('exercise_tags').delete().eq('id', id);
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

export async function updateLocationPosition(id: string, position: { x: number; y: number }) {
  const { data, error } = await supabase
    .from('locations')
    .update(position)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Location;
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
