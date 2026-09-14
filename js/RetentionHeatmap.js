/* =========================================================
   CSW24 Word Lab — RetentionHeatmap.js
   =========================================================
   Scope: turn the two logs app.js already writes —
   csw24_word_history_v1 (every word encounter, any mode) and
   csw24_learn_log_v1 (per-answer correct/incorrect) — into a
   day-by-day activity map for a GitHub-style contribution
   heatmap calendar. This file computes no new raw event; it
   only buckets existing timestamps by calendar day (in the
   learner's own local timezone) and counts/aggregates what's
   already there. Read-only against both localStorage keys —
   never writes to either.

   Two numbers per day, both real:
     - count: total word encounters that day, from
       csw24_word_history_v1 (every mode — Learn, Quiz, Typing,
       Cardbox review, Minigames, Browse, etc.), so a day with
       activity in ANY part of the app lights up, not just Learn.
     - accuracyPct: that day's correct/total from
       csw24_learn_log_v1, when at least one Learn-tab answer
       was logged that day; null when there isn't one (never
       guessed or defaulted to 0).

   Intensity buckets (0-4) are computed relative to the
   learner's OWN busiest day in the window, never a fixed
   hardcoded threshold — so the heatmap stays meaningful whether
   someone studies 5 words a day or 500.

   Loaded standalone, same as PerformanceAnalyzer.js — app.js
   exposes nothing globally by design, so this file only reads
   the same localStorage keys app.js already writes.
   ========================================================= */

(function (global) {
  'use strict';

  const HISTORY_KEY = 'csw24_word_history_v1';
  const LEARN_LOG_KEY = 'csw24_learn_log_v1';

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function loadHistory() { return loadJSON(HISTORY_KEY, {}); }
  function loadLearnLog() { return loadJSON(LEARN_LOG_KEY, []); }

  // Local (not UTC) calendar-day key, so a learner's "today" always
  // matches the day they actually studied on, regardless of timezone.
  function dayKey(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function addDays(dateObj, n) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + n);
    return d;
  }

  function startOfLocalDay(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Builds { [YYYY-MM-DD]: { count, correct, total, accuracyPct } } for
   * every day that has at least one real event in either log — plus every
   * day in between so callers can fill gaps as true zeros, not omissions.
   */
  function dailyMap(daysBack) {
    const hist = loadHistory();
    const log = loadLearnLog();

    const map = {};
    function ensure(key) {
      return map[key] || (map[key] = { count: 0, correct: 0, total: 0 });
    }

    Object.keys(hist).forEach(function (word) {
      hist[word].forEach(function (e) {
        if (!e || typeof e.t !== 'number') return;
        ensure(dayKey(e.t)).count++;
      });
    });

    log.forEach(function (e) {
      if (!e || typeof e.t !== 'number') return;
      const bucket = ensure(dayKey(e.t));
      bucket.total++;
      if (e.correct) bucket.correct++;
    });

    // Fill every day in the requested window (even zero-activity ones) so
    // the calendar grid never has a silently-missing cell.
    const today = startOfLocalDay(Date.now());
    for (let i = 0; i < daysBack; i++) {
      const key = dayKey(addDays(today, -i).getTime());
      ensure(key);
    }

    Object.keys(map).forEach(function (key) {
      const b = map[key];
      b.accuracyPct = b.total ? Math.round((b.correct / b.total) * 100) : null;
    });

    return map;
  }

  /**
   * Ordered array (oldest -> newest) of { date, count, accuracyPct, level }
   * covering exactly `daysBack` days ending today (inclusive). `level` is
   * 0-4, scaled against the busiest day actually seen in this window —
   * never a fixed constant — so it stays meaningful at any activity scale.
   */
  function calendarRange(daysBack) {
    const map = dailyMap(daysBack);
    const today = startOfLocalDay(Date.now());
    const days = [];
    let maxCount = 0;

    for (let i = daysBack - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dayKey(d.getTime());
      const bucket = map[key] || { count: 0, accuracyPct: null };
      if (bucket.count > maxCount) maxCount = bucket.count;
      days.push({ date: key, count: bucket.count, accuracyPct: bucket.accuracyPct });
    }

    days.forEach(function (day) {
      if (!maxCount || day.count === 0) { day.level = 0; return; }
      const ratio = day.count / maxCount;
      if (ratio >= 0.8) day.level = 4;
      else if (ratio >= 0.55) day.level = 3;
      else if (ratio >= 0.3) day.level = 2;
      else day.level = 1;
    });

    return days;
  }

  // Current streak (consecutive days up to and including today, or up to
  // yesterday if nothing logged yet today) and the longest streak inside
  // the window — both straight counts over calendarRange(), no inference.
  function streaks(daysBack) {
    const days = calendarRange(daysBack);
    let longest = 0, run = 0;
    days.forEach(function (day) {
      if (day.count > 0) { run++; longest = Math.max(longest, run); }
      else { run = 0; }
    });

    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) current++;
      else if (i === days.length - 1) continue; // today with 0 yet: don't break the streak
      else break;
    }
    // If today has 0 and yesterday broke it, current is correctly 0 from
    // the loop above once it hits the first non-today zero day.
    if (days.length && days[days.length - 1].count === 0) {
      current = 0;
      for (let i = days.length - 2; i >= 0; i--) {
        if (days[i].count > 0) current++;
        else break;
      }
    }

    return { current: current, longest: longest };
  }

  function summary(daysBack) {
    const days = calendarRange(daysBack);
    const activeDays = days.filter(function (d) { return d.count > 0; }).length;
    const totalEvents = days.reduce(function (sum, d) { return sum + d.count; }, 0);
    return {
      daysBack: daysBack,
      activeDays: activeDays,
      totalDays: days.length,
      totalEvents: totalEvents,
      streaks: streaks(daysBack)
    };
  }

  global.RetentionHeatmap = {
    dailyMap: dailyMap,
    calendarRange: calendarRange,
    streaks: streaks,
    summary: summary
  };
})(window);
