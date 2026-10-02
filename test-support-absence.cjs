const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve('勤務表ツール.html').replaceAll('\\','/'));
 const migration=await page.evaluate(()=>{
  loadDemo();state.staff=state.staff.filter(s=>s.type!=='sup');delete state.settings.supportSlotAdded;
  const st=state.staff[0],cyc=getCycle(ui.curStart);cyc.cells[st.id]={[ui.curStart]:{code:'W8',area:'a1'}};
  const before=JSON.stringify(state.cycles),staffBefore=JSON.stringify(state.staff);migrateState();migrateState();renderAll();
  const all=sortedStaff(),support=all.find(s=>s.type==='sup');return {sameCells:before===JSON.stringify(state.cycles),sameStaff:staffBefore===JSON.stringify(state.staff.filter(s=>s.type!=='sup')),count:all.filter(s=>s.type==='sup').length,name:support.name,order:all.indexOf(support)===all.findIndex(s=>s.type==='ind')-1,id:support.id};
 });assert(migration.sameCells&&migration.sameStaff&&migration.order);assert.equal(migration.count,1);assert.equal(migration.name,'1-2');
 await page.evaluate(()=>{switchTab('sched');selectCell(sortedStaff()[0].id,ui.curStart);});await page.click('#palCodes [data-code="KYU"]');
 assert.equal(await page.evaluate(()=>getCycle(ui.curStart).fixed[ui.sel.sid][ui.sel.ds].code),'KYU');await page.click('#palClose');
 await page.click('[data-page="pre"]');await page.click('#preSeg [data-code="KYU"]');await page.locator('#preCal .dcell').nth(1).click();
 await page.selectOption('#preMode','day');assert.match(await page.locator('#preCal .dcell').first().innerText(),/休職/);
 const generated=await page.evaluate(()=>{
  const st=sortedStaff()[0],support=state.staff.find(s=>s.type==='sup'),c=getCycle(ui.curStart);
  for(let i=0;i<28;i++){const ds=addDays(ui.curStart,i);c.fixed[st.id][ds]={code:'KYU'};c.cells[st.id][ds]={code:'KYU'};}
  support.sh8=true;support.areasW=state.areas.map(a=>a.id);support.areasH=support.areasW.slice();
  const ds=addDays(ui.curStart,1);c.cells[support.id]={[ds]:{code:'W8',area:'a2'}};
  const r=solve(ui.curStart,{iter:2000});applySolution(r);const absent=r.ctx.del.findIndex(s=>s.id===st.id),sup=r.ctx.del.findIndex(s=>s.id===support.id);
  const warnings=staffEval(r.ctx,r.g,absent).warns;
  return {absent:r.g[absent].every(x=>x==='KYU'),manual:r.g[sup][1]==='W8'&&r.g[sup].filter(isWork).length===1,area:c.cells[support.id][ds].area,warnings,printedLabel:cellLabel(st,dayInfo(ds),{code:'KYU'},{}).t};
 });assert(generated.absent&&generated.manual);assert.equal(generated.area,'a2');assert.deepEqual(generated.warnings,[]);assert.equal(generated.printedLabel,'休職');
 await page.evaluate(()=>{renderSched();buildPrint();});assert.match(await page.locator('#printRoot').innerText(),/休職/);
 const exported=await page.evaluate(()=>Array.from(exportXlsx()));assert(Buffer.from(exported).includes(Buffer.from('休職','utf8')));assert(Buffer.from(exported).includes(Buffer.from('1-2','utf8')));
 await page.evaluate(()=>{ui.reviewMode='person';ui.reviewTarget=sortedStaff()[0].id;switchTab('review');});assert.match(await page.locator('#reviewBody').innerText(),/休職 28日/);
 await page.waitForTimeout(350);await page.reload();assert.equal(await page.evaluate(()=>state.staff.filter(s=>s.type==='sup').length),1);assert.equal(await page.evaluate(()=>state.staff.find(s=>s.type==='sup').id),migration.id);
 await page.evaluate(()=>switchTab('sched'));await page.locator('#gridWrap').scrollIntoViewIfNeeded();await page.screenshot({path:'support-absence-mobile.png'});
 // 通常のロックなし休職セルも固定扱い、解除時はその固定入力を残さない。
 await page.evaluate(()=>{const st=sortedStaff()[0],c=getCycle(ui.curStart);delete c.fixed[st.id][ui.curStart];c.cells[st.id][ui.curStart]={code:'KYU'};const r=solve(ui.curStart,{iter:200});if(r.g[0][0]!=='KYU')throw Error('raw absence lost');selectCell(st.id,ui.curStart);});
 await page.click('#palCodes [data-code="W8"]');assert.equal(await page.evaluate(()=>getCycle(ui.curStart).fixed[ui.sel.sid]?.[ui.sel.ds]),undefined);
 assert.deepEqual(errors,[]);console.log('PASS: migration preserves existing data; single support slot before indoor; person/day and palette absence; solver preserves support and absence; print/XLSX/review; reload; unpinned absence; clear absence');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
