export enum TaskStatus {
  ToDo = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
  Canceled = 'canceled',
}

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatarUrl: string;
}

export interface NfcCard {
  id: string;
  secretcode: string;
  alias: string;
  uid?: string; // Kartın değiştirilemez benzersiz kimliği
  assignedLocationId: string | null;
  assignedlocationid?: string | null; // Supabase lower-case column mapping
  active?: boolean;
}

export interface Layout {
  id: string;
  name: string;
  imageUrl: string;
}

export interface Location {
  id: string;
  name: string;
  layoutId: string;
  nfcCardId: string | null;
  nfccardid?: string | null; // Supabase lower-case column mapping
  x: number; // Plan üzerindeki yüzde X konumu
  y: number; // Plan üzerindeki yüzde Y konumu
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string; // base64 data URL for this simulation
}

export interface Task {
  id:string;
  title: string;
  description: string;
  status: TaskStatus;
  locationId: string;
  userId: string;
  createdAt: Date;
  dueDate: Date;
  nextDueAt?: Date;
  attachments: Attachment[];
  lastCompletedAt?: Date;
  completionNotes?: string;
  active?: boolean;
  repeat?: {
    frequency: number;
    unit: 'hours' | 'days';
  } | null;
}

export type Page = 'dashboard' | 'board' | 'tasks' | 'layouts' | 'users' | 'cards';
