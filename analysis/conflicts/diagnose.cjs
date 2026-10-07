// 既知問題の再現を含む診断。PASSは製品の無欠陥を意味しない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const installFixtures = require('./fixtures.cjs');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const browser = await chromium.launch({headless: true,
    ...(process.env.BROWSER_CHANNEL ? {channel: process.env.BROWSER_CHANNEL} : {})});
  const context = await browser.newContext();
  // この実行専用プロファイル。実ブラウザの保存データを使用せず外部通信も遮断。
  await context.route(/^https?:/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const result = {source: process.env.TEST_HTML || 'src/index.html', cases: {}, findings: []};
  try {
    await page.goto(pathToFileURL(path.join(root, result.source)).href);
    await page.evaluate(installFixtures);
    result.cases.shortage = await page.evaluate(() => {
      conflictFixture('shortage');
      // seedは診断内だけに適用。製品の乱数や探索手法を変更しない。
      const original = Math.random;
      let seed = 82;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      let r;
      try { r = solve(ui.curStart, {iter: 200}); } finally { Math.random = original; }
      applySolution(r);
      const ctx = buildCtx(ui.curStart), g = gridFromCells(ctx), ev = evaluate(ctx, g);
      return {firstDay: g.map(row => row[0]),
        shortage: ev.warns.filter(w => w.d === 0 && w.msg.includes('不足')),
        impossible: detectImpossible(ctx).filter(x => x.includes('6/14')),
        hardCount: ev.warns.filter(w => w.lv === 'hard').length};
    });
    assert.deepEqual(result.cases.shortage.firstDay, ['OF', 'OF']);
    assert(result.cases.shortage.shortage.length > 0);
    assert(result.cases.shortage.impossible.length > 0);

    // save()の実際の250ms遅延を待ち、ページを再読込して配置と警告全件を比較。
    const snapshot = () => {
      const ctx = buildCtx(ui.curStart);
      return JSON.stringify({cells: ctx.cyc.cells, fixed: ctx.cyc.fixed,
        warnings: evaluate(ctx, gridFromCells(ctx)).warns});
    };
    const before = await page.evaluate(snapshot);
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return JSON.stringify(saved.cycles?.[ui.curStart]?.cells) === JSON.stringify(getCycle(ui.curStart).cells);
    });
    await page.reload();
    await page.evaluate(() => {ui.curStart = state.settings.anchor;});
    assert.equal(await page.evaluate(snapshot), before);
    result.cases.reload = {cellsFixedAndWarningsUnchanged: true};
    await page.evaluate(installFixtures);

    result.cases.boundaries = await page.evaluate(() => {
      conflictFixture('plain');
      const ctx = buildCtx(ui.curStart), g = ctx.del.map(() => Array(28).fill('KYU'));
      ctx.prevTail[0] = ['OF', 'W8', 'W8', 'W8', 'W8', 'W8'];
      g[0][0] = 'W8'; g[0][1] = 'W8';
      const run = staffEval(ctx, g, 0).warns.filter(w => w.msg.includes('連勤'));
      ctx.prevTail[0] = ['OF', 'OF', 'OF', 'OF', 'OF', 'MD'];
      g[0][1] = 'KYU';
      const afterMid8 = staffEval(ctx, g, 0).warns.filter(w => w.msg.includes('中勤翌日'));
      g[0][0] = 'W9'; ctx.dem[0].h9 = 1;
      const afterMid9 = staffEval(ctx, g, 0).warns.filter(w => w.msg.includes('中勤翌日'));
      return {run, afterMid8, afterMid9};
    });
    assert.equal(result.cases.boundaries.run[0].lv, 'soft');
    assert.match(result.cases.boundaries.run[0].msg, /6連勤$/);
    assert.equal(result.cases.boundaries.run[1].lv, 'hard');
    assert.match(result.cases.boundaries.run[1].msg, /7連勤/);
    assert.equal(result.cases.boundaries.afterMid8[0].lv, 'hard');
    assert.equal(result.cases.boundaries.afterMid9[0].lv, 'soft');

    result.cases.fairness = await page.evaluate(() => {
      conflictFixture('plain');
      const ctx = buildCtx(ui.curStart), g = ctx.del.map(() => Array(28).fill('OF'));
      g[0][0] = 'MD'; g[1][7] = 'MD';
      const balanced = fairEval(ctx, g);
      g[1][7] = 'OF'; g[0][7] = 'MD';
      const skewed = fairEval(ctx, g);
      ctx.del.push({...ctx.del[0], id:'sup', type:'sup'}, {...ctx.del[0], id:'absent'});
      g.push(Array(28).fill('MD'), Array(28).fill('KYU'));
      const excluded = fairEval(ctx, g);
      return {balanced: balanced.cost, skewed: skewed.cost, excluded: excluded.cost,
        warningCount: skewed.warns.length};
    });
    assert.equal(result.cases.fairness.balanced, 0);
    assert(result.cases.fairness.skewed > 0);
    assert.equal(result.cases.fairness.excluded, result.cases.fairness.skewed);
    assert.equal(result.cases.fairness.warningCount, 0);

    result.cases.exemptions = await page.evaluate(() => {
      conflictFixture('exemptions');
      const ctx = buildCtx(ui.curStart), g = gridFromCells(ctx);
      return {supportWarnings: staffEval(ctx, g, ctx.del.findIndex(s => s.type === 'sup')).warns,
        absenceWarnings: staffEval(ctx, g, ctx.del.findIndex(s => s.id === '休職')).warns,
        falseReasons: detectImpossible(ctx).filter(x => /架空(応援|休職).*週休/.test(x))};
    });
    assert.deepEqual(result.cases.exemptions.supportWarnings, []);
    assert.deepEqual(result.cases.exemptions.absenceWarnings, []);
    assert.equal(result.cases.exemptions.falseReasons.length, 8);
    result.findings.push({id:'F1', reproduced:true, detail:'応援・休職の除外が解消不能判定へ反映されていない'});

    await page.evaluate(() => {conflictFixture('locked-conflict');
      selectCell('A', addDays(ui.curStart, 6));});
    // 希望休から勤務への手動変更後にロックする、既存UIで到達できる状態。
    await page.click('#palCodes [data-code="W8"]');
    await page.click('#palLock');
    result.cases.lockedConflict = await page.evaluate(() => {
      const r = solve(ui.curStart, {iter: 1});
      const before = staffEval(r.ctx, r.g, 0).warns.filter(w => /7連勤/.test(w.msg));
      applySolution(r);
      const ctx = buildCtx(ui.curStart), saved = gridFromCells(ctx);
      ui.reviewMode = 'person'; ui.reviewTarget = 'A'; renderReview();
      return {solverCode:r.g[0][6], savedCode:saved[0][6],
        before, after:staffEval(ctx, saved, 0).warns.filter(w => /7連勤/.test(w.msg)),
        reviewMismatch:document.querySelector('#reviewBody').textContent.includes('不一致 1件')};
    });
    assert.equal(result.cases.lockedConflict.solverCode, 'OF');
    assert.equal(result.cases.lockedConflict.savedCode, 'W8');
    assert.deepEqual(result.cases.lockedConflict.before, []);
    assert.equal(result.cases.lockedConflict.after.length, 1);
    assert(result.cases.lockedConflict.reviewMismatch);
    result.findings.push({id:'F2', reproduced:true, detail:'固定入力とロックの優先順位が探索・書戻しで不一致'});
    const conflictBeforeReload = await page.evaluate(snapshot);
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return JSON.stringify(saved.cycles?.[ui.curStart]?.cells) === JSON.stringify(getCycle(ui.curStart).cells);
    });
    await page.reload();
    await page.evaluate(() => {ui.curStart = state.settings.anchor;});
    assert.equal(await page.evaluate(snapshot), conflictBeforeReload);
    result.cases.lockedConflict.cellsFixedAndWarningsUnchangedAfterReload = true;
    assert.deepEqual(errors, []);
    result.pageErrors = errors;
    fs.writeFileSync(path.join(__dirname, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('診断完了: 6分類の照合、保存復元一致、既知問題2件を再現、JSエラー0件');
  } finally {
    await browser.close();
  }
})().catch(e => {console.error(e); process.exitCode = 1;});
