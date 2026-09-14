/* =========================================================
   CSW24 Word Lab — AI Coach: CoachCharts.js
   =========================================================
   Scope: ONE thing only — ECharts rendering helpers for
   whatever NEW charts the AI Coach panel needs (accuracy
   trend, weakness-by-dimension radar, etc., built on top of
   PerformanceAnalyzer.js / the coming WeaknessDetector.js).

   This does NOT touch, replace, or duplicate the existing
   Chart.js bar chart on the Stats tab (js/app.js,
   renderStatsOverviewChart / #statsOverviewChart). That chart,
   and Chart.js as its library, stay exactly as they are.
   ECharts here is scoped to coach-panel charts only, rendered
   into their own container elements (ids prefixed "coach"),
   so the two libraries never touch the same canvas/DOM node
   and never conflict.

   Every number plotted here must be passed in by the caller
   (WeaknessDetector.js / RecommendationEngine.js / CoachUI.js)
   from a real PerformanceAnalyzer.js report — this file only
   draws what it's given, it never computes or invents a
   metric itself.

   Loaded standalone, like CoachSearchIndex.js: IIFE, no build
   step. Exposes global.CoachCharts.
   ========================================================= */

(function (global) {
  'use strict';

  // Keep one ECharts instance per container id so re-rendering (new
  // data, tab re-opened, language switch) disposes/reuses cleanly
  // instead of stacking duplicate instances on the same DOM node —
  // mirrors how app.js keeps a single Chart.js instance for its own
  // canvas.
  const instances = new Map(); // containerId -> echarts instance

  function getInstance(containerId) {
    if (!global.echarts) return null;
    const el = document.getElementById(containerId);
    if (!el) return null;
    let inst = instances.get(containerId);
    if (inst && !inst.isDisposed()) return inst;
    inst = global.echarts.init(el);
    instances.set(containerId, inst);
    return inst;
  }

  // Shared dark-theme-ish palette to match the app's existing stats
  // colors (see js/app.js renderStatsOverviewChart's own palette) so a
  // coach-panel chart doesn't look like it came from a different app.
  const PALETTE = ['#7C9EFF', '#7FE0B0', '#F2C879', '#C7A0FF', '#FF9AA6', '#8890A8'];

  // ---------- Accuracy-over-time line chart ----------
  // points: [{ label: string, accuracy: number|null }, ...] — caller
  // supplies this from PerformanceAnalyzer.js data (e.g. accuracy per day
  // or per session). A null accuracy (no samples that period) is plotted
  // as a gap, never coerced to 0.
  function renderAccuracyTrend(containerId, points, title) {
    const inst = getInstance(containerId);
    if (!inst || !Array.isArray(points)) return false;
    inst.setOption({
      backgroundColor: 'transparent',
      title: title ? { text: title, textStyle: { color: '#e6e6ef', fontSize: 13 } } : undefined,
      grid: { left: 36, right: 16, top: title ? 36 : 16, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: points.map(function (p) { return p.label; }),
        axisLine: { lineStyle: { color: '#8890A8' } },
        axisLabel: { color: '#8890A8', fontSize: 10 }
      },
      yAxis: {
        type: 'value', min: 0, max: 100,
        axisLabel: { color: '#8890A8', formatter: '{value}%' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
      },
      series: [{
        type: 'line',
        data: points.map(function (p) { return (typeof p.accuracy === 'number') ? p.accuracy : null; }),
        connectNulls: false,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: PALETTE[0], width: 2 },
        itemStyle: { color: PALETTE[0] },
        areaStyle: { color: PALETTE[0], opacity: 0.12 }
      }]
    }, true);
    return true;
  }

  // ---------- Weakness radar (Word Length / Anagram / Bingo / Stem / etc.) ----------
  // dims: [{ name: string, accuracy: number|null, sampleSize: number }, ...]
  // Dimensions with sampleSize 0 are still shown on the axis (so the
  // shape of what's untested is visible) but plotted as 0 with a
  // dedicated tooltip note, never presented as "0% accuracy" fact.
  function renderWeaknessRadar(containerId, dims, title) {
    const inst = getInstance(containerId);
    if (!inst || !Array.isArray(dims) || !dims.length) return false;
    const indicator = dims.map(function (d) { return { name: d.name, max: 100 }; });
    const values = dims.map(function (d) { return (typeof d.accuracy === 'number') ? d.accuracy : 0; });
    inst.setOption({
      backgroundColor: 'transparent',
      title: title ? { text: title, textStyle: { color: '#e6e6ef', fontSize: 13 } } : undefined,
      tooltip: {
        formatter: function () {
          return dims.map(function (d, i) {
            const acc = (typeof d.accuracy === 'number') ? d.accuracy + '%' : 'ยังไม่มีข้อมูล';
            return d.name + ': ' + acc + ' (n=' + d.sampleSize + ')';
          }).join('<br/>');
        }
      },
      radar: {
        indicator: indicator,
        axisName: { color: '#8890A8', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } }
      },
      series: [{
        type: 'radar',
        data: [{
          value: values,
          name: 'Accuracy %',
          areaStyle: { color: PALETTE[2], opacity: 0.15 },
          lineStyle: { color: PALETTE[2], width: 2 },
          itemStyle: { color: PALETTE[2] }
        }]
      }]
    }, true);
    return true;
  }

  // ---------- Generic bar chart (priority scores, due/leech counts, etc.) ----------
  // bars: [{ label: string, value: number }, ...]
  function renderBar(containerId, bars, title) {
    const inst = getInstance(containerId);
    if (!inst || !Array.isArray(bars)) return false;
    inst.setOption({
      backgroundColor: 'transparent',
      title: title ? { text: title, textStyle: { color: '#e6e6ef', fontSize: 13 } } : undefined,
      grid: { left: 36, right: 16, top: title ? 36 : 16, bottom: 40 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: bars.map(function (b) { return b.label; }),
        axisLine: { lineStyle: { color: '#8890A8' } },
        axisLabel: { color: '#8890A8', fontSize: 10, rotate: bars.length > 5 ? 30 : 0 }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#8890A8' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
      },
      series: [{
        type: 'bar',
        data: bars.map(function (b, i) { return { value: b.value, itemStyle: { color: PALETTE[i % PALETTE.length] } }; }),
        barMaxWidth: 36
      }]
    }, true);
    return true;
  }

  function resize(containerId) {
    const inst = instances.get(containerId);
    if (inst && !inst.isDisposed()) inst.resize();
  }

  function dispose(containerId) {
    const inst = instances.get(containerId);
    if (inst && !inst.isDisposed()) inst.dispose();
    instances.delete(containerId);
  }

  function isAvailable() {
    return !!global.echarts;
  }

  global.CoachCharts = {
    renderAccuracyTrend: renderAccuracyTrend,
    renderWeaknessRadar: renderWeaknessRadar,
    renderBar: renderBar,
    resize: resize,
    dispose: dispose,
    isAvailable: isAvailable
  };

  // Resize every live coach chart on window resize — same pattern
  // Chart.js's own `responsive: true` gives the Stats-tab chart for free;
  // ECharts needs an explicit resize() call.
  window.addEventListener('resize', function () {
    instances.forEach(function (inst, id) { resize(id); });
  });
})(window);
