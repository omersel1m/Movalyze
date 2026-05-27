import { supabase } from '../config/supabaseClient';
import { sessionRepository } from '../repositories/session.repository';
import { WorkoutSession, SessionError } from '../database/models/types';

export const sessionService = {
  async saveSession(session: WorkoutSession, errors: SessionError[]): Promise<void> {
    // 1. Önce yerel SQLite'a kaydet (offline-first)
    sessionRepository.save({ ...session, synced: false });
    for (const err of errors) {
      sessionRepository.saveError({ ...err, synced: false });
    }

    // 2. Supabase'e göndermeyi dene
    try {
      const { error: sessionError } = await supabase
        .from('workout_sessions')
        .upsert(session);

      if (!sessionError) {
        sessionRepository.markSynced(session.id);

        for (const err of errors) {
          const { error: errError } = await supabase
            .from('session_errors')
            .upsert(err);
          if (!errError) {
            sessionRepository.markErrorSynced(err.id);
          }
        }
      }
    } catch {
      // Offline — syncQueue.syncAll() çağrıldığında gönderilecek
    }
  },
};
