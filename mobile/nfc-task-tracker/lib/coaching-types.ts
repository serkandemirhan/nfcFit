export type Exercise = {
  id: string;
  name: string;
  name_en: string;
  description: string;
  muscle: string;
  secondary_muscles: string[];
  equipment: string;
  difficulty: string;
  measurements: ("reps" | "kg" | "seconds" | "meters")[];
  instructions: string[];
  safety: string[];
  variations: string[];
  media: {
    media_type: "image" | "animation" | "video" | "model3d";
    role?: "thumbnail" | "position_1" | "position_2" | "pose";
    url: string;
    alt: string;
    attribution: string;
    license: string;
    license_url: string;
    source: string;
    rights_holder: string;
    sha256: string;
  }[];
  favorite?: boolean;
};
export type Target = {
  id: string;
  exercise_id: string;
  sets: number;
  reps?: number | null;
  kg?: number | null;
  seconds?: number | null;
  meters?: number | null;
  rest_seconds: number;
  notes: string;
  superset?: string | null;
  name?: string;
  measurements?: string[];
};
export type PlanDay = {
  id: string;
  name: string;
  dates: string[];
  exercises: Target[];
};
export type PlanContent = {
  planning_status?: "draft" | "published" | "archived";
  rest_dates?: string[];
  name: string;
  goal: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  start_date: string;
  weeks: number;
  timezone: string;
  days: PlanDay[];
};
export type Plan = {
  id: string;
  owner_id: string;
  athlete_id: string | null;
  tenant_id: string | null;
  template_id: string | null;
  version: number;
  content: PlanContent;
};
export type ActualSet = {
  id: string;
  exercise_key: string;
  set_number: number;
  reps?: number | null;
  kg?: number | null;
  seconds?: number | null;
  meters?: number | null;
  method: "manual" | "nfc";
  status: "completed" | "skipped";
  occurred_at: string;
  notes: string;
};
export type Workout = {
  id: string;
  athlete_id: string;
  plan_id: string;
  plan_version: number;
  session_key: string;
  scheduled_date: string;
  state:
    | "not_started"
    | "in_progress"
    | "paused"
    | "completed"
    | "partial"
    | "skipped"
    | "cancelled";
  version: number;
  snapshot: PlanDay;
  actual: {
    sets: ActualSet[];
    added: Target[];
    skipped: string[];
    order: string[];
    notes: string;
    active_seconds?: number;
    active_since?: string | null;
    started_at?: string;
    finished_at?: string;
  };
  sync_state?: "pending" | "synced" | "rejected";
  sync_error?: string;
};
export type WorkoutCommand = {
  request_id: string;
  occurred_at?: string;
  expected_version: number;
  action:
    | "start"
    | "pause"
    | "resume"
    | "set"
    | "skip_exercise"
    | "add_exercise"
    | "reorder"
    | "note"
    | "finish"
    | "skip"
    | "cancel";
  actual_set?: ActualSet;
  exercise?: Target;
  exercise_key?: string;
  order?: string[];
  notes?: string;
  partial?: boolean;
};
export type CoachLink = {
  id: string;
  tenant_id: string;
  trainer_id: string;
  athlete_id: string;
  name: string;
};
export type Report = {
  id: string;
  athlete_id: string;
  week: string;
  timezone: string;
  scope: string;
  status: string;
  content: {
    scheduled_sessions: number;
    completed_sessions: number;
    partial_sessions: number;
    missed_sessions: number;
    completion_rate: number | null;
    planned_exercises: number;
    planned_sets: number;
    completed_sets: number;
    planned_reps: number;
    actual_reps: number;
    recorded_volume_kg_reps: number | null;
    active_duration_seconds?: number | null;
    set_adherence: number | null;
    insufficient_data: boolean;
    changes: {
      plan_id: string;
      version: number;
      actor_role: string;
      reason: string;
    }[];
    workouts: Workout[];
  };
};
export type Message = {
  id: string;
  link_id: string;
  author_id: string;
  body: string;
  context_type: string;
  context_id: string | null;
  read_at: string | null;
  created_at: string;
  sync_state?: "pending" | "rejected";
  sync_error?: string;
};
export type WellnessEntry = {
  id: string;
  kind: "water" | "coffee" | "sleep" | "wellbeing";
  sync_state?: "pending" | "rejected";
  sync_error?: string;
  occurred_at: string;
  content: {
    amount?: number | null;
    coffee_type?: string | null;
    caffeine_mg?: number | null;
    quality?: number | null;
    energy?: number | null;
    mood?: number | null;
    fatigue?: number | null;
    recovery?: number | null;
    notes?: string;
  };
};
export type CoachingOverview = {
  water_goal_ml?: number;
  timezone?: string;
  equipment?: {
    id: string;
    tenant_id: string;
    tag_id: string | null;
    name: string;
    exercise_ids: string[];
    active: boolean;
  }[];
  account_id: string;
  athlete_id: string;
  links: CoachLink[];
  plans: Plan[];
  workouts: Workout[];
  reports: Report[];
  messages: Message[];
  notifications: {
    id: string;
    body: string;
    context_id: string;
    read: boolean;
  }[];
  wellness: WellnessEntry[];
  consents: { trainer_id: string; kind: string; allowed: boolean }[];
};
export const terminalStates = new Set([
  "completed",
  "partial",
  "skipped",
  "cancelled",
]);
