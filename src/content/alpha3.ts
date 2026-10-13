import { ALPHA2_CONTENT } from './alpha2';
/** Identity-bearing additions; historical Alpha 2 content remains byte-stable. */
export const ALPHA3 = { range: 5, throwCost: 14, impact: 7, collision: 'door-enemy-endpoint-facility-v1', potion: 'break-on-valid-impact-v1' } as const;
export const ALPHA3_CONTENT = { base: ALPHA2_CONTENT, interaction: ALPHA3 };
