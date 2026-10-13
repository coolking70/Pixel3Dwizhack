import type { RigData } from './types';

// A deliberately narrow asset contract: this lab accepts its own converted rig,
// not arbitrary user models, track paths, or runtime executable asset metadata.
export function parseRig(value: unknown): RigData {
  const fail = (): never => { throw new Error('Invalid character motion asset'); };
  if (!value || typeof value !== 'object') return fail();
  const data = value as RigData;
  if (data.version !== 1 || data.rigId !== 'block-humanoid-kay-v1' || !Array.isArray(data.bones) || data.bones.length !== 23 || !Array.isArray(data.clips) || data.clips.length !== 4) return fail();
  if (!data.source || data.source.license !== 'CC0-1.0' || !/^[a-f0-9]{64}$/.test(data.source.sha256)) return fail();
  const required = new Set(['Root', 'Pelvis', 'Spine', 'Chest', 'Head', ...['L', 'R'].flatMap(s => ['UpperArm', 'Forearm', 'Wrist', 'Hand', 'Grip', 'Thigh', 'Shin', 'Foot', 'Toe'].map(b => b + s))]);
  const vector = (v: unknown, length: number, limit: number): v is number[] => Array.isArray(v) && v.length === length && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit);
  const parents = new Map<string, string | null>();
  for (const bone of data.bones) {
    if (!bone || !required.has(bone.name) || parents.has(bone.name) || !vector(bone.position, 3, 5) || !vector(bone.quaternion, 4, 1.001)) return fail();
    const norm = Math.hypot(...bone.quaternion); if (Math.abs(norm - 1) > .001) return fail();
    if (bone.name === 'Root' ? bone.parent !== null : typeof bone.parent !== 'string' || !required.has(bone.parent)) return fail();
    parents.set(bone.name, bone.parent);
  }
  for (const name of parents.keys()) {
    const visited = new Set<string>(); let parent: string | null = name;
    while (parent !== null) { if (visited.has(parent)) return fail(); visited.add(parent); parent = parents.get(parent) ?? null; }
  }
  const clips = new Set(['idle', 'walk', 'attack', 'block']); let samples = 0;
  for (const clip of data.clips) {
    if (!clip || !clips.delete(clip.name) || !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.duration > 10 || !Array.isArray(clip.tracks) || clip.tracks.length > 24) return fail();
    const paths = new Set<string>();
    for (const track of clip.tracks) {
      if (!track || typeof track.name !== 'string' || paths.has(track.name)) return fail(); paths.add(track.name);
      const [bone, property, extra] = track.name.split('.');
      if (!bone || bone === 'Root' || !required.has(bone) || extra !== undefined) return fail();
      const size = property === 'quaternion' && track.type === 'quaternion' ? 4 : bone === 'Pelvis' && property === 'position' && track.type === 'vector' ? 3 : 0;
      if (!size || !Array.isArray(track.times) || !track.times.length || track.times.length > 600 || !vector(track.values, track.times.length * size, 5)) return fail();
      samples += track.times.length; if (samples > 10000) return fail();
      if (!track.times.every((t, i) => Number.isFinite(t) && t >= 0 && t <= clip.duration && (i === 0 || t > track.times[i - 1]!))) return fail();
      if (size === 4) for (let i = 0; i < track.values.length; i += 4) if (Math.abs(Math.hypot(...track.values.slice(i, i + 4)) - 1) > .001) return fail();
    }
    if (!paths.has('Pelvis.quaternion') || !paths.has('UpperArmR.quaternion')) return fail();
  }
  return data;
}
