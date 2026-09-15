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
  function buildMidGameBoard(targetMoves) {
    if (!ready()) return null;
    bot().ensureWordSet();
    const board = bs().createEmptyBoard();
    const bag = rm().createBag();
    let movesApplied = 0;

    for (let i = 0; i < targetMoves; i++) {
      const rackSize = Math.min(7, rm().bagCount(bag));
      if (rackSize < 2) break; // not enough tiles left to plausibly form a word
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
   * Convenience for Endgame Trainer: builds a mid/late-game board (bag
   * already drawn down, simulating "few tiles left"), then draws the
   * learner's own rack from whatever real tiles remain in that same bag —
   * so the rack the learner sees is drawn from a bag genuinely consistent
   * with the board they're looking at, not generated independently.
   */
  function buildEndgameScenario(targetMoves, learnerRackSize) {
    const built = buildMidGameBoard(targetMoves);
    if (!built) return null;
    const size = Math.min(learnerRackSize || 7, rm().bagCount(built.bag));
    if (size < 1) return null;
    const rack = rm().drawTiles(built.bag, size);
    const best = bestMove(built.board, rack);
    return {
      board: built.board,
      rack: rack,
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
  function buildParallelScenario(targetMoves, learnerRackSize) {
    const built = buildMidGameBoard(targetMoves);
    if (!built) return null;
    const size = Math.min(learnerRackSize || 7, rm().bagCount(built.bag));
    if (size < 1) return null;
    const rack = rm().drawTiles(built.bag, size);
    const all = searchAllMoves(built.board, rack);
    const parallels = all.filter(function (c) { return c.formed && c.formed.length > 1; });
    return {
      board: built.board,
      rack: rack,
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
    buildEndgameScenario: buildEndgameScenario,
    buildParallelScenario: buildParallelScenario
  };
})(window);
