import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {GameSession,ALPHA5_IDENTITY} from '../src/session/session';
import {ecologyCases5} from './m31-trace';
import type {Command} from '../src/core/types';
it('Alpha5 winning golden verifies every command, save/continue, random state and nonsequential seek',()=>{
 const raw=readFileSync('tests/fixtures/alpha5-v1.json','utf8').trim(),gold=JSON.parse(raw) as {seed:number;history:{command:Command;digest:string}[]};
 const loaded=GameSession.fromArchive(raw);expect(loaded.capture()).toBe(raw);expect(loaded.view().status).toBe('won');expect(JSON.parse(raw).identity).toEqual(ALPHA5_IDENTITY);
 let s=new GameSession(gold.seed,'alpha5');const views=new Map([[0,s.view()]]);
 for(const [n,e] of gold.history.entries()){expect(s.submit(e.command).accepted).toBe(true);expect(s.fingerprint()).toBe(e.digest);if([27,214,291,383,459].includes(n+1))views.set(n+1,s.view());if(n===214){const before=s.capture();s=GameSession.fromArchive(before);expect(s.capture()).toBe(before);}}
 expect(s.capture()).toBe(raw);for(const at of [459,27,383,0,214,291])expect(loaded.replay(at)).toEqual(views.get(at));
 expect(gold.history.some(e=>e.command.startsWith('a5:jump:'))).toBe(true);expect(gold.history.some(e=>e.command.startsWith('a5:feature:'))).toBe(true);
});
it('five reproducible ecology branches arise only from the natural golden and public formal commands',()=>{
 const cases=ecologyCases5();expect(cases.map(c=>c.name).sort()).toEqual(['manual-barricade','manual-relay','manual-sporeBed','tool-coilKey','tool-sporeBell']);
 for(const c of cases){const s=GameSession.fromArchive(c.before);expect(s.submit(c.command).accepted).toBe(true);expect(s.capture()).toBe(c.after);expect(GameSession.fromArchive(c.after).capture()).toBe(c.after);}
});
