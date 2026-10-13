import * as T from 'three';
import { BlockCharacter } from './character';
import type { CharacterOptions, Motion, RigData } from './types';

export interface StudyOptions extends CharacterOptions {
  motion: Motion; phase: number; angle: number; compare: boolean; monochrome: boolean; pixelHeight: number;
}

export class CharacterStudy {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera();
  readonly characters: BlockCharacter[];
  private observer: ResizeObserver;
  private options: StudyOptions | null = null;
  private width = 0;
  private height = 0;
  private onLost = (event: Event): void => { event.preventDefault(); this.failed(); };
  constructor(readonly canvas: HTMLCanvasElement, data: RigData, private failed: () => void) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.scene.background = new T.Color(0x19262c);
    this.scene.add(new T.HemisphereLight(0xe3edf2, 0x6b6350, 2.5));
    const key = new T.DirectionalLight(0xffe6bd, 4); key.position.set(-3, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.normalBias = .035;
    this.scene.add(key);
    const rim = new T.DirectionalLight(0x89c8ff, 2.5); rim.position.set(3, 4, -4); this.scene.add(rim);
    const room = new T.Group(); this.scene.add(room);
    const stone = new T.MeshStandardMaterial({ color: 0x465258, roughness: 1 });
    const dark = new T.MeshStandardMaterial({ color: 0x303e44, roughness: 1 });
    const box = (size: number[], position: number[], material: T.Material): void => {
      const mesh = new T.Mesh(new T.BoxGeometry(size[0], size[1], size[2]), material);
      mesh.position.fromArray(position); mesh.receiveShadow = true; room.add(mesh);
    };
    box([8, .16, 4], [0, -.12, 0], dark);
    for (let x = -3; x <= 3; x++) for (let z = -1; z <= 1; z++) box([.97, .06, .97], [x, -.02, z], stone);
    for (const x of [-3.2, 3.2]) for (let y = 0; y < 5; y++) box([.44, .49, .45], [x, .245 + y * .5, -1.3], dark);
    box([6.8, .24, .44], [0, 2.65, -1.3], dark);
    this.characters = [new BlockCharacter(data), new BlockCharacter(data)];
    for (const character of this.characters) this.scene.add(character.root);
    this.camera.position.set(0, 2.1, 7); this.camera.lookAt(0, 1.15, 0); this.camera.near = .1; this.camera.far = 30;
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.observer = new ResizeObserver(() => this.render()); this.observer.observe(canvas);
  }
  update(options: StudyOptions): void {
    const previous = this.options; this.options = { ...options };
    this.characters.forEach((character, index) => {
      const outfit = options.compare ? index === 0 ? 'leather' : 'plate' : options.outfit;
      const oldOutfit = previous?.compare ? index === 0 ? 'leather' : 'plate' : previous?.outfit;
      if (!previous || outfit !== oldOutfit || options.model !== previous.model || options.weaponStyle !== previous.weaponStyle || options.helmet !== previous.helmet || options.sword !== previous.sword || options.shield !== previous.shield) {
        character.setEquipment({ ...options, outfit });
      }
      character.root.visible = options.compare || index === 0;
      character.root.position.x = options.compare ? (index === 0 ? -1.08 : 1.08) : 0;
      character.root.rotation.y = T.MathUtils.degToRad(options.angle);
      character.setMonochrome(options.monochrome); character.sample(options.motion, options.phase);
    });
    this.render();
  }
  render(): void {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    if (width !== this.width || height !== this.height) {
      this.width = width; this.height = height; this.renderer.setSize(width, height, false);
    }
    const aspect = width / height;
    const vertical = Math.max(3.1, (this.options?.compare ? 5.4 : 3.1) / aspect, this.options?.pixelHeight ? height * 2.1 / this.options.pixelHeight : 0);
    this.camera.left = -vertical * aspect / 2; this.camera.right = vertical * aspect / 2;
    this.camera.top = vertical / 2; this.camera.bottom = -vertical / 2; this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.gripError = Math.max(...this.characters.flatMap(c => Object.values(c.gripErrors()))).toExponential(2);
    this.canvas.dataset.phase = String(this.options?.phase ?? 0);
    this.canvas.dataset.geometries = String(this.renderer.info.memory.geometries);
  }
  dispose(): void {
    this.observer.disconnect(); this.canvas.removeEventListener('webglcontextlost', this.onLost);
    for (const character of this.characters) character.dispose();
    const materials = new Set<T.Material>();
    this.scene.traverse(object => {
      if (object instanceof T.Mesh) { object.geometry.dispose(); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); }
      if (object instanceof T.Light && 'shadow' in object) (object as T.DirectionalLight).shadow?.dispose();
    });
    for (const material of materials) material.dispose();
    this.renderer.dispose();
  }
}
