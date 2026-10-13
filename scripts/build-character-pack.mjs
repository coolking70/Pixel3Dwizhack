// Original project geometry. Deterministic authoring recipe; no downloaded mesh.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const body = [], armor = [], sword = [], mace = [];
const part = (list, bone, size, position, color, region = 'torso', rotation = [0,0,0], metal = 0) => list.push({bone,size,position,color,region,rotation,metal});
const b = (...args) => part(body,...args), a = (...args) => part(armor,...args);
b('Spine',[.52,.47,.34],[0,.16,0],0x354c69);
b('Chest',[.55,.25,.35],[0,.07,0],0x354c69);
b('Pelvis',[.46,.23,.33],[0,.14,0],0x27374c,'hips');
b('Head',[.21,.19,.24],[0,-.06,0],0xa97f5c,'head');
b('Head',[.42,.40,.39],[0,.19,0],0xccaa83,'head');
b('Head',[.44,.105,.41],[0,.43,-.012],0x252c36,'hair');
b('Head',[.20,.14,.09],[-.13,.35,.16],0x252c36,'hair',[0,0,-.18]);
b('Head',[.12,.06,.075],[0,.20,.224],0xdcb894,'head');
b('Head',[.25,.055,.025],[0,.07,.211],0x876346,'head');
for (const sign of [-1,1]) {
  b('Head',[.062,.037,.014],[sign*.10,.27,.20],0x202a34,'head');
  b('Head',[.058,.018,.022],[sign*.10,.31,.205],0x36313a,'head');
}
for(const side of ['L','R']) {
  b('UpperArm'+side,[.2,.29,.22],[0,.145,0],0x354c69,'upperArm'+side);
  b('Forearm'+side,[.17,.31,.19],[0,.155,0],0x9c7657,'arm'+side);
  b('Wrist'+side,[.18,.1,.18],[0,.05,0],0x364653,'arm'+side);
  b('Thigh'+side,[.235,.35,.26],[0,.17,0],0x27374c,'thigh'+side);
  b('Shin'+side,[.21,.23,.24],[0,.11,0],0x364653,'shin'+side);
  // Boot basis follows the source foot: local +Y points along the instep.
  b('Foot'+side,[.20,.17,.19],[0,.075,0],0x3b302a,'foot'+side);
  b('Foot'+side,[.25,.12,.37],[side==='L'?.2478703:-.2478703,.06,.055],0x3b302a,'foot'+side);
  body.at(-1).space='bind';
}
a('Chest',[.59,.50,.095],[0,-.075,.205],0x304e70);
a('Chest',[.59,.49,.095],[0,-.075,-.21],0x304e70);
a('Chest',[.51,.105,.43],[0,.19,0],0xc4a46e);
for(const sign of [-1,1]) {
  a('Chest',[.08,.48,.38],[sign*.27,-.07,0],0x425d79);
  for(let row=0;row<4;row++) for(const x of [-.2,0,.2]) a('Chest',[.025,.025,.027],[x,.075-row*.1,sign*.26],0xc4a46e,'torso',[0,0,0],.55);
  a('Pelvis',[.235,.33,.075],[sign*.145,-.04,.21],0x304e70,'hips',[0,0,sign*.10]);
  a('Pelvis',[.065,.30,.37],[sign*.29,-.035,0],0x425d79,'hips');
}
for(const side of ['L','R']) {
  for(let row=0;row<3;row++) a('UpperArm'+side,[.29-row*.018,.08,.32],[0,.03+row*.07,0],row===0?0xc4a46e:0x425d79,'upperArm'+side,[0,0,0],.25);
  a('Forearm'+side,[.22,.22,.26],[0,.17,0],0x657c89,'arm'+side,[0,0,0],.45);
}
part(sword,'GripR',[.07,.20,.075],[0,.08,0],0x463d32,'weapon');
part(sword,'GripR',[.12,.075,.10],[0,-.055,0],0xba9e67,'weapon',[0,0,0],.55);
part(sword,'GripR',[.34,.065,.09],[0,.22,0],0xba9e67,'weapon',[0,0,0],.55);
part(sword,'GripR',[.125,.63,.034],[0,.56,0],0xabc1c6,'weapon',[0,0,0],.65);
part(sword,'GripR',[.045,.63,.042],[0,.56,0],0xe1e3cc,'weapon',[0,0,0],.65);
part(sword,'GripR',[.095,.095,.034],[0,.90,0],0xabc1c6,'weapon',[0,0,Math.PI/4],.65);
part(mace,'GripR',[.075,.61,.075],[0,.3,0],0x5d4731,'weapon');
part(mace,'GripR',[.11,.08,.11],[0,-.04,0],0xba9e67,'weapon',[0,0,0],.55);
part(mace,'GripR',[.21,.23,.21],[0,.74,0],0x688590,'weapon',[0,0,0],.55);
for(const angle of [0,Math.PI/3,2*Math.PI/3]) part(mace,'GripR',[.36,.28,.055],[0,.74,0],0xb7cbcc,'weapon',[0,angle,0],.65);
const pack={version:1,id:'vanguard-1',rigId:'block-humanoid-kay-v1',source:{author:'Dungeon Descent project',license:'MIT',method:'Original box meshes; scripts/build-character-pack.mjs'},body,armor:{id:'brigandine',slot:'chest',masks:['torso','armL','armR'],parts:armor},weapons:[{id:'sword',grip:[0,.08,0],parts:sword},{id:'mace',grip:[0,.08,0],parts:mace}]};
const file='src/character-lab/models/vanguard.json', text=JSON.stringify(pack,null,2)+'\n';
if(process.argv.includes('--check')) {if(await readFile(file,'utf8')!==text)throw new Error('Character pack differs from its authoring recipe');}
else {await mkdir('src/character-lab/models',{recursive:true});await writeFile(file,text);}
console.log(`${file}: ${body.length} body, ${armor.length} armor, ${sword.length+mace.length} weapon parts`);
