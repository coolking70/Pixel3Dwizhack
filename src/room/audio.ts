import type { CombatBeat } from '../core/expedition-types';
import { CONTACT, strikes } from './combat-timeline';
// Original short synthesized cues; no downloaded or encoded sound assets.
export class BattleAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Set<OscillatorNode>();
  enabled = false;
  volume = .25;
  async enable(value: boolean): Promise<void> {
    this.enabled = value;
    if (!value) { this.stop(); return; }
    this.context ??= new AudioContext();
    if (!this.master) { this.master = this.context.createGain(); this.master.connect(this.context.destination); }
    this.setVolume(this.volume); await this.context.resume();
  }
  setVolume(value: number): void { this.volume = Math.max(0, Math.min(1, value)); if (this.master) this.master.gain.value = this.volume; }
  play(beats: readonly CombatBeat[], duration: number): void {
    this.stop(); const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return;
    const attacks = strikes(beats);
    const cues = attacks.length ? attacks : beats.filter(b => b.kind === 'heal' || b.kind === 'pickup');
    cues.slice(0, 8).forEach((b, i) => {
      const start = context.currentTime + (i + CONTACT) / Math.max(1, cues.length) * duration / 1000;
      const oscillator = context.createOscillator(), gain = context.createGain();
      const frequency = b.mode === 'spell' ? 520 : b.kind === 'pickup' ? 720 : b.kind === 'heal' ? 440 : b.kind === 'miss' ? 150 : b.actor === 0 ? 230 : 95;
      oscillator.type = b.kind === 'attack' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start); oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * .45), start + .14);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.20, start + .008); gain.gain.exponentialRampToValueAtTime(.001, start + .17);
      oscillator.connect(gain); gain.connect(this.master!); oscillator.start(start); oscillator.stop(start + .18); this.voices.add(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
    });
  }
  stop(): void { for (const voice of this.voices) { try { voice.stop(); } catch { /* Already stopped. */ } } this.voices.clear(); }
  dispose(): void { this.stop(); this.enabled = false; void this.context?.close().catch(() => {}); }
}
