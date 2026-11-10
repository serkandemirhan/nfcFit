import type { PlanContent } from './coaching-types';
import type { ConsoleIdentity } from './tenant-console';
import { canonicalRole } from './club-roles';

export function planTemplateTenants(identity: ConsoleIdentity | null | undefined) {
  return identity?.staff.filter(s => s.status === 'active' &&
    (s.tenant_status == null || s.tenant_status === 'active') &&
    ['CLUB_ADMIN', 'TRAINER'].includes(canonicalRole(s.role))) ?? [];
}
export function initialPlanTenant(identity: ConsoleIdentity | null | undefined, requested?: string): string | null {
  return requested && planTemplateTenants(identity).some(s => s.tenant_id === requested) ? requested : null;
}
export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function planDraftError(content: PlanContent): string | null {
  if (content.name.trim().length < 2 || content.name.length > 160) return 'Program adı 2–160 karakter olmalı.';
  if (!validCalendarDate(content.start_date)) return 'Geçerli bir başlangıç tarihi gir (YYYY-AA-GG).';
  if (!Number.isInteger(content.weeks) || content.weeks < 1 || content.weeks > 52) return 'Program süresi 1–52 hafta arasında tam sayı olmalı.';
  if (!content.days.length) return 'En az bir antrenman günü ekle.';
  const end = new Date(content.start_date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+content.weeks*7);
  const endDate=end.toISOString().slice(0,10);
  for (const day of content.days) {
    if (!day.name.trim()) return 'Her antrenman gününe açıklayıcı bir ad ver.';
    if (!day.dates.length || day.dates.some(d => !validCalendarDate(d) || d < content.start_date || d >= endDate))
      return `${day.name}: tarihler programın ${content.weeks} haftalık aralığında olmalı.`;
    if (new Set(day.dates).size !== day.dates.length) return `${day.name}: aynı tarih iki kez eklenemez.`;
    if (!day.exercises.length) return `${day.name}: en az bir egzersiz seç.`;
    for (const target of day.exercises) {
      if (!Number.isInteger(target.sets) || target.sets < 1 || target.sets > 100) return `${day.name}: set sayısı 1–100 arasında tam sayı olmalı.`;
      if (!Number.isInteger(target.rest_seconds) || target.rest_seconds < 0 || target.rest_seconds > 3600) return `${day.name}: dinlenme 0–3600 saniye arasında tam sayı olmalı.`;
      for (const [key,max,zero] of [['reps',10000,false],['kg',2000,true],['seconds',86400,false],['meters',1000000,false]] as const) {
        const value=target[key];
        if (value != null && (!Number.isFinite(value) || value > max || (zero ? value < 0 : value <= 0) || (key === 'reps' && !Number.isInteger(value))))
          return `${day.name}: ${ {reps:'tekrar',kg:'ağırlık',seconds:'süre',meters:'mesafe'}[key]} değeri geçerli aralıkta olmalı.`;
      }
      if ([target.reps,target.seconds,target.meters].every(v=>v == null)) return `${day.name}: tekrar, süre veya mesafe hedefi gir.`;
    }
  }
  return null;
}
