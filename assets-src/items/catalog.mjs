// Production planning, never imported by game runtime. Not an appearance/effect lookup.
// SPDX-License-Identifier: MIT
const samples = new Set(['sword','knife','maul','shield','helm','renewal','insight','cinder','ration','lantern','emberRing','kit']);
const families = {
 potion: [['renewal','flattened flask'],['antidote','globular bottle'],['venom','long neck'],['slumber','twin handles'],['clarity','square bottle'],['ward','pointed foot'],['water','clay seal'],['acid','bone collar']],
 scroll: [['insight','short roll'],['release','long spindle'],['survey','double roll'],['temper','wax seal'],['shift','metal hoop'],['calling','cloth envelope']],
 wand: [['cinder','fork tip'],['rime','ring tip'],['arc','prism tip'],['mending','vine knot'],['latch','metal clamp']],
 weapon: [['sword','straight crossguard sword'],['knife','short broad blade and sheath'],['maul','double hammer head'],['spear','long shaft leaf point counterweight'],['bow','curved limbs string and grip'],['fireblade','notched thick blade charred guard'],['silverblade','curved narrow blade crescent guard'],['staff','long shaft star head cloth grip']],
 armor: [['brigandine','overlapping riveted scales'],['plate','heavy segmented breastplate'],['leather','wide organic collar'],['cap','soft cloth hood'],['helm','faceted dome narrow visor'],['boots','thick-rim split greaves'],['shield','round wood board and boss'],['tower','vertical tower with brace']],
 accessory: [['emberRing','broad ring bezel'],['hungerCharm','pierced pendant rope']],
 food: [['ration','cloth loaf and ties'],['fruit','lobed cave fruit'],['mushroom','fan cap with raised spots'],['meat','bone handle raw meat']],
 tool: [['pot','twin-handle marching pot'],['kit','open satchel and miniature hammer'],['lantern','framed stone lantern'],['salve','small jar cloth seal'],['sporeBell','flared bell loop and clapper'],['coilKey','open fork coil and side crank'],['rimeUrn','angular siphon jug long spout'],['silverCenser','pierced censer chain crown'],['vigilMirror','triangular prism cradle stem']]
};
const slots = { sword:'mainHand',knife:'mainHand',maul:'mainHand',spear:'mainHand',bow:'mainHand',fireblade:'mainHand',silverblade:'mainHand',staff:'mainHand',brigandine:'chest',plate:'chest',leather:'chest',cap:'head',helm:'head',boots:'legs',shield:'offHand',tower:'offHand',emberRing:'charm',hungerCharm:'charm' };
export const catalog = Object.entries(families).flatMap(([family,entries])=>entries.map(([definition,silhouettePlan])=>({definition,family,status:'geometry-produced',stage:['rimeUrn','silverCenser','vigilMirror'].includes(definition)?'m35-production':samples.has(definition)?'m16-sample':['sporeBell','coilKey'].includes(definition)?'m31-production':'m18-production',silhouettePlan,
  appearancePolicy:['potion','scroll','wand','accessory'].includes(family)?'public-category-ordinal-only; silhouette list is an unordered production pool, never an effect mapping':'public-fixed-definition',
  materialPlan:family==='food'?'matte organic and cloth':family==='potion'?'opaque faceted glass with non-effect colors':'wood/iron/brass/cloth shared palette',
  gripPlan:'metres +Y up; named grip socket, translation in manifest; no rule displacement',
  previewPlan:'same GLB; orthographic three-quarter; 48/64/96 px',groundPlan:'same GLB; bottom aligned to visible floor',
  ...(slots[definition]?{wornPlan:{slot:slots[definition],maskRegions:slots[definition]==='head'?['hair']:slots[definition]==='chest'?['torso']:slots[definition]==='legs'?['lowerLegs']:[],binding:'rigid or segmented geometry aligned to humanoid-v1; no new mechanical slot'}}:{})
})));
