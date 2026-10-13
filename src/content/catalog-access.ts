import {ITEMS6,MONSTERS6,FEATURES6,EFFECTS6} from './alpha6-catalog';
import { ITEM_BY_ID,MONSTER_BY_ID,FACILITIES,EFFECTS } from './alpha2';
import { ITEMS5,MONSTERS5,FEATURES5,EFFECTS5 } from './alpha5-catalog';
// Read-only lookups; historical arrays/content fingerprints are never extended.
export const itemDefinition=(id:string)=>ITEM_BY_ID[id]??[...ITEMS5,...ITEMS6].find(d=>d.id===id)!;
export const monsterDefinition=(id:string)=>MONSTER_BY_ID[id]??[...MONSTERS5,...MONSTERS6].find(d=>d.id===id)!;
export const featureDefinition=(id:string)=>({...FACILITIES,...FEATURES5,...FEATURES6})[id as keyof typeof FACILITIES|keyof typeof FEATURES5|keyof typeof FEATURES6];
export const effectDefinition=(id:string)=>EFFECTS[id]??EFFECTS5[id]??EFFECTS6[id]!;
