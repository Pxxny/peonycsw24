/* =========================================================
   CSW24 Word Lab — AI Coach: SpacedRepetition.js
   =========================================================
   Scope, by design: READ + PREVIEW ONLY. This file never
   writes card.due / card.interval / card.ease / card.streak /
   card.leech / card.reps — those fields belong to app.js's own
   "simplified SM-2 style spaced repetition" (updateCardResult,
   newCard, in the Cardbox section of app.js). That function is
   the ONLY place allowed to change a real review schedule.

   What this file DOES do, all read-only against the same
   csw24_cardbox_v1 localStorage key app.js already writes:

     - Rank the current due queue (what's overdue, by how much,
       and what to review first).
     - Forecast retention / review load for the next N days from
       the schedule that already exists.
     - Surface leech patterns (which words, how long they've
       been stuck) from the leech flag app.js already maintains.
     - PREVIEW "if this card is answered correct/hint/incorrect/
       skipped right now, what would its next due date become?"
       — a pure simulation using an exact mirror of app.js's own
       formula, computed on a *copy* of the card. This never
       touches localStorage and never calls updateCardResult.
       If the learner wants that outcome for real, the AI Coach
       must do it through the existing bridge (CSW24Bridge /
       app.js's own quiz-answering flow) — never here.

   Any actual change to a review schedule must go through
   app.js's existing updateCardResult, reached (for the AI
   Coach) only via window.CSW24Bridge — e.g. by routing the
   learner into REVIEW_WORDS / START_FLASHCARD so app.js's own
   Cardbox UI records the real answer. This file has no write
   path to Cardbox at all, on purpose.

   Loaded standalone, like PerformanceAnalyzer.js: IIFE, no
   build step, reads localStorage directly. Exposes
   global.SpacedRepetition.
   ========================================================= */

(function (global) {
  'use strict';

  const CARDBOX_KEY = 'csw24_cardbox_v1';   // same key app.js uses
  const SETTINGS_KEY = 'csw24_settings_v1'; // same key app.js uses
  const DAY_MS = 86400000;                  // same constant app.js uses
  const DEFAULT_LEECH_THRESHOLD = 4;        // app.js's own default

  function loadCardbox() {
    try {
      const raw = localStorage.getItem(CARDBOX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function leechThreshold() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const s = raw ? JSON.parse(raw) : null;
      return (s && typeof s.leechThreshold === 'number') ? s.leechThreshold : DEFAULT_LEECH_THRESHOLD;
    } catch (e) {
      return DEFAULT_LEECH_THRESHOLD;
    }
  }

  // Same defaulting app.js's patchLegacyCard() does, applied read-only to
  // a card before this file reasons about it — so an old card missing a
  // field (ease/reps/etc.) is treated the same way app.js itself would
  // treat it, without mutating the real stored object.
  function normalized(card) {
    return {
      word: card.word,
      correct: card.correct || 0,
      incorrect: card.incorrect || 0,
      skipped: card.skipped || 0,
      status: card.status || 'new',
      ease: card.ease == null ? 2.5 : card.ease,
      reps: card.reps == null ? 0 : card.reps,
      interval: card.interval == null ? 0 : card.interval,
      due: card.due == null ? Date.now() : card.due,
      streak: card.streak == null ? 0 : card.streak,
      leech: card.leech == null ? false : card.leech,
      lastReviewed: card.lastReviewed || null,
      lastCorrectAt: card.lastCorrectAt || null,
      addedAt: card.addedAt || null
    };
  }

  // ---------- Due queue ranking ----------
  // Returns due cards sorted most-overdue-first (largest positive
  // overdueDays first), which is the single most useful "what should I
  // review right now" ordering — an SM-2 schedule already encodes
  // priority via due date, so no separate scoring is invented here.
  function dueQueue(nowMs) {
    const now = nowMs || Date.now();
    const box = loadCardbox().map(normalized);
    return box
      .filter(function (c) { return c.due <= now; })
      .map(function (c) {
        return Object.assign({}, c, { overdueDays: Math.floor((now - c.due) / DAY_MS) });
      })
      .sort(function (a, b) { return b.overdueDays - a.overdueDays; });
  }

  // Cards not yet due, soonest-due-first — useful for "what's coming up",
  // never presented as something to act on today.
  function upcomingQueue(nowMs, limit) {
    const now = nowMs || Date.now();
    const box = loadCardbox().map(normalized);
    return box
      .filter(function (c) { return c.due > now; })
      .sort(function (a, b) { return a.due - b.due; })
      .slice(0, limit || 20);
  }

  // ---------- Review-load forecast ----------
  // How many currently-scheduled cards become due on each of the next N
  // days, purely by reading each card's existing `due` timestamp — no
  // assumption about future answers, since a real outcome shifts a
  // card's due date and this file can't (and doesn't try to) predict
  // whether the learner will get it right.
  function forecast(days, nowMs) {
    const now = nowMs || Date.now();
    const N = days || 7;
    const box = loadCardbox().map(normalized);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const buckets = [];
    for (let i = 0; i < N; i++) {
      const dayStart = startOfToday.getTime() + i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      buckets.push({
        dayOffset: i,
        dateStartMs: dayStart,
        count: box.filter(function (c) { return c.due >= dayStart && c.due < dayEnd; }).length
      });
    }
    // Anything already overdue as of `now` collapses into day 0 alongside
    // today's newly-due cards, since it would all show up in the same
    // REVIEW_WORDS session today — not spread across a forecast that
    // hasn't happened yet.
    const alreadyOverdue = box.filter(function (c) { return c.due < startOfToday.getTime(); }).length;
    if (buckets.length) buckets[0].count += alreadyOverdue;
    return buckets;
  }

  // ---------- Leech pattern ----------
  // Every currently-flagged leech, ranked by consecutive-miss streak
  // (worst first) — streak and the leech flag itself are both fields
  // app.js's updateCardResult already maintains; this only reads and
  // ranks them, it doesn't decide what counts as a leech.
  function leechReport() {
    const threshold = leechThreshold();
    const box = loadCardbox().map(normalized);
    const leeches = box
      .filter(function (c) { return c.leech; })
      .sort(function (a, b) { return b.streak - a.streak; });
    return {
      threshold: threshold,
      count: leeches.length,
      words: leeches.map(function (c) {
        return { word: c.word, streak: c.streak, incorrect: c.incorrect, correct: c.correct, lastReviewed: c.lastReviewed };
      })
    };
  }

  // ---------- Retention snapshot ----------
  // Coarse, real-numbers-only summary of where the whole Cardbox stands
  // right now: how many cards per status, how many due, how many leech.
  // Deliberately does not attempt an actual "% retained" estimate — SM-2
  // ease/interval isn't a calibrated retention-probability model, and
  // inventing one here would violate the project's own "never invent
  // statistics" rule.
  function retentionSnapshot(nowMs) {
    const now = nowMs || Date.now();
    const box = loadCardbox().map(normalized);
    const byStatus = { new: 0, learning: 0, mastered: 0 };
    box.forEach(function (c) { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
    return {
      totalCards: box.length,
      byStatus: byStatus,
      dueNow: box.filter(function (c) { return c.due <= now; }).length,
      leechCount: box.filter(function (c) { return c.leech; }).length
    };
  }

  // ---------- Preview: what would the next review do? ----------
  // Pure function, exact mirror of app.js's updateCardResult formula.
  // Operates on a COPY (normalized(card)) and returns a new object;
  // never touches localStorage, never calls into app.js, never mutates
  // its input. outcome: 'correct' | 'correctWithHint' | 'incorrect' | 'skipped'.
  function previewNextReview(card, outcome) {
    const c = normalized(card);
    const isCorrect = (outcome === 'correct' || outcome === 'correctWithHint');
    const hintUsed = (outcome === 'correctWithHint');
    const isSkipped = (outcome === 'skipped');
    const now = Date.now();

    if (isCorrect) c.correct++; else c.incorrect++;
    if (isSkipped) c.skipped++;

    if (isCorrect) {
      c.streak = 0;
      c.leech = false;
    } else {
      c.streak = (c.streak || 0) + 1;
      if (c.streak >= leechThreshold()) c.leech = true;
    }

    if (isCorrect) {
      c.lastCorrectAt = now;
      if (c.reps === 0) c.interval = 1;
      else if (c.reps === 1) c.interval = 3;
      else c.interval = Math.max(1, Math.round(c.interval * c.ease));
      c.reps++;
      c.ease = Math.min(3.2, c.ease + (hintUsed ? 0.03 : 0.1));
      if (hintUsed) c.interval = Math.max(1, Math.round(c.interval * 0.6));
    } else {
      c.reps = 0;
      c.interval = 1;
      c.ease = Math.max(1.3, c.ease - (isSkipped ? 0.3 : 0.2));
    }
    c.due = now + c.interval * DAY_MS;

    if (c.correct >= 3) c.status = 'mastered';
    else if (c.correct >= 1) c.status = 'learning';
    else c.status = 'new';

    return {
      word: c.word,
      outcome: outcome,
      wouldBeStatus: c.status,
      wouldBeInterval: c.interval,
      wouldBeDue: c.due,
      wouldBeDueInDays: c.interval,
      wouldBeEase: Math.round(c.ease * 100) / 100,
      wouldBeStreak: c.streak,
      wouldBecomeLeech: c.leech && !normalized(card).leech
    };
  }

  // Convenience: preview all four outcomes at once for one word, e.g. for
  // a coach message like "ตอบถูก → อีก 3 วัน, ตอบผิด → พรุ่งนี้อีกครั้ง".
  function previewAllOutcomes(word) {
    const box = loadCardbox();
    const card = box.find(function (c) { return c.word === word; });
    if (!card) return null;
    return {
      word: word,
      correct: previewNextReview(card, 'correct'),
      correctWithHint: previewNextReview(card, 'correctWithHint'),
      incorrect: previewNextReview(card, 'incorrect'),
      skipped: previewNextReview(card, 'skipped')
    };
  }

  function fullReport(nowMs) {
    const now = nowMs || Date.now();
    return {
      generatedAt: now,
      retention: retentionSnapshot(now),
      due: dueQueue(now),
      upcoming: upcomingQueue(now, 20),
      forecast7d: forecast(7, now),
      leech: leechReport()
    };
  }

  global.SpacedRepetition = {
    dueQueue: dueQueue,
    upcomingQueue: upcomingQueue,
    forecast: forecast,
    leechReport: leechReport,
    retentionSnapshot: retentionSnapshot,
    previewNextReview: previewNextReview,
    previewAllOutcomes: previewAllOutcomes,
    fullReport: fullReport
  };
})(window);
