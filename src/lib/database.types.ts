/**
 * Hand-maintained schema types, mirroring supabase/migrations.
 * Update alongside any migration.
 */

export type EquipmentProfile = "full_gym" | "hotel" | "home_minimal";
export type PlanSource = "template" | "generated" | "manual";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type LiftFamily =
  | "lower_compound"
  | "upper_compound"
  | "accessory"
  | "bodyweight";

export type Profile = {
  id: string;
  name: string;
  email: string;
  height_cm: number | null;
  birth_date: string | null;
  sex: "male" | "female" | "other" | "undisclosed" | null;
  experience: "beginner" | "novice" | "intermediate";
  injury_notes: string | null;
  is_owner: boolean;
  onboarded_at: string | null;
  created_at: string;
}

export type Invite = {
  id: string;
  email: string;
  name: string;
  code_hash: string;
  created_by: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  created_at: string;
}

export type HouseholdSettings = {
  id: string;
  days_per_week: number;
  equipment: EquipmentProfile;
  session_minutes: number;
  rest_default_sec: number;
  updated_at: string;
}

export type Exercise = {
  slug: string;
  name: string;
  primary_muscle: string;
  secondary: string[];
  equipment: string;
  category: string;
  family: LiftFamily;
  increment_kg: number;
  images: string[];
  cues: string[];
  instructions: string | null;
  profiles_ok: EquipmentProfile[];
  is_timed: boolean;
  per_side: boolean;
}

export type Plan = {
  id: string;
  name: string;
  block_start: string;
  weeks: number;
  equipment: EquipmentProfile;
  source: PlanSource;
  rationale: string | null;
  raw_json: unknown | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export type PlanDay = {
  id: string;
  plan_id: string;
  day_index: number;
  name: string;
  focus: string | null;
}

export type PlanItem = {
  id: string;
  plan_day_id: string;
  position: number;
  exercise: string;
  sets: number;
  rep_low: number;
  rep_high: number;
  rest_sec: number;
  notes: string | null;
}

export type Session = {
  id: string;
  user_id: string;
  plan_day_id: string | null;
  performed_on: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export type SetLog = {
  id: string;
  session_id: string;
  user_id: string;
  exercise: string;
  set_no: number;
  is_warmup: boolean;
  target_kg: number | null;
  weight_kg: number | null;
  reps: number | null;
  completed: boolean;
  logged_at: string;
}

export type ProgressionAction =
  | "start"
  | "increase"
  | "hold"
  | "deload"
  | "unchanged";

export type Progression = {
  user_id: string;
  exercise: string;
  working_kg: number;
  fail_count: number;
  last_action: ProgressionAction;
  updated_at: string;
}

export type SessionItem = {
  id: string;
  session_id: string;
  user_id: string;
  position: number;
  exercise: string;
  sets: number;
  rep_low: number;
  rep_high: number;
  rest_sec: number;
  notes: string | null;
  added_mid_session: boolean;
}

export type PersonalRecord = {
  id: string;
  user_id: string;
  exercise: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  achieved_on: string;
}

export type BodyLog = {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  photo_path: string | null;
  notes: string | null;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      profiles: Table<Profile>;
      invites: Table<Invite>;
      household_settings: Table<HouseholdSettings>;
      exercises: Table<Exercise>;
      plans: Table<Plan>;
      plan_days: Table<PlanDay>;
      plan_items: Table<PlanItem>;
      sessions: Table<Session>;
      session_items: Table<SessionItem>;
      set_logs: Table<SetLog>;
      progression: Table<Progression>;
      personal_records: Table<PersonalRecord>;
      body_logs: Table<BodyLog>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      equipment_profile: EquipmentProfile;
      plan_source: PlanSource;
      session_status: SessionStatus;
      lift_family: LiftFamily;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
