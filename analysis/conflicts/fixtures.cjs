// 全件架空。実利用データや職場ルールを取り込まない診断用セットアップ。
module.exports = function installFixtures() {
  window.conflictFixture = (kind) => {
    clearTimeout(_saveTm);
    state = defaultState();
    state.settings.anchor = '2026-06-14';
    state.settings.supportSlotAdded = true;
    ui.curStart = state.settings.anchor;
    ui.preStaff = null;
    ui.reviewTarget = null;
    state.areas = Array.from({length: 3}, (_, i) => ({
      id: `fake-area-${i}`, name: `架空区${i + 1}`, midOK: true, mon: false, sat8: false
    }));
    state.settings.demand = {
      wd: {h8: 1, h9: 0, md: 2}, monTarget: 1,
      sat: {h8: 1, h9: 0, md: 1}, sun: {h8: 1, h9: 0, md: 1}
    };
    const member = (id, type = 'con') => ({
      id, name: `架空${id}`, type, order: 0, weekendOK: true,
      sh8: true, sh9: true, smd: true,
      areasW: state.areas.map(a => a.id), areasH: state.areas.map(a => a.id),
      nightAreas: ['sea', 'mountain'], keiZan: 0, nenZan: 0
    });
    state.staff = [member('A'), member('B')];
    if (kind === 'exemptions') state.staff.push(member('応援', 'sup'), member('休職'));
    if (kind === 'locked-conflict') state.staff = [member('A')];
    const cyc = getCycle(ui.curStart);
    const put = (st, d, code, locked = false, fixed = false) => {
      const ds = addDays(ui.curStart, d);
      cellOf(cyc, st.id, ds, true).code = code;
      cyc.cells[st.id][ds].locked = locked;
      if (fixed) {
        cyc.fixed[st.id] ||= {};
        cyc.fixed[st.id][ds] = {code};
      }
    };
    if (kind === 'shortage') {
      // 必要3人に対して2人。初日は両者が希望休。
      for (const st of state.staff) put(st, 0, 'OF', false, true);
    }
    if (kind === 'exemptions') {
      for (let d = 0; d < 28; d++) put(state.staff[3], d, 'KYU', false, true);
    }
    if (kind === 'locked-conflict') {
      // 初週は6連勤+希望休。その後は5勤2休。手動編集前の整合した状態。
      for (let d = 0; d < 28; d++) put(state.staff[0], d,
        (d < 7 ? d < 6 : d % 7 < 5) ? 'W8' : 'OF', true, d === 6);
      cyc.cells.A[addDays(ui.curStart, 6)].locked = false;
    }
    renderAll();
  };
};
