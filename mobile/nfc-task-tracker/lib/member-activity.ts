import type { QueryClient } from '@tanstack/react-query';
import type { ExerciseLog, ExerciseType } from './api';
import type { RecordedTenantActivity, TenantActivity } from './tenant-console';

export type MemberExerciseLog = ExerciseLog & { exercise_key: string; origin: 'personal' | 'tenant'; tenant_name?: string; sync_state?: string; sync_error?: string | null };
export type MemberExerciseSummary = { key: string; name: string; unit: string; count: number; quantity: number; calories: number | null; tenant_name?: string; sync_state?: string; sync_error?: string | null };

export function combineMemberExerciseLogs(personal: ExerciseLog[], tenant: TenantActivity[], userId: string, includeRejected = false): MemberExerciseLog[] {
  const entries: MemberExerciseLog[] = [
    ...personal.map(log => ({ ...log, id: `personal:${log.id}`, exercise_key: `personal:${log.exercise_type_id}:${log.unit}`, origin: 'personal' as const })),
    ...tenant.filter(log => includeRejected || log.sync_state !== 'rejected').map(log => ({
      id: `tenant:${log.id}`, user_id: userId, exercise_type_id: log.exercise_id ?? `${log.tenant_id}:${log.exercise}:${log.unit}`,
      exercise_key: `tenant:${log.tenant_id}:${log.exercise_id ?? log.exercise}:${log.unit}`,
      exercise_name: log.exercise, quantity: log.quantity, unit: log.unit as ExerciseLog['unit'],
      source: 'nfc' as const, calorie_estimate: null, createdat: log.created_at,
      tag_id: log.tag_id, sync_state: log.sync_state, sync_error: log.sync_error, origin: 'tenant' as const, tenant_name: log.tenant_name,
    })),
  ];
  return [...new Map(entries.map(log => [log.id, log])).values()].sort((a, b) => Date.parse(b.createdat) - Date.parse(a.createdat));
}

export function summarizeMemberExercises(logs: MemberExerciseLog[], selected: ExerciseType[]): MemberExerciseSummary[] {
  const summaries = new Map<string, MemberExerciseSummary>();
  for (const exercise of selected) {
    const key = `personal:${exercise.id}:${exercise.unit}`;
    summaries.set(key, { key, name: exercise.name, unit: exercise.unit, count: 0, quantity: 0, calories: 0 });
  }
  for (const log of logs) {
    const row = summaries.get(log.exercise_key) ?? { key: log.exercise_key, name: log.exercise_name ?? 'Egzersiz', unit: log.unit, count: 0, quantity: 0, calories: 0, tenant_name: log.tenant_name };
    row.count++; row.quantity += Number(log.quantity);
    row.calories = log.calorie_estimate == null || row.calories == null ? null : row.calories + Number(log.calorie_estimate);
    summaries.set(log.exercise_key, row);
  }
  return [...summaries.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'tr'));
}

export function recordedMinutes(logs: ExerciseLog[]) {
  return logs.reduce((sum, log) => sum + (log.unit === 'seconds' ? log.quantity / 60 : log.unit === 'minutes' ? log.quantity : 0), 0);
}

export async function publishConfirmedTenantActivity(client: QueryClient, userId: string, saved: RecordedTenantActivity) {
  const key = ['tenant-activities', userId];
  const previousQuery = client.getQueryCache().find({ queryKey: key, exact: true });
  if (previousQuery) {
    await client.cancelQueries({ queryKey: key, exact: true });
    if (client.getQueryCache().find({ queryKey: key, exact: true }) === previousQuery) {
      const activity: TenantActivity = { ...saved, tenant_name: saved.tenant_name ?? saved.tenant };
      client.setQueryData<TenantActivity[]>(key, current => [activity, ...(current ?? []).filter(item => item.id !== saved.id)]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 100));
    }
  }
  void client.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
  void client.invalidateQueries({ queryKey: ['member-fitness', userId] });
  void client.invalidateQueries({ queryKey: ['club-management'], refetchType: 'none' });
}
