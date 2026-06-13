import { supabase } from '../config/supabaseClient';
import { sessionRepository } from '../repositories/session.repository';
import { nutritionService } from '../services/nutrition.service';

export const syncQueue = {
  async syncAll(): Promise<void> {
    await Promise.all([
      syncQueue.syncSessions(),
      syncQueue.syncErrors(),
      syncQueue.syncNutrition(),
    ]);
  },

  async syncSessions(): Promise<void> {
    const unsynced = sessionRepository.getUnsynced();

    for (const session of unsynced) {
      const { error } = await supabase
        .from('workout_sessions')
        .upsert(session);

      if (!error) {
        sessionRepository.markSynced(session.id);
      }
    }
  },

  async syncErrors(): Promise<void> {
    const unsynced = sessionRepository.getUnsyncedErrors();

    for (const err of unsynced) {
      const { error } = await supabase
        .from('session_errors')
        .upsert(err);

      if (!error) {
        sessionRepository.markErrorSynced(err.id);
      }
    }
  },

  async syncNutrition(): Promise<void> {
    await Promise.all([
      nutritionService.syncNutritionEntries(),
      nutritionService.syncWaterEntries(),
      nutritionService.syncGoals(),
    ]);
  },
};
