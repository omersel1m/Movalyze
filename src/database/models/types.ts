// ================================================================
// Global Tables (Supabase'den okunur, RLS yok)
// ================================================================

export interface ExerciseCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface Exercise {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  is_active: boolean;
  display_order: number;
  created_at: string;
}

// ================================================================
// User Tables (RLS aktif)
// ================================================================

export interface Profile {
  id: string; // auth.users.id ile aynı
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  height_cm: number | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  created_at: string;
  updated_at: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  exercise_id: string;
  duration_seconds: number;
  total_reps: number;
  left_reps: number;
  right_reps: number;
  correct_reps: number;
  incorrect_reps?: number; // Supabase'de generated column
  avg_accuracy_pct: number | null;   // = average_form_score
  max_accuracy_pct: number | null;   // = best_form_score
  min_accuracy_pct: number | null;   // = worst_form_score
  rep_log: string | null;            // JSON string — RepLogEntry[]
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  ended_at: string | null;
  created_at: string;
  // Yerel SQLite alanı — Supabase'e gönderilmez
  synced?: boolean;
}

export interface SessionError {
  id: string;
  session_id: string;
  user_id: string; // trigger tarafından doldurulur, mobil göndermez
  error_code: string;
  error_description: string | null;
  rep_number: number | null;
  occurrence_count: number;
  severity_score: number | null;
  detected_at: string;
  // Yerel SQLite alanı — Supabase'e gönderilmez
  synced?: boolean;
}

export interface DailyStats {
  id: string;
  user_id: string;
  stat_date: string; // 'YYYY-MM-DD'
  total_sessions: number;
  total_reps: number;
  total_correct_reps: number;
  avg_accuracy_pct: number | null;
  total_duration_seconds: number;
  accuracy_by_exercise: Record<string, {
    avg_accuracy: number;
    sessions: number;
    reps: number;
  }>;
  created_at: string;
  updated_at: string;
}

// ================================================================
// Nutrition Tables (RLS aktif)
// ================================================================

export interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  serving_size: number;
  serving_unit: 'g' | 'ml' | 'piece';
  calories: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  created_by: string | null;
  is_user_created: boolean;
  created_at: string;
}

export interface NutritionEntryRow {
  id: string;
  user_id: string;
  food_id: string | null;
  entry_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  amount: number;
  unit: string;
  calories: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  is_quick_add: boolean;
  quick_add_label: string | null;
  created_at: string;
  synced?: boolean;
  food_name?: string | null; // populated by JOIN in getEntriesForDate
}

export interface WaterEntryRow {
  id: string;
  user_id: string;
  entry_date: string;
  amount_ml: number;
  created_at: string;
  synced?: boolean;
}

export interface NutritionGoalsRow {
  user_id: string;
  daily_calories: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  water_ml: number;
  updated_at: string;
  synced?: boolean;
}

export interface FavoriteFoodRow {
  user_id: string;
  food_id: string;
  created_at: string;
}

// ================================================================
// Local-only (SQLite)
// ================================================================

export interface SyncQueueItem {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string; // JSON string
  created_at: string;
}
