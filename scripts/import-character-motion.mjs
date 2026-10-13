// Reproducible offline preparation, not a runtime asset service.
// Only this known, pinned GLB profile is supported; arbitrary GLBs are not accepted.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const commit = '672074b73ba276876a19e8816ecdc5241817ab47';
const base = `https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/${commit}`;
const asset = '/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb';
const buffer = process.argv[2] ? await readFile(process.argv[2]) : Buffer.from(await (await fetch(base + asset)).arrayBuffer());
if (createHash('sha256').update(buffer).digest('hex') !== '60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168') throw new Error('Source differs from the pinned, reviewed profile');
if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) throw new Error('Expected glTF 2');
const jsonLength = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
const bin = buffer.subarray(28 + jsonLength);
function readAccessor(index) {
  const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.sparse) throw new Error('Unsupported animation accessor');
  const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  if (!size) throw new Error('Unsupported vector');
  const result = [];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) {
    result.push(bin.readFloatLE((view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? size * 4) + k * 4));
  }
  return result;
}
const names = {
  root: 'Root', hips: 'Pelvis', spine: 'Spine', chest: 'Chest', head: 'Head',
  'upperarm.l': 'UpperArmL', 'lowerarm.l': 'ForearmL', 'wrist.l': 'WristL', 'hand.l': 'HandL', 'handslot.l': 'GripL',
  'upperarm.r': 'UpperArmR', 'lowerarm.r': 'ForearmR', 'wrist.r': 'WristR', 'hand.r': 'HandR', 'handslot.r': 'GripR',
  'upperleg.l': 'ThighL', 'lowerleg.l': 'ShinL', 'foot.l': 'FootL', 'toes.l': 'ToeL',
  'upperleg.r': 'ThighR', 'lowerleg.r': 'ShinR', 'foot.r': 'FootR', 'toes.r': 'ToeR',
};
const parents = new Map();
gltf.nodes.forEach((n, index) => (n.children ?? []).forEach(child => parents.set(child, index)));
const scaleFor = name => name === 'hips' ? [1.65, 1.65, 1.65]
  : /upperleg|lowerleg|foot\.|toes/.test(name) ? [1.45, 1.65, 1.65]
  : /upperarm/.test(name) ? [1.52, 1.15, 1.3]
  : /lowerarm|wrist|hand/.test(name) ? [1.3, 1.3, 1.3] : [1.25, 1.15, 1.25];
const scaled = (v, name) => v.map((x, i) => x * scaleFor(name)[i % 3]);
const round = n => Math.round(n * 1e7) / 1e7;
const bones = gltf.nodes.flatMap((node, index) => names[node.name] ? [{
  name: names[node.name], sourceName: node.name, parent: names[gltf.nodes[parents.get(index)]?.name] ?? null,
  position: scaled(node.translation ?? [0, 0, 0], node.name).map(round),
  quaternion: (node.rotation ?? [0, 0, 0, 1]).map(round),
}] : []);
const selections = { idle: 'Idle', walk: 'Walking_A', attack: '1H_Melee_Attack_Chop', block: 'Blocking' };
const clips = Object.entries(selections).map(([name, sourceName]) => {
  const a = gltf.animations.find(clip => clip.name === sourceName);
  if (!a) throw new Error(`Missing clip ${sourceName}`);
  const tracks = a.channels.flatMap(channel => {
    const sourceBone = gltf.nodes[channel.target.node].name, bone = names[sourceBone];
    const property = { translation: 'position', rotation: 'quaternion' }[channel.target.path];
    // Target segment lengths are constant. Keep only pelvis bob; root motion is removed.
    if (!bone || !property || bone === 'Root' || (property === 'position' && bone !== 'Pelvis')) return [];
    const sampler = a.samplers[channel.sampler];
    if ((sampler.interpolation ?? 'LINEAR') !== 'LINEAR') throw new Error('Unsupported interpolation');
    const times = readAccessor(sampler.input).map(round);
    let values = readAccessor(sampler.output);
    if (property === 'position') {
      values = scaled(values, sourceBone);
      const rest = bones.find(bone => bone.name === 'Pelvis').position;
      values = values.map((value, i) => i % 3 === 1 ? value : rest[i % 3]);
    }
    return [{ name: `${bone}.${property}`, type: property === 'quaternion' ? 'quaternion' : 'vector', times, values: values.map(round) }];
  });
  return { name, sourceName, duration: Math.max(...tracks.flatMap(track => track.times)), tracks };
});
const data = { version: 1, rigId: 'block-humanoid-kay-v1', source: { author: 'Kay Lousberg', license: 'CC0-1.0', commit, url: base + asset, sha256: createHash('sha256').update(buffer).digest('hex') }, bones, clips };
const output = fileURLToPath(new URL('../public/assets/character-study/', import.meta.url));
await mkdir(output, { recursive: true });
await writeFile(output + '/motions.json', JSON.stringify(data));
const license = process.argv[3] ? await readFile(process.argv[3], 'utf8') : await (await fetch(base + '/LICENSE.txt')).text();
if (!license.includes('Creative Commons Zero')) throw new Error('Expected source license');
await writeFile(output + '/KayKit-LICENSE.txt', license);
await writeFile(output + '/provenance.json', JSON.stringify({ ...data.source, derived: 'Selected rotation tracks, pelvis bob, renamed skeleton and profile-specific segment scaling. Original meshes, textures, IK controls and root movement omitted.', clips: selections }, null, 2));
console.log(`${bones.length} bones, ${clips.length} imported clips, ${Buffer.byteLength(JSON.stringify(data))} bytes`);
