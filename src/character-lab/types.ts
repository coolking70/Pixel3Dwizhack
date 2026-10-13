export type Outfit = 'cloth' | 'leather' | 'plate' | 'brigandine';
export type Motion = 'idle' | 'walk' | 'attack' | 'block' | 'climb';
export interface RigData {
  version: number; rigId: string;
  source: { author: string; license: string; commit: string; url: string; sha256: string };
  bones: { name: string; sourceName: string; parent: string | null; position: number[]; quaternion: number[] }[];
  clips: { name: string; sourceName: string; duration: number;
    tracks: { name: string; type: string; times: number[]; values: number[] }[] }[];
}
export interface CharacterOptions { outfit: Outfit; helmet: boolean; sword: boolean; shield: boolean; model?: 'classic' | 'vanguard'; headStyle?: Outfit; legsStyle?: Outfit; weaponStyle?: 'sword' | 'mace' | 'wand'; weaponVariant?: 'knife'|'spear'|'bow'|'fireblade'|'silverblade'; shieldStyle?: 'small' | 'tower' }
