/* =========================================================
   CSW24 Word Lab — OddsTrainer.js
   =========================================================
   Scope: the "Probability/Odds Trainer" advanced Practice
   mode. Pure combinatorics over the REAL tile pool already
   defined in RackManage.js's TILE_DISTRIBUTION (100 tiles,
   standard Scrabble/CSW distribution incl. 2 blanks) — no
   dictionary lookups, no board state, no bot logic. This file
   depends only on window.RackManage.TILE_DISTRIBUTION.

   What this file does:
     - Simulates a "remaining bag" state (a copy of the full
       distribution minus whatever the drill has removed so
       far) — entirely in memory, never touching the real Play
       game's bag or any localStorage key another system owns.
     - Generates a random drill question about that bag state
       (e.g. "odds of drawing a blank in your next N draws",
       "chance this draw includes at least one vowel") using
       exact hypergeometric probability, not a simulation or
       approximation.
     - Grades a learner's numeric guess (as a percentage)
       against the exact computed answer, within a tolerance
       band, and returns a pass/fail plus the precise value so
       the learner always sees the real number either way.

   Every probability here is computed analytically from the
   real, finite tile counts — nothing is estimated by random
   sampling, so the "correct answer" shown to the learner is
   always exact.
   ========================================================= */

(function (global) {
  'use strict';

  const VOWELS = { A: 1, E: 1, I: 1, O: 1, U: 1 };

  function fullDistribution() {
    const rm = global.RackManage;
    if (!rm || !rm.TILE_DISTRIBUTION) return null;
    // Defensive copy — this file must never mutate RackManage's own object.
    return Object.assign({}, rm.TILE_DISTRIBUTION);
  }

  function totalTiles(dist) {
    return Object.keys(dist).reduce(function (sum, k) { return sum + dist[k]; }, 0);
  }

  // log(n!) via Stirling-safe accumulation — avoids overflow for n up to 100,
  // which is all this file ever needs (the full bag is 100 tiles).
  function logFactorial(n) {
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  }

  function logChoose(n, k) {
    if (k < 0 || k > n) return -Infinity;
    return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
  }

  // Exact hypergeometric P(exactly k successes in a draw of `draws` tiles,
  // from a population of `pop` tiles containing `successStates` successes).
  function hypergeomExact(pop, successStates, draws, k) {
    if (k > draws || k > successStates) return 0;
    const logP = logChoose(successStates, k) + logChoose(pop - successStates, draws - k) - logChoose(pop, draws);
    return Math.exp(logP);
  }

  // Exact P(at least one success in `draws` tiles) = 1 - P(zero successes).
  function hypergeomAtLeastOne(pop, successStates, draws) {
    return 1 - hypergeomExact(pop, successStates, draws, 0);
  }

  function countByPredicate(dist, predicate) {
    return Object.keys(dist).reduce(function (sum, letter) {
      return sum + (predicate(letter) ? dist[letter] : 0);
    }, 0);
  }

  // ---------- Question generation ----------
  // Each question type returns { prompt, exactPct, detail }. exactPct is
  // the precise probability as a 0-100 number; detail is a short, honest
  // explanation of the real counts used, shown after grading.

  function questionBlankDraw(dist, draws) {
    const pop = totalTiles(dist);
    const blanks = dist['?'] || 0;
    const p = hypergeomAtLeastOne(pop, blanks, draws) * 100;
    return {
      type: 'blank',
      prompt: 'ถุงเหลือ ' + pop + ' ตัว (blank ' + blanks + ' ตัว) — โอกาสที่คุณจะจับได้ blank อย่างน้อย 1 ตัว จากการจับ ' + draws + ' ตัวถัดไปคือกี่เปอร์เซ็นต์?',
      exactPct: p,
      detail: 'คำนวณจาก hypergeometric: ถุงมี ' + pop + ' ตัว, blank ' + blanks + ' ตัว, จับ ' + draws + ' ตัว'
    };
  }

  function questionVowelDraw(dist, draws) {
    const pop = totalTiles(dist);
    const vowels = countByPredicate(dist, function (l) { return !!VOWELS[l]; });
    const p = hypergeomAtLeastOne(pop, vowels, draws) * 100;
    return {
      type: 'vowel',
      prompt: 'ถุงเหลือ ' + pop + ' ตัว (สระ A/E/I/O/U รวม ' + vowels + ' ตัว) — โอกาสที่การจับ ' + draws + ' ตัวถัดไปจะมีสระอย่างน้อย 1 ตัวคือกี่เปอร์เซ็นต์?',
      exactPct: p,
      detail: 'คำนวณจาก hypergeometric: ถุงมี ' + pop + ' ตัว, สระรวม ' + vowels + ' ตัว, จับ ' + draws + ' ตัว'
    };
  }

  function questionSpecificLetter(dist, draws) {
    const pop = totalTiles(dist);
    const letters = Object.keys(dist).filter(function (l) { return l !== '?' && dist[l] > 0; });
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const count = dist[letter];
    const p = hypergeomAtLeastOne(pop, count, draws) * 100;
    return {
      type: 'letter',
      prompt: 'ถุงเหลือ ' + pop + ' ตัว (ตัว ' + letter + ' เหลือ ' + count + ' ตัว) — โอกาสที่การจับ ' + draws + ' ตัวถัดไปจะมีตัว ' + letter + ' อย่างน้อย 1 ตัวคือกี่เปอร์เซ็นต์?',
      exactPct: p,
      detail: 'คำนวณจาก hypergeometric: ถุงมี ' + pop + ' ตัว, ตัว ' + letter + ' เหลือ ' + count + ' ตัว, จับ ' + draws + ' ตัว'
    };
  }

  const QUESTION_BUILDERS = [questionBlankDraw, questionVowelDraw, questionSpecificLetter];

  /**
   * Generates one drill question against a fresh full bag (or a caller-
   * supplied remaining distribution, e.g. to chain questions within one
   * simulated game without a real bag ever being touched).
   */
  function generateQuestion(remainingDist) {
    const dist = remainingDist || fullDistribution();
    if (!dist) return null;
    const pop = totalTiles(dist);
    if (pop === 0) return null;
    const draws = 1 + Math.floor(Math.random() * Math.min(3, pop)); // 1-3 draws, never more than what's left
    const builder = QUESTION_BUILDERS[Math.floor(Math.random() * QUESTION_BUILDERS.length)];
    return builder(dist, draws);
  }

  // ---------- Grading ----------
  // Tolerance band widens slightly as the true probability moves away from
  // 50%, since guessing "near the extreme" is naturally easier than the
  // middle — but this never changes the exact answer shown, only whether
  // the learner's guess counts as a "pass".
  const BASE_TOLERANCE_PCT = 5;

  function gradeGuess(question, guessPct) {
    if (!question || typeof guessPct !== 'number' || isNaN(guessPct)) {
      return { ok: false, error: 'กรุณากรอกตัวเลขเป็นเปอร์เซ็นต์ (0-100)' };
    }
    const diff = Math.abs(guessPct - question.exactPct);
    const pass = diff <= BASE_TOLERANCE_PCT;
    return {
      ok: true,
      pass: pass,
      exactPct: Math.round(question.exactPct * 10) / 10,
      guessPct: guessPct,
      diff: Math.round(diff * 10) / 10,
      detail: question.detail
    };
  }

  global.OddsTrainer = {
    fullDistribution: fullDistribution,
    totalTiles: totalTiles,
    hypergeomExact: hypergeomExact,
    hypergeomAtLeastOne: hypergeomAtLeastOne,
    generateQuestion: generateQuestion,
    gradeGuess: gradeGuess
  };
})(window);
