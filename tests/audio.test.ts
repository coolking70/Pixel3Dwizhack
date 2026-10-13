import { afterEach, expect, it, vi } from 'vitest';
import { BattleAudio } from '../src/room/audio';
const starts: number[] = [], stops: number[] = [];
class FakeContext {
  currentTime = 10; state = 'running'; destination = {};
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
  createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start(t: number) { starts.push(t); }, stop(t?: number) { stops.push(t ?? -1); }, onended: null }; }
}
afterEach(() => { vi.unstubAllGlobals(); starts.length = 0; stops.length = 0; });
it('audio is opt-in, shares strike contacts, cancels scheduled voices and stays silent after disable', async () => {
  vi.stubGlobal('AudioContext', FakeContext);
  const audio = new BattleAudio(), beats = [{ kind: 'attack' as const, actor: 0, target: 2, position: { x: 2, floor: 0 }, tick: 0 }, { kind: 'attack' as const, actor: 2, target: 0, position: { x: 3, floor: 0 }, tick: 8 }];
  audio.play(beats, 1000); expect(starts).toEqual([]); await audio.enable(true); audio.play(beats, 1000);
  expect(starts).toEqual([10.225, 10.725]); expect(stops.filter(t => t === -1)).toHaveLength(0);
  audio.stop(); expect(stops.filter(t => t === -1)).toHaveLength(2);
  await audio.enable(false); audio.play(beats, 1000); expect(starts).toHaveLength(2); audio.dispose();
});
