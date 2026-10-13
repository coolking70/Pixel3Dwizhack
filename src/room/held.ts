import type { Command } from '../core/types';
import type { SubmitResult } from '../session/session';

// One currently held direction. Presentation completion may retry only while
// that physical input is still down; no timers, queued commands or catch-up.
export class MotionInput {
  private intention: { source: string; command: Command } | null = null;
  constructor(private submit: (command: Command) => SubmitResult, private busy: () => boolean) {}
  start(source: string, command: Command): void { this.intention = { source, command }; this.completed(); }
  release(source: string): void { if (this.intention?.source === source) this.stop(); }
  stop(): void { this.intention = null; }
  completed(): void {
    if (!this.intention || this.busy()) return;
    const result = this.submit(this.intention.command);
    if (!result.accepted || result.interrupt) this.stop();
  }
}
