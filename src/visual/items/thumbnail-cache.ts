import * as T from 'three';
import { createItemModelCache, type ItemModelCache } from './presenter';
import type { ItemLOD, ItemVisualSpec } from './types';
import { ITEM_VISUALS } from './registry';
import type { Item2View } from '../../core/alpha2-types';
import { resolveItemVisual } from './appearance-resolver';
import { applyItemAppearance, itemConditionKey } from './appearance';

/** One renderer, one scene, one render per distinct visible asset/size. No rule access. */
export class ItemThumbnailCache {
  private readonly images = new Map<string, Promise<HTMLCanvasElement | null>>();
  private readonly models: ItemModelCache = createItemModelCache();
  private renderer?: T.WebGLRenderer;
  private readonly ownRenderer: boolean;
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  constructor(renderer?: T.WebGLRenderer) { this.renderer = renderer; this.ownRenderer = !renderer; }
  getItem(item: Item2View, size = 64, level: ItemLOD = 0): Promise<HTMLCanvasElement | null> { return this.get(resolveItemVisual(item), size, level, item); }
  get(spec: ItemVisualSpec, size = 64, level: ItemLOD = 0, condition?: Pick<Item2View, 'category' | 'freshness'>): Promise<HTMLCanvasElement | null> {
    if (this.disposed || spec.status !== 'ready') return Promise.resolve(null);
    const pixels = Math.max(32, Math.min(192, Math.round(size))), key = `${spec.assetId}:${pixels}:${level}:${condition ? itemConditionKey(condition) : 'fresh'}`;
    const cached = this.images.get(key); if (cached) return cached;
    const result = this.queue.then(() => this.render(spec, pixels, level, condition)).catch(() => { this.images.delete(key); return null; });
    this.queue = result; this.images.set(key, result); return result;
  }
  private async render(spec: ItemVisualSpec, size: number, level: ItemLOD, condition?: Pick<Item2View, 'category' | 'freshness'>): Promise<HTMLCanvasElement | null> {
    const model = await this.models.instantiate(spec, level); if (!model || this.disposed) return null;
    if (!this.renderer) { this.renderer = new T.WebGLRenderer({ alpha: true, antialias: false }); this.renderer.setPixelRatio(1); }
    const renderer = this.renderer, scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xe2eef3, 0x554b40, 2.4));
    const light = new T.DirectionalLight(0xffe1b6, 3.8); light.position.set(-2, 4, 5); scene.add(light, model);
    const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3());
    const span = Math.max(...bounds.getSize(new T.Vector3()).toArray()) * spec.preview.framing;
    applyItemAppearance(model, condition ?? { category: spec.family });
    const camera = new T.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, .01, 20);
    camera.position.copy(center).add(new T.Vector3(.7, .35, 2.5)); camera.lookAt(center);
    const target = new T.WebGLRenderTarget(size, size), previous = renderer.getRenderTarget();
    target.texture.colorSpace = T.SRGBColorSpace;
    const clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
    const viewport = renderer.getViewport(new T.Vector4()), scissor = renderer.getScissor(new T.Vector4()), scissorTest = renderer.getScissorTest();
    const bytes = new Uint8Array(size * size * 4);
    try {
      renderer.autoClear = true; renderer.setScissorTest(false); renderer.setRenderTarget(target); renderer.setViewport(0, 0, size, size); renderer.setClearColor(0, 0);
      renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, size, size, bytes);
    } finally {
      renderer.setRenderTarget(previous); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); renderer.setClearColor(clear, alpha); renderer.autoClear = autoClear; target.dispose();
    }
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) image.data.set(bytes.subarray((size - y - 1) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.putImageData(image, 0, 0); return canvas;
  }
  get size(): number { return this.images.size; }
  dispose(): void { this.disposed = true; this.images.clear(); this.models.dispose(); if (this.ownRenderer) this.renderer?.dispose(); }
}

/** Development-only inspection entry. Caller owns returned canvas and cache. */
export async function renderItemAtlas(cache: ItemThumbnailCache, sizes: readonly number[] = [48, 64, 96], level: ItemLOD = 0): Promise<HTMLCanvasElement> {
  const cellWidth = 168, rowHeight = 130, columns = 6;
  const canvas = document.createElement('canvas'); canvas.width = columns * cellWidth; canvas.height = Math.ceil(ITEM_VISUALS.length / columns) * rowHeight * sizes.length;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#242d32'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let n = 0; n < sizes.length; n++) for (let i = 0; i < ITEM_VISUALS.length; i++) {
    const spec = ITEM_VISUALS[i]!, size = sizes[n]!, icon = await cache.get(spec, size, level), x = i % columns * cellWidth, y = (n * Math.ceil(ITEM_VISUALS.length / columns) + Math.floor(i / columns)) * rowHeight;
    if (icon) ctx.drawImage(icon, x + (cellWidth - size) / 2, y + 4);
    ctx.fillStyle = '#dfded6'; ctx.font = '12px sans-serif'; ctx.fillText(`${spec.assetId} / ${size}px`, x + 8, y + 118);
  }
  return canvas;
}

/** Public-condition comparison fixture; same model and camera for fresh/stale. */
export async function renderFoodConditionAtlas(cache: ItemThumbnailCache, size = 64): Promise<HTMLCanvasElement> {
  const foods=ITEM_VISUALS.filter(s=>s.family==='food'),canvas=document.createElement('canvas');canvas.width=foods.length*168;canvas.height=520;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#242d32';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const [row,condition] of ([{level:0,freshness:'fresh'},{level:0,freshness:'stale'},{level:2,freshness:'fresh'},{level:2,freshness:'stale'}] as const).entries())for(const [n,spec] of foods.entries()){
    const icon=await cache.getItem({id:1,definition:spec.assetId.slice(6),category:'food',appearance:0,freshness:condition.freshness,name:{zh:'检查',en:'Inspection'},durability:6,proof:false,actions:[],note:'',weight:1},size,condition.level);
    if(icon)ctx.drawImage(icon,n*168+(168-size)/2,row*130+4);ctx.fillStyle='#dfded6';ctx.font='12px sans-serif';ctx.fillText(`${spec.assetId} ${condition.freshness} L${condition.level}`,n*168+4,row*130+118);
  }
  return canvas;
}
