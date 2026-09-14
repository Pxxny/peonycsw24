/* =========================================================
   CSW24 Word Lab — AI Coach: CoachMistakesPanel.js
   =========================================================
   Scope: the missing visible half of "Repeated Mistakes
   Tracking". WeaknessDetector.js's repeatedMistakeWords() has
   been computing this correctly for a while — group the raw
   Learn log by word, keep any word missed >= 2 times, rank
   worst-first. Until this file, that list was only ever
   consumed as an INGREDIENT by other modules (capped at 5 words
   inside RecommendationEngine.js's daily plan, or used as seed
   words for AdaptiveQuiz.js) — there was nowhere the learner
   could see their own full repeated-mistakes list on its own.

   This file computes NOTHING new. Every row shown here is
   exactly what WeaknessDetector.repeatedMistakeWords() already
   returns (word, len, attempts, mistakes, accuracy,
   avgResponseMs, lastMistakeAt) — this file only renders that
   list as a sortable/filterable table and wires one real action
   per row (add the word back to Cardbox for extra practice),
   via the same CSW24Bridge.addToCardbox() the rest of the coach
   already uses.

   Fourth coach-panel tab, alongside chat / Insights
   (CoachInsightsPanel.js) / Daily Plan (CoachPlanPanel.js).
   CoachPlanPanel.js already had to solve "how does a second
   tab extend a switcher that only knew about two tabs" once
   (by rebinding every button itself); rather than repeat that
   same fork a second time, CoachPlanPanel.js now exposes a
   small shared registry (global.CoachTabs) for exactly this
   situation. This file uses that registry instead of forking
   switchTab() again — see CoachTabs.registerTab's own comment
   in CoachPlanPanel.js for the contract.

   Loaded standalone: IIFE, no build step. Must load after
   WeaknessDetector.js (data), CSW24Bridge (app.js — add-to-
   Cardbox action), and CoachPlanPanel.js (creates
   global.CoachTabs this file registers into) — see index.html
   load order. Exposes global.CoachMistakesPanel.
   ========================================================= */

(function (global) {
  'use strict';

  const MISTAKES_TAB_ID = 'mistakes';
  const MISTAKES_PANE_ID = 'coachMistakes';

  // ---------- Data (all read from WeaknessDetector.js, nothing new) ----------

  function getMistakeWords() {
    if (!global.WeaknessDetector) return null;
    return global.WeaknessDetector.repeatedMistakeWords(); // default threshold (>= 2 mistakes), full list, worst-first
  }

  function formatWhen(t) {
    if (!t) return '—';
    if (global.dayjs && global.dayjs_plugin_relativeTime) return global.dayjs(t).fromNow();
    const diffMs = Date.now() - t;
    const days = Math.floor(diffMs / 86400000);
    if (days < 1) return 'วันนี้';
    if (days === 1) return 'เมื่อวาน';
    return days + ' วันก่อน';
  }

  function severityClass(mistakes) {
    if (mistakes >= 5) return 'critical';
    if (mistakes >= 3) return 'high';
    return 'medium';
  }

  // ---------- Rendering ----------

  function escapeHtmlLocal(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function rowHTML(w) {
    return (
      '<div class="coach-mistake-row coach-mistake-sev-' + severityClass(w.mistakes) + '">' +
        '<div class="coach-mistake-word">' + escapeHtmlLocal(w.word) + '<span class="coach-mistake-len">' + w.len + ' ตัวอักษร</span></div>' +
        '<div class="coach-mistake-stats">' +
          '<span class="coach-mistake-stat">❌ ผิด <b>' + w.mistakes + '</b>/' + w.attempts + ' ครั้ง</span>' +
          '<span class="coach-mistake-stat">✅ ถูก <b>' + w.accuracy + '%</b></span>' +
          (typeof w.avgResponseMs === 'number' ? '<span class="coach-mistake-stat">⏱️ เฉลี่ย <b>' + (w.avgResponseMs / 1000).toFixed(1) + 's</b></span>' : '') +
          '<span class="coach-mistake-stat">🕓 ผิดล่าสุด <b>' + formatWhen(w.lastMistakeAt) + '</b></span>' +
        '</div>' +
        '<button type="button" class="coach-mistake-action-btn" data-word="' + escapeHtmlLocal(w.word) + '">+ Cardbox</button>' +
      '</div>'
    );
  }

  function renderMistakes() {
    const el = document.getElementById(MISTAKES_PANE_ID);
    if (!el) return;
    const words = getMistakeWords();
    if (words === null) {
      el.innerHTML = '<div class="coach-chart-empty">ระบบวิเคราะห์จุดอ่อนยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ</div>';
      return;
    }
    if (!words.length) {
      el.innerHTML = '<div class="coach-chart-empty">🎉 ยังไม่มีคำที่ผิดซ้ำ (ตั้งแต่ 2 ครั้งขึ้นไป) เลย — เก่งมากครับ</div>';
      return;
    }
    el.innerHTML =
      '<div class="coach-mistake-summary">พบคำที่ผิดซ้ำ (≥ 2 ครั้ง) ทั้งหมด ' + words.length + ' คำ เรียงจากผิดบ่อยสุด</div>' +
      words.map(rowHTML).join('');

    el.querySelectorAll('.coach-mistake-action-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const word = btn.getAttribute('data-word');
        const bridge = global.CSW24Bridge;
        if (!bridge) return;
        const added = bridge.addToCardbox([word]);
        btn.textContent = added > 0 ? '✓ เพิ่มแล้ว' : 'มีอยู่แล้ว';
        btn.disabled = true;
      });
    });
  }

  // ---------- Tab button + pane markup, wired via the shared CoachTabs registry ----------

  function mistakesTabButtonHTML() {
    return '<button type="button" class="coach-tab-btn" data-tab="' + MISTAKES_TAB_ID + '">🔁 ผิดซ้ำ</button>';
  }

  function mistakesPaneHTML() {
    return '<div id="' + MISTAKES_PANE_ID + '" class="coach-mistakes-pane" hidden></div>';
  }

  function wireInto() {
    const tabRow = document.getElementById('coachTabRow');
    // Anchor after the Plan pane if it exists (keeps tab order
    // chat -> insights -> plan -> mistakes), falling back to right after
    // Insights if CoachPlanPanel.js somehow isn't present, so this file
    // still works standalone rather than silently failing to mount.
    const anchor = document.getElementById('coachPlan') || document.getElementById('coachInsights');
    if (!tabRow || !anchor || !global.CoachTabs || document.getElementById(MISTAKES_PANE_ID)) return false;

    tabRow.insertAdjacentHTML('beforeend', mistakesTabButtonHTML());
    anchor.insertAdjacentHTML('afterend', mistakesPaneHTML());
    global.CoachTabs.registerTab(MISTAKES_TAB_ID, MISTAKES_PANE_ID, renderMistakes);
    global.CoachTabs.rebindTabButtons();
    return true;
  }

  function init() {
    // Same short-poll pattern CoachPlanPanel.js/CoachInsightsPanel.js use —
    // waits for the coach panel (and CoachTabs registry) to exist without
    // assuming a fixed load-order delay.
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

  global.CoachMistakesPanel = { renderMistakes: renderMistakes };
})(window);
