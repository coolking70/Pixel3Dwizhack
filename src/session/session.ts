import {ALPHA6_CONTENT} from '../content/alpha6';
import {queryContextOffers6} from '../core/alpha6-query';
import {queryContextOffers5} from '../core/alpha5-query';
import { ALPHA5_CONTENT } from '../content/alpha5';
import { queryActionOffers4, queryContextOffers4, queryTargets4 } from '../core/alpha4-query';
import { ALPHA4_CONTENT } from '../content/alpha4';
import { queryActionOffers3, queryTargets3 } from '../core/alpha3-query';
import { ALPHA3_CONTENT } from '../content/alpha3';
import { queryActionOffers, queryContextOffers, queryTargets } from '../core/action-query';
import type { TargetRef } from '../core/action-types';
import {ALPHA2_CONTENT} from '../content/alpha2';
import { ALPHA, ALPHA_GEAR } from '../content/alpha';
import { MINE } from '../content/mine';
import { ROOM, GEAR } from '../content/room';
import { DUNGEON, DUNGEON_GEAR } from '../content/dungeon';
import { EXPEDITION, EXPEDITION_GEAR } from '../content/expedition';
import { canonical, digest } from '../core/digest';
import { accept, createWorld, inspect, isCommand } from '../core/simulation';
import { type Scenario, type Command, type PublicView, type Rejection, type World } from '../core/types';

export const IDENTITY = Object.freeze({ archive: 1, commands: 1, rules: 'mine-1', content: digest(MINE) });
export const ROOM_IDENTITY = Object.freeze({ archive: 1, commands: 2, rules: 'room-1', content: digest({ ROOM, GEAR }) });
export const DUNGEON_IDENTITY = Object.freeze({ archive: 1, commands: 3, rules: 'dungeon-1', content: digest({ DUNGEON, DUNGEON_GEAR }) });
export const EXPEDITION_IDENTITY = Object.freeze({ archive: 1, commands: 4, rules: 'expedition-1', content: digest({ EXPEDITION, EXPEDITION_GEAR }) });
export const ALPHA_IDENTITY = Object.freeze({ archive: 1, commands: 5, rules: 'alpha-1', content: digest({ ALPHA, ALPHA_GEAR }) });
export const ALPHA2_IDENTITY=Object.freeze({archive:1,commands:6,rules:'alpha2-1',content:digest(ALPHA2_CONTENT)});
export const ALPHA3_IDENTITY = Object.freeze({ archive: 1, commands: 7, rules: 'alpha3-1', content: digest(ALPHA3_CONTENT) });
export const ALPHA4_IDENTITY = Object.freeze({ archive: 1, commands: 8, rules: 'alpha4-1', content: digest(ALPHA4_CONTENT) });
export const ALPHA6_IDENTITY=Object.freeze({archive:1,commands:10,rules:'alpha6-1',content:digest(ALPHA6_CONTENT)});
export const ALPHA5_IDENTITY = Object.freeze({ archive: 1, commands: 9, rules: 'alpha5-1', content: digest(ALPHA5_CONTENT) });
export const MAX_COMMANDS = 4096;
export const MAX_BYTES = 2 * 1024 * 1024;
interface Entry { command: Command; digest: string }
interface Archive { identity: typeof IDENTITY | typeof ROOM_IDENTITY | typeof DUNGEON_IDENTITY | typeof EXPEDITION_IDENTITY | typeof ALPHA_IDENTITY | typeof ALPHA2_IDENTITY | typeof ALPHA3_IDENTITY | typeof ALPHA4_IDENTITY | typeof ALPHA5_IDENTITY | typeof ALPHA6_IDENTITY; seed: number; history: Entry[]; world: World }
export type SubmitResult = { accepted: true; interrupt: boolean } | { accepted: false; reason: Rejection };
export class ArchiveError extends Error {
  constructor(public readonly code: 'invalidArchive' | 'incompatible' | 'divergence', public readonly position?: number) { super(code); }
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function keys(value: Record<string, unknown>, expected: string[]): boolean { return Object.keys(value).sort().join(',') === expected.sort().join(','); }
function checkBudget(root: unknown): void {
  const pending = [{ value: root, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > 16 || ++count > 100_000) throw new ArchiveError('invalidArchive');
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
    }
  }
}

export class GameSession {
  #world: World;
  #history: Entry[] = [];
  #replayCache = new Map<number, World>();
  constructor(seed = 24681, readonly scenario: Scenario = 'mine') { this.#world = createWorld(seed, scenario); this.#replayCache.set(0, structuredClone(this.#world)); }
  get length(): number { return this.#history.length; }
  view(): PublicView { return inspect(this.#world); }
  queryActionOffers(itemId: number) { return (this.scenario === 'alpha6' || this.scenario === 'alpha5' || this.scenario === 'alpha4') ? queryActionOffers4(this.#world, itemId) : this.scenario === 'alpha3' ? queryActionOffers3(this.#world, itemId) : queryActionOffers(this.#world, itemId); }
  queryTargets(itemId: number, actionId: string) { return (this.scenario === 'alpha6' || this.scenario === 'alpha5' || this.scenario === 'alpha4') ? queryTargets4(this.#world, itemId, actionId) : this.scenario === 'alpha3' ? queryTargets3(this.#world, itemId, actionId) : queryTargets(this.#world, itemId, actionId); }
  queryContextOffers(target: TargetRef) { return this.scenario==='alpha6'?queryContextOffers6(this.#world,target):this.scenario==='alpha5'?queryContextOffers5(this.#world,target):this.scenario === 'alpha4' ? queryContextOffers4(this.#world, target) : queryContextOffers(this.#world, target); }
  queryJumpTargets() { return this.scenario === 'alpha6' || this.scenario === 'alpha5' ? this.view().alpha5!.jumpTargets : []; }
  fingerprint(): string { return digest(this.#world); }
  submit(command: Command): SubmitResult {
    if (this.length >= MAX_COMMANDS) return { accepted: false, reason: 'limit' };
    const result = accept(this.#world, command);
    if (!result.accepted) return result;
    const entry = { command, digest: digest(result.world) };
    // All potentially failing candidate work completes before publication.
    const history = [...this.#history, entry];
    // Notes may contain long percent-encoded text. Keep every accepted Alpha 2
    // archive within the same UTF-8 byte budget enforced by the file picker.
    if ((this.scenario === 'alpha2' || this.scenario === 'alpha3' || this.scenario === 'alpha4' || this.scenario === 'alpha6' || this.scenario === 'alpha5') && new TextEncoder().encode(JSON.stringify({ identity: this.scenario === 'alpha6' ? ALPHA6_IDENTITY : this.scenario === 'alpha5' ? ALPHA5_IDENTITY : this.scenario === 'alpha4' ? ALPHA4_IDENTITY : this.scenario === 'alpha3' ? ALPHA3_IDENTITY : ALPHA2_IDENTITY, seed: this.#world.seed, history, world: result.world })).byteLength > MAX_BYTES) return { accepted: false, reason: 'limit' };
    this.#world = result.world;
    this.#history = history;
    return { accepted: true, interrupt: result.interrupt };
  }
  capture(): string {
    const archive: Archive = { identity: this.scenario === 'alpha6' ? ALPHA6_IDENTITY : this.scenario === 'alpha5' ? ALPHA5_IDENTITY : this.scenario === 'alpha4' ? ALPHA4_IDENTITY : this.scenario === 'alpha3' ? ALPHA3_IDENTITY : this.scenario === 'alpha2' ? ALPHA2_IDENTITY : this.scenario === 'alpha' ? ALPHA_IDENTITY : this.scenario === 'expedition' ? EXPEDITION_IDENTITY : this.scenario === 'dungeon' ? DUNGEON_IDENTITY : this.scenario === 'room' ? ROOM_IDENTITY : IDENTITY, seed: this.#world.seed, history: this.#history, world: this.#world };
    return JSON.stringify(archive);
  }
  restore(raw: string): void {
    const candidate = GameSession.fromArchive(raw);
    if (candidate.scenario !== this.scenario) throw new ArchiveError('incompatible');
    this.#world = candidate.#world;
    this.#history = candidate.#history;
    this.#replayCache = candidate.#replayCache;
  }
  replay(position: number): PublicView {
    if (!Number.isInteger(position) || position < 0 || position > this.length) throw new ArchiveError('invalidArchive');
    const candidate = new GameSession(this.#world.seed, this.scenario);
    const base = Math.max(...[...this.#replayCache.keys()].filter(i => i <= position));
    candidate.#world = structuredClone(this.#replayCache.get(base)!);
    candidate.#history = this.#history.slice(0, base);
    for (let index = base; index < position; index++) {
      candidate.verify(this.#history[index]!, index);
      if ((index + 1) % 32 === 0) {
        this.#replayCache.set(index + 1, structuredClone(candidate.#world));
        // Verified, private, disposable checkpoints; never serialized or used
        // to trust imported snapshots. Keep the initial state plus 32 entries.
        if (this.#replayCache.size > 33) this.#replayCache.delete([...this.#replayCache.keys()].find(i => i !== 0)!);
      }
    }
    return candidate.view();
  }
  private verify(entry: Entry, index: number): void {
    const result = this.submit(entry.command);
    if (!result.accepted || this.fingerprint() !== entry.digest) throw new ArchiveError('divergence', index + 1);
  }
  static fromArchive(raw: string): GameSession {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) throw new ArchiveError('invalidArchive');
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new ArchiveError('invalidArchive'); }
    checkBudget(value);
    if (!object(value) || !keys(value, ['identity', 'seed', 'history', 'world'])) throw new ArchiveError('invalidArchive');
    const scenario = canonical(value.identity) === canonical(IDENTITY) ? 'mine' : canonical(value.identity) === canonical(ROOM_IDENTITY) ? 'room' : canonical(value.identity) === canonical(DUNGEON_IDENTITY) ? 'dungeon' : canonical(value.identity) === canonical(EXPEDITION_IDENTITY) ? 'expedition' : canonical(value.identity) === canonical(ALPHA_IDENTITY) ? 'alpha' : canonical(value.identity) === canonical(ALPHA2_IDENTITY) ? 'alpha2' : canonical(value.identity) === canonical(ALPHA3_IDENTITY) ? 'alpha3' : canonical(value.identity) === canonical(ALPHA4_IDENTITY) ? 'alpha4' : canonical(value.identity) === canonical(ALPHA5_IDENTITY) ? 'alpha5' : canonical(value.identity) === canonical(ALPHA6_IDENTITY) ? 'alpha6' : null;
    if (!scenario) throw new ArchiveError('incompatible');
    if (!Number.isInteger(value.seed) || (value.seed as number) < 1 || (value.seed as number) > 0xffffffff
      || !Array.isArray(value.history) || value.history.length > MAX_COMMANDS) throw new ArchiveError('invalidArchive');
    const candidate = new GameSession(value.seed as number, scenario);
    value.history.forEach((entry: unknown, index: number) => {
      if (!object(entry) || !keys(entry, ['command', 'digest']) || !isCommand(entry.command, scenario)
        || typeof entry.digest !== 'string' || !/^[0-9a-f]{8}$/.test(entry.digest)) throw new ArchiveError('invalidArchive');
      candidate.verify(entry as unknown as Entry, index);
    });
    // Compare to the independently rebuilt state, not to an imported self-reported hash.
    // This simultaneously validates every snapshot field, reference and deadline.
    if (canonical(value.world) !== canonical(candidate.#world)) throw new ArchiveError('divergence', candidate.length);
    return candidate;
  }
}
