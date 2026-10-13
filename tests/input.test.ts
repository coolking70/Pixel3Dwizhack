import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HeldInput } from '../src/ui/input';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it('submits short actions at its own cadence and stops on release', () => {
  const submit = vi.fn(() => ({ accepted: true as const, interrupt: false }));
  const input = new HeldInput(submit);
  input.start('KeyD', 'right'); expect(submit).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(301); expect(submit).toHaveBeenCalledTimes(3);
  input.release('KeyA'); vi.advanceTimersByTime(150); expect(submit).toHaveBeenCalledTimes(4);
  input.release('KeyD'); vi.advanceTimersByTime(3000); expect(submit).toHaveBeenCalledTimes(4);
});
it('clears the pending intention on danger, rejection, or a blocking surface', () => {
  const submit = vi.fn(() => ({ accepted: true as const, interrupt: true }));
  const input = new HeldInput(submit); input.start('KeyD', 'right');
  vi.advanceTimersByTime(2000); expect(submit).toHaveBeenCalledTimes(1);
  input.stop(); vi.advanceTimersByTime(2000); expect(submit).toHaveBeenCalledTimes(1);
  const rejected = vi.fn(() => ({ accepted: false as const, reason: 'wall' as const }));
  new HeldInput(rejected).start('KeyA', 'left'); vi.advanceTimersByTime(2000); expect(rejected).toHaveBeenCalledTimes(1);
});
