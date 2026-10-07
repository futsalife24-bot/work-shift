// 共有UIの新規貸出後だけ実行。--prepare は資材照合のみでブラウザ/サーバーを起動しない。
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const root=__dirname,base='d5959cec6b08978d8d4914c006477e2b02c641f8';
const old=Object.fromEntries(['index.html','sw.js'].map(p=>[p,cp.execFileSync('git',['show',base+':'+p],{cwd:root})]));
const current=Object.fromEntries(['index.html','sw.js','manifest.webmanifest','icon-192-v2.png','icon-512-v2.png'].map(p=>[p,fs.readFileSync(path.join(root,p))]));
const sha=b=>crypto.createHash('sha256').update(b.toString('utf8').replace(/\r\n/g,'\n')).digest('hex');
assert(old['sw.js'].toString().includes('kinmuhyo-v16'));
assert(current['sw.js'].toString().includes('kinmuhyo-v17'));
const harness=fs.readFileSync(path.join(root,'test-fixed-lock-conflicts.cjs'),'utf8');
const setup=harness.match(/function install\(app,kind\)\{[\s\S]*?app\.run\(`([\s\S]*?)`\);/)[1];
const expected={base,oldHtml:sha(old['index.html']),candidateHtml:sha(current['index.html']),candidateSw:sha(current['sw.js'])};
if(process.argv.includes('--prepare')){console.log(JSON.stringify({prepared:true,...expected}));process.exit(0);}
assert(process.env.WORK_SHIFT_UI_LEASE,'共有UIの新規貸出IDをWORK_SHIFT_UI_LEASEに指定してください');
const {chromium}=require('playwright');
let phase='old';const requests=[];
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname,p=pathname==='/'?'index.html':pathname.slice(1);
  const bytes=phase==='old'&&old[p]?old[p]:current[p];
  if(req.method!=='GET'||!bytes){res.writeHead(404);res.end();return;}
  requests.push({phase,path:pathname});
  const type=p.endsWith('.js')?'application/javascript':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.png')?'image/png':'application/manifest+json';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(bytes);
});
(async()=>{
  let browser,context;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
    context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route(/^https?:/,route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await context.addInitScript(()=>{
      const NativeDate=Date;
      window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-06-14T12:00:00.000Z']));}static now(){return NativeDate.parse('2026-06-14T12:00:00.000Z');}};
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('kinmuhyo-v16');});
    await page.evaluate(setup=>{window.kind='consistent';(0,eval)(setup);ui.guideStep=null;renderAll();save();},setup);
    await page.selectOption('#textSize','large');await page.waitForTimeout(350);
    const snapshot=()=>page.evaluate(()=>({data:localStorage.getItem('kinmuhyo_v1'),state:JSON.stringify(state),size:localStorage.getItem('kinmuhyo_text_size'),selected:document.querySelector('#textSize').value,scale:getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim()}));
    const before=await snapshot();assert.equal(before.size,'large');assert.equal(before.scale,'1.25');
    const cachedHash=key=>page.evaluate(async key=>{
      const response=await (await caches.open(key)).match('./');if(!response)return null;
      const text=(await response.text()).replace(/\r\n/g,'\n');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    },key);
    assert.equal(await cachedHash('kinmuhyo-v16'),expected.oldHtml);
    phase='candidate';
    await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('kinmuhyo-v17')&&!keys.includes('kinmuhyo-v16');});
    await page.reload();
    await page.waitForFunction(()=>runSolve.toString().includes('固定入力とロックが一致していません'));
    assert.deepEqual(await snapshot(),before,'オンライン更新後の勤務データ・表示設定');
    assert.equal(await cachedHash('kinmuhyo-v17'),expected.candidateHtml);
    // 実ネットワーク停止状態でページを再起動。SWのキャッシュから候補を読む。
    await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await page.evaluate(()=>navigator.onLine),false);
    assert(await page.evaluate(()=>runSolve.toString().includes('固定入力とロックが一致していません')));
    assert.deepEqual(await snapshot(),before,'オフライン再起動後の勤務データ・表示設定');
    assert.deepEqual(errors,[]);
    const result={...expected,lease:process.env.WORK_SHIFT_UI_LEASE,passed:true,oldCacheRemoved:true,
      candidateCacheHtmlMatches:true,onlinePreserved:true,offlinePreserved:true,pageErrors:errors,
      scope:'localhost・隔離Edge・架空8人/28日・文字サイズ大・v16→v17・実offline再読込。実端末/公開更新の保証ではない',
      servedOldSw:requests.some(r=>r.phase==='old'&&r.path==='/sw.js'),servedCandidateSw:requests.some(r=>r.phase==='candidate'&&r.path==='/sw.js')};
    assert(result.servedOldSw&&result.servedCandidateSw);
    if(process.env.F2_CACHE_RESULT_PATH)fs.writeFileSync(process.env.F2_CACHE_RESULT_PATH,JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result,null,2));
  }finally{
    if(context)await context.close();if(browser)await browser.close();
    if(server.listening)await new Promise(resolve=>server.close(resolve));
    console.log('専用context/browser/localhostサーバー終了・viewport破棄');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
