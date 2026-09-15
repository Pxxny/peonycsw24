/* =========================================================
   CSW24 Word Lab — RackBalanceAnalyzer.js
   =========================================================
   Scope: the "Rack Balance Analyzer" advanced Practice mode.
   Draws a real 7-tile rack from the actual tile bag (same
   window.RackManage distribution as everywhere else in this
   app) and reports a full, honest breakdown of it — no picking
   tiles to discard, no grading a choice (that's Vowel Dump
   Practice); this is a straight analysis of whatever rack you
   were just dealt.

   Reuses window.VowelDumpTrainer's vowel/consonant counting
   and balance-band logic rather than re-implementing it, so
   both trainers always agree on what "balanced" means. Adds
   what Vowel Dump Practice doesn't cover:
     - duplicate-letter counts (a real rack liability — e.g.
       three E's or two I's crowds out flexibility)
     - total point value of the rack's tiles (from
       RackManage.tileValue, the same values used everywhere
       else in this app)
     - a plain "difficult tiles" flag list: Q present without a
       U in the same rack (Qi/Qat/etc. from CSW24 aside, this is
       the single most commonly cited rack problem), and how
       many of J/Q/X/Z (the four highest-value, hardest-to-play
       letters) are on the rack at once

   Every number here is a direct count off the real drawn rack
   — nothing is a subjective "quality score".
   ========================================================= */

(function (global) {
  'use strict';

  const HARD_LETTERS = { J: 1, Q: 1, X: 1, Z: 1 };

  function drawRack() {
    // Draws directly from RackManage rather than delegating to
    // VowelDumpTrainer.drawRack() — both trainers want the exact same
    // "7 tiles from a fresh full bag" draw, but calling RackManage
    // directly here means this file has no dependency on
    // VowelDumpTrainer.js's load order or internal implementation at
    // all, which is one less way for this trainer to break.
    const rm = global.RackManage;
    if (!rm) return null;
    const bag = rm.createBag();
    return rm.drawTiles(bag, 7);
  }

  function duplicateCounts(rack) {
    const counts = {};
    rack.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    const duplicates = {};
    Object.keys(counts).forEach(function (letter) {
      if (counts[letter] > 1) duplicates[letter] = counts[letter];
    });
    return duplicates;
  }

  function totalValue(rack) {
    const rm = global.RackManage;
    if (!rm) return null;
    return rack.reduce(function (sum, t) { return sum + rm.tileValue(t); }, 0);
  }

  function hardLetterReport(rack) {
    const present = rack.filter(function (t) { return !!HARD_LETTERS[t]; });
    const hasQ = rack.indexOf('Q') !== -1;
    const hasU = rack.indexOf('U') !== -1;
    return {
      present: present,
      count: present.length,
      qWithoutU: hasQ && !hasU
    };
  }

  /**
   * Full analysis of a drawn rack. Delegates vowel/consonant counting and
   * balance banding to window.VowelDumpTrainer so both trainers stay in
   * exact agreement on what "balanced" means; adds duplicate-letter,
   * point-value, and hard-letter facts on top.
   */
  function analyzeRack(rack) {
    const vd = global.VowelDumpTrainer;
    const vcCounts = vd ? vd.countVowelsConsonants(rack) : null;
    const band = vd ? vd.balanceBand(vcCounts.vowels) : null;

    return {
      rack: rack,
      vowelConsonant: vcCounts,
      balanceBand: band,
      duplicates: duplicateCounts(rack),
      totalValue: totalValue(rack),
      hardLetters: hardLetterReport(rack)
    };
  }

  global.RackBalanceAnalyzer = {
    drawRack: drawRack,
    duplicateCounts: duplicateCounts,
    totalValue: totalValue,
    hardLetterReport: hardLetterReport,
    analyzeRack: analyzeRack
  };
})(window);
