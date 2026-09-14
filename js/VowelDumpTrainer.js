/* =========================================================
   CSW24 Word Lab — VowelDumpTrainer.js
   =========================================================
   Scope: the "Vowel Dump Practice" advanced Practice mode.
   Draws a real 7-tile rack from the actual tile bag
   (window.RackManage — same distribution used everywhere else
   in this app) and lets the learner mark which tiles they'd
   discard/exchange, then reports the REAL vowel/consonant
   counts of what they kept versus a standard, named Scrabble
   rack-balance guideline — never a fabricated "AI score".

   Guideline used (explicitly stated to the learner, not
   hidden): a 7-tile rack is considered balanced when it holds
   roughly 2-3 vowels (treating a blank as flexible, counted
   separately) — a widely used tournament rule of thumb, not
   this file's own invention. 0-1 vowels is "consonant-heavy"
   and 4+ is "vowel-heavy" (a "vowel dump" situation, hence the
   drill's name); this file only counts and reports which band
   the learner's kept tiles fall into.

   Depends only on window.RackManage.createBag/drawTiles.
   ========================================================= */

(function (global) {
  'use strict';

  const VOWELS = { A: 1, E: 1, I: 1, O: 1, U: 1 };
  const RACK_SIZE = 7;
  const BALANCED_MIN = 2;
  const BALANCED_MAX = 3;

  function drawRack() {
    const rm = global.RackManage;
    if (!rm) return null;
    const bag = rm.createBag();
    return rm.drawTiles(bag, RACK_SIZE);
  }

  function isVowel(letter) { return !!VOWELS[letter]; }

  function countVowelsConsonants(tiles) {
    let vowels = 0, consonants = 0, blanks = 0;
    tiles.forEach(function (t) {
      if (t === '?') blanks++;
      else if (isVowel(t)) vowels++;
      else consonants++;
    });
    return { vowels: vowels, consonants: consonants, blanks: blanks };
  }

  function balanceBand(vowelCount) {
    if (vowelCount < BALANCED_MIN) return 'low';
    if (vowelCount > BALANCED_MAX) return 'high';
    return 'balanced';
  }

  /**
   * Evaluates the learner's discard choice.
   * @param {string[]} rack - the full 7 tiles drawn.
   * @param {Set<number>|number[]} discardIdx - indices (into rack) marked
   *   for discard.
   * Returns real counts for the full rack, the kept tiles, and the
   * discarded tiles, plus which balance band the kept tiles land in.
   * No pass/fail verdict is invented — band + real counts are the
   * whole result, exactly as a coach would describe the rack.
   */
  function evaluateDiscard(rack, discardIdx) {
    const discardSet = discardIdx instanceof Set ? discardIdx : new Set(discardIdx);
    const kept = [], discarded = [];
    rack.forEach(function (tile, i) {
      if (discardSet.has(i)) discarded.push(tile); else kept.push(tile);
    });

    const fullCounts = countVowelsConsonants(rack);
    const keptCounts = countVowelsConsonants(kept);
    const discardedCounts = countVowelsConsonants(discarded);

    return {
      rack: rack,
      kept: kept,
      discarded: discarded,
      fullCounts: fullCounts,
      keptCounts: keptCounts,
      discardedCounts: discardedCounts,
      keptBand: balanceBand(keptCounts.vowels),
      originalBand: balanceBand(fullCounts.vowels)
    };
  }

  global.VowelDumpTrainer = {
    RACK_SIZE: RACK_SIZE,
    BALANCED_MIN: BALANCED_MIN,
    BALANCED_MAX: BALANCED_MAX,
    drawRack: drawRack,
    countVowelsConsonants: countVowelsConsonants,
    balanceBand: balanceBand,
    evaluateDiscard: evaluateDiscard
  };
})(window);
