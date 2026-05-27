import { supabase } from '../config/supabaseClient';
import { sessionRepository } from '../repositories/session.repository';

export const syncQueue = {
  async syncAll(): Promise<void> {
    await Promise.all([
      syncQueue.syncSessions(),
      syncQueue.syncErrors(),
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
};
