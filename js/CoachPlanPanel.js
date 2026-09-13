/* =========================================================
   CSW24 Word Lab — AI Coach: CoachPlanPanel.js
   =========================================================
   Scope: the missing visible half of "Daily Training Plan".
   RecommendationEngine.js's dailyPlan() has been fully
   implemented for a while — it already reads
   WeaknessDetector.js + SpacedRepetition.js and returns a real,
   prioritized, honest plan. Until this file, the only place
   that ever showed it was as plain text lines inside a chat
   bubble (CoachEngine.js's intentCreateStudyPlan(), triggered
   by typing something like "สร้างแผนฝึกให้หน่อย"). This file adds
   an actual "📋 แผนวันนี้" tab to the coach panel so the plan is
   a real, glanceable, actionable view — not just chat text.

   This file computes NOTHING new. Every item shown here is
   exactly what RecommendationEngine.dailyPlan() already
   produced (which itself only re-shapes WeaknessDetector.js /
   SpacedRepetition.js output — see that file's own header).
   This file's only job is rendering that plan as a checklist
   and wiring each item's existing `suggestedCommand` to
   CoachUI.js's real executeCommand(), so "เริ่มฝึก" on a plan
   item does exactly what asking the coach the same question in
   chat would do — never a second, divergent action path.

   Third coach-panel tab, alongside CoachUI.js's own chat pane
   and CoachInsightsPanel.js's "ภาพรวม" (Insights) pane. Because
   CoachInsightsPanel.js's own switchTab()/wireInto() only know
   about "chat" vs "insights" and only bind whatever
   .coach-tab-btn elements exist at ITS wire time, this file
   can't just add a third button and expect the existing
   switcher to handle it. Instead — loaded after
   CoachInsightsPanel.js — this file REBINDS every .coach-tab-btn
   (the two that already exist, plus its own new one) to a
   single shared switcher defined here that knows about all
   three panes. This mirrors CoachAdaptiveLoop.js's own pattern
   of non-invasively wrapping an existing function rather than
   editing that file: CoachInsightsPanel.js's chart-rendering
   (renderAll/resizeAll) is still called exactly as before, just
   from this file's switcher instead of that file's own.

   Loaded standalone: IIFE, no build step. Must load after
   RecommendationEngine.js (data), CoachUI.js (mounts the panel,
   exposes executeCommand), and CoachInsightsPanel.js (creates
   the tab row + insights pane this file extends and takes over
   switching for) — see index.html load order. Exposes
   global.CoachPlanPanel.
   ========================================================= */

(function (global) {
  'use strict';

  const PLAN_TAB_ID = 'plan';
  const PLAN_PANE_ID = 'coachPlan';

  // ---------- Data (all read from RecommendationEngine.js, nothing new) ----------

  function getPlan() {
    if (!global.RecommendationEngine) return null;
    return global.RecommendationEngine.dailyPlan();
  }

  const TYPE_LABELS = {
    due_review: '⏰ ถึงกำหนดทบทวน',
    leech: '🐛 Leech',
    repeated_mistake: '🔁 ผิดซ้ำใน Learn',
    weak_dimension: '📉 จุดอ่อนตามมิติ'
  };
  const PRIORITY_LABELS = { critical: 'ด่วนมาก', high: 'สำคัญ', medium: 'ปานกลาง', low: 'ทั่วไป' };

  function itemTitle(item) {
    if (item.type === 'weak_dimension') return item.label;
    if (item.words && item.words.length) {
      const shown = item.words.slice(0, 5).join(', ');
      const more = item.count > item.words.slice(0, 5).length ? ' และอีก ' + (item.count - 5) + ' คำ' : '';
      return shown + more;
    }
    return item.reason;
  }

  function actionLabel(command) {
    return {
      REVIEW_WORDS: '▶ ไปทบทวนใน Cardbox', START_FLASHCARD: '▶ ไปที่ Cardbox',
      START_QUIZ: '▶ ไปที่ Quiz', START_ANAGRAM: '▶ ไปฝึก Anagram',
      START_BINGO: '▶ ไปดูคำยาว (Browse)', START_ACTIVE_RECALL: '▶ ไปที่ Learn'
    }[command] || '▶ เริ่มฝึก';
  }

  // ---------- Rendering ----------

  function itemHTML(item, index) {
    const typeLabel = TYPE_LABELS[item.type] || item.type;
    const prLabel = PRIORITY_LABELS[item.priority] || item.priority;
    return (
      '<div class="coach-plan-item coach-plan-priority-' + (item.priority || 'low') + '">' +
        '<div class="coach-plan-item-head">' +
          '<span class="coach-plan-item-num">' + (index + 1) + '</span>' +
          '<span class="coach-plan-item-type">' + typeLabel + '</span>' +
          '<span class="coach-plan-item-priority">' + prLabel + '</span>' +
        '</div>' +
        '<div class="coach-plan-item-title">' + escapeHtmlLocal(itemTitle(item)) + '</div>' +
        '<div class="coach-plan-item-reason">' + escapeHtmlLocal(item.reason) + '</div>' +
        (item.suggestedCommand
          ? '<button type="button" class="coach-plan-action-btn" data-command="' + item.suggestedCommand + '" data-index="' + index + '">' + actionLabel(item.suggestedCommand) + '</button>'
          : '') +
      '</div>'
    );
  }

  // Minimal local escaper — this file doesn't have access to app.js's own
  // escapeHtml (closed IIFE, no exports), so it keeps its own tiny copy
  // rather than assuming one exists globally.
  function escapeHtmlLocal(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderPlan() {
    const el = document.getElementById(PLAN_PANE_ID);
    if (!el) return;
    const plan = getPlan();
    if (!plan) {
      el.innerHTML = '<div class="coach-chart-empty">ระบบวางแผนฝึกยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ</div>';
      return;
    }
    if (!plan.items.length) {
      el.innerHTML = '<div class="coach-chart-empty">' + escapeHtmlLocal(plan.summary) + '</div>';
      return;
    }
    el.innerHTML =
      '<div class="coach-plan-summary">' + escapeHtmlLocal(plan.summary) + '</div>' +
      plan.items.map(itemHTML).join('') +
      '<button type="button" class="coach-plan-refresh-btn" id="coachPlanRefreshBtn">🔄 คำนวณแผนใหม่</button>';

    el.querySelectorAll('.coach-plan-action-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const item = plan.items[idx];
        if (!item || !global.CoachUI) return;
        // Routed through CoachUI.js's own real executeCommand() — the
        // exact same function the chat responder uses — so a plan item's
        // action button and asking the coach the same thing in chat can
        // never diverge into two different behaviors.
        const params = {};
        if (item.count) params.count = item.count;
        if (item.words && item.words.length) params.words = item.words;
        global.CoachUI.executeCommand({
          command: item.suggestedCommand,
          params: params,
          message: '' // executeCommand only posts a chat message if one is given; the plan card already shows the reason
        });
      });
    });

    const refreshBtn = document.getElementById('coachPlanRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', renderPlan);
  }

  // ---------- Shared tab switcher (rebinds ALL .coach-tab-btn, incl. the
  // two CoachInsightsPanel.js already created) ----------

  // ---------- Generic tab registry (shared with any future coach-panel
  // tab, e.g. a later Repeated Mistakes view) ----------
  // CoachInsightsPanel.js's own switchTab() only ever knew about
  // "chat"/"insights". Rather than have every new tab re-fork its own
  // "hide everyone else" switcher the way this file first did (which
  // would only get more fragile with a 4th, 5th tab), this registry is
  // the single place that knows the full set of non-chat panes. Each
  // entry is { paneId, onShow } — onShow runs whenever that tab becomes
  // active (e.g. to render/resize charts), same as this file's own
  // isInsights/isPlan branches already did inline.
  const paneRegistry = new Map(); // tabId -> { paneId, onShow }

  function registerTab(tabId, paneId, onShow) {
    paneRegistry.set(tabId, { paneId: paneId, onShow: onShow || function () {} });
  }
  registerTab('insights', 'coachInsights', function () {
    if (!global.CoachInsightsPanel) return;
    global.CoachInsightsPanel.renderAll();
    setTimeout(function () {
      // CoachInsightsPanel.js's own resize helper isn't exposed
      // (resizeAll is a private function in that file), but its charts
      // still listen to window 'resize' — dispatching one after the
      // panel's width transition settles gets them sized correctly
      // without needing that file to expose anything new.
      window.dispatchEvent(new Event('resize'));
    }, 220);
  });
  registerTab(PLAN_TAB_ID, PLAN_PANE_ID, renderPlan);

  function switchTab(tab) {
    const panel = document.getElementById('coachPanel');
    const messages = document.getElementById('coachMessages');
    const quickRow = document.getElementById('coachQuickRow');
    const form = document.getElementById('coachForm');
    if (!panel) return;

    const activeEntry = paneRegistry.get(tab);
    const isChat = !activeEntry;

    paneRegistry.forEach(function (entry, tabId) {
      const el = document.getElementById(entry.paneId);
      if (el) el.hidden = (tabId !== tab);
    });
    if (messages) messages.hidden = !isChat;
    if (quickRow) quickRow.hidden = !isChat;
    if (form) form.hidden = !isChat;
    // Any non-chat tab gets the same wide-panel treatment — one shared
    // visual rule for "a bigger pane than chat is open", regardless of
    // how many such panes end up existing.
    panel.classList.toggle('coach-panel-wide', !isChat);

    document.querySelectorAll('.coach-tab-btn').forEach(function (btn) {
      btn.classList.toggle('coach-tab-active', btn.getAttribute('data-tab') === tab);
    });

    if (activeEntry) activeEntry.onShow();
  }

  function rebindTabButtons() {
    document.querySelectorAll('.coach-tab-btn').forEach(function (btn) {
      // Clone-and-replace strips CoachInsightsPanel.js's own listener
      // (added at its wireInto() time) so there is exactly one active
      // click handler per button afterward — this file's switchTab(),
      // which already covers everything that handler did (chat/insights)
      // plus the new plan tab.
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener('click', function () { switchTab(clone.getAttribute('data-tab')); });
    });
  }

  function planTabButtonHTML() {
    return '<button type="button" class="coach-tab-btn" data-tab="' + PLAN_TAB_ID + '">📋 แผนวันนี้</button>';
  }

  function planPaneHTML() {
    return '<div id="' + PLAN_PANE_ID + '" class="coach-plan-pane" hidden></div>';
  }

  function wireInto() {
    const tabRow = document.getElementById('coachTabRow');
    const insights = document.getElementById('coachInsights');
    if (!tabRow || !insights || document.getElementById(PLAN_PANE_ID)) return false; // not ready, or already wired
    tabRow.insertAdjacentHTML('beforeend', planTabButtonHTML());
    insights.insertAdjacentHTML('afterend', planPaneHTML());
    rebindTabButtons();
    return true;
  }

  function init() {
    // CoachInsightsPanel.js mounts #coachTabRow/#coachInsights via its own
    // short poll after CoachUI.js creates #coachPanel. Poll the same way
    // here rather than assuming a fixed delay — resilient to either file's
    // timing changing later.
    let attempts = 0;
    const timer = setInterval(function () {
      attempts++;
      if (wireInto() || attempts > 50) clearInterval(timer); // ~5s at 100ms, then give up quietly
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CoachPlanPanel = { renderPlan: renderPlan, switchTab: switchTab };

  // Shared tab registry — exposed so a later coach-panel tab (loaded
  // after this file) can add itself without re-forking switchTab() the
  // way this file first had to on top of CoachInsightsPanel.js. A new
  // tab: (1) inserts its own button + pane into the DOM, (2) calls
  // global.CoachTabs.registerTab(tabId, paneId, onShow), (3) calls
  // global.CoachTabs.rebindTabButtons() once its button exists.
  global.CoachTabs = {
    registerTab: registerTab,
    rebindTabButtons: rebindTabButtons,
    switchTab: switchTab
  };
})(window);
