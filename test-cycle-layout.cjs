const {chromium}=require('playwright');
const path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage();
 await page.goto('file:///'+path.resolve('勤務表ツール.html').replaceAll('\\','/'));
 await page.click('#startGuide');
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:900});
  for(const size of ['small','standard','large']){
   await page.selectOption('#textSize',size);
   const prev=await page.locator('#cyclePrev').boundingBox(),next=await page.locator('#cycleNext').boundingBox(),label=await page.locator('#cycleLabel').boundingBox();
   assert(Math.abs(prev.y-next.y)<1,'period buttons must stay on the same row');
   assert(Math.abs(prev.width-next.width)<1,'period buttons must have equal widths');
   assert(label.y+label.height<=prev.y,'date must be above both buttons');
   assert.equal(await page.locator('.scheduleTools').isVisible(),false,'period step must only show period controls');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
   if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`cycle-layout-${size}.png`});}
  }
 }
 const before=await page.locator('#cycleLabel').innerText();await page.click('#cycleNext');assert.notEqual(await page.locator('#cycleLabel').innerText(),before);await page.click('#cyclePrev');assert.equal(await page.locator('#cycleLabel').innerText(),before);
 assert.equal(await page.locator('#creationGuide').innerText().then(s=>s.includes(before)),false,'guide must not repeat the period');
 await page.click('#guideNext');assert.equal(await page.locator('#page-pre').getAttribute('class'),'page active');
 console.log('PASS: 3 sizes x 3 widths; equal-height row position, equal widths, date above, exports below, no page overflow, period and guide navigation');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
