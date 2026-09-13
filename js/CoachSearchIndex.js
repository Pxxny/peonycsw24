/* =========================================================
   CSW24 Word Lab — AI Coach: CoachSearchIndex.js
   =========================================================
   Scope: ONE thing only — a fast, shared FlexSearch index over
   the CSW24 word list (globalThis.CSW24_BY_LENGTH), for the AI
   Coach modules (WeaknessDetector.js, RecommendationEngine.js,
   AdaptiveQuiz.js, etc.) to look words up by prefix/substring
   fast, without each of them re-scanning the raw arrays.

   This is intentionally separate from, and does NOT replace,
   the existing Fuse.js "did you mean" fuzzy-suggest in the
   Browse tab (js/app.js, showBrowseFuzzySuggestions). That
   stays exactly as-is: different job (typo tolerance on a
   user-typed search box), different library, not touched here.

   Why FlexSearch here and not Fuse: the AI Coach mostly needs
   fast exact/prefix/substring lookups across ~300k+ words
   (e.g. "does CSW24 contain this word", "words containing this
   stem", "words starting with these letters") — FlexSearch's
   Document/Index is built for that at this scale. It is not a
   fuzzy/typo matcher (no Levenshtein distance) — for typo
   tolerance, the coach should keep deferring to CSW24Bridge /
   the existing Fuse-powered suggestion, not this index.

   Loaded standalone, like PerformanceAnalyzer.js / CoachUI.js:
   IIFE, no build step, reads only the global CSW24_BY_LENGTH
   data that words-data.js already sets. Exposes
   global.CoachSearchIndex.
   ========================================================= */

(function (global) {
  'use strict';

  // FlexSearch is loaded from CDN as window.FlexSearch (see index.html).
  // If it hasn't loaded (offline, CDN blocked, script order issue), every
  // method below degrades to a plain Array.prototype scan over
  // CSW24_BY_LENGTH — slower, but never broken and never wrong. Nothing
  // in this file invents a word or a match Chart.js-side data doesn't
  // already contain in CSW24_BY_LENGTH.
  let indexByLength = null; // Map<length, FlexSearch.Index> once built
  let flatIndex = null;     // FlexSearch.Index over ALL words, once built
  let builtWordCount = 0;

  function allWords() {
    const src = (typeof CSW24_BY_LENGTH !== 'undefined') ? CSW24_BY_LENGTH : {};
    let total = [];
    Object.keys(src).forEach(function (L) { total = total.concat(src[L]); });
    return total;
  }

  // Builds (once) a per-length FlexSearch.Index plus one flat index over
  // every word. Rebuilding is cheap-ish but not free at 300k+ words, so
  // this is memoized — call ensureBuilt() before every read, it's a no-op
  // after the first successful build.
  function ensureBuilt() {
    if (indexByLength && flatIndex) return true;
    if (!global.FlexSearch || typeof CSW24_BY_LENGTH === 'undefined') return false;

    indexByLength = new Map();
    // "forward" tokenizer: indexes every prefix of every word, which is
    // what lets START_QUIZ/RecommendationEngine-style "words starting
    // with X" or "words containing X" lookups resolve without a manual
    // scan. bidirectional would also index suffixes, at higher memory
    // cost, and isn't needed for the coach's current lookups.
    const IDX_OPTS = { tokenize: 'forward', cache: true };

    Object.keys(CSW24_BY_LENGTH).forEach(function (L) {
      const idx = new global.FlexSearch.Index(IDX_OPTS);
      CSW24_BY_LENGTH[L].forEach(function (w, i) { idx.add(i, w); });
      indexByLength.set(Number(L), { index: idx, words: CSW24_BY_LENGTH[L] });
    });

    const words = allWords();
    flatIndex = { index: new global.FlexSearch.Index(IDX_OPTS), words: words };
    words.forEach(function (w, i) { flatIndex.index.add(i, w); });
    builtWordCount = words.length;
    return true;
  }

  // ---------- exact membership check ----------
  // Cheap direct array membership — no need for FlexSearch here, an exact
  // check against CSW24_BY_LENGTH[len] is already O(n) over a small
  // per-length bucket and never wrong. Kept here so coach modules have
  // one place to ask "is this in CSW24" without reaching into globals
  // directly.
  function isRealWord(word) {
    const w = (word || '').toUpperCase();
    const pool = (typeof CSW24_BY_LENGTH !== 'undefined' && CSW24_BY_LENGTH[w.length]) || [];
    return pool.indexOf(w) !== -1;
  }

  // ---------- prefix / substring search ----------
  // Returns CSW24 words matching a prefix or substring query, optionally
  // restricted to one length. Every result is read straight out of
  // CSW24_BY_LENGTH via the index's own stored ids — never generated or
  // guessed — so a result list can never contain a non-CSW24 word.
  function search(query, opts) {
    const q = (query || '').toUpperCase().trim();
    if (!q) return [];
    const options = opts || {};
    const limit = options.limit || 20;
    const length = options.length; // optional: restrict to one word length

    if (!ensureBuilt()) {
      // Fallback: plain substring scan, so callers always get an answer.
      const pool = length ? ((CSW24_BY_LENGTH && CSW24_BY_LENGTH[length]) || []) : allWords();
      const out = [];
      for (let i = 0; i < pool.length && out.length < limit; i++) {
        if (pool[i].indexOf(q) !== -1) out.push(pool[i]);
      }
      return out;
    }

    const target = length ? indexByLength.get(Number(length)) : flatIndex;
    if (!target) return [];
    const ids = target.index.search(q, limit);
    return ids.map(function (id) { return target.words[id]; }).filter(Boolean);
  }

  // ---------- words that anagram (share the same letter multiset) ----------
  // Not a FlexSearch job (that's substring/prefix search, not letter-set
  // equality) — this is the same alphagram approach
  // PerformanceAnalyzer.js already uses independently, exposed here too
  // so the coming coach modules (WeaknessDetector/RecommendationEngine/
  // AdaptiveQuiz) share ONE implementation instead of three.
  function sortLetters(word) {
    return word.split('').sort().join('');
  }

  const anagramCache = new Map(); // "LEN:KEY" -> array of matching words

  function anagramsOf(word) {
    const w = (word || '').toUpperCase();
    if (!w) return [];
    const pool = (typeof CSW24_BY_LENGTH !== 'undefined' && CSW24_BY_LENGTH[w.length]) || [];
    const key = w.length + ':' + sortLetters(w);
    if (anagramCache.has(key)) return anagramCache.get(key);
    const result = pool.filter(function (cand) { return sortLetters(cand) === sortLetters(w); });
    anagramCache.set(key, result);
    return result;
  }

  // ---------- words of a given length starting with a given prefix ----------
  // Convenience wrapper RecommendationEngine.js / AdaptiveQuiz.js are
  // likely to want directly: "give me N words of length L starting with S".
  function wordsStartingWith(prefix, length, limit) {
    return search(prefix, { length: length, limit: limit || 50 })
      .filter(function (w) { return w.indexOf((prefix || '').toUpperCase()) === 0; });
  }

  function stats() {
    return {
      ready: !!(indexByLength && flatIndex),
      flexSearchLoaded: !!global.FlexSearch,
      wordCount: builtWordCount || allWords().length
    };
  }

  global.CoachSearchIndex = {
    ensureBuilt: ensureBuilt,
    isRealWord: isRealWord,
    search: search,
    anagramsOf: anagramsOf,
    wordsStartingWith: wordsStartingWith,
    stats: stats
  };

  // Build eagerly once the DOM (and therefore words-data.js, which loads
  // before this file — see index.html) is ready, so the first real coach
  // query doesn't pay the index-build cost. Silently no-ops if
  // CSW24_BY_LENGTH or FlexSearch aren't available yet; ensureBuilt()
  // will retry lazily on first use either way.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBuilt);
  } else {
    ensureBuilt();
  }
})(window);
