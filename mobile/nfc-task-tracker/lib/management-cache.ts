import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { ClubManagementData } from './tenant-console';

// Call only after DELETE succeeds. Never remove a card before server confirmation.
export function applyConfirmedTagDeletion(client: QueryClient, queryKey: QueryKey, tagId: string) {
  client.setQueryData<ClubManagementData>(queryKey, current => {
    if (!current || !current.tags.some(tag => tag.id === tagId)) return current;
    return {
      ...current,
      tags: current.tags.filter(tag => tag.id !== tagId),
      dashboard: {
        ...current.dashboard,
        tenant: { ...current.dashboard.tenant, cards: Math.max(0, current.dashboard.tenant.cards - 1) },
      },
    };
  });
  // The next deliberate refresh or focus can reconcile history and other totals.
  // Do not start another six-request reload while completing a deletion.
  void client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
}

// The server returns the saved row. Publish it without reloading unrelated tabs.
export function applyConfirmedManagementSave(client: QueryClient, queryKey: QueryKey, resource: 'tags' | 'exercises', saved: import('./tenant-console').ManagedTag | import('./tenant-console').ManagedExercise) {
  client.setQueryData<ClubManagementData>(queryKey, current => {
    if (!current) return current;
    if (resource === 'tags') {
      const tag = saved as import('./tenant-console').ManagedTag;
      const exists = current.tags.some(item => item.id === tag.id);
      return { ...current, tags: [tag, ...current.tags.filter(item => item.id !== tag.id)].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
        dashboard: { ...current.dashboard, tenant: { ...current.dashboard.tenant, cards: current.dashboard.tenant.cards + (exists ? 0 : 1) } } };
    }
    const exercise = saved as import('./tenant-console').ManagedExercise;
    return { ...current, exercises: [exercise, ...current.exercises.filter(item => item.id !== exercise.id)].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      tags: current.tags.map(tag => tag.exercise_id === exercise.id ? { ...tag, exercise } : tag) };
  });
  void client.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
}

/** Publish only confirmed server rows; a repeated response must not count a member twice. */
export function applyConfirmedMemberSave(client: QueryClient, queryKey: QueryKey, saved: Partial<import('./tenant-console').ManagedMember> & {id:string;status:string}) {
  client.setQueryData<ClubManagementData>(queryKey, current => {
    if (!current) return current;
    const previous=current.members.find(m=>m.id===saved.id);
    if (!previous && (!saved.name || !saved.email || !saved.account_id || !saved.requested_at)) return current;
    const member={...previous,...saved} as import('./tenant-console').ManagedMember;
    const delta=(state:string)=>(member.status===state?1:0)-(previous?.status===state?1:0);
    return {...current,members:[member,...current.members.filter(m=>m.id!==member.id)],dashboard:{...current.dashboard,
      inactive_members:Math.max(0,current.dashboard.inactive_members+delta('suspended')),
      tenant:{...current.dashboard.tenant,active_members:Math.max(0,current.dashboard.tenant.active_members+delta('active')),pending_joins:Math.max(0,current.dashboard.tenant.pending_joins+delta('pending'))}}};
  });
  void client.invalidateQueries({queryKey,exact:true,refetchType:'none'});
}
export function applyConfirmedStaffSave(client: QueryClient, queryKey: QueryKey, saved: Partial<import('./tenant-console').ManagedStaff> & {id:string}) {
  client.setQueryData<ClubManagementData>(queryKey,current=>{
    if(!current)return current;
    const previous=current.staff.find(s=>s.id===saved.id);
    if(!previous&&(!saved.name||!saved.email||!saved.account_id||!saved.role||!saved.status))return current;
    return {...current,staff:[{...previous,...saved} as import('./tenant-console').ManagedStaff,...current.staff.filter(s=>s.id!==saved.id)]};
  });
  void client.invalidateQueries({queryKey,exact:true,refetchType:'none'});
}
