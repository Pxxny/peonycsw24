/* =========================================================
   CSW24 Word Lab — endgame-practice-worker.js
   =========================================================
   Runs EndgamePracticeEngine's board-building + exhaustive
   move search off the main thread, so building an Endgame
   Trainer / Parallel Play Finder scenario (which can take a
   couple of seconds for the final exhaustive search on a
   filled board — see EndgamePracticeEngine.js's header for
   why that step specifically needs to stay uncapped) never
   freezes the UI.

   Self-contained: imports the same real local files the main
   thread uses (words-data.js, RackManage.js, BoardSystems.js,
   BotSystem.js, EndgamePracticeEngine.js) via same-origin
   importScripts — no CDN dependency, no duplicated logic. The
   worker calls the exact same functions the main thread would;
   this file only relays results back over postMessage.
   ========================================================= */

// RackManage.js / BoardSystems.js / BotSystem.js are written as
// (function (global) { ... })(window) for use on the main thread, where
// `window` is the global object. A classic Worker's global object is
// `self`, not `window` — aliasing window to self here (before importing
// those files) is a standard, side-effect-free shim so the exact same
// unmodified files work correctly in both places.
self.window = self;

importScripts(
  'words-data.js',
  'BoardSystem/RackManage.js',
  'BoardSystem/BoardSystems.js',
  'BoardSystem/BotSystem.js',
  'EndgamePracticeEngine.js'
);

self.onmessage = function (e) {
  const msg = e.data || {};
  let result, error;
  try {
    if (msg.method === 'buildEndgameScenario') {
      result = self.EndgamePracticeEngine.buildEndgameScenario(msg.args[0], msg.args[1], msg.args[2]);
    } else if (msg.method === 'buildParallelScenario') {
      result = self.EndgamePracticeEngine.buildParallelScenario(msg.args[0], msg.args[1], msg.args[2]);
    } else {
      error = 'unknown method: ' + msg.method;
    }
  } catch (err) {
    error = err && err.message ? err.message : String(err);
  }
  self.postMessage({ requestId: msg.requestId, result: result, error: error });
};
