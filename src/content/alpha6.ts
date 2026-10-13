import {ALPHA5_CONTENT} from './alpha5';
import {ITEMS6,MONSTERS6,FEATURES6,EFFECTS6,FACILITY_EFFECTS6} from './alpha6-catalog';
const mechanics=<T extends {name:unknown;description?:unknown}>(v:T)=>{const{name,description,...rest}=v;void name;void description;return rest;};
export const ALPHA6_CONTENT={base:ALPHA5_CONTENT,generation:'alpha6-ossuary-v1',items:ITEMS6.map(mechanics),monsters:MONSTERS6.map(mechanics),facilities:Object.keys(FEATURES6),effects:EFFECTS6,facilityEffects:FACILITY_EFFECTS6,manual:{cover:24,silence:28},ecology:{ventDamage:4,ward:3,regeneration:3,range:2}};
