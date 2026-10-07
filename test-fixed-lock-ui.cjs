// 共有UIの貸出許可後に実行する局所確認。架空fixture・隔離context・ローカルHTMLのみ。
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const harness=fs.readFileSync(path.join(__dirname,'test-fixed-lock-conflicts.cjs'),'utf8');
const setup=harness.match(/function install\(app,kind\)\{[\s\S]*?app\.run\(`([\s\S]*?)`\);/)[1];
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route(/^https?:/,route=>route.abort());
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('file:///'+path.join(__dirname,'index.html').replaceAll('\\','/'));
    const fixture=async kind=>{
      await page.evaluate(({setup,kind})=>{window.kind=kind;(0,eval)(setup);ui.guideStep=null;renderAll();switchTab('sched');save();},{setup,kind});
      await page.waitForTimeout(300);
    };
    await fixture('locked-hard');
    const original=await page.evaluate(()=>({state:JSON.stringify(state),saved:localStorage.getItem(LS_KEY),undo:JSON.stringify(ui.undoSnap)}));
    await page.click('#btnSolve');
    await page.waitForSelector('#modalBack.open #solveResultClose');
    assert.match(await page.locator('#modal').innerText(),/固定 休 ／ ロック 8時/);
    assert.deepEqual(await page.evaluate(()=>({state:JSON.stringify(state),saved:localStorage.getItem(LS_KEY),undo:JSON.stringify(ui.undoSnap)})),original);
    await page.click('#solveResultClose');
    assert.equal(await page.locator('#modalBack').evaluate(e=>e.classList.contains('open')),false);
    // 実パレットから固定希望と同じ「休」に直して再生成する。
    await page.evaluate(()=>selectCell('A','2026-06-20'));
    await page.click('#palCodes [data-code="OF"]');
    await page.click('#palClose');
    await page.click('#btnSolve');
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('生成しました'));
    assert.equal(await page.locator('#modalBack').evaluate(e=>e.classList.contains('open')),false);
    await page.waitForTimeout(300);
    const generated=await page.evaluate(()=>({fixed:getCycle(ui.curStart).fixed.A['2026-06-20'].code,cell:getCycle(ui.curStart).cells.A['2026-06-20'].code,start:ui.curStart}));
    assert.equal(generated.fixed,'OF');assert.equal(generated.cell,'OF');
    await page.reload();
    assert.equal(await page.evaluate(start=>getCycle(start).cells.A['2026-06-20'].code,generated.start),'OF');
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});await fixture('many');await page.click('#btnSolve');
      await page.waitForSelector('#modalBack.open #solveResultClose');
      const modal=page.locator('#modal');
      assert.match(await modal.innerText(),/13件の矛盾/);assert.match(await modal.innerText(),/ほか1件/);
      assert.equal(await modal.locator('li').count(),12);
      assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'通知の横方向のはみ出し');
      await page.locator('#solveResultClose').scrollIntoViewIfNeeded();
      assert(await page.locator('#solveResultClose').isVisible());
      const capture=process.env.F2_SCREENSHOT_DIR;
      if(capture){fs.mkdirSync(capture,{recursive:true});await page.screenshot({path:path.join(capture,`f2-modal-${width}.png`)});}
      await page.click('#solveResultClose');
      assert.equal(await page.locator('#modalBack').evaluate(e=>e.classList.contains('open')),false);
    }
    assert.deepEqual(errors,[]);console.log('F2実画面: 通知/閉じる/実パレット修正/再生成/保存復元/320・390pxの13件表示 PASS');
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
