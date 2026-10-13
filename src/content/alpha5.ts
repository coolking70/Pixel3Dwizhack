import { ITEMS5, MONSTERS5, FEATURES5, EFFECTS5, REGIONS5, FACILITY_EFFECTS5 } from './alpha5-catalog';
import { ALPHA4_CONTENT } from './alpha4';
export const ALPHA5 = { jump: { range: 2, shortCost: 16, longCost: 22, maxWeight: 40 }, generation: 'alpha5-regions-v1' } as const;
const mechanics = <T extends {name:unknown;description?:unknown}>(value:T) => { const {name,description,...rest}=value; void name;void description;return rest; };
export const ALPHA5_CONTENT = { base: ALPHA4_CONTENT, expedition: ALPHA5, items:ITEMS5.map(mechanics), monsters:MONSTERS5.map(mechanics), facilities:Object.keys(FEATURES5), effects:EFFECTS5, regions:REGIONS5.map(mechanics), facilityEffects:FACILITY_EFFECTS5 };
