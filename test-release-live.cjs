// 新規共有UI貸出後の公開局所確認。隔離context・架空データのみ。サイトへデータ送信しない。
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
assert(process.env.WORK_SHIFT_UI_LEASE,'共有UI貸出IDが必要です');
const url='https://futsalife24-bot.github.io/work-shift/';
const setup=fs.readFileSync(path.join(__dirname,'test-fixed-lock-conflicts.cjs'),'utf8').match(/function install\(app,kind\)\{[\s\S]*?app\.run\(`([\s\S]*?)`\);/)[1];
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route(/^https?:/,route=>route.request().url().startsWith(url)?route.continue():route.abort());
    await context.addInitScript(()=>{const Original=Date;window.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-06-14T12:00:00.000Z']));}static now(){return Original.parse('2026-06-14T12:00:00.000Z');}};});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(async()=>!!navigator.serviceWorker.controller&&(await caches.keys()).includes('kinmuhyo-v17'));
    assert(await page.evaluate(()=>runSolve.toString().includes('固定入力とロックが一致していません')));
    await page.evaluate(setup=>{window.kind='locked-hard';(0,eval)(setup);ui.guideStep=null;renderAll();switchTab('sched');save();},setup);
    await page.selectOption('#textSize','large');await page.waitForTimeout(350);
    const snap=()=>page.evaluate(()=>({data:localStorage.getItem(LS_KEY),state:JSON.stringify(state),size:localStorage.getItem('kinmuhyo_text_size'),selected:document.querySelector('#textSize').value}));
    const before=await snap();await page.click('#btnSolve');
    await page.waitForSelector('#modalBack.open #solveResultClose');
    assert.match(await page.locator('#modal').innerText(),/固定 休 ／ ロック 8時/);assert.deepEqual(await snap(),before);
    await page.click('#solveResultClose');await page.evaluate(()=>selectCell('A','2026-06-20'));
    await page.click('#palCodes [data-code="OF"]');await page.click('#palClose');await page.click('#btnSolve');
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('生成しました'));await page.waitForTimeout(350);
    const generated=await snap();await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(()=>navigator.onLine),false);assert.deepEqual(await snap(),generated);
    assert.equal(await page.evaluate(()=>getCycle(ui.curStart).cells.A['2026-06-20'].code),'OF');assert.deepEqual(errors,[]);
    console.log(JSON.stringify({url,lease:process.env.WORK_SHIFT_UI_LEASE,passed:true,sw:'kinmuhyo-v17',conflictPreserved:true,correctedRegeneration:true,offlineSavedStateAndDisplayPreserved:true,pageErrors:errors}));
    await context.close();
  }finally{await browser.close();console.log('専用ブラウザ終了・tab/context/viewport破棄。サーバー未起動。');}
})().catch(e=>{console.error(e);process.exitCode=1;});
