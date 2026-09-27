const {chromium}=require('playwright'),path=require('path'),assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve('勤務表ツール.html').replaceAll('\\','/'));
 await page.evaluate(()=>{loadDemo();renderAll();});
 for(const width of [320,390,1280])for(const size of ['small','standard','large']){
  await page.setViewportSize({width,height:900});await page.selectOption('#textSize',size);
  await page.evaluate(()=>guideGo(0));assert(!await page.locator('#btnSolve').isVisible());assert(!await page.locator('#gridWrap').isVisible());
  if(width===390&&size==='standard')await page.screenshot({path:'tools-period.png'});
  await page.evaluate(()=>guideGo(2));assert(await page.locator('#btnSolve').isVisible());
  await page.locator('#scheduleMore').evaluate(e=>e.open=false);
  assert(!await page.locator('#btnClearCells').isVisible());
  if(width===390&&size==='standard')await page.screenshot({path:'tools-generate.png'});
  await page.click('#scheduleMore summary');
  for(const selector of ['#chkArea','#btnFit','#btnXlsx','#btnPrint','#btnPrintCheck','#btnResolve','#btnClearCells'])assert(await page.locator(selector).isVisible());
  const left=await page.locator('#chkArea').boundingBox(),right=await page.locator('#btnFit').boundingBox();assert(Math.abs(left.y-right.y)<1);assert(Math.abs(left.width-right.width)<1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===390&&size==='standard'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tools-expanded.png',fullPage:true});}
  await page.click('#chkArea');assert(await page.locator('#chkArea').evaluate(e=>e.classList.contains('on')));await page.click('#chkArea');
  await page.click('#guideClose');assert(await page.locator('#btnSolve').isVisible());assert(await page.locator('#gridWrap').isVisible());
 }
 assert.deepEqual(errors,[]);console.log('PASS: period-only controls; generation and grouped actions; 3 sizes x 3 widths; two-column alignment; display toggle; normal mode; no JS errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
