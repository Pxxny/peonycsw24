/* =========================================================
   CSW24 Word Lab — AI Coach: WeaknessDetector.js
   =========================================================
   Scope: turn PerformanceAnalyzer.js's real numbers (and the
   raw Learn log it already reads from) into a ranked list of
   weaknesses — which specific WORDS keep getting missed, and
   which DIMENSION (word length / anagram / bingo / stem) is
   weakest overall. This file computes no new raw statistic
   PerformanceAnalyzer.js doesn't already expose or the Learn
   log doesn't already contain; it only aggregates, thresholds,
   and ranks what's already real.

   Two kinds of weakness, both real-data-only:

     1. Per-WORD repeated mistakes — a word missed >= N times in
        its own Learn-log history (own_mistakes), read directly
        from csw24_learn_log_v1. This is the "Repeated Mistakes"
        the project brief calls for, and it's the same log
        PerformanceAnalyzer.js already reads — no second source
        of truth.

     2. Per-DIMENSION weakness — wraps
        PerformanceAnalyzer.js's byLength/byAnagram/byBingo/byStem
        buckets, filters out buckets with too few samples to mean
        anything (never calls a 1-attempt 0% a "weakness"), and
        ranks the rest by accuracy. This directly replaces the ad
        hoc ranking CoachUI.js's buildResponse() currently does
        inline for "ฉันอ่อนเรื่องอะไร?" — CoachEngine.js (once
        built) should call this file instead of that inline logic.

   A word only ever appears here if the Learn log says it was
   answered; a bucket only ever appears if it has samples. No
   word or bucket is invented, guessed, or extrapolated.

   Loaded standalone, like PerformanceAnalyzer.js /
   SpacedRepetition.js: IIFE, no build step, reads
   localStorage + PerformanceAnalyzer.js's report. Exposes
   global.WeaknessDetector.
   ========================================================= */

(function (global) {
  'use strict';

  const LEARN_LOG_KEY = 'csw24_learn_log_v1'; // same key app.js / PerformanceAnalyzer.js use
  const MIN_BUCKET_SAMPLES = 5;   // below this, a bucket's accuracy is noise, not a finding
  const MIN_WORD_MISTAKES = 2;    // a word must be missed at least this many times to count as a "repeated" mistake

  function loadLearnLog() {
    try {
      const raw = localStorage.getItem(LEARN_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // ---------- Per-word repeated mistakes ----------
  // Groups the raw log by word, keeps only words with >= MIN_WORD_MISTAKES
  // incorrect answers, and ranks worst-first by (mistakes count, then
  // most-recent mistake time) — a word missed 5 times outranks one missed
  // twice; ties break toward whichever was gotten wrong more recently,
  // since that's the more actionable one to drill today.
  function repeatedMistakeWords(minMistakes) {
    const threshold = minMistakes || MIN_WORD_MISTAKES;
    const log = loadLearnLog();
    const byWord = new Map(); // word -> { len, attempts, mistakes, lastMistakeAt, responseMsSum, responseMsCount }

    log.forEach(function (e) {
      if (!byWord.has(e.word)) {
        byWord.set(e.word, { word: e.word, len: e.len, attempts: 0, mistakes: 0, lastMistakeAt: null, responseMsSum: 0, responseMsCount: 0 });
      }
      const rec = byWord.get(e.word);
      rec.attempts++;
      if (!e.correct) {
        rec.mistakes++;
        rec.lastMistakeAt = e.t;
      }
      if (typeof e.responseMs === 'number') {
        rec.responseMsSum += e.responseMs;
        rec.responseMsCount++;
      }
    });

    const out = [];
    byWord.forEach(function (rec) {
      if (rec.mistakes < threshold) return;
      out.push({
        word: rec.word,
        len: rec.len,
        attempts: rec.attempts,
        mistakes: rec.mistakes,
        accuracy: Math.round(((rec.attempts - rec.mistakes) / rec.attempts) * 100),
        avgResponseMs: rec.responseMsCount ? Math.round(rec.responseMsSum / rec.responseMsCount) : null,
        lastMistakeAt: rec.lastMistakeAt
      });
    });

    out.sort(function (a, b) {
      if (b.mistakes !== a.mistakes) return b.mistakes - a.mistakes;
      return (b.lastMistakeAt || 0) - (a.lastMistakeAt || 0);
    });
    return out;
  }

  // ---------- Per-dimension weakness ranking ----------
  // Flattens PerformanceAnalyzer.js's four breakdowns into one comparable
  // list of {dimension, label, accuracy, sampleSize}, drops anything below
  // MIN_BUCKET_SAMPLES, and sorts weakest-accuracy-first. This is a
  // straight re-shaping of PerformanceAnalyzer.js's own numbers — no
  // recomputation of accuracy happens here.
  function dimensionWeaknesses(minSamples) {
    if (!global.PerformanceAnalyzer) return [];
    const threshold = minSamples || MIN_BUCKET_SAMPLES;
    const report = global.PerformanceAnalyzer.fullReport();
    const out = [];

    report.byLength.forEach(function (b) {
      if (b.sampleSize >= threshold) {
        out.push({ dimension: 'length', label: 'คำยาว ' + b.length + ' ตัวอักษร', accuracy: b.accuracy, sampleSize: b.sampleSize, avgResponseMs: b.avgResponseMs });
      }
    });

    [
      ['anagram', report.byAnagram.hasAnagramPartners],
      ['anagram', report.byAnagram.noAnagramPartners],
      ['bingo', report.byBingo.bingoLengths],
      ['bingo', report.byBingo.otherLengths],
      ['stem', report.byStem.noStem],
      ['stem', report.byStem.poorStem],
      ['stem', report.byStem.richStem]
    ].forEach(function (pair) {
      const dim = pair[0], b = pair[1];
      if (b.sampleSize >= threshold) {
        out.push({ dimension: dim, label: b.label, accuracy: b.accuracy, sampleSize: b.sampleSize, avgResponseMs: b.avgResponseMs });
      }
    });

    out.sort(function (a, b) { return a.accuracy - b.accuracy; });
    return out;
  }

  // Same ranking, but response-time-based instead of accuracy-based —
  // "which bucket takes the learner longest to answer, on average", among
  // buckets that actually have timing data. Complements accuracy ranking:
  // a bucket can be accurate but slow (not yet automatic) or fast but
  // inaccurate (guessing) — these are different problems worth surfacing
  // separately, both straight from PerformanceAnalyzer.js's own numbers.
  function slowestDimensions(minSamples) {
    return dimensionWeaknesses(minSamples)
      .filter(function (d) { return typeof d.avgResponseMs === 'number'; })
      .sort(function (a, b) { return b.avgResponseMs - a.avgResponseMs; });
  }

  // ---------- Combined severity ranking ----------
  // A single "what's the single worst thing to work on right now" answer,
  // combining both signals above into one ordered list the way a coach
  // would actually prioritize: words with the most repeated mistakes
  // first (most concrete, most actionable), then the weakest dimension
  // buckets (broader, still real). severity is a plain ordinal rank
  // here, not a fabricated composite score — it never mixes accuracy
  // percentages and mistake counts into one invented number.
  function topWeaknesses(opts) {
    const options = opts || {};
    const words = repeatedMistakeWords(options.minMistakes).slice(0, options.wordLimit || 5);
    const dims = dimensionWeaknesses(options.minSamples).slice(0, options.dimLimit || 5);

    const items = [];
    words.forEach(function (w, i) {
      items.push({
        type: 'word',
        severity: 'critical',
        rank: i + 1,
        word: w.word,
        len: w.len,
        mistakes: w.mistakes,
        accuracy: w.accuracy,
        detail: w.word + ' ผิดไปแล้ว ' + w.mistakes + ' ครั้ง (ถูก ' + w.accuracy + '%)'
      });
    });
    dims.forEach(function (d, i) {
      items.push({
        type: 'dimension',
        severity: d.accuracy < 50 ? 'high' : 'medium',
        rank: i + 1,
        dimension: d.dimension,
        label: d.label,
        accuracy: d.accuracy,
        sampleSize: d.sampleSize,
        detail: d.label + ' — ถูก ' + d.accuracy + '% (จาก ' + d.sampleSize + ' ครั้ง)'
      });
    });
    return items;
  }

  function fullReport(opts) {
    return {
      generatedAt: Date.now(),
      repeatedMistakeWords: repeatedMistakeWords(opts && opts.minMistakes),
      dimensionWeaknesses: dimensionWeaknesses(opts && opts.minSamples),
      slowestDimensions: slowestDimensions(opts && opts.minSamples),
      topWeaknesses: topWeaknesses(opts)
    };
  }

  global.WeaknessDetector = {
    repeatedMistakeWords: repeatedMistakeWords,
    dimensionWeaknesses: dimensionWeaknesses,
    slowestDimensions: slowestDimensions,
    topWeaknesses: topWeaknesses,
    fullReport: fullReport
  };
})(window);
