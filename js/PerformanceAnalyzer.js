/* =========================================================
   CSW24 Word Lab — AI Coach: PerformanceAnalyzer.js
   =========================================================
   Scope for this file, right now: Response Time + the four
   breakdowns (Word Length / Anagram / Bingo / Stem). Nothing
   else from the AI Coach spec lives here yet — no priority
   scoring, no recommendations, no adaptive difficulty. This
   is purely "read the real log, compute real numbers."

   Reads directly from localStorage (csw24_learn_log_v1, same
   key app.js's Learn tab already writes to) and from the
   global CSW24_BY_LENGTH data (set by words-data.js). This
   file is loaded standalone like CoachUI.js — app.js is a
   closed IIFE with nothing exported, so nothing here can call
   into it; it only reads the same localStorage key and the
   same global word lists app.js already uses.

   Every number below is either a direct read or a
   straightforward aggregate (count/average/percentage) of the
   real learn log. Nothing here is inferred or invented — a
   bucket with 0 samples is reported as such (sampleSize: 0,
   accuracy: null), never silently skipped or guessed at.
   ========================================================= */

(function (global) {
  'use strict';

  const LEARN_LOG_KEY = 'csw24_learn_log_v1';
  const BINGO_LENGTHS = [7, 8]; // standard Scrabble/CSW "bingo" lengths (full-rack plays)

  function loadLearnLog() {
    try {
      const raw = localStorage.getItem(LEARN_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function sortLetters(word) {
    return word.split('').sort().join('');
  }

  function poolForLength(L) {
    return (typeof CSW24_BY_LENGTH !== 'undefined' && CSW24_BY_LENGTH[L]) || [];
  }

  // ---------- shared aggregation helper ----------
  // Buckets a set of {correct, responseMs} entries and reduces each bucket
  // to sampleSize / accuracy / avgResponseMs. accuracy and avgResponseMs
  // are null (not 0) when there's no data for that metric specifically —
  // an empty bucket is null accuracy, and a bucket where no entry happened
  // to have a recorded responseMs (all logged before this feature existed)
  // is null avgResponseMs, even if accuracy is known. The two are tracked
  // independently on purpose.
  function reduceBucket(entries) {
    const sampleSize = entries.length;
    if (!sampleSize) return { sampleSize: 0, accuracy: null, avgResponseMs: null };
    let correct = 0, timedCount = 0, timedSum = 0;
    entries.forEach(function (e) {
      if (e.correct) correct++;
      if (typeof e.responseMs === 'number') { timedCount++; timedSum += e.responseMs; }
    });
    return {
      sampleSize: sampleSize,
      accuracy: Math.round((correct / sampleSize) * 100),
      avgResponseMs: timedCount ? Math.round(timedSum / timedCount) : null
    };
  }

  // ---------- Word Length breakdown ----------
  // Straight groupby on the log's own `len` field — no lookups needed.
  function breakdownByLength() {
    const log = loadLearnLog();
    const byLen = {};
    log.forEach(function (e) {
      const L = e.len;
      if (!byLen[L]) byLen[L] = [];
      byLen[L].push(e);
    });
    const lengths = Object.keys(byLen).map(Number).sort(function (a, b) { return a - b; });
    return lengths.map(function (L) {
      return Object.assign({ length: L }, reduceBucket(byLen[L]));
    });
  }

  // ---------- Anagram breakdown ----------
  // "Has anagram(s)" = at least one other CSW24 word of the same length
  // shares this word's exact letter multiset. This is the same alphagram
  // concept Alphagram Blitz and Learn's multi-answer cards already use —
  // not a new definition, just applied here for accuracy comparison.
  const anagramPartnerCountCache = new Map(); // "LEN:KEY" -> partner count (excluding self)

  function anagramPartnerCount(word) {
    const key = sortLetters(word);
    const cacheKey = word.length + ':' + key;
    if (anagramPartnerCountCache.has(cacheKey)) return anagramPartnerCountCache.get(cacheKey);
    const pool = poolForLength(word.length);
    let count = 0;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i] !== word && sortLetters(pool[i]) === key) count++;
    }
    anagramPartnerCountCache.set(cacheKey, count);
    return count;
  }

  function breakdownByAnagram() {
    const log = loadLearnLog();
    const withPartners = [];
    const noPartners = [];
    log.forEach(function (e) {
      (anagramPartnerCount(e.word) > 0 ? withPartners : noPartners).push(e);
    });
    return {
      hasAnagramPartners: Object.assign({ label: 'มี anagram partner (คำอื่นใช้ตัวอักษรชุดเดียวกัน)' }, reduceBucket(withPartners)),
      noAnagramPartners: Object.assign({ label: 'ไม่มี anagram partner' }, reduceBucket(noPartners))
    };
  }

  // ---------- Bingo breakdown ----------
  // Bingo = playing all tiles on a full 7- or 8-tile rack in real Scrabble.
  // Here that's simply "the word is 7 or 8 letters long" vs. everything else.
  function breakdownByBingo() {
    const log = loadLearnLog();
    const bingo = [];
    const nonBingo = [];
    log.forEach(function (e) {
      (BINGO_LENGTHS.indexOf(e.len) !== -1 ? bingo : nonBingo).push(e);
    });
    return {
      bingoLengths: Object.assign({ label: 'คำ 7-8 ตัวอักษร (Bingo)' }, reduceBucket(bingo)),
      otherLengths: Object.assign({ label: 'ความยาวอื่น' }, reduceBucket(nonBingo))
    };
  }

  // ---------- Stem breakdown ----------
  // Only meaningful for 7-letter words (a "stem" is the app's own term for
  // a 6-letter base that extends to 7-letter bingos — see app.js's Stem
  // system comment). For each 7-letter word in the log, check whether
  // removing any one letter leaves a 6-letter CSW24 word (i.e. this word
  // sits on a real stem) and, if so, how many total 7-letter words that
  // richest stem base extends to. "Rich" vs "poor" split at >=10 total
  // extensions, a reasonable stem-study threshold — not a precise science,
  // so this is exposed as ruleOfThumb, not a fixed spec value.
  const RICH_STEM_THRESHOLD = 10;
  let stem6KeySetCache = null;
  let stemExtensionCountCache = new Map(); // 6-letter alphagram key -> total 7-letter extensions

  function ensureStemCaches() {
    if (stem6KeySetCache) return;
    const pool6 = poolForLength(6);
    const pool7 = poolForLength(7);
    stem6KeySetCache = new Set(pool6.map(sortLetters));
    // Count, for every 6-letter alphagram key, how many DISTINCT 7-letter
    // words extend it (across all 26 possible added letters) — mirrors
    // app.js's stemBuildTable() logic independently, since this file can't
    // call into app.js's closure.
    const key6ToWords7 = new Map();
    for (let i = 0; i < pool7.length; i++) {
      const w7 = pool7[i];
      const triedKeys = new Set();
      for (let pos = 0; pos < w7.length; pos++) {
        const remainder = w7.slice(0, pos) + w7.slice(pos + 1);
        const key6 = sortLetters(remainder);
        if (triedKeys.has(key6) || !stem6KeySetCache.has(key6)) continue;
        triedKeys.add(key6);
        if (!key6ToWords7.has(key6)) key6ToWords7.set(key6, new Set());
        key6ToWords7.get(key6).add(w7);
      }
    }
    key6ToWords7.forEach(function (words7Set, key6) {
      stemExtensionCountCache.set(key6, words7Set.size);
    });
  }

  // Returns the richest stem base's extension count for a 7-letter word,
  // or 0 if it sits on no valid 6-letter stem at all.
  function richestStemExtensionCount(word7) {
    ensureStemCaches();
    let best = 0;
    const triedKeys = new Set();
    for (let pos = 0; pos < word7.length; pos++) {
      const remainder = word7.slice(0, pos) + word7.slice(pos + 1);
      const key6 = sortLetters(remainder);
      if (triedKeys.has(key6)) continue;
      triedKeys.add(key6);
      const count = stemExtensionCountCache.get(key6) || 0;
      if (count > best) best = count;
    }
    return best;
  }

  function breakdownByStem() {
    const log = loadLearnLog().filter(function (e) { return e.len === 7; });
    const noStem = [];
    const poorStem = [];
    const richStem = [];
    log.forEach(function (e) {
      const ext = richestStemExtensionCount(e.word);
      if (ext === 0) noStem.push(e);
      else if (ext < RICH_STEM_THRESHOLD) poorStem.push(e);
      else richStem.push(e);
    });
    return {
      ruleOfThumb: 'นับเฉพาะคำ 7 ตัวอักษร แบ่งตามว่าฐาน 6 ตัวอักษรที่ดีที่สุดของคำนั้นต่อเป็นคำ 7 ตัวได้กี่คำ (>= ' + RICH_STEM_THRESHOLD + ' คำ = stem ที่มีประโยชน์มาก)',
      noStem: Object.assign({ label: 'ไม่มี stem 6 ตัวอักษรที่ใช้ได้เลย' }, reduceBucket(noStem)),
      poorStem: Object.assign({ label: 'Stem ต่อได้น้อย (< ' + RICH_STEM_THRESHOLD + ' คำ)' }, reduceBucket(poorStem)),
      richStem: Object.assign({ label: 'Stem ต่อได้เยอะ (>= ' + RICH_STEM_THRESHOLD + ' คำ)' }, reduceBucket(richStem))
    };
  }

  // ---------- overall response-time summary ----------
  function responseTimeSummary() {
    const log = loadLearnLog();
    const timed = log.filter(function (e) { return typeof e.responseMs === 'number'; });
    if (!timed.length) {
      return { sampleSize: 0, avgResponseMs: null, medianResponseMs: null, note: 'ยังไม่มีข้อมูล response time (เพิ่งเริ่มเก็บ — จะมีข้อมูลหลังตอบคำถามใน Learn รอบต่อไป)' };
    }
    const sorted = timed.map(function (e) { return e.responseMs; }).sort(function (a, b) { return a - b; });
    const sum = sorted.reduce(function (a, b) { return a + b; }, 0);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return { sampleSize: timed.length, avgResponseMs: Math.round(sum / sorted.length), medianResponseMs: median, note: null };
  }

  function fullReport() {
    return {
      generatedAt: Date.now(),
      responseTime: responseTimeSummary(),
      byLength: breakdownByLength(),
      byAnagram: breakdownByAnagram(),
      byBingo: breakdownByBingo(),
      byStem: breakdownByStem()
    };
  }

  global.PerformanceAnalyzer = {
    breakdownByLength: breakdownByLength,
    breakdownByAnagram: breakdownByAnagram,
    breakdownByBingo: breakdownByBingo,
    breakdownByStem: breakdownByStem,
    responseTimeSummary: responseTimeSummary,
    fullReport: fullReport
  };
})(window);
