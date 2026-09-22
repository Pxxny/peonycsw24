/* =========================================================
   CSW24 Word Lab — EndgamePracticeEngine.js
   =========================================================
   Scope: shared engine behind two advanced Practice modes —
   "Endgame Trainer" and "Parallel Play Finder". Both need the
   same two real ingredients: a legitimate mid-game board (real
   interlocking CSW24 words, not decoration) and a real rack
   drawn from a real remaining bag — then a real search over
   every legal placement for that rack on that board. This file
   builds both ingredients and wraps BotSystem.generateCandidates
   (already used by the bot opponents, unmodified here) as that
   search, so "the best move" and "every parallel play" shown to
   the learner are genuinely the best/every one, not a sampled
   subset presented as complete.

   Depends on: window.BoardSystems, window.BotSystem (for
   generateCandidates + findAnchors + isValidWord/ensureWordSet),
   window.RackManage. All three are already loaded globally by
   index.html for the Play tab; this file adds no new dependency.

   BOARD GENERATION
   -----------------
   To guarantee every generated board is 100% legal (every
   cross-word real), this file builds a board the same way the
   real game does: draw a rack, ask generateCandidates for a
   legal placement, apply it, repeat. This is slower than
   hand-authoring a fixed set of boards, but it means the board
   shown is never fabricated set-dressing — it's provably valid
   under the exact same rules the rest of the app already
   enforces, and a fresh one can be generated every time.

   SEARCH
   -----------------
   Both modes call the SAME exhaustive search
   (BotSystem.generateCandidates with opts.exhaustive:true, which
   removes every early-exit cap the bot normally uses to stay
   fast) — Endgame Trainer wants the single highest-scoring
   candidate; Parallel Play Finder wants every candidate whose
   `formed` array has more than one word (i.e. the new tiles
   complete more than one word at once — the literal definition
   of a parallel play). Nothing here re-implements or
   approximates move legality; a candidate only exists in the
   returned list because BotSystem's own real dictionary-and-
   board validation already accepted it.
   ========================================================= */

(function (global) {
  'use strict';

  // Used for the final, uncapped search only (searchAllMoves). Word order
  // doesn't matter here since nothing is capped — opts.exhaustive:true is
  // what removes every cap/budget.
  const EXHAUSTIVE_PROFILE = {
    label: 'exhaustive',
    maxWordLenPreference: 15,
    wordOrder: 'default',
    searchDepth: Infinity
  };

  // Used for the fast, capped board-building search only (fastLegalMove).
  // wordOrder:'shuffled' (a BotSystem.js word-pool order used only by this
  // file — see its definition there) is essential here, not cosmetic: a
  // capped attemptCap over the plain alphabetical order would only ever
  // try early-alphabet words, so a rack whose legal words all start later
  // in the alphabet would wrongly come back empty. See fastLegalMove's
  // comment below for the full explanation.
  const FAST_PROFILE = {
    label: 'fast-shuffled',
    maxWordLenPreference: 15,
    wordOrder: 'shuffled',
    searchDepth: Infinity
  };

  function bs() { return global.BoardSystems; }
  function bot() { return global.BotSystem; }
  function rm() { return global.RackManage; }

  function ready() {
    return !!(bs() && bot() && rm() && typeof bot().generateCandidates === 'function');
  }

  /**
   * Runs the FULL, uncapped legal-move search for `rack` on `board`.
   * Returns the raw candidate array from BotSystem.generateCandidates —
   * each candidate already carries {placements, direction, score, word,
   * formed} exactly as the bot itself uses to choose its own moves.
   *
   * This is the expensive call (can take a couple of seconds on a busy
   * board — every dictionary word of every length at every anchor is
   * tried, with no per-slot cap) and is used ONLY for the final "what's
   * the best move" / "find every parallel play" query on an already-built
   * board — never per-move while building that board (see fastLegalMove
   * below for that).
   */
  function searchAllMoves(board, rack) {
    if (!ready()) return [];
    bot().ensureWordSet();
    return bot().generateCandidates(board, rack, EXHAUSTIVE_PROFILE, undefined, undefined, { exhaustive: true });
  }

  /**
   * Runs a FAST (capped) legal-move search — used only while constructing
   * the intermediate board, where any real legal placement is enough; the
   * board's legitimacy comes from every placement being independently
   * validated by BoardSystems/BotSystem's own real dictionary+shape
   * checks, not from having searched every possible option.
   *
   * Uses wordOrder:'shuffled' + a bounded attemptCap together — NOT
   * attemptCap:Infinity (that regressed timing badly on a filled board,
   * since it then tries every dictionary word of every length at every
   * anchor) and NOT the default attemptCap:25 with alphabetical order
   * (that reintroduces a real correctness bug: capped-plus-alphabetical
   * means only early-alphabet words are ever tried, so racks like WILY/
   * SIN/WIN — nothing legal starting A-through-T-ish — would wrongly
   * come back with zero candidates on an empty board, which measured
   * ~27% of random racks in testing). Shuffling the per-length word pool
   * once, then capping attempts, samples fairly across the whole
   * dictionary instead of always hitting the same early-alphabet prefix,
   * which is what "find any legal move quickly" actually needs.
   */
  function fastLegalMove(board, rack) {
    if (!ready()) return [];
    bot().ensureWordSet();
    return bot().generateCandidates(board, rack, FAST_PROFILE, undefined, undefined, { widenMaxLen: true, candidateCap: Infinity, attemptCap: 60 });
  }

  /**
   * Builds one legitimate mid-game board by repeatedly drawing a rack from
   * a real bag and applying one real legal placement found by a fast
   * (capped) search — never a hand-decorated or invented layout. Every
   * applied placement is still fully validated (real dictionary words,
   * correct crosswords, real board rules) by BoardSystems/BotSystem; only
   * the SEARCH for a placement is capped for speed, not the validation of
   * the one that gets used. Stops once `targetMoves` legal placements
   * have been applied, or earlier if the bag runs out or a draw genuinely
   * has no legal placement (rare, but honestly reported rather than
   * forced).
   *
   * Returns { board, movesApplied, bag } — movesApplied may be less than
   * targetMoves if the search ever came up empty; callers should treat
   * that as "board is smaller than requested", not an error.
   */
  // reserveTiles: stop building moves once the bag would drop below this
  // many tiles, so the caller's own draw afterward is guaranteed to have
  // at least this many tiles available. 0 = old behavior (draw down as
  // far as targetMoves allows).
  function buildMidGameBoard(targetMoves, reserveTiles) {
    if (!ready()) return null;
    bot().ensureWordSet();
    const board = bs().createEmptyBoard();
    const bag = rm().createBag();
    let movesApplied = 0;
    const reserve = reserveTiles || 0;

    for (let i = 0; i < targetMoves; i++) {
      // Never draw the bag down past the caller's reserve — that tile
      // count is being held back for the learner's own rack.
      const available = rm().bagCount(bag) - reserve;
      const rackSize = Math.min(7, available);
      if (rackSize < 2) break; // not enough spare tiles left to plausibly form a word
      const rack = rm().drawTiles(bag, rackSize);
      const candidates = fastLegalMove(board, rack);
      if (!candidates.length) {
        // No legal placement for this draw — return the tiles to the bag
        // (so the bag composition stays honest) and stop building rather
        // than force an illegal or fabricated placement.
        rm().returnTiles(bag, rack);
        break;
      }
      // Pick a genuinely random legal candidate (not always the highest-
      // scoring one) so the resulting board looks like an ordinary game in
      // progress rather than an unnaturally optimal one.
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      bs().applyPlacements(board, pick.placements);
      movesApplied++;
    }

    return { board: board, movesApplied: movesApplied, bag: bag };
  }

  /**
   * Picks the learner's rack from `bag` according to `opts.rackSource`:
   *
   *  - 'bag' (default): old behavior. Rack size = min(wantSize, tiles
   *    left in bag) — whatever the board-building step happened to leave.
   *
   *  - 'bag-exact': the caller must have already reserved `wantSize`
   *    tiles via buildMidGameBoard's `reserveTiles` (see below), so this
   *    just draws exactly `wantSize` tiles, or fails honestly if for some
   *    reason fewer remain.
   *
   *  - 'cardbox': picks a word the learner is actually studying whose
   *    letters can genuinely still be drawn from `bag` right now (i.e. the
   *    bag currently holds at least as many of each needed letter, blanks
   *    substitutable for anything), draws exactly that word's letters out
   *    of the bag, then tops the rack up to `wantSize` with ordinary
   *    random draws from what's left. This keeps the physics 100% honest
   *    — nothing is added to the rack that wasn't really available in the
   *    bag — while guaranteeing a familiar word is sitting in the rack to
   *    practice building off of. `opts.cardboxWords` is the candidate
   *    list (already filtered/shuffled by the caller); the first word
   *    that fits the current bag wins. Returns `null` (not a smaller
   *    rack) if no candidate word fits — callers should treat that as "no
   *    usable Cardbox word right now", not silently fall back, so the
   *    learner is told plainly rather than getting an unrelated rack.
   */
  function drawRackForLearner(bag, wantSize, opts) {
    opts = opts || {};
    if (opts.rackSource === 'cardbox') {
      const words = Array.isArray(opts.cardboxWords) ? opts.cardboxWords : [];
      for (let i = 0; i < words.length; i++) {
        const word = String(words[i] || '').toUpperCase();
        if (!word || word.length > wantSize) continue;
        const need = {};
        for (const ch of word) need[ch] = (need[ch] || 0) + 1;
        // Count what's actually left in the bag right now (real tiles, not a fresh bag).
        const have = {};
        bag.forEach(function (t) { have[t] = (have[t] || 0) + 1; });
        let blanksNeeded = 0, fits = true;
        for (const ch in need) {
          const short = need[ch] - (have[ch] || 0);
          if (short > 0) blanksNeeded += short;
        }
        if (blanksNeeded > (have['?'] || 0)) fits = false; // not enough blanks to cover the shortfall
        if (!fits) continue;
        // Draw the word's exact letters out of the bag (using blanks for any shortfall).
        const drawn = [];
        const bagCopy = bag.slice();
        for (const ch of word) {
          let idx = bagCopy.indexOf(ch);
          if (idx === -1) idx = bagCopy.indexOf('?'); // use a blank in place of a missing letter
          if (idx === -1) { fits = false; break; } // shouldn't happen given the count check above, but never fabricate a tile
          drawn.push(bagCopy[idx]);
          bagCopy.splice(idx, 1);
        }
        if (!fits) continue;
        bag.length = 0;
        bagCopy.forEach(function (t) { bag.push(t); });
        // Top up to wantSize with ordinary random draws from what's left.
        const extra = rm().drawTiles(bag, Math.min(wantSize - drawn.length, bag.length));
        return { rack: drawn.concat(extra), cardboxWord: word };
      }
      return null; // no candidate word currently fits the real bag contents
    }

    // 'bag' / 'bag-exact': plain draw of whatever is available/requested.
    const size = Math.min(wantSize, rm().bagCount(bag));
    if (opts.rackSource === 'bag-exact' && size < wantSize) return null;
    if (size < 1) return null;
    return { rack: rm().drawTiles(bag, size), cardboxWord: null };
  }

  /**
   * Convenience for Endgame Trainer: builds a mid/late-game board (bag
   * already drawn down, simulating "few tiles left"), then draws the
   * learner's own rack from whatever real tiles remain in that same bag —
   * so the rack the learner sees is drawn from a bag genuinely consistent
   * with the board they're looking at, not generated independently.
   *
   * opts.rackSource: 'bag' (default, old variable-size behavior),
   * 'bag-exact' (always exactly learnerRackSize tiles — "bingo hunting"),
   * or 'cardbox' (rack is built around a word from opts.cardboxWords that
   * the current bag can genuinely still supply). For 'bag-exact' and
   * 'cardbox', the board-building step reserves `learnerRackSize` tiles
   * from the very first move onward so the rack is never silently smaller
   * than requested — if the bag genuinely can't support both the
   * requested board moves and a full-size rack, this honestly returns
   * null (or fewer board moves aren't enough — see buildMidGameBoard)
   * rather than ever shortchanging the learner's rack.
   */
  function buildEndgameScenario(targetMoves, learnerRackSize, opts) {
    opts = opts || {};
    const wantSize = learnerRackSize || 7;
    const reserve = (opts.rackSource === 'bag-exact' || opts.rackSource === 'cardbox') ? wantSize : 0;
    const built = buildMidGameBoard(targetMoves, reserve);
    if (!built) return null;
    const drawn = drawRackForLearner(built.bag, wantSize, opts);
    if (!drawn) return null;
    const best = bestMove(built.board, drawn.rack);
    return {
      board: built.board,
      rack: drawn.rack,
      cardboxWord: drawn.cardboxWord,
      movesApplied: built.movesApplied,
      tilesLeftInBag: rm().bagCount(built.bag),
      best: best
    };
  }

  /** Highest-scoring legal candidate for `rack` on `board`, or null if none exists. */
  function bestMove(board, rack) {
    const candidates = searchAllMoves(board, rack);
    if (!candidates.length) return null;
    return candidates.reduce(function (best, c) { return (!best || c.score > best.score) ? c : best; }, null);
  }

  /**
   * Convenience for Parallel Play Finder: builds a board, draws a fresh
   * rack from the SAME bag state (consistent with the board, as above),
   * and returns every legal candidate whose placement forms more than one
   * word at once — the real definition of a parallel play, not a
   * heuristic approximation of one.
   */
  function buildParallelScenario(targetMoves, learnerRackSize, opts) {
    opts = opts || {};
    const wantSize = learnerRackSize || 7;
    const reserve = (opts.rackSource === 'bag-exact' || opts.rackSource === 'cardbox') ? wantSize : 0;
    const built = buildMidGameBoard(targetMoves, reserve);
    if (!built) return null;
    const drawn = drawRackForLearner(built.bag, wantSize, opts);
    if (!drawn) return null;
    const rack = drawn.rack;
    const all = searchAllMoves(built.board, rack);
    const parallels = all.filter(function (c) { return c.formed && c.formed.length > 1; });
    return {
      board: built.board,
      rack: rack,
      cardboxWord: drawn.cardboxWord,
      movesApplied: built.movesApplied,
      allMoveCount: all.length,
      parallels: parallels
    };
  }

  global.EndgamePracticeEngine = {
    ready: ready,
    searchAllMoves: searchAllMoves,
    buildMidGameBoard: buildMidGameBoard,
    bestMove: bestMove,
    drawRackForLearner: drawRackForLearner,
    buildEndgameScenario: buildEndgameScenario,
    buildParallelScenario: buildParallelScenario
  };
})(window);
