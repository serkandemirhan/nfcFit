export enum TaskStatus {
  ToDo = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
  Canceled = 'canceled',
}

export interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  avatarurl?: string;
}

export interface NfcCard {
  id: string;
  secretcode?: string;
  alias: string;
  uid?: string; // Kartın değiştirilemez benzersiz kimliği
  nfc_uid?: string;
  name?: string;
  assignedLocationId: string | null;
  assignedlocationid?: string | null; // Supabase lower-case column mapping
  location_id?: string | null;
  active?: boolean;
  is_active?: boolean;
  lifecycle_status?: 'pending' | 'active' | 'lost' | 'revoked' | 'damaged';
  security_mode?: 'static_uid' | 'static_ndef' | 'rolling_token' | 'ntag424_sun' | 'desfire' | 'mifare_ultralight_aes';
  ndef_payload?: string | null;
  read_counter?: number;
  lastscannedat?: string | null;
  last_scanned_at?: string | null;
  lastverifiedat?: string | null;
  action_domain?: 'unassigned' | 'fitness' | 'wellness';
  exercise_type_id?: string | null;
  exercise_name?: string | null;
  wellness_type_id?: string | null;
  wellness_name?: string | null;
  quantity?: number | null;
  unit?: 'repetition' | 'seconds' | 'minutes' | 'meters' | 'ml' | 'cups' | 'count' | null;
  calorie_estimate?: number | null;
  difficulty_level?: 'easy' | 'medium' | 'hard' | null;
}

export interface ExerciseType {
  id: string;
  name: string;
  category: 'strength' | 'core' | 'cardio' | 'mobility' | 'rehab' | 'other';
  unit: 'repetition' | 'seconds' | 'minutes' | 'meters';
  default_calorie_per_unit?: number | null;
}

export interface UserExercise {
  user_id: string;
  exercise_type_id: string;
  active: boolean;
  createdat?: string;
}

export interface DailyGoalProgress {
  user_id: string;
  exercise_type_id: string;
  exercise_name: string;
  target_quantity: number;
  unit: 'repetition' | 'seconds' | 'minutes' | 'meters';
  completed_quantity: number;
  remaining_quantity: number;
}

export interface WellnessType {
  id: string;
  name: string;
  category: 'hydration' | 'nutrition' | 'mindfulness' | 'movement' | 'supplement' | 'other';
  unit: 'ml' | 'cups' | 'minutes' | 'count';
  icon?: string | null;
}

export interface WellnessGoal {
  id?: string;
  user_id: string;
  wellness_type_id: string;
  target_quantity: number;
  unit: 'ml' | 'cups' | 'minutes' | 'count';
  active: boolean;
  createdat?: string;
}

export interface WellnessLog {
  id: string;
  user_id: string;
  wellness_type_id: string;
  wellness_name?: string | null;
  quantity: number;
  unit: 'ml' | 'cups' | 'minutes' | 'count';
  source: 'nfc' | 'manual' | 'health_import';
  createdat: string;
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

export type Page = 'dashboard' | 'members' | 'fitness' | 'wellness' | 'tasks' | 'cards' | 'profile' | 'settings' | 'exercises';
