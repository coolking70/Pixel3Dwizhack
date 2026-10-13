import type { Command, PublicView, Rejection } from '../core/types';
import type { Loadout } from '../core/alpha-types';

export const AGENT_VERSION = 'm16-public-1';
export const STRATEGIES = ['novice', 'survivor', 'fighter'] as const;
export const LOADOUTS = ['vanguard', 'breaker', 'channeler'] as const;
export type Strategy = typeof STRATEGIES[number];
export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] : T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;
export type Observation = DeepReadonly<PublicView>;
export interface RunConfig { seed: number; strategy: Strategy; loadout: Loadout; maxActions: number; maxTicks: number; stuckLimit: number; choiceSeed?: number }
export type StopReason = 'won' | 'dead' | 'action-limit' | 'tick-limit' | 'agent-stuck' | 'agent-unsolved' | 'session-limit' | 'error';
export interface TraceEntry { command: Command; accepted: boolean; tick: number; digest: string; reason?: Rejection }
export interface Resources {
  healing: number; healingActions: number; foodUsed: number; foodPressureActions: number;
  itemUses: number; unknownUses: number; unknownHarmfulOutcomes: number; damage: number;
  goldSpent: number; goldEarned: number; equipmentChanges: number; conditionsAcquired: number; conditionsCleared: number;
  damageSources: Record<string, number>; equipmentSelections: Record<string, number>;
}
export interface RunResult {
  schema: 1; agentVersion: string; identity: { rules: string; commands: number; content: string }; config: RunConfig;
  outcome: StopReason; error?: string; deathCause: string | null; actions: number; attempts: number; rejected: number;
  ticks: number; finalDigest: string; minHp: number; minFood: number; finalHp: number; maxDepth: number; finalDepth: number;
  reachedDepths: number[]; kills: number; collected: number; knownItems: number; resources: Resources; trace: TraceEntry[];
}
export interface Agent { next(view: Observation, rejected: readonly Command[]): Command | null }
