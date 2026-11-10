import type { RecordedTenantActivity } from './tenant-console';
export type ActivityIntent = { tagId: string; exerciseId?: string; exercise: string; unit: string; tenant: string; quantity: number };
export type PendingActivity = ActivityIntent & { requestId: string };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };

export function createActivityWorkflow(storage: Storage, record: (tag: string, quantity: number, request: string) => Promise<RecordedTenantActivity>, uuid: () => string) {
  const key = (userId: string) => `nfcfit:pending-activity:${userId}`;
  const flights = new Map<string, Promise<RecordedTenantActivity>>();
  const load = async (userId: string): Promise<PendingActivity | null> => {
    if (!userId) return null;
    const raw = await storage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingActivity;
    if (!value.requestId || !value.tagId || !Number.isFinite(value.quantity) || value.quantity <= 0) throw new Error('Bekleyen kayıt bilgisi okunamadı.');
    return value;
  };
  const submit = (userId: string, intent: ActivityIntent): Promise<RecordedTenantActivity> => {
    if (!userId || !Number.isFinite(intent.quantity) || intent.quantity <= 0 || intent.quantity > 100000) return Promise.reject(new Error('Geçerli bir miktar girin.'));
    if (flights.has(userId)) return Promise.reject(new Error('Bir kayıt işlemi sürüyor. Sonucunu bekleyin.'));
    const operation = (async () => {
      const previous = await load(userId);
      if (previous && (previous.tagId !== intent.tagId || previous.quantity !== intent.quantity)) throw new Error('Önce bekleyen kaydı kontrol edin. Yeni kayıt henüz gönderilmedi.');
      const pending = previous ?? { ...intent, requestId: uuid() };
      // Persist before sending: a timeout or restart always retries the same operation.
      if (!previous) await storage.setItem(key(userId), JSON.stringify(pending));
      try {
        const saved = await record(pending.tagId, pending.quantity, pending.requestId);
        await storage.removeItem(key(userId)).catch(() => undefined);
        return saved;
      } catch (error) {
        const status = (error as { status?: number })?.status;
        // A definitive validation/permission error cannot have committed this request.
        if (status && [400, 403, 404, 410, 422].includes(status)) await storage.removeItem(key(userId)).catch(() => undefined);
        throw error;
      }
    })().finally(() => flights.delete(userId));
    flights.set(userId, operation);
    return operation;
  };
  return { load, submit };
}

export function goalProgress(completed: number, target?: number | null) {
  if (!target || target <= 0) return { percent: 0, remaining: 0, complete: false };
  return { percent: Math.min(100, Math.max(0, Math.round(completed / target * 100))), remaining: Math.max(0, target - completed), complete: completed >= target };
}

export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weeklyTrend(timeline: { day: string; count: number }[], personal: { createdat: string }[]) {
  const days = timeline.map(day => ({ ...day }));
  const byDay = new Map(days.map(day => [day.day, day]));
  for (const log of personal) {
    const day = byDay.get(localDay(new Date(log.createdat)));
    if (day) day.count++;
  }
  const current = days.slice(-7);
  const previous = days.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
  const total = current.reduce((sum, day) => sum + day.count, 0);
  return { days: current, total, previous, activeDays: current.filter(day => day.count > 0).length,
    change: previous ? Math.round((total - previous) / previous * 100) : null };
}

export function createGoalCelebrationClaim(storage: Storage) {
  const claimed = new Set<string>();
  return async (userId: string, day: string, exerciseId: string, unit: string) => {
    if (!userId) return false;
    const key = `nfcfit:celebrated:${userId}:${exerciseId}:${unit}`;
    const event = `${key}:${day}`;
    if (claimed.has(event)) return false;
    claimed.add(event);
    try {
      if (await storage.getItem(key) === day) return false;
      await storage.setItem(key, day);
      return true;
    } catch (error) { claimed.delete(event); throw error; }
  };
}
