// F2のみ、実ロジックを隔離VMで実行。製品・ブラウザ・実保存へは書き込まない。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'src/app.js'),'utf8').replace(/\r\n/g,'\n');
function between(text,start,end){ const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return text.slice(a,b); }
function createApp(text){
  const nodes=new Map(),jobs=new Map(),memory=new Map(),errors=[],calls={solve:[],apply:0,save:0,render:0};let seq=0,now=0;
  function element(){const classes=new Set();return {innerHTML:'',textContent:'',children:[],classList:{add(x){classes.add(x);},remove(x){classes.delete(x);},contains:x=>classes.has(x),toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);}},
    appendChild(x){this.children.push(x);},addEventListener(){},querySelectorAll(){return [];}};}
  const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  let seed=82;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-07T00:00:00.000Z']));}static now(){return Date.parse('2026-10-07T00:00:00.000Z');}}
  const ctx=vm.createContext({structuredClone,Math:math,Date:FixedDate,
    document:{querySelector:node,querySelectorAll:()=>[],createElement:element},
    localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>{calls.save++;memory.set(k,v);}},
    setTimeout:(fn,delay)=>{const id=++seq;jobs.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>jobs.delete(id),
    console:{warn:(...x)=>errors.push(x.join(' ')),error:(...x)=>errors.push(x.join(' '))},
    renderSched:()=>{calls.render++;},undoLastGen(){},calls,assert});
  // ロジック全体＋実runSolve/トースト/モーダル/最終チェックの文字列生成。起動処理やUIイベントは実行しない。
  const code=text.slice(0,text.indexOf('function weeklyOffLabels('))+
    between(text,'function runSolve(){','$("#btnSolve")')+
    between(text,'function renderReview(){','function renderAll(){')+
    text.match(/^const PRE_LABEL=.*$/m)[0]+'\n'+
    text.match(/^function areaName.*$/m)[0]+'\n'+
    text.match(/^function openModal.*$/m)[0]+'\n'+text.match(/^function closeModal.*$/m)[0];
  vm.runInContext(code,ctx,{timeout:2000});
  vm.runInContext(`const originalSolve=solve, originalApply=applySolution;
    solve=(start,opts)=>{assert(calls.solve.length<2,'探索回数上限');assert(opts.iter<=60000,'探索反復上限');
      const r=originalSolve(start,opts);calls.solve.push({iterations:opts.iter,grid:structuredClone(r.g),evaluation:evaluate(r.ctx,r.g)});return r;};
    applySolution=r=>{calls.apply++;originalApply(r);};`,ctx);
  const run=code=>vm.runInContext(code,ctx,{timeout:15000});
  function flush(){let n=0;while(jobs.size){assert(++n<10);const [id,job]=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];jobs.delete(id);now=job.at;ctx.pending=job.fn;run('pending()');}}
  return {ctx,run,flush,node,memory,calls,errors};
}
function install(app,kind){
  app.ctx.kind=kind;
  app.run(`state=defaultState();state.settings.anchor='2026-06-14';state.settings.supportSlotAdded=true;ui.curStart=state.settings.anchor;
    state.areas=Array.from({length:3},(_,i)=>({id:'fake-area-'+i,name:'架空区'+(i+1),midOK:true,mon:false,sat8:false}));
    state.settings.demand={wd:{h8:3,h9:0,md:2},monTarget:3,sat:{h8:3,h9:0,md:2},sun:{h8:3,h9:0,md:2}};
    const member=id=>({id,name:'架空'+id,type:'con',order:0,weekendOK:true,sh8:true,sh9:true,smd:true,
      areasW:state.areas.map(a=>a.id),areasH:state.areas.map(a=>a.id),nightAreas:['sea','mountain'],keiZan:0,nenZan:0});
    state.staff=[member('A'),...Array.from({length:7},(_,i)=>member('補助'+i))];
    const cyc=getCycle(ui.curStart),pattern=['W8','W8','W8','MD','MD','OF','OF'];
    // 旧fixtureの「初週6勤+休」を維持し、後続週を2/2/3休として28日で8休にする。
    const off=new Set([6,12,13,19,20,25,26,27]);
    for(let i=0;i<state.staff.length;i++)for(let d=0;d<28;d++){
      const st=state.staff[i],ds=addDays(ui.curStart,d);
      cellOf(cyc,st.id,ds,true).code=i===0?(off.has(d)?'OF':'W8'):pattern[(d+i-1)%7];
      cyc.cells[st.id][ds].locked=true;
    }
    const targetDay=kind==='locked-no-hard'?0:6,ds=addDays(ui.curStart,targetDay);
    cyc.fixed.A={[ds]:{code:targetDay===0?'W8':'OF'}};
    if(kind==='locked-hard'||kind==='unlocked-stale')cyc.cells.A[ds].code='W8';
    if(kind==='unlocked-stale')cyc.cells.A[ds].locked=false;
    if(kind==='locked-no-hard')cyc.cells.A[ds].code='NEN';
    if(kind==='empty-same')cyc.fixed.A[ds].code=cyc.cells.A[ds].code='';
    if(kind==='unknown-same')cyc.fixed.A[ds].code=cyc.cells.A[ds].code='UNKNOWN';
    if(kind==='empty-conflict')cyc.cells.A[ds].code='';
    if(kind==='unknown-conflict')cyc.cells.A[ds].code='UNKNOWN';
    if(kind==='escaped'){
      state.staff[0].name='架空<&"社員';
      cyc.cells.A[ds].code='<img src=x onerror=alert(1)>';
    }
    if(kind==='many')for(let d=0;d<13;d++){
      const day=addDays(ui.curStart,d),c=cyc.cells.A[day];
      cyc.fixed.A[day]={code:c.code};c.code=c.code==='OF'?'W8':'OF';
    }
    ui.reviewTarget='A';ui.undoSnap={start:addDays(ui.curStart,-28),cells:{}};
    globalThis.target={sid:'A',ds};
  `);
}
function snapshot(app){return JSON.parse(app.run(`JSON.stringify({cells:getCycle(ui.curStart).cells,fixed:getCycle(ui.curStart).fixed})`));}
function runCase(kind,text=source){
  const app=createApp(text);install(app,kind);
  const before=snapshot(app);
  // 生成前保存をメモリ内に置き、停止時は一切書換えないことも確認する。
  app.run('save()');app.flush();app.calls.save=0;
  const savedBefore=app.memory.get('kinmuhyo_v1');
  const stateBefore=app.run('JSON.stringify(state)');
  const undoBefore=app.run('JSON.stringify(ui.undoSnap)');
  app.run('runSolve()');app.flush();assert.deepEqual(app.errors,[]);
  app.run('renderReview()');
  const after=snapshot(app),written=JSON.parse(app.run('JSON.stringify(evaluate(buildCtx(ui.curStart),gridFromCells(buildCtx(ui.curStart))))'));
  const review=app.node('#reviewBody').innerHTML,modal=app.node('#modal').innerHTML;
  const toast=app.node('#toast').children.filter(n=>n.textContent).map(n=>n.textContent);
  const afterSave=app.memory.get('kinmuhyo_v1');
  const stateAfter=app.run('JSON.stringify(state)');
  app.run('state=loadState();renderReview()');assert.deepEqual(snapshot(app),after,'保存復元');assert.equal(app.node('#reviewBody').innerHTML,review);
  assert.deepEqual(after.fixed,before.fixed,'希望固定は保持');
  const conflict=['locked-hard','locked-no-hard','empty-conflict','unknown-conflict','escaped','many'].includes(kind);
  if(conflict){
    assert.equal(app.calls.solve.length,0);assert.equal(app.calls.apply,0);assert.equal(app.calls.save,0);
    assert.equal(afterSave,savedBefore);assert.equal(stateAfter,stateBefore);assert.equal(app.run('JSON.stringify(ui.undoSnap)'),undoBefore);
    assert.deepEqual(after,before);assert.match(modal,/生成していません/);assert(!toast.includes('生成しました'));
    assert(!app.node('#solveOverlay').classList.contains('open'));
    assert(app.node('#modalBack').classList.contains('open'));app.node('#solveResultClose').onclick();
    assert(!app.node('#modalBack').classList.contains('open'),'確認ボタンで既存modalを閉じる');
  }else{
    assert.equal(app.calls.solve.length,1);assert.equal(app.calls.apply,1);assert.equal(app.calls.save,1);
    if(['consistent','unlocked-stale'].includes(kind)){assert(toast.includes('生成しました'));assert.equal(written.warns.filter(w=>w.lv==='hard').length,0);}
  }
  if(kind==='locked-hard')assert(written.warns.some(w=>w.msg.includes('7連勤')));
  if(kind==='locked-no-hard')assert.equal(written.warns.filter(w=>w.lv==='hard').length,0);
  if(kind==='empty-conflict')assert.match(modal,/ロック 空欄/);
  if(kind==='unknown-conflict')assert.match(modal,/ロック UNKNOWN/);
  if(kind==='escaped'){assert(!modal.includes('<img'));assert.match(modal,/架空&lt;&amp;&quot;社員/);assert.match(modal,/&lt;img src=x onerror=alert\(1\)&gt;/);}
  if(kind==='many'){assert.match(modal,/13件の矛盾/);assert.equal((modal.match(/<li>/g)||[]).length,12);assert.match(modal,/先頭12件.*ほか1件/);}
  const result={kind,blocked:conflict,solve:app.calls.solve.length,apply:app.calls.apply,save:app.calls.save,
    hard:written.warns.filter(w=>w.lv==='hard').length,mismatch:Number(review.match(/不一致 (\d+)件/)[1]),toast,modal,review,after};
  // 利用者が入力を揃えた後に同じ入口を再実行。製品が勝手に優先する処理は追加しない。
  if(kind==='locked-hard'||kind==='many'){
    app.run(`for(const [ds,f] of Object.entries(getCycle(ui.curStart).fixed.A))getCycle(ui.curStart).cells.A[ds].code=f.code;runSolve();`);app.flush();
    assert.equal(app.calls.solve.length,1);assert.equal(app.calls.apply,1);assert.equal(app.calls.save,1);
    assert(app.node('#toast').children.some(x=>x.textContent==='生成しました'));assert.deepEqual(app.errors,[]);
  }
  return JSON.parse(JSON.stringify(result));
}
const results=[];
const controls=['consistent','unlocked-stale','empty-same','unknown-same'];
for(const kind of [...controls,'locked-hard','locked-no-hard','empty-conflict','unknown-conflict','escaped','many'])results.push(runCase(kind));
// 任意の追加照合。Git管理されたF1基点のコードを読み取り、既存の空/不正コード扱いも変更していないことを確認。
if(process.argv.includes('--compare-base')){
  const baseline=require('node:child_process').execFileSync('git',['show','c410dfb8fcef36cf7bf46ad8447b60f6e385442a:src/app.js'],{cwd:__dirname,encoding:'utf8'}).replace(/\r\n/g,'\n');
  for(const kind of controls)assert.deepEqual(results.find(r=>r.kind===kind),runCase(kind,baseline),kind+': F1基点との既存動作一致');
}
console.log(JSON.stringify(results.map(({kind,blocked,solve,apply,save,hard,mismatch})=>({kind,blocked,solve,apply,save,hard,mismatch})),null,2));
console.log('F2入口10条件・停止時状態保持・閉じる/再生成・保存復元: PASS');
