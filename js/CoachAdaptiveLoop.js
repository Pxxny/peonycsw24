/* =========================================================
   CSW24 Word Lab — AI Coach: CoachAdaptiveLoop.js
   =========================================================
   Scope: close the back half of the project's own training
   cycle — Train → Measure → Adapt → Repeat — which, until now,
   only ran when the learner directly asked the coach a question
   (on-demand). This file makes the coach re-analyze and, when
   warranted, proactively say something the moment a REAL
   training session finishes, without the learner having to ask.

   How it hooks in, without editing app.js or achievement.js:

   app.js already calls a pluggable hook at exactly the two
   moments a real training session completes:

     if (window.Achievements) {
       window.Achievements.record('session_complete', { total, correct, incorrect });
     }

   (see app.js, end of a Cardbox review session AND end of a
   Learn level — both call this same event name). achievement.js
   owns window.Achievements today. Rather than edit either
   already-reviewed file, this file WRAPS window.Achievements.record
   at load time: the original function still runs first and
   unchanged (achievements/streaks keep working exactly as
   before), then this file's own onSessionComplete() runs
   afterward. If window.Achievements never loads (blocked,
   removed later), this file falls back to polyfilling a minimal
   {record: fn} object so app.js's own `if (window.Achievements)`
   guard still finds something to call — app.js's behavior is
   unaffected either way.

   What "Adapt" means here, concretely and only from real data:

     - Re-run WeaknessDetector.js + RecommendationEngine.js
       immediately (MEASURE) — the same modules the on-demand
       chat already uses, so there is exactly one source of
       truth for "what's weak" whether the learner asked or not.
     - Compare the new recommendation's priority/word against
       what was last recommended (kept in memory only, for this
       page load — never persisted, since it's a UI-nudge
       decision, not training data). If something meaningfully
       changed (a NEW leech appeared, priority moved up, or the
       previously-recommended word is now resolved), post one
       proactive message into the coach chat, using
       CoachEngine.js's own intent logic so the message is
       phrased and prioritized identically to an on-demand
       answer (ADAPT + a visible Repeat prompt).
     - If nothing meaningfully changed, stay silent — a coach
       that comments after every single session regardless of
       whether anything changed would be noise, not adaptation.

   This file never grades an answer, never writes SM-2 fields,
   and never calls a bridge action directly — it only decides
   WHEN to ask CoachEngine.js for a fresh answer and appends the
   result to the chat via CoachUI's own message list, the same
   DOM entry point CoachInsightsPanel.js / CoachUI.js use.

   Loaded standalone: IIFE, no build step. Must load after
   achievement.js (to wrap the real record()), and after
   WeaknessDetector.js / RecommendationEngine.js / CoachEngine.js
   / CoachUI.js (to call into them) — see index.html load order.
   Exposes global.CoachAdaptiveLoop.
   ========================================================= */

(function (global) {
  'use strict';

  // Kept in memory only for this page load — comparing "did the
  // recommendation change" is a UI-nudge decision, not something that
  // belongs in localStorage/Cardbox/Learn log.
  let lastNotifiedSignature = null;

  function modulesReady() {
    return !!(global.WeaknessDetector && global.RecommendationEngine && global.CoachEngine);
  }

  // A short, stable fingerprint of "what the coach would currently lead
  // with" — used only to detect real change between one session-end and
  // the next, never shown to the learner and never stored.
  function recommendationSignature(rec) {
    if (!rec) return 'none';
    return [rec.type, rec.priority, (rec.words && rec.words[0]) || rec.word || rec.dimension || ''].join('|');
  }

  // Decides whether the new recommendation is different enough from the
  // last one this file already surfaced to be worth a proactive message.
  // Deliberately conservative: same type+priority+target as last time =
  // stay quiet, even if the underlying counts shifted slightly, so the
  // coach doesn't repeat itself every session.
  function shouldNotify(rec) {
    const sig = recommendationSignature(rec);
    if (sig === lastNotifiedSignature) return false;
    // Never proactively interrupt for a "low"-priority / "none" result —
    // that's exactly the case where there's nothing actionable to adapt
    // toward; the learner can still ask on-demand any time.
    if (!rec || rec.type === 'none' || rec.priority === 'low') return false;
    return true;
  }

  // ---------- The actual Measure -> Adapt step ----------
  // Re-runs the same real-data pipeline the on-demand chat uses
  // (RecommendationEngine.recommend(), which itself reads
  // WeaknessDetector.js + SpacedRepetition.js), and — only if the result
  // is meaningfully different from last time — posts one coach message
  // using CoachEngine.js's own phrasing so proactive and on-demand
  // answers never sound like two different coaches.
  function measureAndAdapt(sessionPayload) {
    if (!modulesReady()) return;

    const rec = global.RecommendationEngine.recommend();
    if (!shouldNotify(rec)) return;
    lastNotifiedSignature = recommendationSignature(rec);

    // Reuse CoachEngine.js's own "what should I study today" answer
    // rather than building a second copy of the same message logic —
    // this keeps the proactive nudge and the on-demand answer to the
    // same question word-for-word identical in phrasing/priority.
    const response = global.CoachEngine.buildResponse('วันนี้ควรฝึกอะไร?');
    postProactiveMessage(response, sessionPayload);
  }

  // Appends the message into the coach's own chat list (same element
  // CoachUI.js's appendCoachMessage writes to), prefixed so it's visibly
  // distinguishable as a proactive nudge rather than a reply to
  // something the learner typed. Falls back to a console note if the
  // panel hasn't been mounted yet (e.g. session finished before the
  // learner ever opened the coach) — never throws, never blocks
  // app.js's own session-end UI.
  function postProactiveMessage(response, sessionPayload) {
    const wrap = document.getElementById('coachMessages');
    if (!wrap || !response || !response.message) return;

    const prefix = 'อัปเดตจากเซสชันที่เพิ่งจบ (ถูก ' + sessionPayload.correct + '/' + sessionPayload.total + '): ';
    const bubble = document.createElement('div');
    bubble.className = 'coach-msg coach-msg-coach coach-msg-proactive';
    bubble.textContent = prefix + response.message;
    wrap.appendChild(bubble);
    wrap.scrollTop = wrap.scrollHeight;

    // Nudge the FAB so a learner who isn't currently looking at the
    // panel notices something new arrived, without forcing the panel
    // open (that would be an unrequested UI takeover mid-training).
    const fab = document.getElementById('coachFab');
    const panel = document.getElementById('coachPanel');
    if (fab && panel && panel.hidden) fab.classList.add('coach-fab-nudge');
  }

  // ---------- Wrapping window.Achievements.record (non-invasive) ----------
  function wrapAchievementsRecord() {
    const original = (global.Achievements && typeof global.Achievements.record === 'function')
      ? global.Achievements.record.bind(global.Achievements)
      : function () {}; // polyfill: if Achievements never loaded, still satisfy app.js's `if (window.Achievements)` check safely

    if (!global.Achievements) global.Achievements = {};

    global.Achievements.record = function (eventName, payload) {
      // Original behavior always runs first, unchanged — achievements,
      // streaks, and every existing stat this already powers keep
      // working exactly as before this file ever loaded.
      const result = original(eventName, payload);
      if (eventName === 'session_complete' && payload) {
        // Deferred slightly so app.js finishes its own render of the
        // session-summary screen first — this file's message should
        // never race the UI update that triggered it.
        setTimeout(function () { measureAndAdapt(payload); }, 50);
      }
      return result;
    };
  }

  function init() {
    wrapAchievementsRecord();
    clearNudgeOnPanelOpen();
  }

  // Clears the FAB pulse the moment the learner opens the coach panel —
  // attached via its own listener (not an edit to CoachUI.js's existing
  // fab click handler) so this file's own file stays the only place that
  // manages the nudge class it adds. Polls briefly for #coachFab the
  // same way CoachInsightsPanel.js does, since CoachUI.js creates it
  // asynchronously on DOMContentLoaded.
  function clearNudgeOnPanelOpen() {
    let attempts = 0;
    const timer = setInterval(function () {
      attempts++;
      const fab = document.getElementById('coachFab');
      if (fab) {
        fab.addEventListener('click', function () { fab.classList.remove('coach-fab-nudge'); });
        clearInterval(timer);
      } else if (attempts > 50) {
        clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CoachAdaptiveLoop = {
    measureAndAdapt: measureAndAdapt,
    recommendationSignature: recommendationSignature
  };
})(window);
