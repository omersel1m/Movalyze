import { getDatabase } from '../database/sqlite';
import {
  FoodRow,
  NutritionEntryRow,
  WaterEntryRow,
  NutritionGoalsRow,
  FavoriteFoodRow,
} from '../database/models/types';

function rows<T>(result: { rows?: T[] | { _array?: T[] } }): T[] {
  if (!result.rows) return [];
  if (Array.isArray(result.rows)) return result.rows as T[];
  return (result.rows as { _array?: T[] })._array ?? [];
}

export const nutritionRepository = {
  // ── Foods ────────────────────────────────────────────────────

  saveFood(food: FoodRow): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO foods
        (id, name, brand, serving_size, serving_unit, calories, carbs_g, protein_g, fat_g,
         fiber_g, sugar_g, sodium_mg, created_by, is_user_created, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        food.id, food.name, food.brand ?? null, food.serving_size, food.serving_unit,
        food.calories, food.carbs_g, food.protein_g, food.fat_g,
        food.fiber_g ?? null, food.sugar_g ?? null, food.sodium_mg ?? null,
        food.created_by ?? null, food.is_user_created ? 1 : 0, food.created_at,
      ],
    );
  },

  searchFoods(query: string): FoodRow[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT * FROM foods WHERE name LIKE ? OR brand LIKE ? ORDER BY name ASC LIMIT 50`,
      [`%${query}%`, `%${query}%`],
    );
    return rows<FoodRow>(result);
  },

  getUserFoods(userId: string): FoodRow[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT * FROM foods WHERE created_by = ? AND is_user_created = 1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows<FoodRow>(result);
  },

  getFoodById(id: string): FoodRow | null {
    const db = getDatabase();
    const result = db.executeSync(`SELECT * FROM foods WHERE id = ?`, [id]);
    return rows<FoodRow>(result)[0] ?? null;
  },

  // ── Nutrition Entries ─────────────────────────────────────────

  saveEntry(entry: NutritionEntryRow): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO nutrition_entries
        (id, user_id, food_id, entry_date, meal_type, amount, unit, calories,
         carbs_g, protein_g, fat_g, is_quick_add, quick_add_label, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id, entry.user_id, entry.food_id ?? null, entry.entry_date,
        entry.meal_type, entry.amount, entry.unit, entry.calories,
        entry.carbs_g, entry.protein_g, entry.fat_g,
        entry.is_quick_add ? 1 : 0, entry.quick_add_label ?? null,
        entry.created_at, entry.synced ? 1 : 0,
      ],
    );
  },

  getEntriesForDate(userId: string, date: string): NutritionEntryRow[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT ne.*, f.name AS food_name
       FROM nutrition_entries ne
       LEFT JOIN foods f ON ne.food_id = f.id
       WHERE ne.user_id = ? AND ne.entry_date = ?
       ORDER BY ne.created_at ASC`,
      [userId, date],
    );
    return rows<NutritionEntryRow>(result);
  },

  deleteEntry(id: string): void {
    const db = getDatabase();
    db.executeSync(`DELETE FROM nutrition_entries WHERE id = ?`, [id]);
  },

  updateEntry(id: string, patch: Partial<NutritionEntryRow>): void {
    const db = getDatabase();
    const fields = Object.keys(patch)
      .filter(k => k !== 'id')
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.keys(patch)
      .filter(k => k !== 'id')
      .map(k => (patch as Record<string, unknown>)[k]);
    db.executeSync(`UPDATE nutrition_entries SET ${fields}, synced = 0 WHERE id = ?`, [...values, id]);
  },

  getUnsyncedEntries(): NutritionEntryRow[] {
    const db = getDatabase();
    const result = db.executeSync(`SELECT * FROM nutrition_entries WHERE synced = 0`);
    return rows<NutritionEntryRow>(result);
  },

  markEntrySynced(id: string): void {
    const db = getDatabase();
    db.executeSync(`UPDATE nutrition_entries SET synced = 1 WHERE id = ?`, [id]);
  },

  // ── Water Entries ─────────────────────────────────────────────

  saveWaterEntry(entry: WaterEntryRow): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO water_entries (id, user_id, entry_date, amount_ml, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.user_id, entry.entry_date, entry.amount_ml, entry.created_at, entry.synced ? 1 : 0],
    );
  },

  getWaterForDate(userId: string, date: string): WaterEntryRow[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT * FROM water_entries WHERE user_id = ? AND entry_date = ?`,
      [userId, date],
    );
    return rows<WaterEntryRow>(result);
  },

  deleteWaterEntry(id: string): void {
    const db = getDatabase();
    db.executeSync(`DELETE FROM water_entries WHERE id = ?`, [id]);
  },

  getUnsyncedWater(): WaterEntryRow[] {
    const db = getDatabase();
    const result = db.executeSync(`SELECT * FROM water_entries WHERE synced = 0`);
    return rows<WaterEntryRow>(result);
  },

  markWaterSynced(id: string): void {
    const db = getDatabase();
    db.executeSync(`UPDATE water_entries SET synced = 1 WHERE id = ?`, [id]);
  },

  // ── Nutrition Goals ───────────────────────────────────────────

  saveGoals(goals: NutritionGoalsRow): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO nutrition_goals
        (user_id, daily_calories, carbs_g, protein_g, fat_g, water_ml, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goals.user_id, goals.daily_calories, goals.carbs_g,
        goals.protein_g, goals.fat_g, goals.water_ml, goals.updated_at, goals.synced ? 1 : 0,
      ],
    );
  },

  getGoals(userId: string): NutritionGoalsRow | null {
    const db = getDatabase();
    const result = db.executeSync(`SELECT * FROM nutrition_goals WHERE user_id = ?`, [userId]);
    return rows<NutritionGoalsRow>(result)[0] ?? null;
  },

  getUnsyncedGoals(): NutritionGoalsRow[] {
    const db = getDatabase();
    const result = db.executeSync(`SELECT * FROM nutrition_goals WHERE synced = 0`);
    return rows<NutritionGoalsRow>(result);
  },

  markGoalsSynced(userId: string): void {
    const db = getDatabase();
    db.executeSync(`UPDATE nutrition_goals SET synced = 1 WHERE user_id = ?`, [userId]);
  },

  // ── Favorites ─────────────────────────────────────────────────

  addFavorite(userId: string, foodId: string): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR IGNORE INTO favorite_foods (user_id, food_id) VALUES (?, ?)`,
      [userId, foodId],
    );
  },

  removeFavorite(userId: string, foodId: string): void {
    const db = getDatabase();
    db.executeSync(`DELETE FROM favorite_foods WHERE user_id = ? AND food_id = ?`, [userId, foodId]);
  },

  getFavorites(userId: string): FavoriteFoodRow[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT * FROM favorite_foods WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
    );
    return rows<FavoriteFoodRow>(result);
  },

  isFavorite(userId: string, foodId: string): boolean {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT 1 FROM favorite_foods WHERE user_id = ? AND food_id = ?`,
      [userId, foodId],
    );
    return (rows(result).length ?? 0) > 0;
  },

  // ── Recent Foods ──────────────────────────────────────────────

  touchRecentFood(userId: string, foodId: string): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO recent_foods (user_id, food_id, used_at) VALUES (?, ?, datetime('now'))`,
      [userId, foodId],
    );
  },

  getRecentFoodIds(userId: string, limit: number): string[] {
    const db = getDatabase();
    const result = db.executeSync(
      `SELECT food_id FROM recent_foods WHERE user_id = ? ORDER BY used_at DESC LIMIT ?`,
      [userId, limit],
    );
    return rows<{ food_id: string }>(result).map(r => r.food_id);
  },
};
