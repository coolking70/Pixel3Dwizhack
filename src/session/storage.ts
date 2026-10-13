import { GameSession } from './session';
export const SAVE_KEY = 'dungeon-descent.m01';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function saveSession(session: GameSession, storage: StoragePort): void {
  // One replacement operation: world and provenance can never be written separately.
  storage.setItem(SAVE_KEY, session.capture());
}
export function loadSession(session: GameSession, storage: StoragePort): boolean {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return false;
  session.restore(raw);
  return true;
}
