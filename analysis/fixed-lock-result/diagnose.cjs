// F2のみ、実ロジックを隔離VMで実行。製品・ブラウザ・実保存へは書き込まない。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'), source=fs.readFileSync(path.join(root,'src/app.js'),'utf8').replace(/\r\n/g,'\n');
const patch=fs.readFileSync(path.join(__dirname,'candidate.patch'),'utf8').replace(/\r\n/g,'\n');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const additions=patch.split('\n').filter(s=>s.startsWith('+')&&!s.startsWith('+++')).map(s=>s.slice(1)).join('\n');
const anchor='function runSolve(){\n  const cyc0=getCycle(ui.curStart);';
assert.equal(source.split(anchor).length,2);
const candidate=source.replace(anchor,anchor+'\n'+additions);
function between(text,start,end){ const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return text.slice(a,b); }
function createApp(text){
  const nodes=new Map(),jobs=new Map(),memory=new Map(),errors=[],calls={solve:[],apply:0,save:0,render:0};let seq=0,now=0;
  function element(){return {innerHTML:'',textContent:'',children:[],classList:{add(){},remove(){},toggle(){}},
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
    ui.reviewTarget='A';ui.undoSnap={start:addDays(ui.curStart,-28),cells:{}};
    globalThis.target={sid:'A',ds};
  `);
}
function snapshot(app){return JSON.parse(app.run(`JSON.stringify({cells:getCycle(ui.curStart).cells,fixed:getCycle(ui.curStart).fixed})`));}
function runCase(kind,patched){
  const app=createApp(patched?candidate:source);install(app,kind);
  const before=snapshot(app),beforeHard=app.run('evaluate(buildCtx(ui.curStart),gridFromCells(buildCtx(ui.curStart))).warns.filter(w=>w.lv==="hard")');
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
  const conflict=kind.startsWith('locked-');
  if(patched&&conflict){assert.equal(app.calls.solve.length,0);assert.equal(app.calls.apply,0);assert.equal(app.calls.save,0);assert.equal(afterSave,savedBefore);assert.equal(stateAfter,stateBefore);assert.equal(app.run('JSON.stringify(ui.undoSnap)'),undoBefore);assert.deepEqual(after,before);assert.match(modal,/生成していません/);assert(!toast.includes('生成しました'));}
  else {assert.equal(app.calls.solve.length,1);assert.equal(app.calls.apply,1);assert.equal(app.calls.save,1);assert(toast.includes('生成しました'));assert.equal(app.calls.solve[0].evaluation.warns.filter(w=>w.lv==='hard').length,0);}
  if(!conflict)assert.equal(written.warns.filter(w=>w.lv==='hard').length,0);
  assert.match(review,new RegExp('不一致 '+(conflict?1:0)+'件'));
  if(kind==='locked-hard')assert(written.warns.some(w=>w.msg.includes('7連勤')));
  if(kind==='locked-no-hard')assert.equal(written.warns.filter(w=>w.lv==='hard').length,0);
  const target=JSON.parse(app.run('JSON.stringify(target)'));
  assert.equal(after.cells.A[target.ds].code,kind==='locked-hard'?'W8':kind==='locked-no-hard'?'NEN':'OF');
  if(app.calls.solve.length)assert.equal(app.calls.solve[0].grid[0][kind==='locked-no-hard'?0:6],before.fixed.A[target.ds].code);
  return {kind,patched,target,before_code:before.cells.A[target.ds].code,fixed_code:before.fixed.A[target.ds].code,
    requested_iterations:app.calls.solve.map(c=>c.iterations),solved_code:app.calls.solve[0]?.grid[0][kind==='locked-no-hard'?0:6]??null,
    before_hard:Array.from(beforeHard,w=>w.msg),solve_hard:app.calls.solve[0]?.evaluation.warns.filter(w=>w.lv==='hard').map(w=>w.msg)??null,
    written_code:after.cells.A[target.ds].code,written_hard:written.warns.filter(w=>w.lv==='hard').map(w=>w.msg),
    mismatch:Number(review.match(/不一致 (\d+)件/)[1]),toast,modal,review_html:review,
    apply_calls:app.calls.apply,save_writes:app.calls.save,saved_reloaded_equal:true,unchanged:JSON.stringify(before)===JSON.stringify(after)};
}
const results=[];
for(const kind of ['consistent','unlocked-stale','locked-hard','locked-no-hard'])for(const patched of [false,true])results.push(runCase(kind,patched));
for(const kind of ['consistent','unlocked-stale']){
  // 独立VM由来の配列prototypeの違いではなく、保存可能な値を比較する。
  const [current,proposed]=results.filter(r=>r.kind===kind).map(({patched,...r})=>JSON.parse(JSON.stringify(r)));
  assert.deepEqual(proposed,current,'正常対照の結果・表示・保存回数は案の前後で同一');
}
const output={base:'c410dfb8fcef36cf7bf46ad8447b60f6e385442a',source_sha256_lf:hash(source),patch_sha256_lf:hash(patch),
  scope:'4条件×現行/未適用案。実runSolveは各60000反復を要求、全探索変数は固定済み。最大2探索/回・VM実行15秒上限。DOM代替の文字列観測でブラウザ未使用。',results};
const json=JSON.stringify(output,null,2)+'\n',file=path.join(__dirname,'result.json');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),json);else fs.writeFileSync(file,json);
console.log(JSON.stringify(results.map(r=>({kind:r.kind,patched:r.patched,solve:r.solved_code,written:r.written_code,hard:r.written_hard.length,mismatch:r.mismatch,toast:r.toast,blocked:!!r.modal,save:r.save_writes})),null,2));
console.log('4条件×現行/未適用案・保存復元・期待値照合: PASS');
