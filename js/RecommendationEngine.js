/* =========================================================
   CSW24 Word Lab — AI Coach: RecommendationEngine.js
   =========================================================
   Scope: combine WeaknessDetector.js's findings (repeated-
   mistake words, weak dimensions) with SpacedRepetition.js's
   read-only schedule view (due queue, leech report, forecast)
   into ONE prioritized "what should the learner do right now"
   answer, and a multi-item "Daily Training Plan".

   This file computes no new raw statistic of its own — every
   number it surfaces was already produced by WeaknessDetector.js,
   SpacedRepetition.js, or PerformanceAnalyzer.js. Its only job is
   PRIORITIZATION: deciding order and grouping, per the project's
   own priority rule (rule #11: "ให้ความสำคัญกับคำที่ผิดซ้ำและคำที่
   ตอบช้า" — repeated mistakes and slow responses come first).

   Priority order this file applies, highest first:
     1. Cardbox words already due/overdue (SpacedRepetition due
        queue) — real, time-sensitive, must not go stale.
     2. Leech words (SpacedRepetition leech report) — real,
        stuck words the learner keeps missing.
     3. Repeated-mistake words from the Learn log
        (WeaknessDetector) that are NOT already in the Cardbox
        due/leech sets above (no point recommending the same
        word twice under two different reasons).
     4. Weak dimensions (WeaknessDetector) — broader, lower
        urgency than a specific stuck word, used when there's
        nothing more concrete to point at.
     5. Nothing due, no leeches, no repeated mistakes, no
        dimension has enough samples: honest "not enough data /
        nothing outstanding" fallback — never a fabricated
        suggestion.

   This file does NOT decide what command CoachUI.js should
   execute — it returns priority + reasoning ranking. CoachEngine.js
   (once built) is the one that turns a recommendation into an
   AI Coach JSON command (START_QUIZ / REVIEW_WORDS / etc.) and
   validates it. This file only INCLUDES a suggestedCommand hint
   per item as a convenience, staying within the command enum the
   project's JSON contract defines — CoachEngine.js still owns
   actually emitting and validating the JSON.

   Loaded standalone, like the other AI Coach modules: IIFE, no
   build step. Depends on WeaknessDetector.js and
   SpacedRepetition.js being loaded first (checked defensively —
   degrades to whichever of the two is actually available rather
   than throwing). Exposes global.RecommendationEngine.
   ========================================================= */

(function (global) {
  'use strict';

  // Commands this file is allowed to *suggest* — must stay a subset of
  // the project's own ALLOWED_COMMANDS enum (see CoachUI.js). Never
  // invents a command outside this list.
  const SUGGESTABLE_COMMANDS = [
    'REVIEW_WORDS', 'START_FLASHCARD', 'START_QUIZ', 'START_ANAGRAM',
    'START_BINGO', 'START_ACTIVE_RECALL', 'CREATE_STUDY_PLAN'
  ];

  function sd() { return global.SpacedRepetition || null; }
  function wd() { return global.WeaknessDetector || null; }

  // ---------- Individual priority sources ----------

  // 1) Due/overdue Cardbox words — highest priority, time-sensitive.
  function dueItems(limit) {
    const engine = sd();
    if (!engine) return [];
    const due = engine.dueQueue();
    if (!due.length) return [];
    return [{
      type: 'due_review',
      priority: due.some(function (c) { return c.overdueDays >= 3; }) ? 'critical' : 'high',
      count: due.length,
      words: due.slice(0, limit || 10).map(function (c) { return c.word; }),
      reason: 'มีคำครบกำหนดทบทวนใน Cardbox ' + due.length + ' คำ (ล่าช้าสุด ' + due[0].overdueDays + ' วัน)',
      suggestedCommand: 'REVIEW_WORDS'
    }];
  }

  // 2) Leech words — real, stuck words the learner keeps missing.
  function leechItems(limit) {
    const engine = sd();
    if (!engine) return [];
    const report = engine.leechReport();
    if (!report.count) return [];
    return [{
      type: 'leech',
      priority: 'high',
      count: report.count,
      words: report.words.slice(0, limit || 10).map(function (w) { return w.word; }),
      reason: 'มีคำที่เป็น Leech (ผิดติดกัน >= ' + report.threshold + ' ครั้ง) อยู่ ' + report.count + ' คำ',
      suggestedCommand: 'START_FLASHCARD'
    }];
  }

  // 3) Repeated-mistake words from the Learn log, excluding words already
  // covered by due/leech above so the same word isn't recommended twice
  // under two different reasons.
  function repeatedMistakeItems(alreadyCoveredWords, limit) {
    const engine = wd();
    if (!engine) return [];
    const covered = new Set(alreadyCoveredWords || []);
    const words = engine.repeatedMistakeWords().filter(function (w) { return !covered.has(w.word); });
    if (!words.length) return [];
    return [{
      type: 'repeated_mistake',
      priority: words[0].mistakes >= 4 ? 'high' : 'medium',
      count: words.length,
      words: words.slice(0, limit || 10).map(function (w) { return w.word; }),
      reason: 'มีคำที่ตอบผิดซ้ำหลายครั้งใน Learn (สูงสุด ' + words[0].mistakes + ' ครั้ง: ' + words[0].word + ')',
      suggestedCommand: 'START_ACTIVE_RECALL'
    }];
  }

  // 4) Weakest dimension (word length / anagram / bingo / stem) — broader
  // signal, used as a lower-priority filler when there's no specific
  // word-level problem to point at.
  function weakDimensionItems() {
    const engine = wd();
    if (!engine) return [];
    const dims = engine.dimensionWeaknesses();
    if (!dims.length) return [];
    const weakest = dims[0];
    const cmd = weakest.dimension === 'bingo' ? 'START_BINGO'
      : weakest.dimension === 'anagram' ? 'START_ANAGRAM'
      : 'START_QUIZ';
    return [{
      type: 'weak_dimension',
      priority: weakest.accuracy < 50 ? 'high' : 'medium',
      dimension: weakest.dimension,
      label: weakest.label,
      accuracy: weakest.accuracy,
      sampleSize: weakest.sampleSize,
      reason: weakest.label + ' เป็นจุดที่อ่อนที่สุดตอนนี้ (ถูก ' + weakest.accuracy + '% จาก ' + weakest.sampleSize + ' ครั้ง)',
      suggestedCommand: cmd
    }];
  }

  // ---------- Combined single recommendation ----------
  // Returns the ONE highest-priority thing to recommend right now, in
  // the fixed order documented in the file header. Never fabricates a
  // recommendation when none of the four sources has anything real to
  // say — returns an explicit "nothing outstanding" result instead.
  function recommend() {
    const due = dueItems();
    if (due.length) return due[0];

    const leech = leechItems();
    if (leech.length) return leech[0];

    const dueWords = due.length ? due[0].words : [];
    const leechWords = leech.length ? leech[0].words : [];
    const repeated = repeatedMistakeItems(dueWords.concat(leechWords));
    if (repeated.length) return repeated[0];

    const weakDim = weakDimensionItems();
    if (weakDim.length) return weakDim[0];

    return {
      type: 'none',
      priority: 'low',
      reason: 'ไม่มีคำค้างทบทวน ไม่มี Leech และข้อมูลใน Learn ยังไม่พอจะชี้จุดอ่อนได้แม่นยำ',
      suggestedCommand: 'START_ANAGRAM'
    };
  }

  // ---------- Daily Training Plan ----------
  // A short ordered list of study items for "today", each with its own
  // reason and suggested command — built from the same four sources
  // above, deduplicated by word where applicable, capped at maxItems so
  // it stays a plan and not a full data dump.
  function dailyPlan(maxItems) {
    const cap = maxItems || 4;
    const due = dueItems();
    const leech = leechItems();
    const coveredWords = (due.length ? due[0].words : []).concat(leech.length ? leech[0].words : []);
    const repeated = repeatedMistakeItems(coveredWords);
    const weakDim = weakDimensionItems();

    const items = due.concat(leech).concat(repeated).concat(weakDim).slice(0, cap);
    if (!items.length) {
      return {
        generatedAt: Date.now(),
        items: [],
        summary: 'ยังไม่มีข้อมูลพอจะสร้างแผนฝึกวันนี้ — ลองฝึกใน Learn หรือ Anagram สักหน่อยก่อนครับ'
      };
    }
    return {
      generatedAt: Date.now(),
      items: items,
      summary: 'แผนฝึกวันนี้มี ' + items.length + ' รายการ เรียงตามความสำคัญ'
    };
  }

  function fullReport() {
    return {
      generatedAt: Date.now(),
      recommendation: recommend(),
      dailyPlan: dailyPlan(),
      sources: {
        due: dueItems(),
        leech: leechItems(),
        repeatedMistakes: repeatedMistakeItems(dueItems().length ? dueItems()[0].words : []),
        weakDimension: weakDimensionItems()
      }
    };
  }

  global.RecommendationEngine = {
    recommend: recommend,
    dailyPlan: dailyPlan,
    dueItems: dueItems,
    leechItems: leechItems,
    repeatedMistakeItems: repeatedMistakeItems,
    weakDimensionItems: weakDimensionItems,
    fullReport: fullReport,
    SUGGESTABLE_COMMANDS: SUGGESTABLE_COMMANDS.slice()
  };
})(window);
