import {EXPEDITION,EXPEDITION_GEAR} from './expedition';
export const ALPHA_GEAR=Object.freeze({...EXPEDITION_GEAR,
 sword:{slot:'mainHand',armor:0,damage:5},mace:{slot:'mainHand',armor:-1,damage:10},
 towerShield:{slot:'offHand',armor:4,damage:-2},
 brigandine:{slot:'chest',armor:3,damage:0},wand:{slot:'mainHand',armor:0,damage:1},
} as const);
export const ALPHA=Object.freeze({...EXPEDITION,generation:2,hp:64,
 mana:12,manaPeriod:20,spellMana:3,spellTime:18,spellDamage:14,spellRange:5,
 swordTime:10,maceTime:20,unarmedTime:12,macePierce:4,
 doorTime:8,leverTime:10,cacheTime:10,cacheGold:12,cacheHp:8,
 loadouts:{vanguard:{chest:'brigandine',mainHand:'sword',offHand:'shield'},breaker:{chest:'ironCuirass',mainHand:'mace',offHand:'towerShield'},channeler:{chest:'leatherVest',mainHand:'wand',offHand:'shield'}},
} as const);
