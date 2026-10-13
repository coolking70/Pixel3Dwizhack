import {itemDefinition} from '../content/catalog-access';
import { ITEMS } from '../content/alpha2';
import type { ItemCategory, ItemSlot } from './alpha2-types';
/** Inputs are public knowledge only; do not pass an unidentified definition. */
export function publicSlot(category:ItemCategory,definition?:string,equipped?:ItemSlot):{equippableSlot?:ItemSlot} {
  if(equipped)return {equippableSlot:equipped};
  const slots=definition?[itemDefinition(definition)?.slot]:[...new Set(ITEMS.filter(item=>item.category===category).map(item=>item.slot))];
  return slots.length===1&&slots[0]?{equippableSlot:slots[0]}:{};
}
