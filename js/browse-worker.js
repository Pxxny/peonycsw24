/* =========================================================
   CSW24 Word Lab — Browse search Web Worker
   Runs the heaviest "all lengths" filter scans off the main
   thread via Comlink, so a big search never freezes the UI.

   This file intentionally duplicates a handful of small, pure
   functions from app.js (sortLetters, wordScore, pattern/rack
   matching, vowel ratio) rather than importing app.js itself —
   app.js is a DOM-dependent, self-invoking closure with no
   exports, and none of that is available inside a worker
   anyway (no `document`, no `window`). Keeping this file
   self-contained also means the worker only ever needs
   words-data.js, not the whole app.
   ========================================================= */

importScripts('https://cdn.jsdelivr.net/npm/comlink@4.4.2/dist/umd/comlink.js');
importScripts('words-data.js');

const SCRABBLE_VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8,
  K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1,
  U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};
const VOWELS = { A: 1, E: 1, I: 1, O: 1, U: 1 };

function wordScore(word) {
  let s = 0;
  for (let i = 0; i < word.length; i++) s += SCRABBLE_VALUES[word[i]] || 0;
  return s;
}

function letterCounts(str) {
  const m = {};
  for (let i = 0; i < str.length; i++) m[str[i]] = (m[str[i]] || 0) + 1;
  return m;
}

function vowelRatioPct(word) {
  let v = 0;
  for (let i = 0; i < word.length; i++) if (VOWELS[word[i]]) v++;
  return (v / word.length) * 100;
}

function wordMatchesPattern(word, pattern) {
  if (word.length !== pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    if (p === '_' || p === '?') continue;
    if (p !== word[i]) return false;
  }
  return true;
}

function isSubsetOfCountsWithBlanks(word, rackCounts, blankCount) {
  const wc = letterCounts(word);
  let blanksNeeded = 0;
  for (const ch in wc) {
    const have = rackCounts[ch] || 0;
    if (have < wc[ch]) blanksNeeded += (wc[ch] - have);
  }
  return blanksNeeded <= blankCount;
}

function wordPlayableFromRack(word, rackCounts, blankCount) {
  return isSubsetOfCountsWithBlanks(word, rackCounts, blankCount);
}

function wordContainsLettersAnywhere(word, needle) {
  const clean = (needle || '').toUpperCase().replace(/[^A-Z?]/g, '');
  if (!clean) return true;
  const blankCount = (clean.match(/\?/g) || []).length;
  const letters = clean.replace(/\?/g, '');
  const needCounts = letterCounts(letters);
  const wordCounts = letterCounts(word);
  let blanksUsed = 0;
  for (const ch in needCounts) {
    const have = wordCounts[ch] || 0;
    const short = needCounts[ch] - have;
    if (short > 0) blanksUsed += short;
  }
  return blanksUsed <= blankCount;
}

function wordMatchesFilters(word, f) {
  if (f.wordSearch && word.indexOf(f.wordSearch) === -1) return false;
  if (f.starts && !word.startsWith(f.starts)) return false;
  if (f.ends && !word.endsWith(f.ends)) return false;
  if (f.contains && word.indexOf(f.contains) === -1) return false;
  if (f.containsAll && !wordContainsLettersAnywhere(word, f.containsAll)) return false;
  if (f.scoreMin != null && wordScore(word) < f.scoreMin) return false;
  if (f.scoreMax != null && wordScore(word) > f.scoreMax) return false;
  if (f.pattern && !wordMatchesPattern(word, f.pattern)) return false;
  if (f.rackCounts && !wordPlayableFromRack(word, f.rackCounts, f.rackBlanks)) return false;
  if (f.vowelMin != null && vowelRatioPct(word) < f.vowelMin) return false;
  if (f.vowelMax != null && vowelRatioPct(word) > f.vowelMax) return false;
  return true;
}

function lengthPool(L) {
  return (typeof CSW24_BY_LENGTH !== 'undefined' && CSW24_BY_LENGTH[L]) || [];
}

const api = {
  // Runs the same candidate-gathering + filtering that runBrowseSearch does
  // on the main thread, but here — used only for the expensive "all
  // lengths, with filters" case. Returns just the matched words (a much
  // smaller payload than shipping the whole candidate pool both ways).
  filterWords: function (activeLength, filters) {
    let candidates = [];
    if (filters.pattern) {
      candidates = lengthPool(filters.pattern.length);
    } else if (activeLength === 'all') {
      const min = typeof CSW24_MIN_LEN !== 'undefined' ? CSW24_MIN_LEN : 2;
      const max = typeof CSW24_MAX_LEN !== 'undefined' ? CSW24_MAX_LEN : 15;
      for (let L = min; L <= max; L++) candidates = candidates.concat(lengthPool(L));
    } else {
      candidates = lengthPool(activeLength);
    }
    return candidates.filter(function (w) { return wordMatchesFilters(w, filters); });
  }
};

Comlink.expose(api);
