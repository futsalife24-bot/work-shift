// F1回帰: 実アプリのロジックだけを読み込む。ブラウザ・実データ・外部依存なし。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');
const boundary = source.indexOf('function weeklyOffLabels(');
assert(boundary > 0, '表示処理の境界が変わった場合はテスト読込範囲を確認する');
const sandbox = vm.createContext({
  localStorage: {getItem: () => null},
  setTimeout: () => 0, clearTimeout: () => {}, console
});
const api = vm.runInContext(source.slice(0, boundary) + `
  ({defaultState, getCycle, addDays, buildCtx, solve, staffEval, detectImpossible,
    replaceState(value) { state = value; }})`, sandbox);
const start = '2026-06-14';
const results = [];

function fixture(type = 'con') {
  const state = api.defaultState();
  state.settings.supportSlotAdded = true;
  state.staff = [{id:'fake', name:'架空社員', type, order:0, weekendOK:true,
    sh8:true, sh9:true, smd:true, areasW:[], areasH:[], nightAreas:[]}];
  api.replaceState(state);
  const cyc = api.getCycle(start);
  cyc.fixed.fake = {};
  cyc.cells.fake = {};
  for (let d = 0; d < 28; d++) {
    const ds = api.addDays(start, d);
    if (type !== 'sup') cyc.fixed.fake[ds] = {code:'W8'};
  }
  return {state, cyc, day:d => api.addDays(start, d)};
}

function check(name, data, expectedWeeks) {
  api.replaceState(data.state);
  const ctx = api.buildCtx(start);
  const result = api.solve(start, {iter:1}); // 全勤務を固定。探索性能のテストではない。
  const reasons = api.detectImpossible(ctx);
  const actualWeeks = reasons.filter(x => x.includes('週休・非番を置ける日')).map(x => Number(x.match(/第(\d)週/)[1]));
  const evaluatedWeeks = api.staffEval(result.ctx, result.g, 0).warns
    .filter(x => x.msg.includes('週の週休・非番が0日')).map(x => Number(x.msg.match(/第(\d)週/)[1]));
  assert.deepEqual(Array.from(actualWeeks), expectedWeeks, name + ': 解消不能理由');
  assert.deepEqual(Array.from(evaluatedWeeks), expectedWeeks, name + ': 通常評価との整合');
  // 週休例外でも日別の本物の不足まで消してはいけない。
  assert(reasons.some(x => x.includes('必要人数を満たせる勤務適性者が足りません')), name + ': 人数不足を維持');
  results.push({name, weeklyReasons:actualWeeks.length});
}

check('空欄の応援', fixture('sup'), []);
let f = fixture();
for (let d = 0; d < 28; d++) f.cyc.fixed.fake[f.day(d)].code = 'KYU';
check('28日すべて休職', f, []);
f = fixture();
for (let d = 0; d < 7; d++) f.cyc.fixed.fake[f.day(d)].code = 'KYU';
check('第1週すべて休職・他週は判定継続', f, [2,3,4]);
f = fixture();
f.cyc.fixed.fake[f.day(6)].code = 'KYU';
check('第1週の1日だけ休職', f, [2,3,4]);
f = fixture();
delete f.cyc.fixed.fake[f.day(6)];
f.cyc.cells.fake[f.day(6)] = {code:'KYU', locked:false};
check('未ロックの休職セル', f, [2,3,4]);
f = fixture();
f.cyc.cells.fake[f.day(6)] = {code:'KYU', locked:false};
check('勤務の固定入力が古い休職セルより優先', f, [1,2,3,4]);
check('期間雇用社員の全日固定勤務', fixture(), [1,2,3,4]);
check('正社員の全日固定勤務', fixture('reg'), [1,2,3,4]);
f = fixture();
f.cyc.fixed.fake[f.day(6)].code = 'NEN';
check('年休は休職の週休例外にしない', f, [1,2,3,4]);
f = fixture();
for (const d of [6,13,20,27]) f.cyc.fixed.fake[f.day(d)].code = 'OF';
check('各週に週休・非番を1日確保', f, []);
console.log(JSON.stringify({passed:results.length, cases:results}, null, 2));
