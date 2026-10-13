// Original Fallen Star low-poly forms, authored for this project. SPDX-License-Identifier: MIT
// Metres, +Y up, +Z front. Parts are merged by material at export, no textures.
const iron = '#abb8bc', edge = '#dce5e2', wood = '#79513b', brass = '#c1a260', cloth = '#b89b71', dark = '#303b42';
const part = (shape, size, at, color, rotation = [0, 0, 0]) => ({ shape, size, at, color, rotation });
const box = (s,p,c,r) => part('box',s,p,c,r);
const cylinder = (s,p,c,r) => part('cylinder',s,p,c,r);
const sphere = (s,p,c,r) => part('sphere',s,p,c,r);
const torus = (s,p,c,r) => part('torus',s,p,c,r);
const base = (assetId, family, silhouetteTag, parts, extra = {}) => ({ assetId, family, silhouetteTag, parts, grip:[0,0,0], ...extra });
const hand = { socket:'rightGrip', gripPreset:'upright-y' };
export const recipes = [
 base('fixed-sword','weapon','straight-point-crossguard',[
  box([.07,.23,.08],[0,0,0],wood),sphere([.06,.06,.05],[0,-.15,0],brass),box([.30,.05,.09],[0,.15,0],brass),box([.13,.57,.045],[0,.46,0],iron),part('cone',[.092,.19,4],[0,.84,0],edge,[0,Math.PI/4,0]),box([.025,.52,.055],[0,.45,0],edge)],{hand}),
 base('fixed-knife','weapon','short-wide-asymmetric-blade',[
  box([.085,.22,.08],[0,0,0],wood),box([.21,.045,.10],[0,.13,0],iron),box([.15,.22,.035],[.025,.255,0],edge),part('cone',[.11,.19,3],[.025,.46,0],iron,[0,Math.PI/2,0]),box([.11,.34,.07],[.18,.10,-.07],dark,[0,0,-.18])],{hand}),
 base('fixed-maul','weapon','double-headed-hammer-counterweight',[
 cylinder([.045,.045,.78,8],[0,.24,0],wood),box([.10,.21,.10],[0,0,0],dark),box([.49,.25,.24],[0,.68,0],iron),box([.10,.31,.30],[-.27,.68,0],dark),box([.10,.31,.30],[.27,.68,0],dark),sphere([.075,.075,.075],[0,-.20,0],brass)],{hand}),
 base('fixed-shield','armor','round-board-rim-boss',[
 cylinder([.36,.36,.07,12],[0,0,0],wood,[Math.PI/2,0,0]),torus([.335,.03,12],[0,0,.055],iron),sphere([.105,.105,.07],[0,0,.10],iron),box([.47,.035,.02],[0,.13,.055],brass),box([.47,.035,.02],[0,-.13,.055],brass),box([.08,.28,.06],[0,0,-.09],dark)],{hand:{socket:'leftGrip',gripPreset:'board-z'},grip:[0,0,-.09],worn:{slot:'offHand',meshGroup:'whole',maskRegions:[]}}),
 base('fixed-helm','armor','faceted-dome-narrow-visor',[
 sphere([.24,.25,.22],[0,.12,0],iron),box([.49,.065,.44],[0,-.02,0],dark),box([.045,.23,.055],[0,.03,.225],brass),box([.055,.22,.23],[-.22,-.04,0],iron),box([.055,.22,.23],[.22,-.04,0],iron),box([.06,.05,.44],[0,.33,0],brass)],{worn:{slot:'head',meshGroup:'whole',maskRegions:['hair']}}),
 base('fixed-ration','food','cloth-wrapped-loaf-cross-ties',[
 box([.44,.24,.28],[0,.12,0],cloth,[0,0,.07]),box([.46,.035,.30],[0,.24,0],dark),box([.04,.28,.30],[0,.12,0],dark),sphere([.16,.10,.13],[.06,.27,0],wood),box([.17,.04,.06],[.04,.29,.04],cloth,[0,0,.35])]),
 base('fixed-lantern','tool','hanging-cage-stone-lantern',[
 box([.29,.055,.26],[0,0,0],dark),box([.29,.055,.26],[0,.43,0],brass),...[-1,1].flatMap(x=>[-1,1].map(z=>box([.025,.43,.025],[x*.125,.215,z*.11],brass))),part('cone',[.20,.12,4],[0,.515,0],dark,[0,Math.PI/4,0]),torus([.095,.017,10],[0,.64,0],brass),part('octahedron',[.14],[0,.22,0],'#c9e6b0')],{hand,grip:[0,.67,0]}),
 base('fixed-kit','tool','open-repair-satchel-and-small-hammer',[
 box([.48,.23,.24],[0,.12,0],wood),box([.48,.07,.26],[0,.32,-.075],cloth,[.8,0,0]),box([.07,.24,.265],[-.15,.12,0],dark),box([.07,.24,.265],[.15,.12,0],dark),cylinder([.024,.024,.40,6],[.04,.28,0],brass,[0,0,-.55]),box([.16,.075,.09],[.14,.44,0],iron),box([.08,.08,.025],[0,.18,.135],brass)],{hand,grip:[0,.28,0]})
];
const colors=['#abbdcc','#9dc7b5','#c3aad0','#cfc195','#95b6ca','#c79899','#adb986','#d0b090'];
// These ordinal appearance IDs are deliberately unrelated to potion effects.
for(let n=0;n<8;n++) {
 const forms=['flattened-flask','globular-bottle','long-neck','twin-handles','square-bottle','pointed-foot','clay-seal','bone-collar'];
 const body=n===4?box([.32,.30,.25],[0,.19,0],colors[n]):sphere([n===2?.12:.18,n===2?.24:.18,n===0?.08:.15],[0,.20,0],colors[n]);
 const parts=[body,cylinder([.058,.08,n===2?.23:.13,8],[0,n===2?.45:.39,0],iron),cylinder([.061,.061,.06,8],[0,n===2?.585:.49,0],wood)];
 if(n===0)parts.push(torus([.115,.018,8],[0,.20,.085],brass));
 if(n===3)for(const x of [-1,1])parts.push(torus([.075,.024,8],[x*.175,.28,0],brass));
 if(n===5)parts.push(part('cone',[.13,.20,6],[0,.035,0],brass,[Math.PI,0,0]));
 if(n===6)parts.push(sphere([.10,.07,.09],[0,.47,0],cloth));
 if(n===7)for(const x of [-1,1])parts.push(box([.045,.22,.045],[x*.145,.32,0],edge,[0,0,x*.3]));
 if(n===1)parts.push(torus([.15,.024,12],[0,.22,0],brass,[Math.PI/2,0,0]));
 recipes.push(base(`potion-${n}`,'potion',forms[n],parts,{hand,grip:[0,.39,0]}));
}
for(let n=0;n<6;n++) {
 const height=.29+(n%3)*.075;
 const radius=n===1?.065:.095;
 const parts=[cylinder([radius,radius,height,10],[0,height/2,0],cloth),cylinder([.035,.035,height+.08,8],[0,height/2,0],wood),box([radius*2+.01,.05,radius*2+.01],[0,height*.45,0],n===3?'#944e52':brass)];
 if(n===0)parts.push(box([.19,height*.75,.025],[.13,height*.5,-.015],cloth,[0,.25,0]));
 if(n===1)for(const y of [-.04,height+.04])parts.push(sphere([.066,.04,.066],[0,y,0],brass));
 if(n===2||n===5)parts.push(cylinder([.065,.065,height*.8,8],[.14,height*.4,0],cloth));
 if(n===3)parts.push(sphere([.06,.06,.025],[0,height*.45,.11],'#a44742'));
 if(n===4)parts.push(torus([.10,.028,10],[0,height*.8,0],dark,[Math.PI/2,0,0]));
 if(n===5)parts.push(box([.31,.16,.025],[.06,height*.5,.07],dark));
 parts.push({...box([.40,height,.008],[.20,height/2,0],cloth),group:'reading'},...Array.from({length:3},(_,line)=>({...box([.27,.012,.003],[.22,height*(line+1)/4,.006],wood),group:'reading'})));
 recipes.push(base(`scroll-${n}`,'scroll',['short-roll','long-spindle','double-roll','wax-seal','metal-hoop','cloth-envelope'][n],parts,{hand,grip:[0,height/2,0],groups:[{id:'whole',assembly:[0,0,0]},{id:'reading',name:'ReadingSheet',assembly:[0,0,.10],initialScale:[.001,1,1]}]}));
}
for(let n=0;n<5;n++) {
 const parts=[cylinder([.032,.045,.65,7],[0,.22,0],wood),box([.085,.16,.08],[0,0,0],cloth)];
 if(n===0)parts.push(box([.055,.27,.055],[-.08,.60,0],brass,[0,0,-.5]),box([.055,.27,.055],[.08,.60,0],brass,[0,0,.5]));
 if(n===1)parts.push(torus([.12,.03,10],[0,.64,0],brass));
 if(n===2)parts.push(part('octahedron',[.14],[0,.66,0],'#bac6c4'));
 if(n===3)parts.push(torus([.09,.035,7],[.035,.60,0],wood,[0,.6,.3]),sphere([.06,.06,.06],[-.07,.70,0],brass));
 if(n===4)parts.push(box([.22,.045,.10],[0,.72,0],iron),box([.045,.19,.10],[-.09,.62,0],iron),box([.045,.19,.10],[.09,.62,0],iron));
 recipes.push(base(`wand-${n}`,'wand',['fork-tip','ring-tip','prism-tip','vine-knot','metal-clamp'][n],parts,{hand,muzzle:[0,.78,0]}));
}
recipes.push(base('accessory-0','accessory','broad-ring-raised-bezel',[torus([.12,.038,12],[0,.16,0],brass),box([.14,.10,.10],[0,.30,0],iron),part('octahedron',[.065],[0,.36,0],'#bec7ba')],{worn:{slot:'charm',meshGroup:'whole',maskRegions:[]}}));
recipes.push(base('accessory-1','accessory','pierced-pendant-and-rope',[torus([.17,.015,12],[0,.29,0],wood),part('octahedron',[.13],[0,.06,0],brass),torus([.04,.018,8],[0,.14,.03],dark)],{worn:{slot:'charm',meshGroup:'whole',maskRegions:[]}}));

// M18 fixed silhouettes. Optional ornaments explicitly declare the last LOD
// that retains them; structural pieces and all sockets survive every level.
const fine = (p,lastLOD=0) => ({...p,lastLOD});
const beam = (a,b,width,depth,color) => box([width,Math.hypot(b[0]-a[0],b[1]-a[1]),depth],[(a[0]+b[0])/2,(a[1]+b[1])/2,0],color,[0,0,Math.atan2(a[0]-b[0],b[1]-a[1])]);
recipes.push(base('fixed-spear','weapon','long-shaft-leaf-head-butt-cap',[
 cylinder([.03,.037,1.34,8],[0,.28,0],wood),box([.075,.22,.075],[0,0,0],cloth),part('cone',[.13,.38,4],[0,1.13,0],edge,[0,Math.PI/4,0]),cylinder([.055,.045,.09,8],[0,.925,0],iron),part('cone',[.065,.16,6],[0,-.47,0],iron,[Math.PI,0,0]),fine(torus([.051,.012,8],[0,.85,0],brass,[Math.PI/2,0,0]))],{hand,muzzle:[0,1.32,0]}));
const bowPoints=[[-.11,-.70],[.11,-.52],[.21,-.25],[.19,0],[.21,.25],[.11,.52],[-.11,.70]];
recipes.push(base('fixed-bow','weapon','recurved-bow-visible-string-and-limb-caps',[
 ...bowPoints.slice(1).map((p,n)=>beam(bowPoints[n],p,.055,.07,wood)),beam(bowPoints[0],bowPoints.at(-1),.012,.014,cloth),box([.09,.20,.11],[.18,0,0],dark),...[-1,1].map(s=>fine(box([.075,.10,.08],[-.08,s*.65,0],brass,[0,0,s*.65]),1)),fine(cylinder([.025,.025,.48,6],[.26,.15,0],iron),0)],{hand,grip:[.18,0,0],muzzle:[-.11,0,0]}));
recipes.push(base('fixed-fireblade','weapon','notched-broad-blade-charcoal-cage-guard',[
 box([.085,.23,.09],[0,0,0],dark),box([.28,.08,.13],[0,.16,0],dark),box([.18,.45,.055],[0,.43,0],iron),box([.14,.18,.055],[.035,.735,0],iron),part('cone',[.10,.20,3],[.018,.91,0],edge,[0,Math.PI/2,0]),...[-1,1].map(s=>box([.05,.16,.11],[s*.13,.22,0],dark,[0,0,s*.4])),...Array.from({length:3},(_,n)=>fine(box([.19,.018,.065],[0,.28+n*.13,0],brass),n===1?1:0)),sphere([.07,.06,.06],[0,-.16,0],iron)],{hand,muzzle:[.02,1.01,0]}));
const silverPoints=[[0,.17],[.045,.38],[.13,.61],[.20,.78]];
recipes.push(base('fixed-silverblade','weapon','curved-slim-blade-open-crescent-guard',[
 box([.06,.22,.07],[0,0,0],cloth),...silverPoints.slice(1).map((p,n)=>beam(silverPoints[n],p,.07,.035,edge)),part('cone',[.055,.16,3],[.225,.84,0],edge,[0,Math.PI/2,-.3]),torus([.115,.023,10],[.065,.15,0],iron,[0,0,.3]),fine(torus([.08,.013,10],[-.09,.11,0],brass)),sphere([.045,.06,.045],[0,-.15,0],brass)],{hand,muzzle:[.25,.92,0]}));
recipes.push(base('fixed-staff','weapon','long-wrapped-shaft-five-point-star-head',[
 cylinder([.034,.05,1.24,8],[0,.33,0],wood),box([.09,.24,.08],[0,0,0],cloth),part('octahedron',[.09],[0,1.05,0],brass),...Array.from({length:5},(_,n)=>{const a=n*Math.PI*2/5;return part('cone',[.055,.19,4],[Math.sin(a)*.13,1.05+Math.cos(a)*.13,0],brass,[0,0,-a]);}),fine(torus([.066,.016,10],[0,.82,0],iron,[Math.PI/2,0,0]))],{hand,muzzle:[0,1.28,0]}));

// Piece geometry is bone-local. Assembly positions make the same pieces a
// coherent floor/thumbnail model; bindings replace those transforms when worn.
const group = (id,bone,assembly,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]) => ({id,bone,assembly,position,rotation,scale});
function clothing(id,tag,slot,groups,parts,masks) {
 return base(`fixed-${id}`,'armor',tag,parts,{groups,worn:{slot,meshGroup:'pieces',maskRegions:masks,bindings:groups.map(g=>({node:`piece_${g.id}`,bone:g.bone,position:g.position,rotation:g.rotation,scale:g.scale}))}});
}
const piece = (name,parts)=>parts.map(p=>({...p,group:name}));
const torsoGroups=[group('torso','Chest',[0,.76,0]),group('armL','UpperArmL',[.43,.68,0]),group('armR','UpperArmR',[-.43,.68,0]),group('waist','Pelvis',[0,.25,0])];
const collar=(color)=>[-1,1].map(s=>box([.20,.11,.43],[s*.19,.18,0],color,[0,0,s*.15]));
recipes.push(clothing('brigandine','riveted-overlapping-scale-jacket','chest',torsoGroups,[
 ...piece('torso',[box([.56,.52,.42],[0,-.08,0],dark),
  ...[-1,1].flatMap(z=>Array.from({length:16},(_,n)=>box([.14,.15,.055],[(n%4-1.5)*.145,-.28+Math.floor(n/4)*.135,z*.235],Math.floor(n/4)%2?iron:'#788b91',[Math.floor(n/4)*.015,0,0]))),
  ...Array.from({length:12},(_,n)=>fine(sphere([.018,.018,.014],[(n%3-1)*.18,-.28+Math.floor(n/3)*.135,.271],brass))),...collar(iron)]),
 ...['L','R'].flatMap(side=>piece(`arm${side}`,[box([.28,.20,.33],[0,.08,0],iron),fine(box([.31,.055,.35],[0,.02,0],brass),1)])),
 ...piece('waist',[-1,1].map(s=>box([.23,.24,.39],[s*.15,.02,0],dark)))
],['torso']));
recipes.push(clothing('plate','heavy-layered-breastplate-ridge-and-pauldrons','chest',torsoGroups,[
 ...piece('torso',[box([.62,.43,.44],[0,-.035,0],iron),box([.16,.44,.12],[0,-.04,.25],edge),...Array.from({length:3},(_,i)=>box([.58-i*.05,.10,.43],[0,-.29-i*.075,.01],i%2?dark:iron)),...collar(edge),...[-1,1].map(s=>fine(box([.045,.32,.04],[s*.23,-.02,.247],brass),1))]),
 ...['L','R'].flatMap(side=>piece(`arm${side}`,[box([.34,.19,.39],[0,.055,0],iron),box([.29,.11,.33],[0,.20,0],dark),fine(box([.365,.045,.415],[0,-.015,0],edge),0)])),
 ...piece('waist',[-1,1].map(s=>box([.24,.31,.10],[s*.145,-.025,.245],iron)))
],['torso']));
recipes.push(clothing('leather','fungal-hide-wide-folded-collar-and-overlap','chest',torsoGroups,[
 ...piece('torso',[box([.58,.54,.43],[0,-.08,0],'#716947'),...[-1,1].map(s=>box([.27,.20,.12],[s*.20,.10,.22],cloth,[0,0,s*.55])),box([.08,.48,.035],[.12,-.08,.235],wood),fine(sphere([.04,.035,.02],[.13,.02,.26],brass)),fine(sphere([.04,.035,.02],[.13,-.19,.26],brass),1)]),
 ...['L','R'].flatMap(side=>piece(`arm${side}`,[box([.25,.19,.29],[0,.08,0],'#716947')])),
 ...piece('waist',[-1,1].map(s=>box([.27,.29,.11],[s*.14,-.02,.19],wood,[0,0,s*.08])))
],['torso']));
recipes.push(clothing('cap','cloth-hood-pointed-crown-and-folded-neck','head',[group('hood','Head',[0,.12,0],[0,.30,-.025])],piece('hood',[
 sphere([.26,.25,.245],[0,.12,-.025],'#66736b'),part('cone',[.19,.20,5],[0,.36,-.03],'#66736b'),box([.50,.09,.07],[0,.10,.20],cloth),...[-1,1].map(s=>box([.075,.24,.29],[s*.23,-.015,-.005],'#66736b')),fine(box([.032,.22,.028],[.22,-.08,.16],brass),1),fine(box([.032,.22,.028],[-.22,-.08,.16],brass),0)
]),['hair']));
recipes.push(clothing('boots','paired-flared-rime-greaves-with-toe-plates','legs',[group('shinL','ShinL',[.18,.18,0]),group('shinR','ShinR',[-.18,.18,0])],[
 ...['L','R'].flatMap(side=>piece(`shin${side}`,[box([.27,.28,.30],[0,.10,0],iron),box([.31,.09,.36],[0,-.055,.025],dark),box([.30,.12,.43],[0,-.12,.055],wood),fine(box([.09,.27,.055],[0,.12,.17],edge),1),fine(box([.31,.035,.34],[0,.24,0],brass),0),fine(sphere([.025,.025,.02],[.09,.14,.16],brass),0)]))
],['shinL','shinR']));
recipes.push(base('fixed-tower','armor','tall-tapered-tower-shield-with-spine',[
 box([.48,.95,.075],[0,.08,0],wood),part('cone',[.25,.27,4],[0,-.52,0],wood,[Math.PI,Math.PI/4,0]),box([.075,1.0,.10],[0,.08,.075],iron),...[-1,1].map(s=>box([.045,.98,.07],[s*.25,.08,.035],iron)),box([.55,.055,.075],[0,.57,.035],edge),box([.11,.27,.07],[0,0,-.09],dark),...[-1,1].map(s=>fine(box([.43,.035,.05],[0,s*.27,.055],brass),s===1?1:0))],{hand:{socket:'leftGrip',gripPreset:'board-z'},grip:[0,0,-.09],worn:{slot:'offHand',meshGroup:'whole',maskRegions:[]}}));
recipes.push(base('fixed-fruit','food','five-lobed-cave-fruit-with-stem',[
 ...Array.from({length:5},(_,n)=>{const a=n*Math.PI*2/5;return sphere([.10,.14,.10],[Math.cos(a)*.09,.15,Math.sin(a)*.09],'#b88a70');}),cylinder([.021,.028,.11,6],[0,.32,0],wood),fine(box([.12,.025,.055],[.06,.32,0],'#8e9d68',[0,0,.30]),1)]));
recipes.push(base('fixed-mushroom','food','broad-fan-cap-radial-gills-and-spots',[
 cylinder([.07,.10,.25,8],[0,.12,0],cloth),sphere([.31,.11,.20],[0,.29,0],'#886c87'),...[-1,0,1].map(n=>fine(sphere([.045,.02,.035],[n*.14,.39,0],edge),Math.abs(n)===1?0:1)),...[-1,0,1].map(n=>box([.028,.02,.25],[n*.095,.24,0],dark,[0,n*.35,0]))]));
recipes.push(base('fixed-meat','food','bone-handle-and-asymmetric-haunch',[
 sphere([.22,.16,.15],[.065,.23,0],'#ac716b'),sphere([.15,.14,.14],[-.07,.16,0],'#ac716b'),cylinder([.032,.036,.29,7],[-.09,.035,0],edge,[0,0,-.4]),sphere([.045,.038,.038],[-.17,-.095,0],edge),sphere([.045,.038,.038],[-.10,-.12,0],edge),fine(box([.16,.045,.035],[.02,.34,.06],cloth,[0,0,-.25]),1)]));
recipes.push(base('fixed-pot','tool','open-twin-handle-cauldron-and-three-feet',[
 cylinder([.26,.19,.25,12],[0,.20,0],dark),cylinder([.22,.22,.009,12],[0,.329,0],'#151e23'),torus([.26,.026,12],[0,.33,0],iron,[Math.PI/2,0,0]),...[-1,1].map(s=>torus([.09,.025,10],[s*.30,.25,0],iron)),...Array.from({length:3},(_,n)=>{const a=n*Math.PI*2/3;return box([.045,.10,.045],[Math.sin(a)*.16,.045,Math.cos(a)*.16],iron);}),fine(box([.10,.04,.015],[0,.20,.26],brass),1)],{hand,grip:[.30,.32,0]}));
recipes.push(base('fixed-salve','tool','low-medicine-jar-with-crossed-cloth-seal',[
 cylinder([.14,.16,.18,10],[0,.105,0],'#988e71'),cylinder([.155,.14,.07,10],[0,.23,0],cloth),box([.07,.02,.30],[0,.275,0],dark),box([.30,.02,.065],[0,.277,0],dark),...[-1,1].map(s=>fine(box([.055,.12,.026],[s*.13,.20,0],cloth,[0,0,s*.35]),s===1?1:0))],{hand,grip:[0,.15,0]}));

// Back-compatible whole-object bindings and tip/socket metadata.
for (const r of recipes) {
 if(r.assetId==='fixed-knife')r.parts.push(fine(box([.025,.18,.045],[.05,.255,.016],brass),0),fine(box([.12,.035,.08],[.18,.16,-.07],brass),1));
 if(r.family==='weapon'&&!r.muzzle)r.muzzle=[0,r.assetId==='fixed-maul'?.81:r.assetId==='fixed-knife'?.56:.935,0];
 if(r.assetId==='fixed-helm')r.worn.bindings=[{node:'piece_whole',bone:'Head',position:[0,.31,0],rotation:[0,0,0],scale:[1,1,1]}];
 if(r.family==='accessory')r.worn.bindings=[{node:'piece_whole',bone:'Chest',position:[0,.05,.30],rotation:[0,0,0],scale:[.6,.6,.6]}];
 if(r.family==='potion')r.contact=[0,r.assetId==='potion-2'?.615:.52,0];
 if(r.family==='scroll'){const n=Number(r.assetId.split('-')[1]),height=.29+(n%3)*.075;r.grip=[0,-.04,0];r.supportGrip=[0,height+.04,0];}
 const foodContact={'fixed-ration':[0,.26,.11],'fixed-fruit':[.13,.16,.04],'fixed-mushroom':[.10,.32,.10],'fixed-meat':[.08,.26,.10]};
 if(foodContact[r.assetId])r.contact=foodContact[r.assetId];
 const toolContact={'fixed-kit':[.14,.4775,0],'fixed-salve':[0,.287,0],'fixed-pot':[0,.356,0],'fixed-lantern':[0,.22,.11]};
 if(toolContact[r.assetId])r.contact=toolContact[r.assetId];
 if(r.family==='food') {
  const patches={'fixed-ration':[[.08,.30,.10],[-.11,.25,.13],[.16,.17,.145]],'fixed-fruit':[[.10,.20,.15],[-.09,.13,.16],[.025,.27,.12]],'fixed-mushroom':[[.12,.37,.07],[-.13,.37,.05],[.02,.39,-.06]],'fixed-meat':[[.09,.25,.145],[-.055,.18,.145],[.14,.31,.11]]}[r.assetId];
  r.groups=[{id:'whole',assembly:[0,0,0]},{id:'freshness',name:'FreshnessOverlay',assembly:[0,0,0],initialScale:[0,0,0]}];
  r.parts.push(...patches.map((at,n)=>({...sphere([.062,.035,.024],at,n===1?'#6d563b':'#657e42',r.assetId==='fixed-mushroom'?[Math.PI/2,0,0]:[0,0,0]),group:'freshness'})));
 }
}

// M31 original tools; public identities only, no BUC/charge-dependent geometry.
recipes.push(base('fixed-sporeBell','tool','flared-hollow-bell-loop-handle-and-clapper',[
 cylinder([.08,.24,.30,12],[0,.22,0],brass),torus([.24,.025,12],[0,.065,0],iron,[Math.PI/2,0,0]),
 cylinder([.022,.022,.24,8],[0,.12,0],dark),sphere([.065,.065,.065],[0,0,0],iron),
 torus([.09,.026,12],[0,.48,0],wood),fine(box([.04,.20,.035],[.13,.20,.12],edge),1),fine(sphere([.022,.022,.022],[0,.33,.11],edge))
],{hand,grip:[0,.48,0],contact:[0,0,0]}));
recipes.push(base('fixed-coilKey','tool','open-tuning-fork-copper-coil-and-side-crank',[
 box([.12,.32,.12],[0,.02,0],wood),box([.36,.09,.12],[0,.22,0],iron),
 ...[-1,1].map(s=>box([.07,.34,.09],[s*.15,.40,0],iron)),
 ...Array.from({length:4},(_,i)=>torus([.084,.014,10],[0,-.09+i*.066,0],brass,[Math.PI/2,0,0])),
 box([.17,.04,.05],[.12,-.11,0],dark),cylinder([.03,.03,.12,8],[.20,-.06,0],wood),
 fine(box([.03,.25,.03],[-.15,.40,.065],brass),1),fine(sphere([.035,.035,.035],[.15,.56,0],edge))
],{hand,grip:[0,.02,0],contact:[0,.56,0]}));

// M35 original silhouettes. Charges and BUC never change meshes.
recipes.push(base('fixed-rimeUrn','tool','angular-siphon-jug-long-spout-open-handle',[
 cylinder([.15,.22,.32,6],[0,.20,0],edge),box([.16,.08,.14],[0,.40,0],dark),
 cylinder([.055,.08,.36,6],[.23,.29,0],iron,[0,0,-.95]),torus([.15,.03,10],[-.22,.26,0],dark),
 fine(box([.04,.22,.04],[0,.20,.20],brass),1),fine(sphere([.03,.03,.03],[0,.32,.18],brass),0)
],{hand,grip:[-.22,.31,0],contact:[.39,.40,0]}));
recipes.push(base('fixed-silverCenser','tool','pierced-censer-tripod-chain-crown',[
 cylinder([.20,.12,.23,10],[0,.20,0],iron),part('cone',[.22,.20,8],[0,.41,0],dark),
 ...[-1,1].map(x=>box([.025,.30,.025],[x*.14,.48,0],brass)),torus([.08,.024,10],[0,.67,0],iron),
 ...[-1,0,1].map(x=>box([.045,.07,.028],[x*.10,.25,.18],dark)),
 fine(torus([.18,.02,12],[0,.31,0],brass,[Math.PI/2,0,0]),1),fine(sphere([.025,.025,.025],[0,.51,0],edge),0)
],{hand,grip:[0,.67,0],muzzle:[0,.49,0],contact:[0,.49,0]}));
recipes.push(base('fixed-vigilMirror','tool','triangular-prism-cradle-stem-and-three-ribs',[
 cylinder([.04,.055,.32,6],[0,0,0],wood),part('cone',[.23,.38,3],[0,.32,0],'#9eb9bb',[0,Math.PI/2,0]),
 ...[-1,1].map(x=>box([.035,.41,.055],[x*.14,.28,.09],iron,[0,0,-x*.35])),box([.34,.05,.12],[0,.10,0],brass),
 fine(box([.02,.24,.03],[0,.31,.15],edge),1),fine(sphere([.035,.035,.035],[0,.55,0],brass),0)
],{hand,grip:[0,0,0],contact:[0,.50,0]}));
