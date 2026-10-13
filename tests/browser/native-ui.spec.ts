import {test,expect,type Page} from '@playwright/test';
type Region={id:string;x:number;y:number;width:number;height:number};
async function region(page:Page,id:string){const canvas=page.locator('canvas[data-ui=native]');const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as Region[];const r=regions.find(r=>r.id===id);expect(r,`canvas region ${id}`).toBeTruthy();const box=(await canvas.boundingBox())!;return{x:box.x+r!.x+r!.width/2,y:box.y+r!.y+r!.height/2};}
async function click(page:Page,id:string,touch=false){const p=await region(page,id);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
async function start(page:Page){await page.goto('/alpha2.html?ui=buttons');await expect(page.locator('canvas[data-ui=native]')).toHaveAttribute('data-panel','newRun');await click(page,'start');await expect(page.locator('canvas[data-ui=native]')).toHaveAttribute('data-panel','world');}
for(const [width,height] of [[390,844],[844,390],[1440,900]])test(`native inventory fits ${width}x${height} and isolates navigation`,async({page})=>{
 await page.setViewportSize({width:width!,height:height!});await start(page);const canvas=page.locator('canvas[data-ui=native]'),tick=await canvas.getAttribute('data-tick');await click(page,'bag');await expect(canvas).toHaveAttribute('data-panel','bag');await expect(page.locator('dialog')).not.toBeVisible();
 const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as Region[];expect(regions.filter(r=>r.id.startsWith('item:'))).toHaveLength(16);expect(regions.filter(r=>r.id.startsWith('slot:'))).toHaveLength(6);for(const r of regions){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width!);expect(r.y+r.height).toBeLessThanOrEqual(height!);}
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');await page.keyboard.press('a');await expect(canvas).toHaveAttribute('data-tick',tick!);await page.keyboard.press('Escape');await expect(canvas).toHaveAttribute('data-panel','world');await expect(canvas).toHaveAttribute('data-tick',tick!);
});
test('native pointer and touch equipment commands match legacy session capture',async({page,isMobile})=>{
 await start(page);const canvas=page.locator('canvas[data-ui=native]');await click(page,'bag',isMobile);await click(page,'slot:mainHand',isMobile);await click(page,'action:unequip',isMobile);await expect(canvas).toHaveAttribute('data-tick','8');await expect(canvas).toHaveAttribute('data-panel','action');await expect(canvas).toHaveAttribute('data-busy','false');await expect(canvas).toHaveAttribute('data-panel','bag');await click(page,'action:equip',isMobile);await expect(canvas).toHaveAttribute('data-tick','16');await page.waitForTimeout(1300);await click(page,'close',isMobile);await click(page,'save',isMobile);const native=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'));
 await page.goto('/alpha2.html?ui=legacy');await page.getByRole('button',{name:'进入地牢',exact:true}).click();await page.getByRole('button',{name:/背包.*\//}).click();const mainId=await page.locator('.bag-item').filter({hasText:'主手'}).first().getAttribute('data-item');const main=page.locator(`[data-item="${mainId}"]`);await main.getByRole('button',{name:'卸下 · 8',exact:true}).click();await page.waitForTimeout(1300);await main.getByRole('button',{name:/穿戴/}).click();await page.waitForTimeout(1300);await page.getByRole('button',{name:'返回冒险',exact:true}).click();await page.getByRole('button',{name:'保存',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(native);
});
test('native keyboard equips, cancels use, and touch long press only inspects',async({page,isMobile})=>{
 await start(page);const canvas=page.locator('canvas[data-ui=native]');await canvas.focus();await page.keyboard.press('b');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(canvas).toHaveAttribute('data-tick','8');await expect(canvas).toHaveAttribute('data-busy','false');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(canvas).toHaveAttribute('data-tick','16');await expect(canvas).toHaveAttribute('data-busy','false');
 const itemRegions=JSON.parse((await canvas.getAttribute('data-regions'))!) as (Region&{label:string})[];const food=itemRegions.find(r=>r.id.startsWith('item:')&&r.label.includes('干粮'));expect(food).toBeTruthy();
 await click(page,food!.id,isMobile);await click(page,'action:eat',isMobile);await click(page,'cancel',isMobile);await expect(canvas).toHaveAttribute('data-tick','16');
 if(isMobile){const p=await region(page,food!.id),client=await page.context().newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await page.waitForTimeout(550);await expect(canvas).toHaveAttribute('data-panel','detail');await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();await expect(canvas).toHaveAttribute('data-tick','16');await page.keyboard.press('Escape');await expect(canvas).toHaveAttribute('data-panel','bag');}
 await page.keyboard.press('Escape');await expect(canvas).toHaveAttribute('data-panel','world');await expect(canvas).toHaveAttribute('data-tick','16');
});
test('same-page resize recreates native texture without framebuffer ghosts',async({page})=>{
 await page.setViewportSize({width:844,height:390});await start(page);await click(page,'bag');await page.mouse.move(1,1);const canvas=page.locator('canvas[data-ui=native]');await expect(canvas).toHaveAttribute('data-ui-assets-pending','0');await page.waitForTimeout(300);const before=await canvas.screenshot();
 for(const size of [{width:390,height:844},{width:1440,height:900},{width:844,height:390}]){await page.setViewportSize(size);await expect(canvas).toHaveAttribute('data-panel','bag');await page.waitForTimeout(150);}
 const after=await canvas.screenshot();expect(after.equals(before),'native canvas pixels must reproduce after a viewport round trip').toBe(true);
});
test('closing inventory invalidates a pressed action and pending touch long press',async({page,isMobile})=>{
 await start(page);const canvas=page.locator('canvas[data-ui=native]'),tick=await canvas.getAttribute('data-tick'),revision=await canvas.getAttribute('data-revision');await click(page,'save');const before=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'));
 await click(page,'bag',isMobile);const items=JSON.parse((await canvas.getAttribute('data-regions'))!) as (Region&{label:string})[],food=items.find(r=>r.id.startsWith('item:')&&r.label.includes('干粮'));expect(food).toBeTruthy();await click(page,food!.id,isMobile);const p=await region(page,'action:drop');
 if(isMobile){const client=await page.context().newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await page.keyboard.press('Escape');await page.waitForTimeout(550);await expect(canvas).toHaveAttribute('data-tick',tick!);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();}
 else{await page.mouse.move(p.x,p.y);await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up();}
 await expect(canvas).toHaveAttribute('data-panel','world');await expect(canvas).toHaveAttribute('data-tick',tick!);await expect(canvas).toHaveAttribute('data-revision',revision!);await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(before);
});
test('native movement hold survives its own revision updates and stops on release',async({page,isMobile})=>{
 await start(page);const canvas=page.locator('canvas[data-ui=native]'),revision=Number(await canvas.getAttribute('data-revision')),p=await region(page,'command:right');
 const client=isMobile?await page.context().newCDPSession(page):undefined;
 if(client)await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});else{await page.mouse.move(p.x,p.y);await page.mouse.down();}
 await expect.poll(async()=>Number(await canvas.getAttribute('data-revision'))).toBeGreaterThan(revision+1);
 if(client){await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();}else await page.mouse.up();
 await expect(canvas).toHaveAttribute('data-busy','false');const tick=await canvas.getAttribute('data-tick');await page.waitForTimeout(600);await expect(canvas).toHaveAttribute('data-tick',tick!);
});

test('world HUD and native menus are reachable with Tab and Enter without rule time',async({page})=>{
 await start(page);const canvas=page.locator('canvas[data-ui=native]');await click(page,'save');const before=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'));await canvas.focus();
 // Save has focus after the snapshot, so cycle the real HUD to its next menu button.
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(canvas).toHaveAttribute('data-panel','menu');
 const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as Region[],at=regions.findIndex(r=>r.id==='open:storage');expect(at).toBeGreaterThanOrEqual(0);for(let i=0;i<=at;i++)await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(canvas).toHaveAttribute('data-panel','storage');
 await page.keyboard.press('Escape');await expect(canvas).toHaveAttribute('data-panel','world');await expect(canvas).toHaveAttribute('data-tick','0');await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(before);
});

test('world Space remains attack when the pointer hovers the save button',async({page})=>{
 await start(page);const canvas=page.locator('canvas[data-ui=native]');await canvas.focus();await page.mouse.move(2,200);await page.keyboard.press('Space');await expect(canvas).toHaveAttribute('data-tick','10');await expect(canvas).toHaveAttribute('data-busy','false');await click(page,'save');const expected=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'));
 await start(page);await canvas.focus();const p=await region(page,'save');await page.mouse.move(p.x,p.y);await page.keyboard.press('Space');await expect(canvas).toHaveAttribute('data-panel','world');await expect(canvas).toHaveAttribute('data-tick','10');await expect(canvas).toHaveAttribute('data-busy','false');await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(expected);
});

test('touch long press on drop never commits before release or after drag cancellation',async({page})=>{
 await page.setViewportSize({width:844,height:390});await start(page);const canvas=page.locator('canvas[data-ui=native]');await click(page,'save');const before=await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15')),revision=await canvas.getAttribute('data-revision');await click(page,'bag');
 const regions=JSON.parse((await canvas.getAttribute('data-regions'))!) as (Region&{label:string})[],food=regions.find(r=>r.id.startsWith('item:')&&r.label.includes('干粮'));expect(food).toBeTruthy();await click(page,food!.id);const p=await region(page,'action:drop'),client=await page.context().newCDPSession(page);
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await page.waitForTimeout(550);await expect(canvas).toHaveAttribute('data-tick','0');await expect(canvas).toHaveAttribute('data-revision',revision!);await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:2,y:2}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await client.detach();await expect(canvas).toHaveAttribute('data-tick','0');await expect(canvas).toHaveAttribute('data-revision',revision!);await page.keyboard.press('Escape');await click(page,'save');expect(await page.evaluate(()=>localStorage.getItem('dungeon-descent.m15'))).toBe(before);
});




