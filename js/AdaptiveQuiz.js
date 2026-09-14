/* =========================================================
   CSW24 Word Lab — AI Coach: AdaptiveQuiz.js
   =========================================================
   Scope: decide WHAT a quiz/drill should contain — difficulty
   (word-length range), how many words, and (when the situation
   calls for it) a specific curated word list — based on real
   performance data. This file does NOT render a quiz, run a
   timer, or grade an answer; app.js's existing Quiz tab
   (initQuizTab, pickRandomWords, quizState) and Cardbox/Learn
   flows already own all of that. AdaptiveQuiz.js only computes
   PARAMETERS that a command like START_QUIZ's `params` field
   can carry — CoachEngine.js (once built) is responsible for
   actually placing them into a validated JSON command, and
   app.js/CSW24Bridge remain the only things that execute a quiz.

   "Adaptive" here means concretely, from real data only:

     - Difficulty (length range) shifts toward whichever word
       lengths WeaknessDetector.js's dimensionWeaknesses() shows
       as weakest (lower accuracy), and away from lengths with
       strong accuracy and enough samples to trust — the project
       brief's "adjust quiz difficulty by real performance"
       (rule #12: "Adaptive Quiz ต้องปรับตาม Performance จริง").
     - When there ARE specific weak/leech/repeated-mistake words
       (from WeaknessDetector.js / SpacedRepetition.js), the
       curated list uses exactly those words plus real CSW24
       anagram partners (via CoachSearchIndex.js) — never
       invented words, and every word is checked against CSW24
       before being included (rule #15).
     - When there ISN'T enough real data yet, difficulty stays
       at a neutral, honest default (the app's own existing
       min/max length band) rather than guessing.

   Loaded standalone, like the other AI Coach modules: IIFE, no
   build step. Depends on WeaknessDetector.js, SpacedRepetition.js
   and CoachSearchIndex.js being loaded first — every dependency
   is checked defensively, so a missing one degrades this file's
   output rather than throwing. Exposes global.AdaptiveQuiz.
   ========================================================= */

(function (global) {
  'use strict';

  // Same neutral default range the app's own Quiz tab UI ships with
  // (see index.html's quiz length inputs) — used only when there isn't
  // yet enough real per-length data to justify narrowing the range.
  const DEFAULT_MIN_LEN = 4;
  const DEFAULT_MAX_LEN = 8;
  const DEFAULT_COUNT = 20;
  const MIN_SAMPLES_TO_TRUST_LENGTH = 5;

  function wd() { return global.WeaknessDetector || null; }
  function sd() { return global.SpacedRepetition || null; }
  function searchIndex() { return global.CoachSearchIndex || null; }

  // ---------- Difficulty: which word lengths to focus on ----------
  // Reads WeaknessDetector.js's per-length breakdown (already sourced
  // from PerformanceAnalyzer.js's real byLength data), keeps only
  // lengths with enough samples to trust, and splits them into "weak"
  // (worth drilling) vs "strong" (safe to de-emphasize). Lengths with
  // too few samples are neither — they're simply not opinionated about,
  // since there isn't yet real evidence either way.
  function lengthDifficultyProfile() {
    const engine = wd();
    if (!engine) {
      return { weakLengths: [], strongLengths: [], hasData: false };
    }
    const lengthBuckets = engine.dimensionWeaknesses(MIN_SAMPLES_TO_TRUST_LENGTH)
      .filter(function (d) { return d.dimension === 'length'; });
    if (!lengthBuckets.length) {
      return { weakLengths: [], strongLengths: [], hasData: false };
    }
    // dimensionWeaknesses() already sorts weakest-accuracy-first for all
    // dimensions combined; re-derive length from the label it built
    // ("คำยาว N ตัวอักษร") since that's the only place the raw length
    // integer survives past PerformanceAnalyzer.js's own breakdown.
    const withLen = lengthBuckets.map(function (b) {
      const m = b.label.match(/(\d+)/);
      return Object.assign({}, b, { length: m ? Number(m[1]) : null });
    }).filter(function (b) { return b.length; });

    return {
      weakLengths: withLen.filter(function (b) { return b.accuracy < 70; }).map(function (b) { return b.length; }),
      strongLengths: withLen.filter(function (b) { return b.accuracy >= 85; }).map(function (b) { return b.length; }),
      hasData: true
    };
  }

  // Turns the difficulty profile into a concrete {minLen, maxLen} range
  // suitable for app.js's own pickRandomWords(min, max, count) — the
  // same function the app's Quiz tab already uses, via START_QUIZ's
  // params. If there's a weak length, center the range tightly on it
  // (+/-1) so the quiz actually targets the real weakness rather than
  // diluting it across the whole 4-8 default band.
  function suggestedLengthRange() {
    const profile = lengthDifficultyProfile();
    if (!profile.hasData || !profile.weakLengths.length) {
      return { minLen: DEFAULT_MIN_LEN, maxLen: DEFAULT_MAX_LEN, basis: 'default_no_data' };
    }
    const weakest = profile.weakLengths[0]; // dimensionWeaknesses() already ranked worst-first
    const availableMax = (typeof CSW24_MAX_LEN !== 'undefined') ? CSW24_MAX_LEN : 15;
    const availableMin = (typeof CSW24_MIN_LEN !== 'undefined') ? CSW24_MIN_LEN : 2;
    return {
      minLen: Math.max(availableMin, weakest - 1),
      maxLen: Math.min(availableMax, weakest + 1),
      basis: 'weakest_length',
      targetLength: weakest
    };
  }

  // ---------- Difficulty label ----------
  // A coarse, honest difficulty label for a command's params.difficulty
  // field (the project's own example JSON uses "easy"/"medium"/"hard").
  // Derived only from real accuracy: low accuracy on the weakest bucket
  // means the learner needs "hard" (more targeted, less padding); no
  // data yet means "medium" (neutral), never an invented guess.
  function suggestedDifficultyLabel() {
    const engine = wd();
    if (!engine) return 'medium';
    const dims = engine.dimensionWeaknesses(MIN_SAMPLES_TO_TRUST_LENGTH);
    if (!dims.length) return 'medium';
    const worst = dims[0].accuracy;
    if (worst < 50) return 'hard';
    if (worst < 75) return 'medium';
    return 'easy';
  }

  // ---------- Curated word list ----------
  // Builds an actual list of real CSW24 words to quiz on, when there's
  // concrete evidence to target: due/leech words from SpacedRepetition.js
  // and repeated-mistake words from WeaknessDetector.js, topped up with
  // real anagram partners of those words (via CoachSearchIndex.js) so a
  // short "weak word" list still makes a reasonably sized quiz. Every
  // word placed in the returned list is verified against CSW24 before
  // being included (rule #15) — anagramsOf() only ever returns words
  // that already exist in CSW24_BY_LENGTH.
  function curatedWordList(targetCount) {
    const cap = targetCount || DEFAULT_COUNT;
    const seeds = [];

    const spacedEngine = sd();
    if (spacedEngine) {
      spacedEngine.dueQueue().forEach(function (c) { seeds.push(c.word); });
      spacedEngine.leechReport().words.forEach(function (w) { seeds.push(w.word); });
    }
    const weaknessEngine = wd();
    if (weaknessEngine) {
      weaknessEngine.repeatedMistakeWords().forEach(function (w) { seeds.push(w.word); });
    }

    const uniqueSeeds = Array.from(new Set(seeds));
    if (!uniqueSeeds.length) {
      return { words: [], basis: 'no_targeted_words' };
    }

    const idx = searchIndex();
    const result = new Set();
    uniqueSeeds.forEach(function (w) { if (idx ? idx.isRealWord(w) : true) result.add(w); });

    // Top up with real anagram partners of the seed words, so a handful
    // of weak/leech words can still fill a reasonably sized quiz without
    // ever introducing a word CSW24 doesn't contain.
    if (idx) {
      for (let i = 0; i < uniqueSeeds.length && result.size < cap; i++) {
        idx.anagramsOf(uniqueSeeds[i]).forEach(function (partner) {
          if (result.size < cap) result.add(partner);
        });
      }
    }

    return { words: Array.from(result).slice(0, cap), basis: 'targeted_weak_leech_mistakes' };
  }

  // ---------- Combined quiz params ----------
  // The single call CoachEngine.js is expected to use when building a
  // START_QUIZ / START_ANAGRAM command's `params`. Returns real,
  // traceable numbers only — every field can be explained by pointing at
  // WeaknessDetector.js / SpacedRepetition.js output, nothing here is a
  // fabricated statistic.
  function buildQuizParams(opts) {
    const options = opts || {};
    const count = options.count || DEFAULT_COUNT;
    const range = suggestedLengthRange();
    const difficulty = suggestedDifficultyLabel();
    const curated = curatedWordList(count);

    return {
      minLen: range.minLen,
      maxLen: range.maxLen,
      count: count,
      difficulty: difficulty,
      order: 'random',
      words: curated.words.length ? curated.words : undefined, // omit, don't send an empty targeted list
      basis: {
        lengthRange: range.basis,
        targetLength: range.targetLength || null,
        wordList: curated.basis
      }
    };
  }

  function fullReport() {
    return {
      generatedAt: Date.now(),
      lengthDifficultyProfile: lengthDifficultyProfile(),
      suggestedLengthRange: suggestedLengthRange(),
      suggestedDifficultyLabel: suggestedDifficultyLabel(),
      curatedWordList: curatedWordList(),
      quizParams: buildQuizParams()
    };
  }

  global.AdaptiveQuiz = {
    lengthDifficultyProfile: lengthDifficultyProfile,
    suggestedLengthRange: suggestedLengthRange,
    suggestedDifficultyLabel: suggestedDifficultyLabel,
    curatedWordList: curatedWordList,
    buildQuizParams: buildQuizParams,
    fullReport: fullReport
  };
})(window);
