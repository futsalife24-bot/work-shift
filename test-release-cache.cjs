// v17候補のSWだけを隔離VMで確認。実ブラウザ・実キャッシュ・通信・保存には触れない。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8');
const handlers={},stores=new Map([['kinmuhyo-v16',new Map([['./',{version:'old'}]])]]);
const deleted=[],installed=[],puts=[];let skipped=0,claimed=0,network=true,fetches=0;
const candidate={version:'candidate',clone(){return {...this};}};
const ctx={self:{addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:()=>{skipped++;},clients:{claim:()=>{claimed++;}}},
  caches:{open:async key=>{
    if(!stores.has(key))stores.set(key,new Map());const store=stores.get(key);
    return {addAll:async assets=>{for(const a of assets){installed.push(a);store.set(a,{...candidate});}},put:async(key,v)=>{puts.push(key);store.set(typeof key==='string'?key:key.url,v);}};
  },keys:async()=>[...stores.keys()],delete:async key=>{deleted.push(key);return stores.delete(key);},
  match:async key=>{for(const store of stores.values()){const hit=store.get(typeof key==='string'?key:key.url);if(hit)return hit;}}},
  fetch:async()=>{fetches++;if(!network)throw Error('offline');return {...candidate};}};
vm.runInNewContext(source+'\nglobalThis.cacheName=CACHE;',ctx,{timeout:1000});
async function lifecycle(type){let pending;handlers[type]({waitUntil:p=>pending=p});await pending;}
async function request(request){let reply;handlers.fetch({request,respondWith:p=>reply=p});const response=await reply;await Promise.resolve();return response;}
(async()=>{
  assert.equal(ctx.cacheName,'kinmuhyo-v17');
  await lifecycle('install');assert.equal(skipped,1);assert.deepEqual(installed,['./','manifest.webmanifest','icon-192-v2.png','icon-512-v2.png']);
  await lifecycle('activate');assert.deepEqual(deleted,['kinmuhyo-v16']);assert.equal(claimed,1);
  const nav={method:'GET',mode:'navigate',destination:'document',url:'https://fixture.invalid/'};
  assert.equal((await request(nav)).version,'candidate');assert(puts.includes('./'));
  network=false;assert.equal((await request(nav)).version,'candidate','更新後のrootキャッシュでオフライン応答');
  const before=fetches;assert.equal((await request({method:'GET',destination:'image',url:'icon-192-v2.png'})).version,'candidate');assert.equal(fetches,before);
  assert.equal(await request({method:'POST',url:'https://fixture.invalid/'}),undefined);assert.equal(fetches,before);
  assert(!source.includes('localStorage'),'既存勤務保存には触れない');
  console.log('v17 SW候補: install/activate・旧v16整理・ネットワーク優先・オフライン応答・画像キャッシュ・POST非介入 PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
