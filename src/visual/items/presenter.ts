import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ItemLOD, ItemVisualSpec } from './types';
import { applyItemAppearance } from './appearance';

export interface ItemModelCache {
  instantiate(spec: ItemVisualSpec, level?: ItemLOD): Promise<T.Group | null>;
  peek(spec: ItemVisualSpec, level?: ItemLOD): T.Group | null;
  preload(specs: readonly ItemVisualSpec[], level?: ItemLOD): Promise<void>;
  dispose(): void;
  readonly size: number;
}
export function disposeItemTemplate(root: T.Object3D): void {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  root.traverse(o => { if (o instanceof T.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
/** Templates own GPU resources; cloned instances must only be removed, not disposed. */
export function createItemModelCache(load?: (uri: string) => Promise<T.Group>): ItemModelCache {
  const loader = new GLTFLoader();
  const fetchModel = load ?? (async (uri: string) => (await loader.loadAsync(uri)).scene);
  const templates = new Map<string, T.Group>(), pending = new Map<string, Promise<T.Group | null>>();
  let disposed = false;
  const clone = (template: T.Group): T.Group => { const root = template.clone(true); root.userData.itemAsset = true; return root; };
  const ready = async (spec: ItemVisualSpec, level: ItemLOD = 0): Promise<T.Group | null> => {
    if (disposed || spec.status !== 'ready') return null;
    const key = `${spec.assetId}:${level}`, uri = spec.lod?.find(l => l.level === level)?.uri ?? spec.source.uri;
    const cached = templates.get(key); if (cached) return cached;
    let promise = pending.get(key);
    if (!promise) {
      promise = fetchModel(uri).then(root => {
        if (disposed) { disposeItemTemplate(root); return null; }
        root.name = spec.assetId; root.userData.itemAsset = true; root.userData.assetId = spec.assetId; root.userData.itemLOD = level;
        applyItemAppearance(root, { category: spec.family });
        templates.set(key, root); return root;
      }).finally(() => { pending.delete(key); });
      pending.set(key, promise);
    }
    return promise;
  };
  return {
    async instantiate(spec, level = 0) { const template = await ready(spec, level); return template && !disposed ? clone(template) : null; },
    peek(spec, level = 0) { const template = templates.get(`${spec.assetId}:${level}`); return !disposed && template ? clone(template) : null; },
    async preload(specs, level = 0) { await Promise.all(specs.map(spec => ready(spec, level))); },
    get size() { return templates.size; },
    dispose() { disposed = true; templates.forEach(disposeItemTemplate); templates.clear(); }
  };
}

/** Bind the same ground/preview asset to an existing semantic character socket. */
export function bindItemToSocket(root: T.Group, socket: T.Object3D, spec: ItemVisualSpec): void {
  root.position.set(-spec.grip[0], -spec.grip[1], -spec.grip[2]);
  root.rotation.set(0, 0, 0); root.scale.setScalar(1); socket.add(root);
}
