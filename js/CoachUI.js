/* =========================================================
   CSW24 Word Lab — AI Coach: CoachUI.js
   =========================================================
   This file is ONLY the chat UI + command plumbing. The real
   "brain" (CoachEngine.js, PerformanceAnalyzer.js,
   WeaknessDetector.js, RecommendationEngine.js, AdaptiveQuiz.js,
   SpacedRepetition.js) does not exist yet. Until it does, the
   responder built into this file is a deliberately minimal,
   honest stand-in:

     - It only ever states numbers that come straight from
       window.CSW24Bridge.getSnapshot() (real localStorage data).
     - Anything needing real analysis it doesn't have yet
       (weakness by word-length/anagram/bingo/stem, response
       time, repeated mistakes, adaptive difficulty, spaced-
       repetition scheduling, study plans) gets an honest "not
       built yet" answer via SHOW_STATISTICS or a plain message,
       per the project's own rule: never invent statistics.

   Talks to app.js ONLY through window.CSW24Bridge (see the
   bridge object app.js exposes at the end of its init). This
   file never touches localStorage or app.js internals directly
   for anything the bridge already covers, and it never runs
   arbitrary code — every action goes through validateCommand()
   then executeCommand()'s fixed switch statement.
   ========================================================= */

(function (global) {
  'use strict';

  // ---------- Command schema (matches the project's JSON contract) ----------

  const ALLOWED_COMMANDS = [
    'START_QUIZ', 'START_FLASHCARD', 'START_ANAGRAM', 'START_BINGO',
    'START_ACTIVE_RECALL', 'REVIEW_WORDS', 'SHOW_WORD', 'SHOW_ANAGRAM',
    'ADD_TO_CARDBOX', 'CREATE_STUDY_PLAN', 'SHOW_STATISTICS', 'GIVE_HINT',
    'CELEBRATE', 'OPEN_PRACTICE'
  ];
  const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'];

  // Rejects anything that isn't a plain object with exactly the fields the
  // schema allows, an enum-valid command, and a string message — this is
  // the one gate every response must pass before executeCommand() ever
  // sees it. No command outside ALLOWED_COMMANDS can reach the executor,
  // no matter what produced the JSON.
  function validateCommand(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'ไม่ใช่ JSON object' };
    const allowedKeys = ['command', 'params', 'message', 'reason', 'priority'];
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      if (allowedKeys.indexOf(keys[i]) === -1) return { ok: false, error: 'มี field ที่ไม่อนุญาต: ' + keys[i] };
    }
    if (ALLOWED_COMMANDS.indexOf(obj.command) === -1) return { ok: false, error: 'command ไม่อยู่ใน enum ที่อนุญาต' };
    if (typeof obj.message !== 'string' || !obj.message) return { ok: false, error: 'ขาด message' };
    if (obj.params !== undefined && (typeof obj.params !== 'object' || Array.isArray(obj.params) || obj.params === null)) {
      return { ok: false, error: 'params ต้องเป็น object' };
    }
    if (obj.priority !== undefined && ALLOWED_PRIORITIES.indexOf(obj.priority) === -1) {
      return { ok: false, error: 'priority ไม่อยู่ใน enum ที่อนุญาต' };
    }
    if (obj.reason !== undefined && typeof obj.reason !== 'string') return { ok: false, error: 'reason ต้องเป็น string' };
    return { ok: true };
  }

  // ---------- Command executor ----------
  // The ONLY place a command actually does anything. AI (or, right now,
  // the stub responder below) never calls app functions directly — it can
  // only produce a JSON command, which is validated above and then run
  // here through the narrow CSW24Bridge doorway.

  function executeCommand(cmd) {
    const bridge = global.CSW24Bridge;
    const params = cmd.params || {};
    if (!bridge) {
      appendCoachMessage(cmd.message || 'ระบบยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง', 'coach');
      return;
    }

    switch (cmd.command) {
      case 'START_QUIZ':
        bridge.activateTab('quiz');
        break;
      case 'START_FLASHCARD':
      case 'REVIEW_WORDS':
        bridge.activateTab('cardbox');
        break;
      case 'START_ANAGRAM':
        bridge.switchMinigameTab('alpha');
        break;
      case 'START_BINGO':
        // Honest limitation: there is no dedicated Bingo (7/8-letter play)
        // drill in the app yet. Closest real thing is browsing long words.
        bridge.activateTab('browse');
        break;
      case 'START_ACTIVE_RECALL':
        bridge.activateTab('learn');
        break;
      case 'SHOW_STATISTICS':
        bridge.activateTab('stats');
        break;
      case 'OPEN_PRACTICE':
        // Secret menu — only ever reached via the exact-keyword check in
        // handleUserMessage(), never guessed at by intent-matching.
        bridge.activateTab('practice');
        break;
      case 'SHOW_WORD':
      case 'SHOW_ANAGRAM': {
        const word = (params.word || '').toUpperCase();
        if (word && bridge.isRealWord(word)) {
          const partners = bridge.getAnagramsOf(word);
          appendCoachMessage(
            word + (partners.length > 1 ? ' — anagram อื่นที่ใช้ตัวอักษรชุดเดียวกัน: ' + partners.filter(function (w) { return w !== word; }).join(', ') : ' — ไม่มี anagram อื่นที่ใช้ตัวอักษรชุดเดียวกันใน CSW24'),
            'coach'
          );
        } else if (word) {
          appendCoachMessage('"' + word + '" ไม่มีใน CSW24 ครับ/ค่ะ', 'coach');
        }
        break;
      }
      case 'ADD_TO_CARDBOX': {
        const words = params.words || (params.word ? [params.word] : []);
        const added = bridge.addToCardbox(words);
        appendCoachMessage(added > 0 ? 'เพิ่มลง Cardbox แล้ว ' + added + ' คำ' : 'ไม่พบคำที่ถูกต้องใน CSW24 ที่จะเพิ่ม', 'coach');
        break;
      }
      case 'CREATE_STUDY_PLAN':
      case 'GIVE_HINT':
      case 'CELEBRATE':
        // Pure-message commands for now — no navigation/state change.
        break;
      default:
        break;
    }

    if (cmd.message) appendCoachMessage(cmd.message, 'coach');
  }

  // ---------- Minimal rule-based responder (fallback for CoachEngine.js) ----------
  // CoachEngine.js (loaded before this file — see index.html) is now the
  // real "brain": it combines PerformanceAnalyzer,
  // WeaknessDetector, SpacedRepetition, RecommendationEngine and
  // AdaptiveQuiz into one answer. This function now delegates to it first.
  // Everything below the delegation check is the ORIGINAL inline logic,
  // kept byte-for-byte as a fallback for if CoachEngine.js ever fails to
  // load — so the coach chat still answers something honest either way.
  function buildResponse(userText) {
    if (global.CoachEngine && typeof global.CoachEngine.buildResponse === 'function') {
      return global.CoachEngine.buildResponse(userText);
    }

    const bridge = global.CSW24Bridge;
    const snap = bridge ? bridge.getSnapshot() : null;
    const text = (userText || '').toLowerCase();

    if (!snap) {
      return { command: 'SHOW_STATISTICS', params: {}, message: 'ระบบข้อมูลยังโหลดไม่เสร็จ ลองใหม่อีกครั้งครับ', priority: 'low' };
    }

    // "วันนี้ควรฝึกอะไร?" — today's training suggestion. Real
    // prioritization (weak words, response time, spaced repetition) isn't
    // built yet, so this only ever reasons from due/leech counts, which
    // are real Cardbox facts, not inferred weaknesses.
    if (/ฝึก|เรียน.*อะไร|train|study.*what|what.*study/.test(text)) {
      if (snap.due > 0) {
        return {
          command: 'REVIEW_WORDS', params: { count: snap.due },
          message: 'วันนี้มีคำครบกำหนดทบทวนใน Cardbox ' + snap.due + ' คำ เริ่มจากตรงนี้ก่อนดีกว่าครับ',
          reason: 'มีคำถึงกำหนดทบทวนใน Cardbox', priority: snap.due > 10 ? 'high' : 'medium'
        };
      }
      if (snap.leeches > 0) {
        return {
          command: 'START_FLASHCARD', params: {},
          message: 'ไม่มีคำถึงกำหนดทบทวนตอนนี้ แต่มีคำที่เป็น Leech (ตอบผิดซ้ำๆ) อยู่ ' + snap.leeches + ' คำ ลองฝึกคำกลุ่มนี้ใน Cardbox ดูครับ',
          reason: 'มี Leech words ใน Cardbox', priority: 'medium'
        };
      }
      return {
        command: 'START_ANAGRAM', params: {},
        message: 'ตอนนี้ไม่มีคำค้างทบทวนหรือ Leech เลย ลองฝึก Anagram เพิ่มคำศัพท์ใหม่ดูไหมครับ',
        reason: 'ไม่มีงานค้างใน Cardbox ตอนนี้', priority: 'low'
      };
    }

    // "ฉันอ่อนเรื่องอะไร?" — real WeaknessDetector.js/RecommendationEngine.js
    // (priority scoring across all four dimensions at once) isn't built
    // yet, but PerformanceAnalyzer.js now provides real accuracy-by-bucket
    // numbers, so this picks the single weakest bucket with enough samples
    // to mean something (avoids calling a 1-attempt 0% "a weakness").
    if (/อ่อน|จุดอ่อน|weak/.test(text)) {
      if (!global.PerformanceAnalyzer) {
        return {
          command: 'SHOW_STATISTICS', params: {},
          message: 'ระบบวิเคราะห์จุดอ่อนยังโหลดไม่สำเร็จ ลองใหม่อีกครั้งครับ',
          priority: 'low'
        };
      }
      const MIN_SAMPLES = 5;
      const report = global.PerformanceAnalyzer.fullReport();
      const candidates = [];
      report.byLength.forEach(function (b) {
        if (b.sampleSize >= MIN_SAMPLES) candidates.push({ label: 'คำยาว ' + b.length + ' ตัวอักษร', accuracy: b.accuracy, sampleSize: b.sampleSize });
      });
      [report.byAnagram.hasAnagramPartners, report.byAnagram.noAnagramPartners,
       report.byBingo.bingoLengths, report.byBingo.otherLengths,
       report.byStem.noStem, report.byStem.poorStem, report.byStem.richStem].forEach(function (b) {
        if (b.sampleSize >= MIN_SAMPLES) candidates.push({ label: b.label, accuracy: b.accuracy, sampleSize: b.sampleSize });
      });

      if (!candidates.length) {
        return {
          command: 'SHOW_STATISTICS', params: {},
          message: 'ข้อมูลใน Learn ยังน้อยเกินไปที่จะชี้จุดอ่อนได้แม่นยำ (ต้องมีอย่างน้อย ' + MIN_SAMPLES + ' ครั้งต่อกลุ่มเพื่อความน่าเชื่อถือ) ลองฝึกใน Learn เพิ่มก่อนครับ',
          reason: 'ตัวอย่างในแต่ละกลุ่มยังไม่พอ', priority: 'low'
        };
      }
      candidates.sort(function (a, b) { return a.accuracy - b.accuracy; });
      const weakest = candidates[0];
      return {
        command: 'SHOW_STATISTICS', params: {},
        message: 'จุดที่อ่อนที่สุดตอนนี้: ' + weakest.label + ' — ถูก ' + weakest.accuracy + '% (จาก ' + weakest.sampleSize + ' ครั้ง) ลองฝึกกลุ่มนี้เพิ่มดูครับ',
        reason: 'accuracy ต่ำสุดในกลุ่มที่มีตัวอย่างพอ (>= ' + MIN_SAMPLES + ' ครั้ง)', priority: weakest.accuracy < 50 ? 'high' : 'medium'
      };
    }

    // Direct stats ask.
    if (/สถิติ|stat/.test(text)) {
      return {
        command: 'SHOW_STATISTICS', params: {},
        message: 'ใน Cardbox มี ' + snap.cardboxTotal + ' คำ, เรียนจบแล้ว ' + snap.learned + ' คำ, ถึงกำหนดทบทวน ' + snap.due + ' คำ, เป็น Leech ' + snap.leeches + ' คำ',
        priority: 'low'
      };
    }

    // "คำนี้คืออะไร / มี anagram อะไรบ้าง"
    const wordMatch = userText && userText.match(/[A-Za-z]{2,15}/);
    if (wordMatch) {
      return { command: 'SHOW_ANAGRAM', params: { word: wordMatch[0].toUpperCase() }, message: 'เช็คให้แล้วครับ', priority: 'low' };
    }

    // Fallback — no confident intent match, and no fabricated analysis.
    return {
      command: 'SHOW_STATISTICS', params: {},
      message: 'ตอนนี้ผมยังตอบได้แค่คำถามพื้นฐาน (เช่น "วันนี้ควรฝึกอะไร", "ฉันอ่อนเรื่องอะไร", "สถิติของฉัน") ระบบวิเคราะห์แบบเต็มรูปแบบยังอยู่ระหว่างสร้างครับ',
      priority: 'low'
    };
  }

  // ---------- UI ----------

  const QUICK_QUESTIONS = ['วันนี้ควรฝึกอะไร?', 'ฉันอ่อนเรื่องอะไร?', 'สถิติของฉัน'];

  function coachHtml() {
    return (
      '<button type="button" id="coachFab" aria-label="เปิด AI Coach">🤖</button>' +
      '<div id="coachPanel" hidden>' +
        '<div id="coachHeader">' +
          '<span>🤖 AI Coach</span>' +
          '<button type="button" id="coachCloseBtn" aria-label="ปิด">✕</button>' +
        '</div>' +
        '<div id="coachMessages"></div>' +
        '<div id="coachQuickRow">' +
          QUICK_QUESTIONS.map(function (q) { return '<button type="button" class="coach-quick-chip">' + q + '</button>'; }).join('') +
        '</div>' +
        '<form id="coachForm">' +
          '<input type="text" id="coachInput" autocomplete="off" placeholder="ถาม AI Coach...">' +
          '<button type="submit">ส่ง</button>' +
        '</form>' +
      '</div>'
    );
  }

  function appendCoachMessage(text, from) {
    const wrap = document.getElementById('coachMessages');
    if (!wrap) return;
    const bubble = document.createElement('div');
    bubble.className = 'coach-msg coach-msg-' + (from === 'user' ? 'user' : 'coach');
    bubble.textContent = text;
    wrap.appendChild(bubble);
    wrap.scrollTop = wrap.scrollHeight;
  }

  // Secret menu unlock — exact keyword only (any casing), checked before
  // any intent-detection or word-lookup logic ever runs, so this can
  // never misfire off of a real CSW24 word or a normal coach question.
  // Deliberately not part of CoachEngine.js's fuzzy intent regexes: this
  // is a literal trigger phrase, not something the AI should ever be
  // free to interpret loosely.
  function isPracticeUnlockPhrase(text) {
    return typeof text === 'string' && text.trim().toLowerCase() === 'practice';
  }

  function handleUserMessage(text) {
    if (!text || !text.trim()) return;
    appendCoachMessage(text, 'user');

    if (isPracticeUnlockPhrase(text)) {
      const cmd = { command: 'OPEN_PRACTICE', params: {}, message: '🔒 ปลดล็อกแล้ว — เปิดเมนู Practice ให้ครับ', priority: 'low' };
      executeCommand(cmd);
      return;
    }

    const cmd = buildResponse(text);
    const check = validateCommand(cmd);
    if (!check.ok) {
      // Should never happen since buildResponse only emits schema-valid
      // objects, but if it ever does, fail safe rather than execute
      // something unvalidated.
      appendCoachMessage('เกิดข้อผิดพลาดในการตอบกลับ (' + check.error + ')', 'coach');
      return;
    }
    executeCommand(cmd);
  }

  function initCoachUI() {
    if (document.getElementById('coachFab')) return; // already initialized
    const host = document.createElement('div');
    host.id = 'coachWidget';
    host.innerHTML = coachHtml();
    document.body.appendChild(host);

    const fab = document.getElementById('coachFab');
    const panel = document.getElementById('coachPanel');
    fab.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden && !document.getElementById('coachMessages').children.length) {
        appendCoachMessage('สวัสดีครับ ผมคือ AI Coach ของ CSW24 Word Lab — ลองถามผมได้เลย เช่น "วันนี้ควรฝึกอะไร?"', 'coach');
      }
    });
    document.getElementById('coachCloseBtn').addEventListener('click', function () { panel.hidden = true; });

    document.getElementById('coachForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const input = document.getElementById('coachInput');
      const val = input.value;
      input.value = '';
      handleUserMessage(val);
    });

    document.querySelectorAll('.coach-quick-chip').forEach(function (chip) {
      chip.addEventListener('click', function () { handleUserMessage(chip.textContent); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCoachUI);
  } else {
    initCoachUI();
  }

  // Exposed for debugging/future CoachEngine hookup — not required for
  // normal use.
  global.CoachUI = { validateCommand: validateCommand, executeCommand: executeCommand };
})(window);
