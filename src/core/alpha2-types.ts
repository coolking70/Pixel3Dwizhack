import type { Position, GearId, Enemy, Slot } from './types';
import type { Loadout, Door } from './alpha-types';
export type Words = {
    zh: string;
    en: string;
};
export type ItemCategory = 'potion' | 'scroll' | 'wand' | 'weapon' | 'armor' | 'accessory' | 'food' | 'tool';
export type ItemAction = 'drink' | 'throw' | 'apply' | 'read' | 'zap' | 'eat' | 'equip';
export type TargetKind = 'self' | 'enemy' | 'item' | 'facility';
export type Element = 'physical' | 'fire' | 'cold' | 'shock' | 'acid' | 'poison' | 'silver';
export type Condition = 'poison' | 'sleep' | 'blind' | 'confused' | 'ward' | 'might' | 'wet' | 'slow' | 'invisible' | 'light' | 'burn';
export type ItemSlot = Slot | 'charm';
export type Blessing = 'blessed' | 'uncursed' | 'cursed';
export interface EffectDef {
    id: string;
    targets: TargetKind[];
    op: 'heal' | 'cure' | 'damage' | 'status' | 'water' | 'identify' | 'uncurse' | 'map' | 'enchant' | 'blink' | 'summon' | 'open' | 'food' | 'repair' | 'cook' | 'protect';
    power: number;
    duration?: number;
    element?: Element;
    condition?: Condition;
}
export interface ItemDef {
    id: string;
    name: Words;
    description: Words;
    category: ItemCategory;
    material: 'metal' | 'wood' | 'cloth' | 'glass' | 'organic' | 'stone';
    value: number;
    weight: number;
    minDepth: number;
    rarity: number;
    tags: string[];
    sourceKey: 'original-alpha2' | 'original-alpha5' | 'original-alpha6';
    actions: Partial<Record<ItemAction, string>>;
    slot?: ItemSlot;
    visual?: GearId;
    damage?: number;
    armor?: number;
    time?: number;
    range?: number;
    pierce?: number;
    element?: Element;
    resists?: Element[];
    charges?: number;
    perishes?: boolean;
}
export interface Item2 {
    id: number;
    definition: string;
    owner: 'bag' | 'ground' | 'spent' | 'shop' | 'container';
    position: Position;
    holder: number | null;
    blessing: Blessing;
    enchantment: number;
    charges: number;
    durability: number;
    proof: boolean;
    freshUntil: number;
}
export interface Knowledge2 {
    identified: string[];
    buc: number[];
    enchantment: number[];
    charges: number[];
    notes: Record<number, string>;
    monsters: string[];
    facilities: string[];
}
export interface Condition2 {
    kind: Condition;
    actor: number;
    until: number;
    nextAt: number;
    source: string;
    power: number;
}
export type Behavior2 = 'chase' | 'guard' | 'ranged' | 'retreat' | 'flee' | 'summon';
export interface MonsterDef {
    id: string;
    name: Words;
    description: Words;
    kind: NonNullable<Enemy['kind']>;
    behavior: Behavior2;
    hp: number;
    damage: number;
    armor: number;
    period: number;
    range: number;
    element: Element;
    resists: Element[];
    weak: Element[];
    inflict?: Condition;
    minDepth: number;
    color: number;
    scale: number;
    sourceKey: 'original-alpha2' | 'original-alpha5' | 'original-alpha6';
}
export interface Monster2 {
    id: number;
    definition: string;
    spawned: boolean;
    summons: number;
}
export type FacilityKind = 'merchant' | 'altar' | 'fountain' | 'chest' | 'trap' | 'garden' | 'campfire' | 'hazard' | 'sporeBed' | 'relay' | 'barricade' | 'emberVent' | 'boneChime';
export interface Facility2 extends Position {
    id: number;
    kind: FacilityKind;
    used: boolean;
    revealed: boolean;
    stock: number[];
    gold: number;
}
export interface Segment2 {
    id: number;
    floor: number;
    start: number;
    end: number;
    tag: 'mine' | 'crypt' | 'fungal' | 'sanctuary' | 'merchant';
    risk: number;
}
export interface Journal2 {
    key: string;
    name?: string;
    target?: string;
    amount?: number;
}
export interface Alpha2State {
    loadout: Loadout;
    chosen: boolean;
    mana: number;
    manaAt: number;
    food: number;
    foodAt: number;
    items: Item2[];
    equipped: Record<ItemSlot, number | null>;
    assignment: Record<string, number>;
    knowledge: Knowledge2;
    conditions: Condition2[];
    monsters: Monster2[];
    facilities: Facility2[];
    links: Position[];
    doors: Door[];
    segments: Segment2[];
    kills: number;
    collected: number;
    relic: Position;
    journal: Journal2[];
}
export interface Item2View {
    equippableSlot?: ItemSlot;
    id: number;
    name: Words;
    description?: Words;
    category: ItemCategory;
    definition?: string;
    appearance: number;
    blessing?: Blessing;
    enchantment?: number;
    charges?: number;
    durability: number;
    proof: boolean;
    freshness?: 'fresh' | 'stale';
    equipped?: ItemSlot;
    actions: ItemAction[];
    note: string;
    weight: number;
    buy?: number;
    sell?: number;
    damage?: number;
    armor?: number;
    time?: number;
    range?: number;
}
export interface Facility2View extends Position {
    id: number;
    kind: FacilityKind;
    used: boolean;
    name: Words;
    description: Words;
    stock: Item2View[];
    gold?: number;
    near: boolean;
    cost: number;
}
export interface Target2 {
    key: string;
    kind: TargetKind;
    name: Words;
}
export type Condition2View = Omit<Condition2, 'source'> & {
    source: Words;
};
export type Journal2View = Omit<Journal2, 'name' | 'target'> & {
    name?: Words;
    target?: Words;
};
export interface Alpha2View {
    capacityUsed?: number;
    capacityIncludesEquipment?: boolean;
    actionCosts: Record<ItemAction,number>;
    bag: Item2View[];
    nearby: Item2View[];
    ground: (Item2View & Position)[];
    facilities: Facility2View[];
    segments: Segment2[];
    conditions: Condition2View[];
    monsters: (MonsterDef & {
        enemy: number;
        conditions: Condition2View[];
    })[];
    codex: {
        items: {
            id: string;
            name: Words;
            description: Words;
            category: ItemCategory;
        }[];
        monsters: MonsterDef[];
        facilities: {
            id: FacilityKind;
            name: Words;
            description: Words;
        }[];
    };
    targets: Target2[];
    journal: Journal2View[];
    food: number;
    maxFood: number;
    weight: number;
    capacity: number;
    attackCost: number;
    attackRange: number;
    resists: {
        element: Element;
        source: Words;
    }[];
    knownCount: number;
    loadout: Loadout;
    mana: number;
    maxMana: number;
    equipped: Record<ItemSlot, number | null>;
}
export type Alpha2Command = `a2:${string}`;
