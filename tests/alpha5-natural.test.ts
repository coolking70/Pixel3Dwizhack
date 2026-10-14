import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {GameSession,ALPHA5_IDENTITY} from '../src/session/session';
import {ecologyCases5} from './m31-trace';
import type {Command} from '../src/core/types';

const raw=readFileSync('tests/fixtures/alpha5-v1.json','utf8').trim();
const gold=JSON.parse(raw) as {seed:number;history:{command:Command;digest:string}[]};
// Reuse immutable natural archives and the replay session across nonsequential seeks.
// Each test also works alone: these fixtures are initialized lazily, not by another test.
let restored:GameSession|undefined,cases:ReturnType<typeof ecologyCases5>|undefined;
const loaded=()=>restored??=GameSession.fromArchive(raw);
const naturalCases=()=>cases??=ecologyCases5();

it('Alpha5 winning golden restores byte-for-byte with the registered identity',()=>{
 expect(loaded().capture()).toBe(raw);expect(loaded().view().status).toBe('won');
 expect(JSON.parse(raw).identity).toEqual(ALPHA5_IDENTITY);
});
it('Alpha5 verifies every command digest and continues a saved boundary to the exact winning archive',()=>{
 let s=new GameSession(gold.seed,'alpha5');
 for(const [n,e] of gold.history.entries()){
  expect(s.submit(e.command).accepted).toBe(true);expect(s.fingerprint()).toBe(e.digest);
  if(n===214){const before=s.capture();s=GameSession.fromArchive(before);expect(s.capture()).toBe(before);}
 }
 expect(s.capture()).toBe(raw);
 expect(gold.history.some(e=>e.command.startsWith('a5:jump:'))).toBe(true);
 expect(gold.history.some(e=>e.command.startsWith('a5:feature:'))).toBe(true);
});
// Bound each check to one seek; keep the original non-monotonic order and exact public state.
it.each([459,27,383,0,214,291])('Alpha5 nonsequential seek to %i matches a fresh formal prefix',at=>{
 const expected=new GameSession(gold.seed,'alpha5');
 for(const e of gold.history.slice(0,at))expect(expected.submit(e.command).accepted).toBe(true);
 expect(loaded().replay(at)).toEqual(expected.view());
});
const names=['manual-barricade','manual-relay','manual-sporeBed','tool-coilKey','tool-sporeBell'];
it('all five ecology branches arise from the natural golden and public formal commands',()=>{
 expect(naturalCases().map(c=>c.name).sort()).toEqual(names);
});
it.each(names)('natural Alpha5 ecology branch %s restores and continues with exact archives',name=>{
 const c=naturalCases().find(c=>c.name===name)!;expect(c).toBeDefined();
 const s=GameSession.fromArchive(c.before);expect(s.submit(c.command).accepted).toBe(true);
 expect(s.capture()).toBe(c.after);expect(GameSession.fromArchive(c.after).capture()).toBe(c.after);
});
