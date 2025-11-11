import { TaskStatus } from '../types';

const STATUS_ALIASES: Record<string, TaskStatus> = {
  'not_started': TaskStatus.ToDo,
  'todo': TaskStatus.ToDo,
  'to do': TaskStatus.ToDo,
  'yapılacak': TaskStatus.ToDo,
  'yapilacak': TaskStatus.ToDo,
  'başlanmadı': TaskStatus.ToDo,
  'baslanmadi': TaskStatus.ToDo,
  'in_progress': TaskStatus.InProgress,
  'in progress': TaskStatus.InProgress,
  'devam ediyor': TaskStatus.InProgress,
  'devamediyor': TaskStatus.InProgress,
  'ongoing': TaskStatus.InProgress,
  'completed': TaskStatus.Completed,
  'tamamlandı': TaskStatus.Completed,
  'tamamlandi': TaskStatus.Completed,
  'done': TaskStatus.Completed,
  'canceled': TaskStatus.Canceled,
  'cancelled': TaskStatus.Canceled,
  'iptal': TaskStatus.Canceled,
  'iptal edildi': TaskStatus.Canceled,
};

export function normalizeStatus(
  value?: string | null,
  fallback: TaskStatus = TaskStatus.ToDo,
): TaskStatus {
  if (!value) return fallback;
  const key = value.toString().trim().toLowerCase();
  return STATUS_ALIASES[key] ?? fallback;
}

export { TaskStatus };
