import type { Command, Position } from './types';
export type Alpha5Command = `a5:jump:${number}` | `a5:feature:${number}:seal` | `a5:feature:${number}:isolate` | `a5:feature:${number}:clear`;
export interface JumpReceipt5 { revision: number; from: Position; to: Position; cost: number }
export interface Alpha5State { lastJump: JumpReceipt5 | null }
export type JumpReason5 = 'ended' | 'state' | 'burden' | 'range' | 'unseen' | 'obstacle';
export interface JumpTarget5 { revision: number; position: Position; cost: number; command: Command; status: 'enabled' | 'disabled'; reason?: JumpReason5 }
export interface Alpha5View { region: { id:string; name:{zh:string;en:string} }; lastJump: JumpReceipt5 | null; jumpTargets: JumpTarget5[] }
