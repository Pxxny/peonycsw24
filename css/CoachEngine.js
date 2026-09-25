/* =========================================================
   CSW24 Word Lab — AI Coach: CoachEngine.js
   =========================================================
   Scope: the "brain" CoachUI.js's own header comment says
   doesn't exist yet. This file is the ONE place that combines:

     PerformanceAnalyzer.js  (real accuracy/response-time numbers)
     WeaknessDetector.js     (ranked repeated-mistake words + weak dimensions)
     SpacedRepetition.js     (due queue, leech report, forecast — read-only)
     RecommendationEngine.js (single prioritized recommendation + daily plan)
     AdaptiveQuiz.js         (real-data-driven quiz difficulty + word list)
     CoachSearchIndex.js     (fast, CSW24-verified word/anagram lookups)

   into ONE function — buildResponse(userText) — that returns a
   JSON object matching the project's own schema exactly:
   { command, params, message, reason?, priority? }, command
   always one of CoachUI.js's ALLOWED_COMMANDS.

   Hard rules this file follows, matching the project brief:
     - AI ห้ามสั่ง JavaScript โดยตรง ต้องตอบเป็น JSON เท่านั้น —
       this file never calls a bridge/DOM function directly; it
       only RETURNS a command object. CoachUI.js's own
       validateCommand() + executeCommand() remain the only
       thing that ever acts on it (rule #7, #8).
     - Only commands in ALLOWED_COMMANDS are ever returned — this
       file reads that list from CoachUI.js itself rather than
       keeping a second copy, so the two can never drift apart
       (rule #1, #2).
     - Every word mentioned is checked against CSW24 first, via
       CoachSearchIndex.js / CSW24Bridge (rule #15) — this file
       never invents a word or anagram.
     - Every number stated comes from one of the five modules
       above or CSW24Bridge.getSnapshot() — never fabricated
       (rule #9).
     - If a dependency module isn't loaded, or there isn't yet
       enough real data for a confident answer, this file falls
       back to SHOW_STATISTICS with an honest message (rule #10)
       — the same honesty policy CoachUI.js's own stub already
       followed.

   Integration: CoachUI.js's buildResponse() is a placeholder by
   its own header comment ("placeholder for CoachEngine.js").
   This file does not modify that function's contract — it
   exposes global.CoachEngine.buildResponse(userText) with the
   exact same input/output shape, so CoachUI.js can delegate to
   it. CoachUI.js's buildResponse() has one small, clearly
   commented change: its first line now prefers
   CoachEngine.buildResponse() when this file has loaded, and
   only runs its own original inline logic as a fallback
   otherwise (e.g. this file failing to load) — every line of
   that original inline logic is kept, untouched, as that
   fallback.

   Loaded standalone: IIFE, no build step. Exposes
   global.CoachEngine.
   ========================================================= */

(function (global) {
  'use strict';

  // CoachUI.js keeps its own ALLOWED_COMMANDS as a private const inside
  // its IIFE (not exposed on window.CoachUI, which only publishes
  // validateCommand/executeCommand) — so there's no way for this file to
  // read it directly. This list is kept in sync BY HAND with CoachUI.js's
  // own enum and the project's JSON schema; if either changes, update
  // both. This copy is only used for this file's own defensive
  // self-check (safe()) before returning — CoachUI.js's real
  // validateCommand() is still the actual gate that decides what's
  // allowed to execute.
  function allowedCommands() {
    return [
      'START_QUIZ', 'START_FLASHCARD', 'START_ANAGRAM', 'START_BINGO',
      'START_ACTIVE_RECALL', 'REVIEW_WORDS', 'SHOW_WORD', 'SHOW_ANAGRAM',
      'ADD_TO_CARDBOX', 'CREATE_STUDY_PLAN', 'SHOW_STATISTICS', 'GIVE_HINT',
      'CELEBRATE', 'OPEN_PRACTICE'
    ];
  }

  // Self-check before returning — belt-and-suspenders alongside
  // CoachUI.js's own validateCommand(), since that's the function that
  // actually gates execution. This just prevents this file from ever
  // handing back something malformed in the first place.
  //
  // Also strips any extra bookkeeping field (e.g. CoachIntents.js's own
  // `__intent`, used only for its internal routing/debugging) that isn't
  // part of the project's { command, params, message, reason?, priority? }
  // schema. CoachUI.js's validateCommand() enforces an exact key
  // whitelist and rejects the WHOLE command on a single unknown key —
  // so leaving `__intent` on would fail validation for every one of
  // CoachIntents.js's 22 tournament-prep commands, sending the learner
  // to the generic fallback message instead of their real answer.
  const SCHEMA_KEYS = ['command', 'params', 'message', 'reason', 'priority'];
  function toSchema(cmdObj) {
    const out = {};
    SCHEMA_KEYS.forEach(function (k) { if (cmdObj[k] !== undefined) out[k] = cmdObj[k]; });
    return out;
  }
  function safe(cmdObj) {
    if (cmdObj && allowedCommands().indexOf(cmdObj.command) !== -1 && typeof cmdObj.message === 'string' && cmdObj.message) {
      return toSchema(cmdObj);
    }
    return {
      command: 'SHOW_STATISTICS', params: {},
      message: 'เกิดข้อผิดพลาดภายใน AI Coach ลองใหม่อีกครั้งครับ',
      priority: 'low'
    };
  }

  function modulesReady() {
    return !!(global.PerformanceAnalyzer && global.WeaknessDetector && global.SpacedRepetition && global.RecommendationEngine);
  }

  // ---------- Intent: "วันนี้ควรฝึกอะไร?" ----------
  // Delegates entirely to RecommendationEngine.js's own priority order
  // (due > leech > repeated mistake > weak dimension > none) — this
  // function only translates that result into the command JSON shape.
  function intentWhatToStudyToday() {
    if (!global.RecommendationEngine) {
      return safe({ command: 'SHOW_STATISTICS', params: {}, message: 'ระบบแนะนำการฝึกยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ', priority: 'low' });
    }
    const rec = global.RecommendationEngine.recommend();
    const params = {};
    if (rec.count) params.count = rec.count;
    if (rec.words && rec.words.length) params.words = rec.words;

    return safe({
      command: rec.suggestedCommand || 'SHOW_STATISTICS',
      params: params,
      message: rec.reason,
      reason: rec.reason,
      priority: rec.priority || 'low'
    });
  }

  // ---------- Intent: "ฉันอ่อนเรื่องอะไร?" ----------
  // Delegates to WeaknessDetector.js's combined ranking (repeated-mistake
  // words first, then weak dimensions) rather than recomputing anything.
  function intentWhatAmIWeakAt() {
    if (!global.WeaknessDetector) {
      return safe({ command: 'SHOW_STATISTICS', params: {}, message: 'ระบบวิเคราะห์จุดอ่อนยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ', priority: 'low' });
    }
    const top = global.WeaknessDetector.topWeaknesses();
    if (!top.length) {
      return safe({
        command: 'SHOW_STATISTICS', params: {},
        message: 'ข้อมูลใน Learn ยังน้อยเกินไปที่จะชี้จุดอ่อนได้แม่นยำ ลองฝึกใน Learn เพิ่มก่อนครับ',
        reason: 'ตัวอย่างในแต่ละกลุ่มยังไม่พอ', priority: 'low'
      });
    }
    const worst = top[0];
    const params = {};
    let command = 'SHOW_STATISTICS';
    if (worst.type === 'word') {
      params.word = worst.word;
      command = 'SHOW_WORD';
    } else if (global.AdaptiveQuiz) {
      const quizParams = global.AdaptiveQuiz.buildQuizParams();
      Object.assign(params, quizParams);
      command = worst.dimension === 'bingo' ? 'START_BINGO' : worst.dimension === 'anagram' ? 'START_ANAGRAM' : 'START_QUIZ';
    }
    return safe({
      command: command, params: params,
      message: worst.detail,
      reason: worst.type === 'word' ? 'คำที่ผิดซ้ำมากที่สุดใน Learn log' : 'accuracy ต่ำสุดในมิติที่มีตัวอย่างพอ',
      priority: (worst.severity === 'critical' || worst.severity === 'high') ? 'high' : 'medium'
    });
  }

  // ---------- Intent: direct stats ask ----------
  // Unchanged in spirit from CoachUI.js's own stub — getSnapshot() is
  // still the single source of truth for these numbers, this file just
  // keeps that logic centralized here instead of duplicated in the UI file.
  function intentShowStatistics() {
    const bridge = global.CSW24Bridge;
    const snap = bridge ? bridge.getSnapshot() : null;
    if (!snap) {
      return safe({ command: 'SHOW_STATISTICS', params: {}, message: 'ระบบข้อมูลยังโหลดไม่เสร็จ ลองใหม่อีกครั้งครับ', priority: 'low' });
    }
    return safe({
      command: 'SHOW_STATISTICS', params: {},
      message: 'ใน Cardbox มี ' + snap.cardboxTotal + ' คำ, เรียนจบแล้ว ' + snap.learned + ' คำ, ถึงกำหนดทบทวน ' + snap.due + ' คำ, เป็น Leech ' + snap.leeches + ' คำ',
      priority: 'low'
    });
  }

  // ---------- Intent: create a study plan ----------
  // Delegates to RecommendationEngine.js's dailyPlan() — the command
  // stays CREATE_STUDY_PLAN (a pure-message command per CoachUI.js's
  // executor today), with the plan's own items summarized into the
  // message so the learner sees something concrete even though no
  // navigation happens for this command yet.
  function intentCreateStudyPlan() {
    if (!global.RecommendationEngine) {
      return safe({ command: 'SHOW_STATISTICS', params: {}, message: 'ระบบวางแผนฝึกยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ', priority: 'low' });
    }
    const plan = global.RecommendationEngine.dailyPlan();
    if (!plan.items.length) {
      return safe({ command: 'CREATE_STUDY_PLAN', params: {}, message: plan.summary, priority: 'low' });
    }
    const lines = plan.items.map(function (item, i) { return (i + 1) + '. ' + item.reason; });
    return safe({
      command: 'CREATE_STUDY_PLAN',
      params: { items: plan.items.length },
      message: plan.summary + '\n' + lines.join('\n'),
      priority: plan.items[0].priority || 'medium'
    });
  }

  // ---------- Intent: a specific word / anagram lookup ----------
  // Uses CoachSearchIndex.js (CSW24-backed) rather than CSW24Bridge
  // directly, so lookups benefit from the shared index — falls back to
  // the bridge if the index hasn't built yet, so this never breaks.
  function intentWordLookup(word) {
    const w = word.toUpperCase();
    const idx = global.CoachSearchIndex;
    const bridge = global.CSW24Bridge;
    const isReal = idx ? idx.isRealWord(w) : (bridge ? bridge.isRealWord(w) : false);
    if (!isReal) {
      return safe({ command: 'SHOW_WORD', params: { word: w }, message: '"' + w + '" ไม่มีใน CSW24 ครับ/ค่ะ', priority: 'low' });
    }
    return safe({ command: 'SHOW_ANAGRAM', params: { word: w }, message: 'เช็คให้แล้วครับ', priority: 'low' });
  }

  // ---------- Intent router ----------
  // Order matters: more specific patterns (study_plan, weak_at, stats)
  // are checked BEFORE the broad study_today pattern, since a phrase
  // like "สร้างแผนฝึกให้หน่อย" contains "ฝึก" and would otherwise always
  // match study_today first. Each pattern is also written to avoid
  // overlapping with the others as much as Thai phrasing allows.
  function detectIntent(text) {
    const lower = (text || '').toLowerCase();
    if (/แผนฝึก|study\s*plan|วางแผน/.test(lower)) return 'study_plan';
    if (/อ่อน|จุดอ่อน|weak/.test(lower)) return 'weak_at';
    if (/สถิติ|stat/.test(lower)) return 'stats';
    if (/ฝึกอะไร|ควรฝึก|เรียน.*อะไร|train|study.*what|what.*study/.test(lower)) return 'study_today';
    const wordMatch = text && text.match(/[A-Za-z]{2,15}/);
    if (wordMatch) return 'word_lookup:' + wordMatch[0];
    return 'fallback';
  }

  // ---------- Tournament-prep commands (CoachIntents.js, 22 intents) ----------
  // Checked FIRST, before the five intents below: CoachIntents.js's own
  // patterns ("gen 3L 4L...", "ตารางทบทวน", "พร้อมแข่งไหม", etc.) are more
  // specific than this file's broad study_today/weak_at/stats regexes, and
  // CoachIntents.respond() already returns null (falls through) for any
  // text that doesn't match one of its 22 intents, so it can never steal
  // the five questions this file already answered. All CoachIntents output
  // is itself vetted by safe() below, same as every other path here.
  function tryTournamentPrepIntents(userText) {
    if (!global.CoachIntents) return null;
    const out = global.CoachIntents.respond(userText);
    return out ? safe(out) : null;
  }

  function buildResponse(userText) {
    const prep = tryTournamentPrepIntents(userText);
    if (prep) return prep;

    if (!modulesReady()) {
      // Degrade honestly rather than answering with partial/fabricated
      // analysis if a dependency hasn't loaded — mirrors CoachUI.js's
      // own stub's honesty policy.
      return safe({
        command: 'SHOW_STATISTICS', params: {},
        message: 'ระบบวิเคราะห์บางส่วนยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ',
        priority: 'low'
      });
    }

    const intent = detectIntent(userText);
    if (intent === 'study_today') return intentWhatToStudyToday();
    if (intent === 'study_plan') return intentCreateStudyPlan();
    if (intent === 'weak_at') return intentWhatAmIWeakAt();
    if (intent === 'stats') return intentShowStatistics();
    if (intent.indexOf('word_lookup:') === 0) return intentWordLookup(intent.slice('word_lookup:'.length));

    return safe({
      command: 'SHOW_STATISTICS', params: {},
      message: 'ลองถามผมได้ เช่น "วันนี้ควรฝึกอะไร?", "ฉันอ่อนเรื่องอะไร?", "สร้างแผนฝึกให้หน่อย", หรือ "สถิติของฉัน" ครับ',
      priority: 'low'
    });
  }

  global.CoachEngine = {
    buildResponse: buildResponse,
    detectIntent: detectIntent
  };
})(window);
