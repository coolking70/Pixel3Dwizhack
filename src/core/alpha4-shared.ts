import type { World } from './types';
export function bagSlots4(w:World):number {
  const equipped=new Set(Object.values(w.alpha2!.equipped));
  return w.alpha2!.items.filter(item=>item.owner==='bag'&&!equipped.has(item.id)).length;
}
