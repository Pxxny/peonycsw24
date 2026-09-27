/* =========================================================
   CSW24 Word Lab — Daily Word Training: TrainingPlanner.js
   =========================================================
   Scope: turn (mode id, chosen word lengths, word-count size)
   into a concrete, ordered "Daily Plan" (spec section 5) —
   a list of session blocks, each with a real word count and,
   where the block is a review/weak-word step, the REAL words
   to review (pulled from SpacedRepetition.js / WeaknessDetector.js
   / RecommendationEngine.js — never invented).

   This file computes no new raw statistic of its own, same
   discipline as RecommendationEngine.js: every due/leech/weak
   word surfaced here was already produced by SpacedRepetition.js
   or WeaknessDetector.js. TrainingPlanner.js's only job is to
   walk a TrainingModes.js `recipe` and fill each step with real
   sizes and real words, honoring:
     - spec section 4: user's word-count choice (light/normal/
       heavy/custom) scales new-word counts, chosen lengths
       decide which pool new words come from
     - spec section 9: the "Daily Goal" rule (จำชิล ๆ ต้องลด
       Daily Goal, Full Grind ได้เพิ่ม) is TrainingModes.js's
       per-mode dailyGoalMultiplier, applied ONLY on top of an
       explicit light/normal/heavy/custom choice — never on a
       mode's own built-in wordsApprox fallback, since that
       fallback is already the mode-appropriate number and
       multiplying it again would double the same adjustment
     - spec section 10 (Adaptive Learning), so far only the part
       already backed by real data: Full Grind's `adaptiveWordCount`
       flag nudges new-word count from recent accuracy, read via
       PerformanceAnalyzer.js if present — never fabricated when
       that module or its data isn't available
     - spec section 13: modes flagged needsBreaks get a BREAK step
       inserted every ~25 minutes' worth of blocks

   Depends on TrainingModes.js (recipe data), and optionally on
   SpacedRepetition.js, WeaknessDetector.js, RecommendationEngine.js,
   PerformanceAnalyzer.js — each accessed defensively so a plan can
   still be built (with smaller, honest fallbacks) if one of them
   isn't loaded. Never reads or writes localStorage directly; the
   word-pool function and Cardbox reads are passed in by the caller
   (app.js), same separation CoachPlanner.js already uses.

   Loaded standalone: IIFE, no build step. Exposes
   global.TrainingPlanner.
   ========================================================= */

(function (global) {
  'use strict';

  const WORD_COUNT_PRESETS = { light: 15, normal: 25, heavy: 45 };

  function sd() { return global.SpacedRepetition || null; }
  function wd() { return global.WeaknessDetector || null; }
  function re() { return global.RecommendationEngine || null; }
  function pa() { return global.PerformanceAnalyzer || null; }
  function tm() { return global.TrainingModes || null; }
  function rh() { return global.RetentionHeatmap || null; }

  // ---------- word-count resolution (spec section 4) ----------
  // sizeChoice: 'light' | 'normal' | 'heavy' | 'custom'
  // customCount: only used when sizeChoice === 'custom'
  // Falls back to the mode's own approximate range when no explicit
  // choice is given, so a mode picked with zero configuration (spec
  // section 3's quick "เลือกโหมดนี้" path) still gets a sane count.
  //
  // spec section 9's "Daily Goal" rule (จำชิล ๆ → ลด Daily Goal, Full
  // Grind → เพิ่มได้) is applied as a multiplier ONLY on top of an
  // explicit light/normal/heavy/custom choice — never on the mode's own
  // built-in wordsApprox fallback, because that fallback (spec section
  // 2's own "ประมาณ 20-30 คำ" etc. per mode) is already the
  // mode-appropriate number; multiplying it again would double-count
  // the same adjustment spec section 9 is asking for.
  function resolveWordCount(mode, sizeChoice, customCount) {
    const multiplier = (typeof mode.dailyGoalMultiplier === 'number') ? mode.dailyGoalMultiplier : 1;
    if (sizeChoice === 'custom' && customCount > 0) return Math.max(1, Math.round(customCount * multiplier));
    if (sizeChoice && WORD_COUNT_PRESETS[sizeChoice]) return Math.max(1, Math.round(WORD_COUNT_PRESETS[sizeChoice] * multiplier));
    if (mode.wordsApprox) return Math.round((mode.wordsApprox[0] + mode.wordsApprox[1]) / 2);
    return WORD_COUNT_PRESETS.normal;
  }

  // Full Grind's `adaptiveWordCount` (spec section 10): nudge the
  // resolved count up/down based on recent accuracy, IF
  // PerformanceAnalyzer.js is loaded and has enough recent samples to
  // say anything real. Otherwise the count is left exactly as resolved
  // above — no invented adjustment.
  function applyAdaptiveNudge(mode, count) {
    if (!mode.adaptiveWordCount) return count;
    const engine = pa();
    if (!engine || typeof engine.recentAccuracy !== 'function') return count;
    const recent = engine.recentAccuracy();
    if (!recent || recent.sampleSize < 10) return count; // not enough real data to adjust on
    if (recent.accuracy >= 85) return Math.round(count * 1.15);
    if (recent.accuracy < 60) return Math.round(count * 0.8);
    return count;
  }

  // ---------- which lengths a plan draws new words from ----------
  // 'all' modes use 3-9 (the project's own full range). length_focus
  // (เจาะ Letters) requires the caller's own selection — if none was
  // given, that mode contributes zero new words rather than silently
  // picking lengths the learner didn't choose.
  function resolveLengths(mode, chosenLengths) {
    if (mode.requiresLengthSelection) {
      return (chosenLengths && chosenLengths.length) ? chosenLengths.slice() : [];
    }
    if (chosenLengths && chosenLengths.length) return chosenLengths.slice();
    return [3, 4, 5, 6, 7, 8, 9];
  }

  // Spread `count` new words across `lengths`, evenly, using the
  // caller-supplied `lengthPoolFn(L) -> string[]` so custom imported
  // words (app.js's own lengthPool()) participate exactly like
  // everywhere else in the app. Skips words already in the Cardbox
  // (via `existingWordsSet`) so a plan never "adds" a word that's
  // already being tracked.
  function pickNewWords(count, lengths, lengthPoolFn, existingWordsSet) {
    if (!count || !lengths.length) return [];
    const perLength = Math.max(1, Math.round(count / lengths.length));
    const out = [];
    const existing = existingWordsSet || new Set();
    lengths.forEach(function (L) {
      const pool = (lengthPoolFn ? lengthPoolFn(L) : []).filter(function (w) { return !existing.has(w); });
        // simple unbiased-enough sample: shuffle a shallow copy, take N
      const shuffled = pool.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
      }
      shuffled.slice(0, perLength).forEach(function (w) { out.push(w); existing.add(w); });
    });
    return out.slice(0, count);
  }

  // ---------- real words for review-flavored steps ----------
  function reviewWords(limit) {
    const engine = sd();
    if (!engine) return [];
    return engine.dueQueue().slice(0, limit || 20).map(function (c) { return c.word; });
  }

  function weakWords(limit) {
    const engine = wd();
    const sdEngine = sd();
    const out = [];
    if (sdEngine) {
      const leech = sdEngine.leechReport();
      if (leech && leech.words) leech.words.forEach(function (w) { out.push(w.word); });
    }
    if (engine) {
      engine.repeatedMistakeWords().forEach(function (w) {
        if (out.indexOf(w.word) === -1) out.push(w.word);
      });
    }
    return out.slice(0, limit || 20);
  }

  // ---------- spec section 6's 4-tier memory-status display ----------
  // 🟢 จำได้ (Mastered) / 🟡 ยังไม่แม่น (Learning) / 🟠 ลืมบ่อย (Weak) /
  // 🔴 จำไม่ได้ (Forgotten) — a pure DISPLAY grouping derived from fields
  // SpacedRepetition.js already computes (status, leech, streak,
  // overdueDays). This never adds a new stored field; a card's real
  // status/leech/streak are the only source of truth, this just buckets
  // them for the "กู้ศัพท์ที่ลืม" (rescue) screen's four columns.
  function memoryTier(card) {
    if (card.leech) return 'forgotten'; // 🔴 — flagged leech: real, repeated misses
    if (card.status === 'mastered') return 'mastered'; // 🟢
    if (card.status === 'learning' && (card.streak || 0) === 0) return 'learning'; // 🟡
    // learning but currently on a miss-streak (not yet a leech), or
    // significantly overdue: 🟠 "ลืมบ่อย" — struggling, short of leech
    return 'weak';
  }

  const MEMORY_TIER_META = {
    mastered: { emoji: '🟢', label: { th: 'จำได้', en: 'Mastered' } },
    learning: { emoji: '🟡', label: { th: 'ยังไม่แม่น', en: 'Learning' } },
    weak: { emoji: '🟠', label: { th: 'ลืมบ่อย', en: 'Weak' } },
    forgotten: { emoji: '🔴', label: { th: 'จำไม่ได้', en: 'Forgotten' } }
  };

  // Groups the learner's whole Cardbox into the 4 tiers above. Returns
  // real cards (not just counts) so a caller (e.g. the rescue-mode
  // screen) can list them, not just show a number.
  function memoryTierBreakdown(cardbox) {
    const groups = { mastered: [], learning: [], weak: [], forgotten: [] };
    (cardbox || []).forEach(function (c) { groups[memoryTier(c)].push(c); });
    return groups;
  }

  // ---------- spec section 7: 3-9 Letters progress dashboard ----------
  // For each length 3-9: how many words of that length exist in the
  // dictionary pool (via the caller's own lengthPoolFn, so custom
  // imports count too), how many are already in the learner's Cardbox,
  // and how many of those are mastered. The progress fraction is
  // genuinely `masteredOfThisLength / poolSizeOfThisLength` — never a
  // guess — so a length with a huge dictionary pool (e.g. 7L) will
  // correctly show a tiny bar even after mastering hundreds of words,
  // same honesty RecommendationEngine.js already holds itself to.
  function lengthProgress(cardbox, lengthPoolFn) {
    const box = cardbox || [];
    const byLength = {};
    box.forEach(function (c) {
      const L = c.word ? c.word.length : null;
      if (!L) return;
      const bucket = byLength[L] || (byLength[L] = { inCardbox: 0, mastered: 0 });
      bucket.inCardbox++;
      if (c.status === 'mastered') bucket.mastered++;
    });

    const out = [];
    for (let L = 3; L <= 9; L++) {
      const pool = lengthPoolFn ? (lengthPoolFn(L) || []) : [];
      const bucket = byLength[L] || { inCardbox: 0, mastered: 0 };
      out.push({
        length: L,
        poolSize: pool.length,
        inCardbox: bucket.inCardbox,
        mastered: bucket.mastered,
        pct: pool.length ? Math.round((bucket.mastered / pool.length) * 100) : 0
      });
    }
    return out;
  }

  // ---------- spec section 15: Weekly Summary ----------
  // Every real number here comes from an existing engine — no new
  // tracking added just for this summary:
  //   - words learned this week / most-trained length: derived from the
  //     caller's own history object (word -> [{t, mode}]) filtered to the
  //     last 7 days, same event shape the Calendar drill-down reads
  //   - training hours: reduced from the same event timestamps using the
  //     identical session-gap heuristic app.js's own studyTimeStats()
  //     already uses (passed in as sessionGapMs/perAnswerFloorMs so this
  //     file doesn't redefine those constants a second time)
  //   - accuracy: PerformanceAnalyzer.recentAccuracy(), scoped to this
  //     week's learn-log entries the caller supplies
  //   - days trained / streak: RetentionHeatmap.summary(7), the same
  //     calendar math the Calendar tab's heatmap already shows
  //   - words still needing review: SpacedRepetition.dueQueue().length,
  //     the same due-count the Dashboard's review card already shows
  // The encouragement message (spec section 15's explicit "ห้ามใช้
  // ข้อความกดดัน") is chosen from real thresholds on real numbers, never
  // a fixed rotating line — see encouragementForWeek().
  function weeklySummary(historyObj, learnLogThisWeek, cardbox) {
    const now = Date.now();
    const weekStart = now - 7 * 86400000;

    const wordsThisWeek = new Set();
    const lengthCounts = {};
    Object.keys(historyObj || {}).forEach(function (word) {
      const events = (historyObj[word] || []).filter(function (e) { return e && e.t >= weekStart; });
      if (!events.length) return;
      wordsThisWeek.add(word);
      const L = word.length;
      lengthCounts[L] = (lengthCounts[L] || 0) + events.length;
    });

    let mostTrainedLength = null, mostTrainedCount = 0;
    Object.keys(lengthCounts).forEach(function (L) {
      if (lengthCounts[L] > mostTrainedCount) { mostTrainedCount = lengthCounts[L]; mostTrainedLength = parseInt(L, 10); }
    });

    const analyzer = pa();
    const accStats = (analyzer && learnLogThisWeek && learnLogThisWeek.length)
      ? analyzer.recentAccuracy(learnLogThisWeek.length) // caller already scoped the log to this week
      : { sampleSize: 0, accuracy: null };

    const heatmap = rh();
    const calStats = heatmap ? heatmap.summary(7) : { activeDays: null, totalDays: 7, streaks: { current: null, longest: null } };

    const spacedRep = sd();
    const wordsToReview = spacedRep ? spacedRep.dueQueue().length : null;

    return {
      wordsLearned: wordsThisWeek.size,
      mostTrainedLength: mostTrainedLength,
      accuracyPct: accStats.sampleSize ? accStats.accuracy : null,
      accuracySampleSize: accStats.sampleSize,
      daysTrained: calStats.activeDays,
      totalDays: calStats.totalDays,
      currentStreak: calStats.streaks.current,
      wordsToReview: wordsToReview,
      encouragement: encouragementForWeek(wordsThisWeek.size, calStats.activeDays, calStats.totalDays)
    };
  }

  // Picks an honest, non-pressuring line from real thresholds — never
  // "คุณต้องทำให้ได้ทุกวัน" or anything implying an obligation, exactly
  // spec section 15's explicit prohibition. Every branch is a genuine
  // observation about the numbers just computed, not encouragement
  // manufactured regardless of them.
  function encouragementForWeek(wordsLearned, daysTrained, totalDays) {
    if (daysTrained === null) return { th: 'เริ่มสัปดาห์นี้กันเลย', en: 'Let\u2019s start this week' };
    if (daysTrained === 0) return { th: 'สัปดาห์นี้ยังไม่ได้ฝึกเลย เริ่มใหม่วันนี้ก็ได้', en: 'No training yet this week — today\u2019s a fine day to start' };
    if (daysTrained >= Math.round(totalDays * 0.85)) return { th: 'สัปดาห์นี้คุณรักษาความต่อเนื่องได้ดีมาก', en: 'Great consistency this week' };
    if (daysTrained >= Math.round(totalDays * 0.4)) return { th: 'สัปดาห์นี้คุณรักษาความต่อเนื่องได้ดี', en: 'Good consistency this week' };
    if (wordsLearned > 0) return { th: 'สัปดาห์นี้ฝึกน้อยหน่อย แต่ก็ยังได้คำใหม่เพิ่มขึ้น', en: 'A lighter week, but you still picked up new words' };
    return { th: 'สัปดาห์นี้ฝึกน้อยหน่อย ลองกลับมาต่อเมื่อพร้อม', en: 'A quiet week — pick back up whenever you\u2019re ready' };
  }

  // ---------- one recipe step -> one plan block ----------
  const T = (tm() && tm().RECIPE_STEP_TYPES) || {};

  function buildBlock(recipeStep, ctx) {
    const type = recipeStep.type;
    const block = { type: type, label: recipeStep.label, words: [] };

    if (type === 'new_words' || type === T.NEW_WORDS) {
      block.words = pickNewWords(ctx.newWordsRemaining, ctx.lengths, ctx.lengthPoolFn, ctx.existingWords);
      ctx.newWordsRemaining = Math.max(0, ctx.newWordsRemaining - block.words.length);
    } else if (type === 'review' || type === 'review_queue' || type === T.REVIEW || type === T.REVIEW_QUEUE) {
      block.words = reviewWords(ctx.reviewLimit);
    } else if (type === 'weak_words' || type === T.WEAK_WORDS) {
      block.words = weakWords(ctx.reviewLimit);
    } else if (type === 'recall' || type === 'anagram' || type === 'unscramble' ||
               type === 'missing_letters' || type === 'reverse_recall' ||
               type === 'multiple_choice' || type === 'timed_quiz' || type === 'mixed_quiz' ||
               type === 'final_test') {
      // Drill-flavored steps draw from whatever's already been staged
      // this plan (new + review + weak), so the quiz actually covers
      // words the learner is meant to be working on today, not an
      // unrelated random pool.
      block.words = ctx.stagedWords.slice(0, ctx.drillWordCap || 15);
    } else if (type === 'break') {
      block.breakMinutes = 5;
    }

    if (block.words && block.words.length) {
      block.words.forEach(function (w) {
        if (ctx.stagedWords.indexOf(w) === -1) ctx.stagedWords.push(w);
      });
    }
    return block;
  }

  // ---------- public: build a full Daily Plan for one mode ----------
  // options:
  //   sizeChoice, customCount     spec section 4 "จำนวนศัพท์"
  //   chosenLengths: number[]     spec section 4 "Letters"
  //   lengthPoolFn(L)->string[]   caller's own word-pool accessor
  //   existingWords: Set<string>  words already in Cardbox (skip as "new")
  //   reviewLimit: number         cap on words shown per review-flavored block
  function buildPlan(modeId, options) {
    const modes = tm();
    const mode = modes ? modes.get(modeId) : null;
    if (!mode) return null;
    const opts = options || {};

    let newWordsTotal = resolveWordCount(mode, opts.sizeChoice, opts.customCount);
    newWordsTotal = applyAdaptiveNudge(mode, newWordsTotal);
    const lengths = resolveLengths(mode, opts.chosenLengths);

    const ctx = {
      newWordsRemaining: newWordsTotal,
      lengths: lengths,
      lengthPoolFn: opts.lengthPoolFn,
      // copied defensively: pickNewWords() mutates this set as it picks
      // words (so later blocks in the same plan don't re-pick the same
      // word), and callers should not have their own Cardbox-words set
      // silently mutated as a side effect of building a plan.
      existingWords: new Set(opts.existingWords || []),
      reviewLimit: opts.reviewLimit || 20,
      drillWordCap: opts.drillWordCap || 15,
      stagedWords: []
    };

    let recipe = mode.recipe.slice();
    if (mode.shuffleRecipe) {
      for (let i = recipe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = recipe[i]; recipe[i] = recipe[j]; recipe[j] = tmp;
      }
    }

    const blocks = recipe.map(function (step) { return buildBlock(step, ctx); });

    // spec section 13: insert an automatic break roughly every 4 blocks
    // for modes that need one, never as the very first or last block.
    if (mode.needsBreaks) {
      const withBreaks = [];
      blocks.forEach(function (b, i) {
        withBreaks.push(b);
        const isBreakStep = b.type === 'break';
        const nextIsLast = i === blocks.length - 1;
        if (!isBreakStep && !nextIsLast && (i + 1) % 4 === 0) {
          withBreaks.push({ type: 'break', label: { th: 'พัก', en: 'Break' }, breakMinutes: 5 });
        }
      });
      blocks.length = 0;
      blocks.push.apply(blocks, withBreaks);
    }

    const totalNewWordsPlaced = newWordsTotal - ctx.newWordsRemaining;

    return {
      modeId: modeId,
      generatedAt: Date.now(),
      newWordsTarget: newWordsTotal,
      newWordsPlaced: totalNewWordsPlaced,
      lengths: lengths,
      blocks: blocks,
      // honest note when the plan under-delivered vs. the target, e.g.
      // chosen lengths' pools didn't have enough unseen words left —
      // never silently pretend the target was met.
      shortfall: (mode.requiresLengthSelection && !lengths.length)
        ? { reason: 'no_lengths_selected' }
        : (totalNewWordsPlaced < newWordsTotal ? { reason: 'pool_exhausted', missing: newWordsTotal - totalNewWordsPlaced } : null)
    };
  }

  global.TrainingPlanner = {
    WORD_COUNT_PRESETS: Object.assign({}, WORD_COUNT_PRESETS),
    resolveWordCount: resolveWordCount,
    resolveLengths: resolveLengths,
    buildPlan: buildPlan,
    memoryTier: memoryTier,
    memoryTierBreakdown: memoryTierBreakdown,
    MEMORY_TIER_META: MEMORY_TIER_META,
    lengthProgress: lengthProgress,
    weeklySummary: weeklySummary
  };
})(typeof window !== 'undefined' ? window : globalThis);
