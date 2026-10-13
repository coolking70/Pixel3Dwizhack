import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ALPHA4_IDENTITY, GameSession } from '../src/session/session';
import type { Command, PublicView } from '../src/core/types';

describe('natural Alpha 4 victory',()=>{
let raw:string,golden:{identity:typeof ALPHA4_IDENTITY;seed:number;history:{command:Command;digest:string}[]},session:GameSession,restored:GameSession,views:PublicView[],prefix='';
beforeAll(()=>{
 raw=readFileSync('tests/fixtures/alpha4-v1.json','utf8');golden=JSON.parse(raw);session=new GameSession(golden.seed,'alpha4');restored=GameSession.fromArchive(raw);views=[session.view()];
});
it('reproduces all 425 formal command digests including the new throw',()=>{
 expect(golden.identity).toEqual(ALPHA4_IDENTITY);expect(golden.history).toHaveLength(425);
 expect(golden.history.some(e=>e.command.startsWith('a3:throw:'))).toBe(true);
 for(const [index,entry] of golden.history.entries()){
  expect(session.submit(entry.command).accepted,`command ${index+1}`).toBe(true);expect(session.fingerprint(),`digest ${index+1}`).toBe(entry.digest);
  views.push(session.view());if(index===79)prefix=session.capture();
 }
 expect(session.view().status).toBe('won');expect(session.fingerprint()).toBe('394a5ba3');expect(JSON.parse(session.capture())).toEqual(JSON.parse(raw));
});
// Preserve every replay-boundary assertion, but bound each case to one 32-step checkpoint interval.
it.each(Array.from({length:14},(_,i)=>i))('replays every boundary in checkpoint interval %i',chunk=>{for(let at=chunk*32;at<Math.min(views.length,(chunk+1)*32);at++)expect(restored.replay(at)).toEqual(views[at]);});
it.each([425,1,200,30,0,424])('seeks non-monotonically to %i',at=>expect(restored.replay(at)).toEqual(views[at]));
it('continues a restored command prefix to the identical final archive',()=>{
 const branch=GameSession.fromArchive(prefix);for(const entry of golden.history.slice(80)){expect(branch.submit(entry.command).accepted).toBe(true);expect(branch.fingerprint()).toBe(entry.digest);}
 expect(branch.capture()).toBe(session.capture());
});

});
