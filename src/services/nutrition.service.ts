import { supabase } from '../config/supabaseClient';
import { generateId } from '../utils/generateId';
import { nutritionRepository } from '../repositories/nutrition.repository';
import { FoodRow, NutritionEntryRow, WaterEntryRow, NutritionGoalsRow } from '../database/models/types';
import {
  Food,
  NutritionEntry,
  NutritionGoals,
  DayNutrition,
  MealType,
  AddEntryInput,
  CustomFoodInput,
} from '../features/nutrition/types/nutrition.types';
import { calculateEntryNutrition, sumDayTotals } from '../features/nutrition/logic/calculations';

// ─────────────────────────────────────────────────────────────────
// Mappers: DB row ↔ domain type
// ─────────────────────────────────────────────────────────────────

function rowToFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    calories: row.calories,
    carbsG: row.carbs_g,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    fiberG: row.fiber_g ?? undefined,
    sugarG: row.sugar_g ?? undefined,
    sodiumMg: row.sodium_mg ?? undefined,
    isUserCreated: Boolean(row.is_user_created),
  };
}

function rowToEntry(row: NutritionEntryRow): NutritionEntry {
  return {
    id: row.id,
    userId: row.user_id,
    foodId: row.food_id,
    foodName: row.food_name ?? undefined,
    entryDate: row.entry_date,
    mealType: row.meal_type as MealType,
    amount: row.amount,
    unit: row.unit,
    calories: row.calories,
    carbsG: row.carbs_g,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    isQuickAdd: Boolean(row.is_quick_add),
    quickAddLabel: row.quick_add_label ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToGoals(row: NutritionGoalsRow): NutritionGoals {
  return {
    dailyCalories: row.daily_calories,
    carbsG: row.carbs_g,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    waterMl: row.water_ml,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function supabaseItemToFoodRow(item: any): FoodRow {
  return {
    id:              String(item.id),
    name:            String(item.name),
    brand:           item.brand ?? null,
    serving_size:    Number(item.serving_size),
    serving_unit:    item.serving_unit as 'g' | 'ml' | 'piece',
    calories:        Number(item.calories),
    carbs_g:         Number(item.carbs_g),
    protein_g:       Number(item.protein_g),
    fat_g:           Number(item.fat_g),
    fiber_g:         item.fiber_g != null ? Number(item.fiber_g) : null,
    sugar_g:         item.sugar_g != null ? Number(item.sugar_g) : null,
    sodium_mg:       item.sodium_mg != null ? Number(item.sodium_mg) : null,
    created_by:      item.created_by ?? null,
    is_user_created: Boolean(item.is_user_created),
    created_at:      item.created_at ?? new Date().toISOString(),
  };
}

const DEFAULT_GOALS: NutritionGoals = {
  dailyCalories: 2000,
  carbsG: 250,
  proteinG: 100,
  fatG: 65,
  waterMl: 2500,
};

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// ─────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────

export const nutritionService = {
  async getCurrentUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Kullanıcı oturumu bulunamadı.');
    return session.user.id;
  },

  // ── Day data ─────────────────────────────────────────────────

  async getDayNutrition(date: string): Promise<DayNutrition> {
    const userId = await nutritionService.getCurrentUserId();

    const entryRows = nutritionRepository.getEntriesForDate(userId, date);
    const entries = entryRows.map(rowToEntry);

    const waterRows = nutritionRepository.getWaterForDate(userId, date);
    const waterMl = waterRows.reduce((sum, w) => sum + w.amount_ml, 0);

    const goalsRow = nutritionRepository.getGoals(userId);
    const goals = goalsRow ? rowToGoals(goalsRow) : DEFAULT_GOALS;

    const totals = sumDayTotals(entries);
    const meals = MEAL_TYPES.reduce((acc, meal) => {
      acc[meal] = entries.filter(e => e.mealType === meal);
      return acc;
    }, {} as Record<MealType, NutritionEntry[]>);

    return { date, totals, meals, waterMl, goals };
  },

  // ── Food entries ──────────────────────────────────────────────

  async addFoodEntry(payload: AddEntryInput): Promise<NutritionEntry> {
    const userId = await nutritionService.getCurrentUserId();
    const nutrition = calculateEntryNutrition(payload.food, payload.amount, payload.unit);
    const now = new Date().toISOString();

    const row: NutritionEntryRow = {
      id: generateId(),
      user_id: userId,
      food_id: payload.food.id,
      entry_date: payload.entryDate,
      meal_type: payload.mealType,
      amount: payload.amount,
      unit: payload.unit,
      calories: nutrition.calories,
      carbs_g: nutrition.carbsG,
      protein_g: nutrition.proteinG,
      fat_g: nutrition.fatG,
      is_quick_add: false,
      quick_add_label: null,
      created_at: now,
      synced: false,
    };

    nutritionRepository.saveEntry(row);
    nutritionRepository.touchRecentFood(userId, payload.food.id);

    try {
      const { error } = await supabase.from('nutrition_entries').upsert({
        id: row.id,
        user_id: row.user_id,
        food_id: row.food_id,
        entry_date: row.entry_date,
        meal_type: row.meal_type,
        amount: row.amount,
        unit: row.unit,
        calories: row.calories,
        carbs_g: row.carbs_g,
        protein_g: row.protein_g,
        fat_g: row.fat_g,
        is_quick_add: row.is_quick_add,
        created_at: row.created_at,
      });
      if (!error) nutritionRepository.markEntrySynced(row.id);
    } catch { /* offline — sync later */ }

    return rowToEntry(row);
  },

  async updateFoodEntry(id: string, patch: Partial<NutritionEntry>): Promise<void> {
    const dbPatch: Partial<NutritionEntryRow> = {};
    if (patch.amount !== undefined) dbPatch.amount = patch.amount;
    if (patch.unit !== undefined) dbPatch.unit = patch.unit;
    if (patch.calories !== undefined) dbPatch.calories = patch.calories;
    if (patch.carbsG !== undefined) dbPatch.carbs_g = patch.carbsG;
    if (patch.proteinG !== undefined) dbPatch.protein_g = patch.proteinG;
    if (patch.fatG !== undefined) dbPatch.fat_g = patch.fatG;
    if (patch.mealType !== undefined) dbPatch.meal_type = patch.mealType;

    nutritionRepository.updateEntry(id, dbPatch);

    try {
      await supabase.from('nutrition_entries').update(dbPatch).eq('id', id);
      nutritionRepository.markEntrySynced(id);
    } catch { /* offline */ }
  },

  async deleteFoodEntry(id: string): Promise<void> {
    nutritionRepository.deleteEntry(id);
    try {
      await supabase.from('nutrition_entries').delete().eq('id', id);
    } catch { /* offline */ }
  },

  // ── Quick add ─────────────────────────────────────────────────

  async addQuickCalories(
    date: string,
    mealType: MealType,
    kcal: number,
    label?: string,
  ): Promise<void> {
    const userId = await nutritionService.getCurrentUserId();
    const now = new Date().toISOString();

    const row: NutritionEntryRow = {
      id: generateId(),
      user_id: userId,
      food_id: null,
      entry_date: date,
      meal_type: mealType,
      amount: 1,
      unit: 'serving',
      calories: kcal,
      carbs_g: 0,
      protein_g: 0,
      fat_g: 0,
      is_quick_add: true,
      quick_add_label: label ?? null,
      created_at: now,
      synced: false,
    };

    nutritionRepository.saveEntry(row);

    try {
      const { error } = await supabase.from('nutrition_entries').upsert({
        id: row.id, user_id: row.user_id, entry_date: row.entry_date,
        meal_type: row.meal_type, amount: row.amount, unit: row.unit,
        calories: row.calories, carbs_g: 0, protein_g: 0, fat_g: 0,
        is_quick_add: true, quick_add_label: row.quick_add_label, created_at: row.created_at,
      });
      if (!error) nutritionRepository.markEntrySynced(row.id);
    } catch { /* offline */ }
  },

  // ── Water ─────────────────────────────────────────────────────

  async addWater(date: string, amountMl: number): Promise<void> {
    const userId = await nutritionService.getCurrentUserId();
    const row: WaterEntryRow = {
      id: generateId(),
      user_id: userId,
      entry_date: date,
      amount_ml: amountMl,
      created_at: new Date().toISOString(),
      synced: false,
    };
    nutritionRepository.saveWaterEntry(row);

    try {
      const { error } = await supabase.from('water_entries').upsert({
        id: row.id, user_id: row.user_id, entry_date: row.entry_date,
        amount_ml: row.amount_ml, created_at: row.created_at,
      });
      if (!error) nutritionRepository.markWaterSynced(row.id);
    } catch { /* offline */ }
  },

  async removeWater(date: string, amountMl: number): Promise<void> {
    const userId = await nutritionService.getCurrentUserId();
    const rows = nutritionRepository.getWaterForDate(userId, date);
    // Remove the most recent entry that matches the amount
    const toDelete = rows.filter(r => r.amount_ml === amountMl).slice(-1)[0];
    if (!toDelete) return;
    nutritionRepository.deleteWaterEntry(toDelete.id);
    try {
      await supabase.from('water_entries').delete().eq('id', toDelete.id);
    } catch { /* offline */ }
  },

  async getWaterTotal(date: string): Promise<number> {
    const userId = await nutritionService.getCurrentUserId();
    const rows = nutritionRepository.getWaterForDate(userId, date);
    return rows.reduce((sum, r) => sum + r.amount_ml, 0);
  },

  // ── Food search ───────────────────────────────────────────────

  async searchFoods(
    query: string,
    options: { onlyMine?: boolean; onlyFavorites?: boolean } = {},
  ): Promise<Food[]> {
    if (options.onlyFavorites) {
      const userId = await nutritionService.getCurrentUserId();
      const favIds = nutritionRepository.getFavorites(userId).map(f => f.food_id);
      const foods = favIds
        .map(id => nutritionRepository.getFoodById(id))
        .filter((f): f is FoodRow => f !== null && f.name.toLowerCase().includes(query.toLowerCase()));
      return foods.map(rowToFood);
    }

    if (options.onlyMine) {
      const userId = await nutritionService.getCurrentUserId();
      const rows = nutritionRepository.getUserFoods(userId);
      return rows
        .filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
        .map(rowToFood);
    }

    const localRows = nutritionRepository.searchFoods(query);

    // Check if system foods are already in SQLite (synced before)
    const synced = localRows.some(r => Number(r.is_user_created) === 0);
    if (synced) {
      return localRows.map(rowToFood);
    }

    // No system foods in SQLite yet — query Supabase directly as fallback
    try {
      const filter = query ? `%${query}%` : '%';
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .ilike('name', filter)
        .eq('is_user_created', false)
        .order('name')
        .limit(50);

      if (error || !data || data.length === 0) {
        // Supabase unavailable — return custom foods only
        return localRows.map(rowToFood);
      }

      // Cache to SQLite so future searches are instant
      for (const item of data) {
        try { nutritionRepository.saveFood(supabaseItemToFoodRow(item)); } catch { /* skip */ }
      }

      const remoteResults = data.map(item => rowToFood(supabaseItemToFoodRow(item)));

      // Also include any custom foods the user already added (not on Supabase fallback)
      const customLocal = localRows
        .filter(r => Number(r.is_user_created) === 1)
        .map(rowToFood);

      return [...remoteResults, ...customLocal];
    } catch {
      return localRows.map(rowToFood);
    }
  },

  async getFoodById(id: string): Promise<Food | null> {
    const row = nutritionRepository.getFoodById(id);
    if (row) return rowToFood(row);

    // Not in SQLite — fetch from Supabase and cache
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) return null;
      const foodRow = supabaseItemToFoodRow(data);
      try { nutritionRepository.saveFood(foodRow); } catch { /* ignore */ }
      return rowToFood(foodRow);
    } catch {
      return null;
    }
  },

  async getRecentFoods(limit: number): Promise<Food[]> {
    const userId = await nutritionService.getCurrentUserId();
    const ids = nutritionRepository.getRecentFoodIds(userId, limit);
    return ids
      .map(id => nutritionRepository.getFoodById(id))
      .filter((f): f is FoodRow => f !== null)
      .map(rowToFood);
  },

  async toggleFavorite(foodId: string): Promise<void> {
    const userId = await nutritionService.getCurrentUserId();
    if (nutritionRepository.isFavorite(userId, foodId)) {
      nutritionRepository.removeFavorite(userId, foodId);
      try {
        await supabase.from('favorite_foods').delete()
          .eq('user_id', userId).eq('food_id', foodId);
      } catch { /* offline */ }
    } else {
      nutritionRepository.addFavorite(userId, foodId);
      try {
        await supabase.from('favorite_foods')
          .upsert({ user_id: userId, food_id: foodId });
      } catch { /* offline */ }
    }
  },

  async isFavorite(foodId: string): Promise<boolean> {
    const userId = await nutritionService.getCurrentUserId();
    return nutritionRepository.isFavorite(userId, foodId);
  },

  // ── Custom food ───────────────────────────────────────────────

  async createCustomFood(input: CustomFoodInput): Promise<Food> {
    const userId = await nutritionService.getCurrentUserId();
    const now = new Date().toISOString();
    const row: FoodRow = {
      id: generateId(),
      name: input.name,
      brand: input.brand ?? null,
      serving_size: input.servingSize,
      serving_unit: input.servingUnit,
      calories: input.calories,
      carbs_g: input.carbsG,
      protein_g: input.proteinG,
      fat_g: input.fatG,
      fiber_g: input.fiberG ?? null,
      sugar_g: input.sugarG ?? null,
      sodium_mg: input.sodiumMg ?? null,
      created_by: userId,
      is_user_created: true,
      created_at: now,
    };

    nutritionRepository.saveFood(row);

    try {
      await supabase.from('foods').upsert({
        id: row.id, name: row.name, brand: row.brand,
        serving_size: row.serving_size, serving_unit: row.serving_unit,
        calories: row.calories, carbs_g: row.carbs_g, protein_g: row.protein_g, fat_g: row.fat_g,
        fiber_g: row.fiber_g, sugar_g: row.sugar_g, sodium_mg: row.sodium_mg,
        created_by: row.created_by, is_user_created: true, created_at: row.created_at,
      });
    } catch { /* offline */ }

    return rowToFood(row);
  },

  // ── Nutrition goals ───────────────────────────────────────────

  async getGoals(): Promise<NutritionGoals> {
    const userId = await nutritionService.getCurrentUserId();

    // Try Supabase first to get latest goals
    try {
      const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        const row: NutritionGoalsRow = {
          user_id: data.user_id,
          daily_calories: data.daily_calories,
          carbs_g: data.carbs_g,
          protein_g: data.protein_g,
          fat_g: data.fat_g,
          water_ml: data.water_ml,
          updated_at: data.updated_at,
          synced: true,
        };
        nutritionRepository.saveGoals(row);
        return rowToGoals(row);
      }
    } catch { /* offline */ }

    const localRow = nutritionRepository.getGoals(userId);
    return localRow ? rowToGoals(localRow) : DEFAULT_GOALS;
  },

  async updateGoals(goals: Partial<NutritionGoals>): Promise<void> {
    const userId = await nutritionService.getCurrentUserId();
    const existing = nutritionRepository.getGoals(userId);
    const current = existing ? rowToGoals(existing) : DEFAULT_GOALS;
    const merged = { ...current, ...goals };
    const now = new Date().toISOString();

    const row: NutritionGoalsRow = {
      user_id: userId,
      daily_calories: merged.dailyCalories,
      carbs_g: merged.carbsG,
      protein_g: merged.proteinG,
      fat_g: merged.fatG,
      water_ml: merged.waterMl,
      updated_at: now,
      synced: false,
    };

    nutritionRepository.saveGoals(row);

    try {
      const { error } = await supabase.from('nutrition_goals').upsert({
        user_id: userId,
        daily_calories: merged.dailyCalories,
        carbs_g: merged.carbsG,
        protein_g: merged.proteinG,
        fat_g: merged.fatG,
        water_ml: merged.waterMl,
        updated_at: now,
      });
      if (!error) nutritionRepository.markGoalsSynced(userId);
    } catch { /* offline */ }
  },

  // ── Food catalog initial sync ─────────────────────────────────

  /**
   * Supabase'deki sistem besinlerini (is_user_created = false) SQLite'a indirir.
   * SQLite'ta hiç sistem besini yoksa çalışır; doluysa atlar.
   * Sayfalı çeker (batchSize = 500) — büyük kataloglara karşı güvenli.
   */
  async syncFoodsFromSupabase(): Promise<void> {
    const existing = nutritionRepository.searchFoods('');
    // is_user_created comes back from SQLite as 0/1 integer — use Number() to be safe
    const hasSeedData = existing.some(f => Number(f.is_user_created) === 0);
    if (hasSeedData) return;

    const BATCH = 500;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('is_user_created', false)
        .order('name')
        .range(from, from + BATCH - 1);

      if (error || !data) break;

      for (const item of data) {
        try {
          nutritionRepository.saveFood(supabaseItemToFoodRow(item));
        } catch { /* skip malformed row, continue with rest */ }
      }

      hasMore = data.length === BATCH;
      from += BATCH;
    }
  },

  // ── Sync helpers (called by syncQueue) ───────────────────────

  async syncNutritionEntries(): Promise<void> {
    const unsynced = nutritionRepository.getUnsyncedEntries();
    for (const entry of unsynced) {
      const { error } = await supabase.from('nutrition_entries').upsert({
        id: entry.id, user_id: entry.user_id, food_id: entry.food_id,
        entry_date: entry.entry_date, meal_type: entry.meal_type,
        amount: entry.amount, unit: entry.unit,
        calories: entry.calories, carbs_g: entry.carbs_g,
        protein_g: entry.protein_g, fat_g: entry.fat_g,
        is_quick_add: entry.is_quick_add, quick_add_label: entry.quick_add_label,
        created_at: entry.created_at,
      });
      if (!error) nutritionRepository.markEntrySynced(entry.id);
    }
  },

  async syncWaterEntries(): Promise<void> {
    const unsynced = nutritionRepository.getUnsyncedWater();
    for (const entry of unsynced) {
      const { error } = await supabase.from('water_entries').upsert({
        id: entry.id, user_id: entry.user_id,
        entry_date: entry.entry_date, amount_ml: entry.amount_ml, created_at: entry.created_at,
      });
      if (!error) nutritionRepository.markWaterSynced(entry.id);
    }
  },

  async syncGoals(): Promise<void> {
    const unsynced = nutritionRepository.getUnsyncedGoals();
    for (const g of unsynced) {
      const { error } = await supabase.from('nutrition_goals').upsert({
        user_id: g.user_id, daily_calories: g.daily_calories,
        carbs_g: g.carbs_g, protein_g: g.protein_g, fat_g: g.fat_g,
        water_ml: g.water_ml, updated_at: g.updated_at,
      });
      if (!error) nutritionRepository.markGoalsSynced(g.user_id);
    }
  },
};
