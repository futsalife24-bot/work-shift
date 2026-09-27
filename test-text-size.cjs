const {chromium}=require('playwright');
const assert=require('assert'),path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve('勤務表ツール.html').replaceAll('\\','/'));
 await page.evaluate(()=>{loadDemo();state.staff[0].name='長い名前の確認用メンバー';save();renderAll();});
 const metrics=[];
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:900});
  for(const size of ['small','standard','large']){
   const before=await page.evaluate(()=>JSON.stringify(state));
   await page.selectOption('#textSize',size);
   await page.waitForTimeout(80);
   assert(await page.evaluate(b=>JSON.stringify(state)===b,before),'size switch changed work data');
   metrics.push({width,size,font:await page.locator('#creationGuide h2').evaluate(e=>getComputedStyle(e).fontSize)});
   for(const tab of ['sched','pre','review','staff','conf']){
    await page.click(`[data-page="${tab}"]`);await page.evaluate(()=>scrollTo(0,0));
    const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert(overflow.scroll<=width+1,`${width}/${size}/${tab}: ${JSON.stringify(overflow)}`);
    assert(await page.locator('#textSize').isVisible());
    if(tab==='pre'){await page.selectOption('#preMode','day');await page.selectOption('#preMode','person');}
    if(tab==='review'){await page.click('#reviewDay');await page.click('#reviewPerson');}
   }
   if(width>=900){const r=await page.evaluate(()=>({bar:document.querySelector('#topbar').getBoundingClientRect().bottom,nav:document.querySelector('#tabs').getBoundingClientRect().top}));assert(r.nav>=r.bar-1);}
   await page.click('[data-page="sched"]');await page.evaluate(()=>selectCell(sortedStaff()[0].id,ui.curStart));
   const pal=await page.locator('#palette').evaluate(e=>({w:e.scrollWidth,c:e.clientWidth,h:e.clientHeight}));assert(pal.w<=pal.c+1);assert(pal.h<=675);
   await page.click('#palClose');
   if(width===390){await page.click('[data-page="pre"]');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`text-${size}.png`,fullPage:true});}
  }
 }
 await page.reload();assert.equal(await page.locator('#textSize').inputValue(),'large');
 await page.emulateMedia({media:'print'});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()),'1');
 await page.emulateMedia({media:'screen'});
 await page.evaluate(()=>localStorage.setItem('kinmuhyo_text_size','invalid'));await page.reload();assert.equal(await page.locator('#textSize').inputValue(),'standard');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',metrics,checks:'45 page/viewport/size combinations; inputs, reviews, palette, persistence, invalid fallback, work data unchanged, print scale, JS errors'},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
