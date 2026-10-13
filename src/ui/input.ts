import type { Command } from '../core/types';
import type { SubmitResult } from '../session/session';

// A single future intention, never a command queue. A stalled tab cannot catch up.
export class HeldInput {
  private held: { source: string; command: Command } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly submit: (command: Command) => SubmitResult, private readonly interval = 150) {}
  start(source: string, command: Command): void {
    this.stop();
    this.held = { source, command };
    this.step();
  }
  release(source: string): void { if (this.held?.source === source) this.stop(); }
  stop(): void {
    this.held = null;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private step(): void {
    if (!this.held) return;
    const result = this.submit(this.held.command);
    if (!result.accepted || result.interrupt) { this.stop(); return; }
    this.timer = setTimeout(() => this.step(), this.interval);
  }
}
export const KEY_COMMANDS: Record<string, Command> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  ' ': 'attack', f: 'interact', q: 'potion', '.': 'wait',
};
