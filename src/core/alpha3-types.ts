import type { Position } from './types';
export type Alpha3Command = `a3:throw:${number}:${number}:${number}`;
export interface ThrowReceipt3 {
  revision: number;
  itemId: number;
  requested: Position;
  landing: Position;
  collision: { kind: 'ground' } | { kind: 'door' | 'enemy' | 'facility'; id: number };
  consumed: boolean;
}
export interface Alpha3State { lastThrow: ThrowReceipt3 | null }
