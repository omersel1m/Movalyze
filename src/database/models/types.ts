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
  correct_reps: number;
  incorrect_reps?: number; // Supabase'de generated column
  avg_accuracy_pct: number | null;
  max_accuracy_pct: number | null;
  min_accuracy_pct: number | null;
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
