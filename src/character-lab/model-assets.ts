import source from './models/vanguard.json';

export interface ModelPart { bone: string; size: number[]; position: number[]; color: number; region: string; rotation: number[]; metal: number; space?: 'bind' }
export interface ModelPack {
  version: 1; id: string; rigId: string; source: { author: string; license: string; method: string };
  body: ModelPart[];
  armor: { id: string; slot: 'chest'; masks: string[]; parts: ModelPart[] };
  weapons: { id: 'sword' | 'mace'; grip: number[]; parts: ModelPart[] }[];
}
// Data only: no URLs, code, arbitrary track paths, materials or nested scenes.
export function parseModelPack(value: unknown): ModelPack {
  const fail = (): never => { throw new Error('Invalid character model pack'); };
  if (!value || typeof value !== 'object') return fail();
  const p = value as ModelPack;
  const vector = (v: unknown, limit: number, positive = false): boolean => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit && (!positive || n > 0));
  const bones = new Set(['Root','Pelvis','Spine','Chest','Head',...['L','R'].flatMap(s=>['UpperArm','Forearm','Wrist','Hand','Grip','Thigh','Shin','Foot','Toe'].map(n=>n+s))]);
  const regions = new Set(['torso','hips','head','hair','weapon',...['L','R'].flatMap(s=>['upperArm','arm','thigh','shin','foot'].map(n=>n+s))]);
  const parts = (items: ModelPart[]): boolean => Array.isArray(items) && items.length > 0 && items.length <= 128 && items.every(item => item && (item.space === undefined || item.space === 'bind') && bones.has(item.bone) && regions.has(item.region) && vector(item.size, 3, true) && vector(item.position, 3) && vector(item.rotation, Math.PI * 2) && Number.isInteger(item.color) && item.color >= 0 && item.color <= 0xffffff && Number.isFinite(item.metal) && item.metal >= 0 && item.metal <= 1);
  if (p.version !== 1 || p.id !== 'vanguard-1' || p.rigId !== 'block-humanoid-kay-v1' || p.source?.license !== 'MIT' || typeof p.source.author !== 'string' || typeof p.source.method !== 'string') return fail();
  if (!parts(p.body) || p.armor?.id !== 'brigandine' || p.armor.slot !== 'chest' || !parts(p.armor.parts) || !Array.isArray(p.armor.masks) || p.armor.masks.length > 12 || !p.armor.masks.every(r=>regions.has(r))) return fail();
  if (!Array.isArray(p.weapons) || p.weapons.length !== 2 || new Set(p.weapons.map(w=>w?.id)).size !== 2 || !p.weapons.every(w=>w && ['sword','mace'].includes(w.id) && vector(w.grip,1) && parts(w.parts))) return fail();
  return structuredClone(p);
}
export const VANGUARD = parseModelPack(source);
