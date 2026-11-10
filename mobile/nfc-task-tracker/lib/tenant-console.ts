import { consoleTransport } from "./console-transport";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const apiOrigin = process.env.EXPO_PUBLIC_TENANT_API_URL?.trim().replace(/\/+$/, '');
export const tenantConsoleConfigured = Boolean(apiOrigin);

export type TenantExercise = {
  id: string;
  name: string;
  unit: 'repetition' | 'seconds' | 'minutes' | 'meters';
  default_quantity: number;
};

export type TenantScanResult = {
  result: 'join_request_pending' | 'activity_confirmation_required' | 'tag_unassigned';
  tenant: { id: string; name: string };
  membership_status?: 'pending';
  tag?: { id: string; name: string };
  exercise?: TenantExercise;
};

export type TenantActivity = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  exercise: string;
  exercise_id?: string;
  tag_id?: string | null;
  quantity: number;
  unit: string;
  source: string;
  tag: string | null;
  created_at: string;
  sync_state?: 'pending' | 'synced' | 'rejected';
  sync_error?: string | null;
};

export type RecordedTenantActivity = {
  id: string;
  tenant: string;
  tenant_id: string;
  tenant_name: string;
  exercise_id: string;
  tag_id: string | null;
  tag: string | null;
  request_id?: string | null;
  received_at?: string | null;
  sync_state?: 'pending' | 'synced' | 'rejected';
  sync_error?: string | null;
  exercise: string;
  quantity: number;
  unit: string;
  source: string;
  created_at: string;
};

export class ConsoleApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit & { expectedUserId?: string; timeoutMs?: number }): Promise<T> {
  if (!apiOrigin) {
    throw new Error('Tenant API is not configured. Set EXPO_PUBLIC_TENANT_API_URL to the backend URL.');
  }
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session?.access_token) throw new ConsoleApiError('Eşitlemek için yeniden giriş yap.', 401);
  if (init?.expectedUserId && data.session.user.id !== (await AsyncStorage.getItem(`nfcfit:auth-owner:${init.expectedUserId}`) ?? init.expectedUserId)) throw new ConsoleApiError('Oturum hesabı değişti; önceki hesabın eşitlemesi durduruldu.',401);

  const { expectedUserId: _expectedUserId, timeoutMs, ...fetchInit } = init ?? {};
  return consoleTransport(`${apiOrigin}/api/console${path}`, {
    ...fetchInit,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${data.session.access_token}`,
      ...init?.headers,
    },
  }, async response => {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((item: { loc?: string[]; msg?: string }) => `${item.loc?.slice(1).join('.') ?? ''}: ${item.msg ?? 'Geçersiz değer'}`).join('\n')
      : `Tenant API request failed (${response.status}).`;
    throw new ConsoleApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
  }, timeoutMs);
}

export async function scanTenantTag(uid: string, signal?: AbortSignal): Promise<TenantScanResult | null> {
  if (!tenantConsoleConfigured) return null;
  try {
    return await request<TenantScanResult>('/nfc/scan', {
      method: 'POST',
      body: JSON.stringify({ uid }),
      signal,
    });
  } catch (error) {
    if (error instanceof ConsoleApiError && error.status === 404) return null;
    throw error;
  }
}

export async function recordTenantActivity(tagId: string, quantity: number, requestId?: string, expectedUserId?: string): Promise<RecordedTenantActivity> {
  return request('/nfc/record', {
    method: 'POST',
    body: JSON.stringify({ tag_id: tagId, quantity, ...(requestId ? { request_id: requestId } : {}) }),
    expectedUserId,
  });
}

export function fetchTenantActivities(): Promise<TenantActivity[]> {
  return request('/me/activities?limit=100');
}

export type TagLinkPreview = {
  tag: { id: string; name: string }; tenant: { id: string; name: string };
  exercise: ManagedExercise | null; membership_status: 'none' | 'active' | 'pending' | 'rejected' | 'suspended';
};
export const resolveTagLink = (id: string) => request<TagLinkPreview>(`/nfc/resolve/${encodeURIComponent(id)}`);
export const requestTagMembership = (id: string) => request<TenantScanResult>('/nfc/open', { method: 'POST', body: JSON.stringify({ tag_id: id }) });
export const fetchTagWriteLink = (tenantId: string, id: string) => request<{ tag_id: string; uid: string; url: string }>(`/tenants/${encodeURIComponent(tenantId)}/tags/${encodeURIComponent(id)}/link`);

export type ConsoleRole = 'owner' | 'admin' | 'coach' | 'CLUB_ADMIN' | 'CLUB_MANAGER' | 'TRAINER';
export type ConsoleIdentity = {
  account: { id: string; name: string; email: string; is_platform_admin: boolean };
  staff: { tenant_id: string; tenant_name: string; tenant_status?: string; role: ConsoleRole; status: string }[];
  memberships: { tenant_id: string; tenant_name: string; status: string }[];
};
export type ManagedTenant = {
  id: string; name: string; slug: string; status: 'active' | 'suspended'; plan: string;
  member_limit: number; card_limit: number; active_members: number; pending_joins: number; cards: number;
};
export type ManagedExercise = TenantExercise & {
  category: 'strength' | 'core' | 'cardio' | 'mobility' | 'rehab' | 'other';
  default_calories: number; active: boolean;
};
export type ManagedTag = {
  id: string; uid: string; name: string; exercise_id: string | null; active: boolean;
  read_count: number; last_scanned_at: string | null; exercise: ManagedExercise | null;
};
export type ManagedMember = {
  id: string; account_id: string; name: string; email: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended' | 'removed'; requested_at: string;
};
export type ManagedStaff = {
  id: string; account_id: string; name: string; email: string; role: ConsoleRole; status: string;
};
export type ManagedActivity = {
  id: string; member: string; email: string; exercise: string; quantity: number;
  unit: string; source: string; tag: string | null; created_at: string;
};
export type ClubManagementData = {
  dashboard: { tenant: ManagedTenant; activities_today: number; inactive_members: number };
  members: ManagedMember[]; tags: ManagedTag[]; exercises: ManagedExercise[];
  staff: ManagedStaff[]; activities: ManagedActivity[];
};
export type PlatformOverview = {
  tenant_count: number; active_tenants: number; member_count: number; pending_joins: number;
  tenants: ManagedTenant[];
};

export const fetchConsoleIdentity = () => request<ConsoleIdentity>('/auth/me');
export const fetchConsoleIdentityForUser = (expectedUserId: string, signal?: AbortSignal) => request<ConsoleIdentity>('/auth/me', { expectedUserId, signal, timeoutMs: 8000 });
export const fetchPlatformOverview = () => request<PlatformOverview>('/platform/overview');

export async function fetchClubManagement(tenantId: string, _canManage: boolean): Promise<ClubManagementData> {
  return request(`/tenants/${encodeURIComponent(tenantId)}/management`);
}

export type MemberFitnessPeriod = { count: number; quantity: number };
export type MemberFitnessExercise = {
  exercise_id: string; tenant_id: string; tenant_name: string; name: string; unit: string;
  target_quantity: number | null; can_edit: boolean;
  day: MemberFitnessPeriod; week: MemberFitnessPeriod; month: MemberFitnessPeriod;
};
export type MemberFitness = { day: string; exercises: MemberFitnessExercise[]; timeline?: { day: string; count: number }[] };
export const fetchMemberFitness = (day: string, offset: number) => request<MemberFitness>(`/me/fitness?day=${day}&utc_offset_minutes=${offset}`);
export const saveMemberGoal = (exerciseId: string, unit: string, target: number) => request<{ exercise_id: string; unit: string; target_quantity: number }>(`/me/exercise-goals/${encodeURIComponent(exerciseId)}`, { method: 'POST', body: JSON.stringify({ unit, target_quantity: target }) });

// Uses the same Supabase session and server-enforced permissions as the web console.
export function saveConsoleResource(path: string, payload: object, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  return request<unknown>(path, { method, ...(method !== 'DELETE' ? { body: JSON.stringify(payload) } : {}) });
}

async function offlineRequest<T>(userId:string,path:string,payload:object):Promise<T>{
  return request<T>(path,{expectedUserId:userId,method:'POST',body:JSON.stringify(payload)});
}
export const pullOfflineData = (userId: string, payload: object) => offlineRequest<import('./offline-store-core').PullResult>(userId,'/me/offline/pull',payload);
export const pushOfflineData = (userId: string, payload: object) => offlineRequest<{results:any[]}>(userId,'/me/offline/push',payload);

export async function coachingRequest<T>(user:string,path:string,payload?:unknown,method?:'POST'|'PATCH'):Promise<T>{
  return request<T>(`/coaching${path}`,{expectedUserId:user,method:method??(payload?'POST':'GET'),body:payload?JSON.stringify(payload):undefined});
}

export type ClubSubscription = { tenant: ManagedTenant; billing_status: string; billing_profile: { legal_name:string; billing_email:string; tax_id:string; address:string }; requests: { id: string; requested_plan: string; status: string }[] };
export type ClubAuditEntry = { id: string; action: string; subject_id: string; created_at: string };
export const fetchClubSubscription = (tenantId: string) => request<ClubSubscription>(`/tenants/${encodeURIComponent(tenantId)}/subscription`);
export const fetchClubAudit = (tenantId: string) => request<ClubAuditEntry[]>(`/tenants/${encodeURIComponent(tenantId)}/audit`);
