import type { CombatBeat } from '../core/expedition-types';
// Shared presentation timing. Contact occurs 45% into each sequential strike.
// This samples receipts and never advances or modifies simulation state.
export const CONTACT = .45;
// The imported chop raises the hand until ~50% and crosses a neighboring
// humanoid at ~57.5%. Remap it to the presentation contact, not raw clip time.
export const RAISED_CHOP = .45;
export function chopPhase(phase: number, fromWindup = false): number {
  const p = Math.max(0, Math.min(1, phase)), contactClip = .575;
  if (fromWindup && p <= CONTACT) return RAISED_CHOP + (contactClip - RAISED_CHOP) * p / CONTACT;
  if (p < .28) return RAISED_CHOP * p / .28;
  if (p <= CONTACT) return RAISED_CHOP + (contactClip - RAISED_CHOP) * (p - .28) / (CONTACT - .28);
  return contactClip + (1 - contactClip) * (p - CONTACT) / (1 - CONTACT);
}
export function strikes(beats: readonly CombatBeat[]): CombatBeat[] { return beats.filter(b => b.kind === 'attack' || b.kind === 'miss'); }
export function strikeAt(beats: readonly CombatBeat[], phase: number): { beat: CombatBeat; phase: number } | null {
  const list = strikes(beats); if (!list.length || phase < 0 || phase >= 1) return null;
  const index = Math.floor(phase * list.length); return { beat: list[index]!, phase: phase * list.length - index };
}
