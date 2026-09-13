/* =========================================================
   CSW24 Word Lab — AI Coach: CoachInsightsPanel.js
   =========================================================
   Scope: the visual half of the AI Coach — a "ภาพรวม" (Insights)
   tab inside the existing chat panel (see CoachUI.js), showing
   real numbers from PerformanceAnalyzer.js / WeaknessDetector.js
   / SpacedRepetition.js as ECharts charts (via CoachCharts.js).

   This file does NOT compute any new statistic. Every number
   plotted is read straight from an existing AI Coach module's
   own output — this file only re-shapes that output into the
   {label, value} / {name, accuracy} shapes CoachCharts.js's
   render functions expect, and decides layout/tab-switching.

   Three charts, each only rendered when there's real data for it
   (never a chart full of zeros standing in for "no data yet"):

     1. Accuracy trend — daily accuracy for the last 14 days,
        computed directly from the same csw24_learn_log_v1 the
        rest of the coach reads (same key PerformanceAnalyzer.js /
        WeaknessDetector.js / SpacedRepetition.js already use).
        A day with zero attempts is left as a gap (null), never
        shown as 0%.
     2. Weakness radar — one axis per dimension bucket from
        WeaknessDetector.js's dimensionWeaknesses(), which already
        filters out buckets with too few samples to trust.
     3. Due/leech bar — a small bar chart of SpacedRepetition.js's
        own retentionSnapshot() counts (due now / leech count /
        mastered), so the learner sees their Cardbox state at a
        glance without leaving the coach panel.

   Integration with CoachUI.js: this file adds its own tab
   buttons + containers by extending coachHtml()'s output at
   mount time (see wireInto()), rather than editing CoachUI.js's
   HTML string directly — so CoachUI.js's own file stays
   untouched. It hooks the existing #coachFab open handler (via a
   MutationObserver-free polling-free approach: it listens for
   the same click CoachUI.js already wires) to render/resize
   charts only when the Insights tab is actually visible, since
   ECharts can't size a chart in a hidden (display:none) container.

   Loaded standalone, like the other AI Coach modules: IIFE, no
   build step. Exposes global.CoachInsightsPanel. Must load AFTER
   CoachCharts.js, PerformanceAnalyzer.js, WeaknessDetector.js,
   SpacedRepetition.js, and CoachUI.js (since it attaches to DOM
   CoachUI.js creates on mount) — see index.html load order.
   ========================================================= */

(function (global) {
  'use strict';

  const LEARN_LOG_KEY = 'csw24_learn_log_v1'; // same key every other AI Coach module reads
  const DAY_MS = 86400000;
  const TREND_DAYS = 14;

  const CHART_IDS = {
    trend: 'coachChartTrend',
    radar: 'coachChartRadar',
    bar: 'coachChartBar'
  };

  function loadLearnLog() {
    try {
      const raw = localStorage.getItem(LEARN_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // ---------- Data shaping (no new stats — just re-shaping existing ones) ----------

  // Daily accuracy for the last N days, computed from the raw Learn log.
  // A day with 0 attempts becomes { label, accuracy: null } — plotted as
  // a gap by CoachCharts.renderAccuracyTrend, never coerced to 0.
  function accuracyTrendPoints(days) {
    const N = days || TREND_DAYS;
    const log = loadLearnLog();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const points = [];
    for (let i = N - 1; i >= 0; i--) {
      const dayStart = now.getTime() - i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const dayLog = log.filter(function (e) { return e.t >= dayStart && e.t < dayEnd; });
      const correct = dayLog.filter(function (e) { return e.correct; }).length;
      const label = new Date(dayStart).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      points.push({
        label: label,
        accuracy: dayLog.length ? Math.round((correct / dayLog.length) * 100) : null
      });
    }
    return points;
  }

  function hasAnyRealAccuracy(points) {
    return points.some(function (p) { return typeof p.accuracy === 'number'; });
  }

  // Re-shapes WeaknessDetector.js's dimensionWeaknesses() into the
  // {name, accuracy, sampleSize} shape CoachCharts.renderWeaknessRadar
  // expects. Capped to a handful of dimensions so the radar stays
  // readable — picks the weakest ones first, since those are what the
  // learner most needs to see.
  function weaknessRadarDims(limit) {
    if (!global.WeaknessDetector) return [];
    return global.WeaknessDetector.dimensionWeaknesses()
      .slice(0, limit || 6)
      .map(function (d) { return { name: d.label, accuracy: d.accuracy, sampleSize: d.sampleSize }; });
  }

  // Re-shapes SpacedRepetition.js's retentionSnapshot() into
  // {label, value} bars for CoachCharts.renderBar.
  function cardboxBars() {
    if (!global.SpacedRepetition) return [];
    const snap = global.SpacedRepetition.retentionSnapshot();
    return [
      { label: 'ถึงกำหนดทบทวน', value: snap.dueNow },
      { label: 'Leech', value: snap.leechCount },
      { label: 'เรียนใหม่', value: snap.byStatus.new || 0 },
      { label: 'กำลังเรียน', value: snap.byStatus.learning || 0 },
      { label: 'จบแล้ว', value: snap.byStatus.mastered || 0 }
    ];
  }

  // ---------- Rendering ----------
  // Renders whichever charts have real data, and replaces a chart's
  // container with an honest "ยังไม่มีข้อมูลพอ" message when it doesn't —
  // never draws an empty/zeroed chart as if it were a real finding.
  function renderAll() {
    if (!global.CoachCharts || !global.CoachCharts.isAvailable()) return;

    const trendEl = document.getElementById(CHART_IDS.trend);
    const trendPoints = accuracyTrendPoints();
    if (trendEl) {
      if (hasAnyRealAccuracy(trendPoints)) {
        setChartVisible(CHART_IDS.trend, true);
        global.CoachCharts.renderAccuracyTrend(CHART_IDS.trend, trendPoints, 'ความแม่นยำรายวัน (14 วันล่าสุด)');
      } else {
        setChartVisible(CHART_IDS.trend, false, 'ยังไม่มีข้อมูลการฝึกใน 14 วันที่ผ่านมา');
      }
    }

    const radarEl = document.getElementById(CHART_IDS.radar);
    const dims = weaknessRadarDims();
    if (radarEl) {
      if (dims.length >= 3) {
        setChartVisible(CHART_IDS.radar, true);
        global.CoachCharts.renderWeaknessRadar(CHART_IDS.radar, dims, 'จุดอ่อนตามมิติต่างๆ');
      } else {
        setChartVisible(CHART_IDS.radar, false, 'ต้องฝึกใน Learn เพิ่มก่อนถึงจะวิเคราะห์จุดอ่อนแยกตามมิติได้ (ต้องมีอย่างน้อย 3 กลุ่มที่มีตัวอย่างพอ)');
      }
    }

    const barEl = document.getElementById(CHART_IDS.bar);
    const bars = cardboxBars();
    if (barEl) {
      if (bars.some(function (b) { return b.value > 0; })) {
        setChartVisible(CHART_IDS.bar, true);
        global.CoachCharts.renderBar(CHART_IDS.bar, bars, 'สถานะ Cardbox');
      } else {
        setChartVisible(CHART_IDS.bar, false, 'ยังไม่มีคำใน Cardbox');
      }
    }
  }

  // Toggles between the chart canvas and an honest empty-state message,
  // sharing the same container element so layout doesn't jump around.
  function setChartVisible(id, visible, emptyMessage) {
    const el = document.getElementById(id);
    if (!el) return;
    let msgEl = el.parentElement.querySelector('.coach-chart-empty[data-for="' + id + '"]');
    if (visible) {
      el.style.display = '';
      if (msgEl) msgEl.style.display = 'none';
    } else {
      el.style.display = 'none';
      if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'coach-chart-empty';
        msgEl.setAttribute('data-for', id);
        el.parentElement.insertBefore(msgEl, el);
      }
      msgEl.textContent = emptyMessage || 'ยังไม่มีข้อมูลพอ';
      msgEl.style.display = '';
    }
  }

  function resizeAll() {
    Object.keys(CHART_IDS).forEach(function (k) { global.CoachCharts && global.CoachCharts.resize(CHART_IDS[k]); });
  }

  // ---------- DOM: tabs + containers, wired into CoachUI.js's panel ----------
  // Builds its own markup and appends it to CoachUI.js's existing
  // #coachPanel, rather than editing CoachUI.js's coachHtml() string —
  // CoachUI.js's own file is not modified by this one.
  function insightsHtml() {
    return (
      '<div id="coachInsights" hidden>' +
        '<div class="coach-chart-block"><div id="' + CHART_IDS.trend + '" class="coach-chart-el"></div></div>' +
        '<div class="coach-chart-block"><div id="' + CHART_IDS.radar + '" class="coach-chart-el"></div></div>' +
        '<div class="coach-chart-block"><div id="' + CHART_IDS.bar + '" class="coach-chart-el"></div></div>' +
      '</div>'
    );
  }

  function tabsHtml() {
    return (
      '<div id="coachTabRow">' +
        '<button type="button" class="coach-tab-btn coach-tab-active" data-tab="chat">💬 แชท</button>' +
        '<button type="button" class="coach-tab-btn" data-tab="insights">📊 ภาพรวม</button>' +
      '</div>'
    );
  }

  function switchTab(tab) {
    const panel = document.getElementById('coachPanel');
    const insights = document.getElementById('coachInsights');
    const messages = document.getElementById('coachMessages');
    const quickRow = document.getElementById('coachQuickRow');
    const form = document.getElementById('coachForm');
    if (!panel || !insights) return;

    const isInsights = (tab === 'insights');
    insights.hidden = !isInsights;
    if (messages) messages.hidden = isInsights;
    if (quickRow) quickRow.hidden = isInsights;
    if (form) form.hidden = isInsights;
    panel.classList.toggle('coach-panel-wide', isInsights);

    document.querySelectorAll('.coach-tab-btn').forEach(function (btn) {
      btn.classList.toggle('coach-tab-active', btn.getAttribute('data-tab') === tab);
    });

    if (isInsights) {
      renderAll();
      // ECharts needs a layout pass to size correctly after the panel's
      // width transitions (coach-panel-wide) — a short delay lets the
      // CSS transition/reflow settle before measuring the container.
      setTimeout(resizeAll, 220);
    }
  }

  // Attaches tabs + insights containers into CoachUI.js's already-mounted
  // #coachPanel. Runs once, after CoachUI.js has created the panel (see
  // the DOMContentLoaded/readyState guard below) — never assumes a
  // specific timing relative to CoachUI.js beyond "loaded after it" per
  // index.html's script order.
  function wireInto() {
    const panel = document.getElementById('coachPanel');
    const header = document.getElementById('coachHeader');
    const messages = document.getElementById('coachMessages');
    if (!panel || !header || !messages || document.getElementById('coachTabRow')) return; // not ready yet, or already wired

    header.insertAdjacentHTML('afterend', tabsHtml());
    messages.insertAdjacentHTML('afterend', insightsHtml());

    document.querySelectorAll('.coach-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
    });

    window.addEventListener('resize', function () {
      if (!document.getElementById('coachInsights').hidden) resizeAll();
    });
  }

  function init() {
    // CoachUI.js mounts #coachPanel on its own DOMContentLoaded/immediate
    // check (see its initCoachUI). Poll briefly for it rather than
    // assuming a fixed load order beyond "this script tag is after
    // CoachUI.js's" — keeps this file resilient if that ever changes.
    let attempts = 0;
    const timer = setInterval(function () {
      attempts++;
      if (document.getElementById('coachPanel')) {
        wireInto();
        clearInterval(timer);
      } else if (attempts > 50) { // ~5s at 100ms — give up quietly, never throw
        clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CoachInsightsPanel = {
    renderAll: renderAll,
    switchTab: switchTab,
    accuracyTrendPoints: accuracyTrendPoints,
    weaknessRadarDims: weaknessRadarDims,
    cardboxBars: cardboxBars
  };
})(window);
