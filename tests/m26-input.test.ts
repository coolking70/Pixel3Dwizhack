import { expect, it } from 'vitest';
import { FocusInputGate } from '../src/interaction/focus';
import { PickupSequence } from '../src/interaction/pickup';
import { GameSession } from '../src/session/session';

it('focus activation is presentation-only: activation pointer is swallowed, fresh key or next pointer is accepted', () => {
  const gate = new FocusInputGate();
  expect(gate.pointerDown()).toBe(true);
  gate.blur(); expect(gate.keyDown(false)).toBe(false);
  gate.focus(); expect(gate.keyDown(true)).toBe(false);
  expect(gate.pointerDown()).toBe(false); expect(gate.pointerDown()).toBe(true);
  gate.blur(); gate.focus(); expect(gate.keyDown(false)).toBe(true); expect(gate.pointerDown()).toBe(true);
});

function droppedItems() {
  const session = new GameSession(1, 'alpha3');
  const ids = session.view().alpha2!.bag.filter(item => !item.equipped).slice(0, 2).map(item => item.id);
  expect(ids).toHaveLength(2);
  for (const id of ids) expect(session.submit(`drop:${id}`).accepted).toBe(true);
  return { session, ids };
}
it('pickup-all submits only exact fresh public commands and one item per animation completion', () => {
  const { session, ids } = droppedItems(), before = session.capture();
  let busy = false;
  const sequence = new PickupSequence({ view: () => session.view(), busy: () => busy, offers: ref => session.queryContextOffers(ref), submit: command => { busy = true; return session.submit(command); } });
  sequence.start(ids); expect(session.view().alpha2!.bag.some(item => item.id === ids[0])).toBe(true);
  expect(session.view().alpha2!.bag.some(item => item.id === ids[1])).toBe(false);
  const once = session.capture(); sequence.completed(); expect(session.capture()).toBe(once);
  busy = false; sequence.completed(); expect(sequence.active).toBe(false);
  const oracle = GameSession.fromArchive(before); for (const id of ids) expect(oracle.submit(`take:${id}`).accepted).toBe(true);
  expect(session.capture()).toBe(oracle.capture());
});
it('pickup cancellation or a changed boundary cannot enqueue another item; rejected item stops the sequence', () => {
  const { session, ids } = droppedItems();
  const sequence = new PickupSequence({ view: () => session.view(), busy: () => false, offers: ref => session.queryContextOffers(ref), submit: command => session.submit(command) });
  sequence.start(ids); sequence.cancel(); const once = session.capture(); sequence.completed(); expect(session.capture()).toBe(once);
  sequence.start([99999, ids[1]!]); expect(sequence.active).toBe(false); expect(session.capture()).toBe(once);
  let busy = true;
  const boundary = new PickupSequence({ view: () => session.view(), busy: () => busy, offers: ref => session.queryContextOffers(ref), submit: command => session.submit(command) });
  boundary.start([ids[1]!]); expect(session.submit('wait').accepted).toBe(true); const external = session.capture(); busy = false; boundary.completed(); expect(boundary.active).toBe(false); expect(session.capture()).toBe(external);
});

it('a newly visible threat interrupts pickup-all at the already committed archive boundary', () => {
  const { session, ids } = droppedItems(); let threat = false;
  const sequence = new PickupSequence({ view: () => { const view = session.view(); if (threat) view.enemies.push({ id: 999, floor: view.player.floor, x: view.player.x + 1, hp: 10, maxHp: 10, period: 10, nextAt: view.tick + 10 }); return view; }, busy: () => false, offers: ref => session.queryContextOffers(ref), submit: command => { const result = session.submit(command); threat = true; return result; } });
  // Controlled public threat injection, without mutating the session or fabricating a natural trace.
  sequence.start(ids); const once = session.capture(); expect(sequence.active).toBe(false); sequence.completed(); expect(session.capture()).toBe(once);
  expect(session.view().alpha2!.bag.some(item => item.id === ids[0])).toBe(true);
  expect(session.view().alpha2!.bag.some(item => item.id === ids[1])).toBe(false);
});
