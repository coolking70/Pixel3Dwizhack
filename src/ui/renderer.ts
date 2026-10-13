import type { PublicView } from '../core/types';

const TILE = 36;
export function drawMine(canvas: HTMLCanvasElement, view: PublicView, time: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const scale = canvas.width >= 600 ? 1.5 : 1;
  ctx.scale(scale, scale);
  const width = canvas.width / scale, height = canvas.height / scale;
  const cameraX = Math.max(0, Math.min(view.map.width * TILE - width, view.player.x * TILE - width * 0.4));
  const cameraY = Math.max(0, view.player.floor * 142 - 85);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  rect(0, 0, width, height, '#0b1218');
  // Ambient rock texture is presentation-only and does not describe hidden terrain.
  for (let row = 0; row < height / 22; row++) {
    for (let column = 0; column < width / 46; column++) {
      rect(column * 46 + (row % 2 ? 12 : 0), row * 22, 44, 20, (column + row) % 3 ? '#0e181d' : '#101b20');
    }
  }
  for (let floor = 0; floor < view.map.floors; floor++) {
    const ground = 150 + floor * 142 - cameraY;
    for (let tile = 0; tile < view.map.width; tile++) {
      const x = tile * TILE - cameraX;
      if (x < -TILE || x > width) continue;
      const known = view.explored[floor]!.includes(tile);
      if (!known) continue;
      const visible = floor === view.player.floor && Math.abs(tile - view.player.x) <= view.map.sight;
      rect(x, ground - 126, TILE, 126, '#1a2528');
      for (let row = 0; row < 6; row++) {
        rect(x + (row % 2 ? 2 : 0), ground - 124 + row * 20, 33, 18, (tile + row) % 3 ? '#24302f' : '#293632');
        rect(x + 3, ground - 122 + row * 20, 28, 1, '#35403a');
      }
      rect(x, ground, TILE, 6, '#829076'); rect(x, ground + 6, TILE, 15, '#455446');
      rect(x + 1, ground + 8, TILE - 3, 10, '#354137');
      if (tile % 5 === 2) {
        const tx = x + 18, ty = ground - 77;
        const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, 76);
        glow.addColorStop(0, '#edb36038'); glow.addColorStop(1, '#edb36000');
        ctx.fillStyle = glow; ctx.fillRect(tx - 76, ty - 76, 152, 152);
        rect(tx - 2, ty, 4, 17, '#947248'); rect(tx - 5, ty - 5, 10, 9, '#d58b46');
        rect(tx - 2, ty - 9 - Math.round(Math.sin(time / 240 + tile) * 2), 4, 11, '#f3ce7c');
      }
      if (floor === 0 && tile === 1) {
        rect(x + 2, ground - 66, 29, 66, '#090f14'); rect(x + 2, ground - 68, 29, 5, '#a0906e');
        rect(x + 3, ground - 62, 4, 62, '#5b6551'); rect(x + 26, ground - 62, 4, 62, '#5b6551');
      }
      if (!visible) rect(x, ground - 126, TILE, 147, '#091119b8');
    }
  }
  view.map.ladders.forEach(({ x: tile, floor }) => {
    const x = tile * TILE - cameraX + 18, top = 150 + floor * 142 - cameraY;
    rect(x - 10, top - 12, 4, 154, '#aa8655'); rect(x + 8, top - 12, 4, 154, '#aa8655');
    for (let y = top - 6; y < top + 142; y += 13) rect(x - 8, y, 18, 3, '#c1a574');
  });
  for (const loot of view.loot) {
    const x = loot.x * TILE - cameraX + 18, y = 150 + loot.floor * 142 - cameraY;
    if (loot.kind === 'coins') { rect(x - 7, y - 7, 14, 6, '#ddbc6a'); rect(x - 4, y - 10, 9, 3, '#f1d587'); }
    if (loot.kind === 'potion') { rect(x - 3, y - 17, 6, 5, '#c7c1a1'); rect(x - 6, y - 12, 12, 11, '#a6c8b0'); rect(x - 3, y - 10, 3, 5, '#edf1cc'); }
    if (loot.kind === 'relic') {
      ctx.fillStyle = '#e2c37c'; ctx.beginPath(); ctx.moveTo(x, y - 27); ctx.lineTo(x + 10, y - 15); ctx.lineTo(x, y - 3); ctx.lineTo(x - 10, y - 15); ctx.fill();
      rect(x - 1, y - 22, 3, 12, '#fff2c5');
    }
  }
  for (const enemy of view.enemies) {
    const x = enemy.x * TILE - cameraX + 18, y = 150 + enemy.floor * 142 - cameraY;
    rect(x - 12, y - 18, 24, 13, '#b87c67'); rect(x - 8, y - 24, 16, 12, '#cc9974');
    rect(x - 10, y - 5, 5, 5, '#765749'); rect(x + 6, y - 5, 5, 5, '#765749');
    rect(x - 7, y - 20, 4, 3, '#fff2b2'); rect(x + 4, y - 20, 4, 3, '#fff2b2');
    rect(x - 13, y - 34, 26, 3, '#394347'); rect(x - 13, y - 34, Math.round(26 * enemy.hp / enemy.maxHp), 3, '#d7927f');
  }
  const x = view.player.x * TILE - cameraX + 18, y = 150 + view.player.floor * 142 - cameraY;
  const face = view.player.face;
  rect(x - 12, y - 37, 24, 29, '#687c8e'); rect(x - 8, y - 35, 16, 23, '#a8b6ad');
  rect(x - 10, y - 11, 7, 11, '#6d685e'); rect(x + 3, y - 11, 7, 11, '#6d685e');
  rect(x - 9, y - 51, 18, 16, '#ddc29a'); rect(x - 11, y - 54, 22, 8, '#95a6b1');
  rect(x + (face > 0 ? 3 : -6), y - 44, 4, 3, '#283439'); rect(x - 12, y - 16, 24, 4, '#b9925d');
  rect(x + face * 16 - 2, y - 37, 4, 26, '#e0dcc0'); rect(x + face * 16 - 6, y - 16, 12, 3, '#be985e');
  if (view.player.relic) rect(x - 3, y - 66, 6, 6, '#f1d181');
  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.75);
  vignette.addColorStop(0, '#03080b00'); vignette.addColorStop(1, '#03080b99'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
