import { it, expect } from 'vitest';
import { runAlpha2, GameSession } from './alpha2-route';
for (let seed = 1; seed <= 10; seed++)
    it(`seed ${seed}: three loadouts complete both real direct and item routes`, () => { let items = 0; for (const loadout of ['vanguard', 'breaker', 'channeler'] as const)
        for (const strategy of ['direct', 'items'] as const) {
            const r = runAlpha2(seed, loadout, strategy);
            expect(r.session.view().status).toBe('won');
            items += r.itemActions;
            expect(GameSession.fromArchive(r.session.capture()).capture()).toBe(r.session.capture());
        } expect(items).toBeGreaterThan(0); }, 120000);
it('every natural command boundary replays, cold/hot seeks agree, cut restores continue and future knowledge stays hidden', () => { const r = runAlpha2(42, 'channeler', 'items'); for (let n = 0; n <= r.commands.length; n++)
    expect(r.session.replay(n)).toEqual(r.states[n]); for (const n of [r.commands.length, 32, 0, 160, 64, r.commands.length])
    expect(r.session.replay(n)).toEqual(r.states[n]); for (const cut of [1, 60, 160]) {
    const s = new GameSession(42, 'alpha2');
    for (const c of r.commands.slice(0, cut))
        expect(s.submit(c).accepted).toBe(true);
    const restored = GameSession.fromArchive(s.capture());
    for (const c of r.commands.slice(cut))
        expect(restored.submit(c).accepted).toBe(true);
    expect(restored.capture()).toBe(r.session.capture());
} expect(r.session.replay(0).alpha2!.codex.monsters.length).toBeLessThan(r.session.view().alpha2!.codex.monsters.length); }, 120000);
