/* =========================================================
   CSW24 Word Lab — AI Coach: CoachIntents.js
   =========================================================
   Scope: the "understand what the learner typed" half of the
   tournament-prep commands. 22 intents (see INTENTS below),
   matched by keyword patterns in Thai + English, each turning
   the message into ONE CoachPlanner.js table plus a JSON
   command in the project's existing schema.

   How this stays inside the project's hard rules:
     - Returns ONLY { command, params, message, reason?, priority? }
       with `command` one of CoachUI.js's existing ALLOWED_COMMANDS.
       The enum is NOT extended. A table rides along inside
       `params.table` (a plain data object: title/columns/rows/
       note) — validateCommand() already accepts any plain-object
       `params`, and executeCommand()'s switch ignores params keys
       it doesn't know, so no executor change is needed for the
       command to remain safe. CoachUI.js only RENDERS params.table
       (as an HTML <table> built from escaped text) — it never
       evaluates it.
     - Never calls a bridge / touches the DOM. Pure text -> object.
     - Never invents a number: every table comes from
       CoachPlanner.js (real CSW24 counts, the learner's real
       Cardbox / Learn log, the real SM-2 formula).
     - Word lookups (SHOW_ANAGRAM / preview / add) are verified
       against CSW24 through CSW24Bridge / CoachSearchIndex before
       anything is claimed about the word.

   Parsing (all optional, combined freely in ONE message):
     lengths     "3L 4L 5L", "3L,4L", "5-8L", "5 ถึง 8 ตัว"
     coverage    "7L 40%", "8L=15%", "7L n 30"   (n = "ตัวเลขที่ฉันกำหนด")
     days        "30 วัน", "แข่งอีก 45 วัน", "4 สัปดาห์", "2 เดือน",
                 "แข่ง 2026-12-05", "แข่งวันที่ 5/12/2026"
     budget      "วันละ 60 นาที", "60 min/day", "2 ชม./วัน"
     per-day     "วันละ 50 คำ", "50 words/day"
     word        a bare A-Z token for lookups/previews

   Loaded standalone: IIFE, no build step. Exposes
   global.CoachIntents.parse(text) and .respond(text).
   ========================================================= */

(function (global) {
  'use strict';

  const SAFE_COMMANDS = [
    'START_QUIZ', 'START_FLASHCARD', 'START_ANAGRAM', 'START_BINGO',
    'START_ACTIVE_RECALL', 'REVIEW_WORDS', 'SHOW_WORD', 'SHOW_ANAGRAM',
    'ADD_TO_CARDBOX', 'CREATE_STUDY_PLAN', 'SHOW_STATISTICS', 'GIVE_HINT',
    'CELEBRATE', 'OPEN_PRACTICE'
  ];

  function planner() { return global.CoachPlanner || null; }

  // Remembered between messages so "แข่งอีก 30 วัน" typed once sets the
  // horizon for the follow-up "ตารางรายสัปดาห์" without retyping. Session
  // memory only (not persisted): a stale tournament date silently
  // lingering across days would be worse than asking again.
  const session = { days: null, minutesPerDay: null, coverage: {}, lengths: null, tournamentDate: null };

  // ---------- small parsers ----------

  function toInt(s) { const n = parseInt(s, 10); return isNaN(n) ? null : n; }

  // "3L 4L 5L", "3L,4L", "5-8L", "5 ถึง 8 ตัว", "gen 3L n 4L n"
  function parseLengths(text) {
    const set = {};
    let m;
    // ranges first: 5-8L / 5–8 L / 5 ถึง 8 ตัว / 5 to 8 letters
    const rangeRe = /(\d{1,2})\s*(?:-|–|—|ถึง|to|~)\s*(\d{1,2})\s*(?:l\b|ตัว|ตัวอักษร|letters?)/gi;
    while ((m = rangeRe.exec(text)) !== null) {
      let a = toInt(m[1]), b = toInt(m[2]);
      if (a > b) { const t = a; a = b; b = t; }
      for (let i = a; i <= b && i <= 15; i++) if (i >= 2) set[i] = true;
    }
    // ranges where EACH side already carries its own unit: "3L - 8L",
    // "3L-8L", "3L to 8L", "3 ตัว ถึง 8 ตัว" — the pattern above requires
    // the unit token only once (after the second number), so "3L - 8L"
    // was falling through to the single-token matcher below and being
    // read as just {3, 8} instead of the full 3..8 range.
    const rangeRe2 = /(\d{1,2})\s*(?:l\b|ตัว(?:อักษร)?)\s*(?:-|–|—|ถึง|to|~)\s*(\d{1,2})\s*(?:l\b|ตัว(?:อักษร)?)/gi;
    while ((m = rangeRe2.exec(text)) !== null) {
      let a = toInt(m[1]), b = toInt(m[2]);
      if (a > b) { const t = a; a = b; b = t; }
      for (let i = a; i <= b && i <= 15; i++) if (i >= 2) set[i] = true;
    }
    // 3L / 3l / 3-L
    const lRe = /(?:^|[^\d])(\d{1,2})\s*-?\s*l(?![a-z])/gi;
    while ((m = lRe.exec(text)) !== null) {
      const n = toInt(m[1]);
      if (n >= 2 && n <= 15) set[n] = true;
    }
    // "คำ 5 ตัว" / "5 ตัวอักษร"
    const thRe = /(\d{1,2})\s*ตัว(?:อักษร)?/g;
    while ((m = thRe.exec(text)) !== null) {
      const n = toInt(m[1]);
      if (n >= 2 && n <= 15) set[n] = true;
    }
    const arr = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    return arr.length ? arr : null;
  }

  // "7L 40%", "8L=15%", "7L 40 %", "7L n 40" -> { 7: 0.4 }
  function parseCoverage(text) {
    const out = {};
    let m;
    const re = /(\d{1,2})\s*-?\s*l\s*(?:n|=|:)?\s*(\d{1,3}(?:\.\d+)?)\s*%/gi;
    while ((m = re.exec(text)) !== null) {
      const L = toInt(m[1]), v = parseFloat(m[2]);
      if (L >= 2 && L <= 15 && v >= 0 && v <= 100) out[L] = v / 100;
    }
    // all-lengths: "ทุกความยาว 30%" / "all 30%"
    const all = text.match(/(?:ทุกความยาว|ทุกตัว|all)\s*(\d{1,3}(?:\.\d+)?)\s*%/i);
    if (all) out.__all = Math.min(100, parseFloat(all[1])) / 100;
    return Object.keys(out).length ? out : null;
  }

  const TH_MONTH_LOOKUP = { 'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11 };

  // days-left from a tournament date OR a duration phrase.
  function parseDays(text, nowMs) {
    const now = nowMs || Date.now();
    let m;
    // ISO date 2026-12-05
    m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return daysUntil(new Date(+m[1], +m[2] - 1, +m[3]), now);
    // d/m/yyyy (Thai users write day first). yyyy may be Buddhist Era.
    m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      let y = +m[3];
      if (y < 100) y += 2000;
      if (y > 2400) y -= 543;
      return daysUntil(new Date(y, +m[2] - 1, +m[1]), now);
    }
    // "5 ธ.ค." (this/next occurrence)
    m = text.match(/(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/);
    if (m) {
      const mon = TH_MONTH_LOOKUP[m[2]];
      const nd = new Date(now);
      let y = nd.getFullYear();
      let d = new Date(y, mon, +m[1]);
      if (d.getTime() < now) d = new Date(y + 1, mon, +m[1]);
      return daysUntil(d, now);
    }
    m = text.match(/(\d{1,3})\s*(?:เดือน|months?|mo\b)/i);
    if (m) return toInt(m[1]) * 30;
    m = text.match(/(\d{1,3})\s*(?:สัปดาห์|อาทิตย์|weeks?|wk\b)/i);
    if (m) return toInt(m[1]) * 7;
    m = text.match(/(\d{1,4})\s*(?:วัน|days?|d\b)(?!\s*(?:ละ|\/))/i);
    if (m) {
      // "วันละ 60 นาที" has no digits before "วัน"; "60 นาที/วัน" is guarded
      // by the negative lookahead above, so this only fires on real durations.
      const n = toInt(m[1]);
      if (n >= 1 && n <= 730) return n;
    }
    return null;
  }

  function daysUntil(date, now) {
    const a = new Date(now); a.setHours(0, 0, 0, 0);
    const b = new Date(date); b.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
  }

  // "วันละ 60 นาที", "60 นาที/วัน", "60 min/day", "2 ชม./วัน", "วันละ 2 ชั่วโมง"
  function parseBudget(text) {
    let m = text.match(/(?:วันละ|ต่อวัน|per day|\/\s*day)?\s*(\d+(?:\.\d+)?)\s*(นาที|min(?:ute)?s?|m\b|ชม\.?|ชั่วโมง|hours?|h\b)\s*(?:\/\s*วัน|ต่อวัน|\/\s*day|per day|ต่อ\s*วัน)/i);
    if (!m) m = text.match(/(?:วันละ|ต่อวัน)\s*(\d+(?:\.\d+)?)\s*(นาที|min(?:ute)?s?|ชม\.?|ชั่วโมง|hours?|h\b)/i);
    if (!m) return null;
    const v = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const mins = /ชม|ชั่วโมง|hour|^h$/.test(unit) ? Math.round(v * 60) : Math.round(v);
    return mins > 0 && mins <= 1440 ? mins : null;
  }

  // "วันละ 50 คำ", "50 words/day", "50 คำ/วัน"
  function parsePerDayWords(text) {
    let m = text.match(/(?:วันละ|ต่อวัน)\s*(\d{1,5})\s*(?:คำ|words?)/i);
    if (!m) m = text.match(/(\d{1,5})\s*(?:คำ|words?)\s*(?:\/\s*วัน|ต่อวัน|\/\s*day|per day|a day)/i);
    return m ? toInt(m[1]) : null;
  }

  // "เพิ่ม 20 คำ 5L" -> { count, length }
  function parseAddBatch(text) {
    const m = text.match(/(?:เพิ่ม|add)\s*(\d{1,4})\s*(?:คำ|words?)?/i);
    return m ? toInt(m[1]) : null;
  }

  function parseWord(text) {
    // ignore things like "3L" / "gen" / "n" / command words
    // Every English trigger word used by any intent's match() regex must be
    // listed here — otherwise a command like "preview ZAX" or "next review
    // ZAX" gets its own trigger word ("preview"/"next") picked up as the
    // target word instead of "ZAX", since this scan takes the first
    // non-stopword A-Z token left to right.
    const stop = {
      gen: 1, generate: 1, help: 1, plan: 1, stat: 1, stats: 1, leech: 1,
      bingo: 1, practice: 1, days: 1, day: 1, min: 1, mins: 1, week: 1,
      weeks: 1, weekly: 1, words: 1, word: 1, per: 1, all: 1, ready: 1,
      readiness: 1, feasib: 1, feasibility: 1, realistic: 1, fit: 1,
      speed: 1, today: 1, forecast: 1, overdue: 1, due: 1, now: 1,
      progress: 1, mastery: 1, mastered: 1, schedule: 1, target: 1,
      targets: 1, weak: 1, weakest: 1, length: 1, time: 1, needed: 1,
      eta: 1, pace: 1, add: 1, srs: 1, spaced: 1, review: 1, preview: 1,
      next: 1, how: 1, many: 1, long: 1, the: 1, my: 1, hours: 1, hour: 1,
      mo: 1, wk: 1, response: 1
    };
    const re = /\b[A-Za-z]{2,15}\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!stop[m[0].toLowerCase()] && !/^\d+l$/i.test(m[0])) return m[0].toUpperCase();
    }
    return null;
  }

  // ---------- parse() : text -> structured slots ----------
  function parse(text) {
    const raw = String(text || '');
    const lower = raw.toLowerCase();
    return {
      raw: raw,
      lower: lower,
      lengths: parseLengths(raw),
      coverage: parseCoverage(raw),
      days: parseDays(raw),
      minutesPerDay: parseBudget(raw),
      perDayWords: parsePerDayWords(raw),
      addCount: parseAddBatch(raw),
      word: parseWord(raw)
    };
  }

  // ---------- the 22 intents ----------
  // Each: { id, label, examples, match(slots)->bool, run(slots)->response }
  // Order = priority (first match wins). More specific patterns first.
  // `examples` feeds both the help table and the quick-chip row.

  function has(re) { return function (s) { return re.test(s.lower); }; }

  // Merge remembered session values with anything given this message and
  // update the session (so follow-ups inherit).
  function ctx(s) {
    if (s.days) session.days = s.days;
    if (s.minutesPerDay) session.minutesPerDay = s.minutesPerDay;
    if (s.lengths) session.lengths = s.lengths;
    if (s.coverage) {
      const c = Object.assign({}, s.coverage);
      if (c.__all != null) {
        (s.lengths || session.lengths || planner().DEFAULT_LENGTHS).forEach(function (L) { session.coverage[L] = c.__all; });
        delete c.__all;
      }
      Object.assign(session.coverage, c);
    }
    return {
      days: s.days || session.days || null,
      minutesPerDay: s.minutesPerDay || session.minutesPerDay || null,
      lengths: s.lengths || session.lengths || null,
      coverage: Object.assign({}, session.coverage)
    };
  }

  function baseOpts(c, fallbackDays) {
    const o = { days: c.days || fallbackDays || 30, coverage: c.coverage };
    if (c.lengths) o.lengths = c.lengths;
    if (c.minutesPerDay) o.minutesPerDay = c.minutesPerDay;
    return o;
  }

  function tableResp(cmd, table, message, extra) {
    const params = Object.assign({ table: table }, extra || {});
    return { command: cmd, params: params, message: message, priority: 'low' };
  }

  function needDaysNote(c, usedDays) {
    return c.days ? '' : ' (ยังไม่ได้ระบุวันแข่ง ใช้ ' + usedDays + ' วันเป็นตัวอย่าง — พิมพ์เช่น "แข่งอีก 45 วัน" เพื่อกำหนด)';
  }

  const INTENTS = [
    // ---- meta ----
    {
      id: 'help', label: 'รายการคำสั่งทั้งหมด', examples: ['help', 'คำสั่ง'],
      match: has(/^\s*(help|\?|คำสั่ง|ช่วยเหลือ|ทำอะไรได้|commands?)\s*$|คำสั่งทั้งหมด|ทำอะไรได้บ้าง/),
      run: function () { return helpResponse(); }
    },
    // ---- specific-word actions (before generic lookups) ----
    {
      id: 'preview_word', label: 'ทบทวนคำนี้ครั้งหน้าเมื่อไหร่', examples: ['พรุ่งนี้ QUIZ', 'preview ZAX'],
      match: function (s) { return s.word && /พรุ่งนี้|ทบทวน.*เมื่อไหร่|เมื่อไหร่.*ทบทวน|preview|ครั้งหน้า|next review|จำลอง/i.test(s.lower); },
      run: function (s) {
        const w = s.word, P = planner();
        if (!isReal(w)) return notReal(w);
        const t = P.tables.previewWord(w);
        return tableResp('SHOW_WORD', t, 'จำลองการทบทวนของ ' + w + ' ให้แล้ว (ยังไม่บันทึกอะไรใน Cardbox)', { word: w });
      }
    },
    {
      id: 'add_batch', label: 'เพิ่มคำสุ่มเข้า Cardbox', examples: ['เพิ่ม 20 คำ 5L'],
      match: function (s) { return s.addCount != null && /เพิ่ม|add/i.test(s.lower) && s.lengths && s.lengths.length === 1; },
      run: function (s) {
        const L = s.lengths[0], n = Math.min(200, s.addCount);
        const words = pickNewWords(L, n);
        if (!words.length) {
          return { command: 'SHOW_STATISTICS', params: {}, message: 'ไม่พบคำ ' + L + ' ตัวที่ยังไม่อยู่ใน Cardbox ให้เพิ่มแล้วครับ', priority: 'low' };
        }
        return {
          command: 'ADD_TO_CARDBOX', params: { words: words },
          message: 'สุ่มคำ ' + L + ' ตัวจาก CSW24 ที่ยังไม่มีใน Cardbox ' + words.length + ' คำ แล้วเพิ่มให้ (ตัวอย่าง: ' + words.slice(0, 5).join(', ') + '...)',
          priority: 'low'
        };
      }
    },
    // ---- tournament-prep tables ----
    {
      id: 'readiness', label: 'พร้อมแข่งหรือยัง', examples: ['พร้อมแข่งไหม', 'readiness'],
      match: has(/พร้อม.*(แข่ง|ไหม|หรือยัง)|ready|readiness|ความพร้อม|เตรียมตัว.*(ถึงไหน|แล้ว)/),
      run: function (s) {
        const c = ctx(s);
        const t = planner().tables.readiness(baseOpts(c));
        return tableResp('SHOW_STATISTICS', t, 'ประเมินความคืบหน้าเทียบเป้าหมายที่ตั้งไว้ (ไม่ใช่การทำนายผลแข่ง)');
      }
    },
    {
      id: 'feasibility', label: 'เป้าที่ทำได้จริงตามเวลา/งบนาที', examples: ['ทำได้จริงไหม 30 วัน วันละ 45 นาที'],
      match: function (s) { return /ทำได้จริง|ไหวไหม|ทันไหม|พอไหม|feasib|realistic|fit/i.test(s.lower) || (s.minutesPerDay && (s.days || session.days) && /เป้า|แผน|target|plan|gen/.test(s.lower)); },
      run: function (s) {
        const c = ctx(s);
        if (!c.minutesPerDay) {
          return { command: 'CREATE_STUDY_PLAN', params: {}, message: 'บอกงบเวลาต่อวันด้วยครับ เช่น "ทำได้จริงไหม 30 วัน วันละ 60 นาที"', priority: 'low' };
        }
        const o = baseOpts(c, 30);
        const t = planner().tables.feasibility(o);
        return tableResp('CREATE_STUDY_PLAN', t, 'คำนวณเป้าที่ทำได้จริงใน ' + o.days + ' วัน วันละ ' + o.minutesPerDay + ' นาที' + needDaysNote(c, o.days));
      }
    },
    {
      id: 'bingo_prep', label: 'เตรียม Bingo 7L/8L', examples: ['เตรียม bingo 60 วัน'],
      match: has(/bingo|บิงโก|\b7\s*-?\s*l\s*(?:และ|\+|&|,)\s*8\s*-?\s*l\b|เตรียม.*(?:บิงโก|bingo)/),
      run: function (s) {
        const c = ctx(s);
        const o = baseOpts(c, 60);
        const t = planner().tables.bingo(o);
        return tableResp('START_BINGO', t, 'ตารางเตรียม Bingo (7L/8L) ' + o.days + ' วัน' + needDaysNote(c, o.days));
      }
    },
    {
      id: 'per_day', label: 'เรียนวันละ N คำ จะครบเมื่อไหร่', examples: ['วันละ 50 คำ ครบเมื่อไหร่'],
      match: function (s) { return s.perDayWords != null; },
      run: function (s) {
        const c = ctx(s);
        const t = planner().tables.perDay(s.perDayWords, baseOpts(c));
        return tableResp('CREATE_STUDY_PLAN', t, 'คำนวณระยะเวลาถ้าเรียนวันละ ' + s.perDayWords + ' คำ');
      }
    },
    {
      id: 'weekly_plan', label: 'แผนรายสัปดาห์', examples: ['แผนสัปดาห์ 8 สัปดาห์', 'weekly plan'],
      match: has(/รายสัปดาห์|แผน.*(สัปดาห์|อาทิตย์|weekly)|weekly|ตารางสัปดาห์/),
      run: function (s) {
        const c = ctx(s);
        const o = baseOpts(c, 28);
        const t = planner().tables.weekly(o);
        return tableResp('CREATE_STUDY_PLAN', t, 'แผนรายสัปดาห์ ' + o.days + ' วัน' + needDaysNote(c, o.days));
      }
    },
    {
      id: 'srs_schedule', label: 'ตารางเวลาทบทวน (SRS)', examples: ['ตารางทบทวน', 'ทบทวนตอนไหน'],
      match: has(/ตารางทบทวน|ทบทวน.*(ตอนไหน|เมื่อไหร่|กี่วัน|กี่ครั้ง|ยังไง)|review schedule|srs|spaced|ช่วงห่าง|ลำดับทบทวน/),
      run: function (s) {
        const c = ctx(s);
        const t = planner().tables.srsLadder({ steps: 8, days: c.days || null });
        return tableResp('REVIEW_WORDS', t, 'ตารางทบทวนของคำหนึ่งคำที่เริ่มเรียนวันนี้ (ถ้าตอบถูกทุกครั้ง)');
      }
    },
    {
      id: 'forecast', label: 'พยากรณ์ภาระทบทวน', examples: ['พยากรณ์ทบทวน 14 วัน', 'forecast'],
      match: has(/พยากรณ์|forecast|ล่วงหน้า.*ทบทวน|ทบทวน.*ล่วงหน้า|อีกกี่วัน.*ทบทวน/),
      run: function (s) {
        const c = ctx(s);
        const n = Math.min(30, Math.max(3, s.days || 14));
        const t = planner().tables.forecast(n);
        return tableResp('REVIEW_WORDS', t, 'พยากรณ์จำนวนคำที่จะถึงกำหนดทบทวนใน ' + n + ' วันข้างหน้า');
      }
    },
    {
      id: 'overdue', label: 'คำที่ค้างทบทวน', examples: ['ค้างทบทวน', 'overdue'],
      match: has(/ค้าง|เลยกำหนด|overdue|ถึงกำหนด.*(กี่|อะไร)|due (words|now)/),
      run: function () {
        const t = planner().tables.overdue(15);
        return { command: 'REVIEW_WORDS', params: { table: t, count: t.total, words: t.words }, message: t.total ? 'มีคำค้างทบทวน ' + t.total + ' คำ — เริ่มจากคำที่เลยกำหนดนานสุดก่อนครับ' : 'ตอนนี้ไม่มีคำค้างทบทวน 🎉', priority: t.total > 20 ? 'high' : 'low' };
      }
    },
    {
      id: 'leech', label: 'คำ Leech', examples: ['leech', 'คำที่ผิดติด'],
      match: has(/leech|ลีช|ผิดติด|ผิดซ้ำติด|คำติด/),
      run: function () {
        const t = planner().tables.leech(15);
        return { command: 'START_FLASHCARD', params: { table: t, words: t.words }, message: t.total ? 'มี Leech ' + t.total + ' คำ — แนะนำให้ทำ mnemonic/แยกออกมาฝึกเป็นชุดเล็กครับ' : 'ยังไม่มีคำ Leech', priority: t.total ? 'medium' : 'low' };
      }
    },
    {
      id: 'speed', label: 'ความเร็วการตอบ', examples: ['ความเร็ว', 'speed'],
      match: has(/ความเร็ว|speed|ตอบช้า|ตอบเร็ว|เวลาตอบ|response time/),
      run: function () {
        const t = planner().tables.speed();
        return tableResp('SHOW_STATISTICS', t, 'ความเร็วตอบเฉลี่ยจาก Learn ของคุณ');
      }
    },
    {
      id: 'today', label: 'สรุปวันนี้', examples: ['วันนี้ทำอะไรไปแล้ว', 'today'],
      match: has(/วันนี้.*(ทำ|เรียน|ตอบ|ไปแล้ว|กี่)|สรุปวันนี้|today('s)? (summary|progress)|^today$/),
      run: function () {
        const t = planner().tables.today();
        return tableResp('SHOW_STATISTICS', t, t.empty ? 'วันนี้ยังไม่ได้ตอบใน Learn ลองเริ่มจากทบทวนคำค้างก่อนครับ' : 'สรุปการฝึกวันนี้');
      }
    },
    {
      id: 'mastery', label: 'สถานะการจำแยกตามความยาว', examples: ['เชี่ยวชาญ', 'mastery'],
      match: has(/เชี่ยวชาญ|mastery|mastered|สถานะการจำ|จำได้กี่คำ|จำไปแล้ว/),
      run: function () {
        const t = planner().tables.mastery();
        return tableResp('SHOW_STATISTICS', t, t.empty ? 'ยังไม่มีคำใน Cardbox ครับ' : 'สถานะการจำของคำใน Cardbox แยกตามความยาว');
      }
    },
    {
      id: 'weak_lengths', label: 'ความยาวคำที่อ่อน', examples: ['ความยาวไหนอ่อน'],
      match: has(/ความยาว.*(อ่อน|แย่|ต่ำ|weak)|(อ่อน|weak).*(ความยาว|กี่ตัว|length)/),
      run: function () {
        const t = planner().tables.weakLengths(5);
        return tableResp(t.weakest ? 'START_QUIZ' : 'SHOW_STATISTICS', t, t.empty ? t.note : 'ความยาวที่ควรเสริมที่สุดตอนนี้คือ ' + t.weakest + ' ตัว');
      }
    },
    {
      id: 'short_words', label: 'คำสั้น 2–4 ตัว', examples: ['คำสั้น', '2L 3L essentials'],
      match: has(/คำสั้น|short words?|essentials?|two.?letter|three.?letter|2\s*l\s*3\s*l/),
      run: function () {
        const t = planner().tables.shortWords();
        return tableResp('START_FLASHCARD', t, 'คำสั้น 2–4 ตัวเป็นชุดปิด — เรียนให้ครบได้จริง');
      }
    },
    {
      id: 'eta', label: 'เวลาที่ใช้เรียน N คำ', examples: ['เรียน 200 คำ 6L ใช้เวลาเท่าไหร่'],
      match: function (s) { return /ใช้เวลา|กี่นาที|กี่ชั่วโมง|กี่ชม|how long|eta|เวลาเท่าไหร่/i.test(s.lower) && s.lengths && s.lengths.length === 1 && /\d+\s*(คำ|words?)/i.test(s.lower); },
      run: function (s) {
        const m = s.lower.match(/(\d{1,5})\s*(?:คำ|words?)/);
        const n = m ? toInt(m[1]) : 100;
        const t = planner().tables.eta(s.lengths[0], n);
        return tableResp('CREATE_STUDY_PLAN', t, 'ประมาณเวลาเรียน ' + n + ' คำ ' + s.lengths[0] + ' ตัว รวมรอบทบทวน');
      }
    },
    {
      id: 'time_pace', label: 'ต้องเรียนวันละกี่คำ/กี่นาที', examples: ['ต้องเรียนวันละเท่าไหร่ 30 วัน', 'pace 45 days'],
      match: has(/วันละ.*(เท่าไหร่|กี่)|ต้องเรียน|pace|เวลา.*(ต่อวัน|วัน)|กี่นาที.*วัน|คำนวณเวลา|time (needed|per day)|ต่อวัน.*(กี่|เท่าไหร่)/),
      run: function (s) {
        const c = ctx(s);
        const o = baseOpts(c, 30);
        const t = planner().tables.pace(o);
        return tableResp('CREATE_STUDY_PLAN', t, 'คำนวณเวลาและจำนวนที่ต้องเรียนต่อวันสำหรับ ' + o.days + ' วัน' + needDaysNote(c, o.days));
      }
    },
    {
      id: 'progress', label: 'ความคืบหน้าเทียบเป้า', examples: ['ความคืบหน้า', 'progress'],
      match: has(/ความคืบหน้า|progress|ถึงเป้า|เทียบเป้า|ไปถึงไหน|ทำได้กี่%/),
      run: function (s) {
        const c = ctx(s);
        const t = planner().tables.progress(baseOpts(c));
        return tableResp('SHOW_STATISTICS', t, 'ความคืบหน้าของ Cardbox เทียบเป้าหมายรายความยาว');
      }
    },
    // ---- the headline command: gen 3L n 4L n ... ----
    {
      id: 'gen_targets', label: 'gen เป้าคำที่ควรจำ (3L–8L)', examples: ['gen 3L 4L 5L 6L 7L 8L', 'gen 7L 40% 8L 30%'],
      match: function (s) { return /\bgen\b|generate|เจน|สร้างเป้า|เป้า(หมาย)?.*(คำ|จำ)|ควรจำ|เป้าคำ|target|จำกี่คำ|กี่คำ.*(ควร|จำ)|เตรียมแข่ง|เตรียมสอบ/i.test(s.lower) || (s.lengths && s.lengths.length >= 2) || !!s.coverage; },
      run: function (s) {
        const c = ctx(s);
        const o = baseOpts(c);
        const t = planner().tables.targets(o);
        // if the learner also gave days, attach the pace table too
        const extra = {};
        let msg = 'เป้าหมายจำนวนคำที่ควรจำต่อความยาว (คำนวณจากคลัง CSW24 จริง)';
        if (c.days) {
          const pace = planner().tables.pace(Object.assign({}, o, { days: c.days }));
          extra.table2 = pace;
          msg += ' พร้อมเวลาที่ต้องใช้ใน ' + c.days + ' วัน';
        } else {
          msg += ' — บอกวันแข่งเพิ่มได้ เช่น "gen 3L-8L แข่งอีก 45 วัน วันละ 60 นาที"';
        }
        return tableResp('CREATE_STUDY_PLAN', t, msg, extra);
      }
    },
    {
      id: 'single_length', label: 'ดูข้อมูลความยาวเดียว', examples: ['7L', 'คำ 8 ตัว'],
      match: function (s) { return s.lengths && s.lengths.length === 1; },
      run: function (s) {
        const c = ctx(s);
        const o = baseOpts(c);
        o.lengths = s.lengths;
        const t = planner().tables.progress(o);
        return tableResp('SHOW_STATISTICS', t, 'ข้อมูลของคำ ' + s.lengths[0] + ' ตัว เทียบเป้า');
      }
    },
    {
      id: 'set_horizon', label: 'ตั้งวันแข่ง/งบเวลา (จำไว้ให้)', examples: ['แข่งอีก 45 วัน', 'วันละ 60 นาที'],
      match: function (s) { return !!(s.days || s.minutesPerDay); },
      run: function (s) {
        const c = ctx(s);
        const bits = [];
        if (c.days) bits.push('เหลือ ' + c.days + ' วัน');
        if (c.minutesPerDay) bits.push('วันละ ' + c.minutesPerDay + ' นาที');
        const o = baseOpts(c, 30);
        const t = c.minutesPerDay ? planner().tables.feasibility(o) : planner().tables.pace(o);
        return tableResp('CREATE_STUDY_PLAN', t, 'จำไว้แล้ว: ' + bits.join(' · ') + ' — ใช้ค่านี้กับคำสั่งถัดไป (เช่น "gen 3L-8L", "แผนสัปดาห์")');
      }
    },
    {
      id: 'reset_context', label: 'ล้างค่าที่จำไว้', examples: ['reset แผน', 'ล้างค่า'],
      match: has(/reset|ล้างค่า|ล้างแผน|เริ่มใหม่.*แผน|clear (plan|context)/),
      run: function () {
        session.days = null; session.minutesPerDay = null; session.coverage = {}; session.lengths = null;
        return { command: 'CREATE_STUDY_PLAN', params: {}, message: 'ล้างค่าวันแข่ง/งบเวลา/เป้า % ที่จำไว้แล้วครับ', priority: 'low' };
      }
    }
  ];

  // ---------- helpers that touch CSW24 (verify, never invent) ----------
  function isReal(w) {
    const idx = global.CoachSearchIndex, br = global.CSW24Bridge;
    if (idx && idx.isRealWord) return idx.isRealWord(w);
    if (br && br.isRealWord) return br.isRealWord(w);
    const pool = global.CSW24_BY_LENGTH && global.CSW24_BY_LENGTH[w.length];
    return !!pool && pool.indexOf(w) !== -1;
  }
  function notReal(w) {
    return { command: 'SHOW_WORD', params: { word: w }, message: '"' + w + '" ไม่มีใน CSW24 ครับ/ค่ะ', priority: 'low' };
  }

  // Random-but-deterministic-enough sample of words of length L that are
  // NOT already in Cardbox. Reads Cardbox via localStorage (read-only) and
  // the real CSW24 list; the actual write goes through ADD_TO_CARDBOX →
  // CSW24Bridge.addToCardbox, which re-verifies each word.
  function pickNewWords(L, n) {
    const pool = (global.CSW24_BY_LENGTH && global.CSW24_BY_LENGTH[L]) || [];
    if (!pool.length) return [];
    let have = new Set();
    try { have = new Set((JSON.parse(localStorage.getItem('csw24_cardbox_v1') || '[]')).map(function (c) { return c.word; })); } catch (e) { /* ignore */ }
    const idxs = [];
    const seen = {};
    let guard = 0;
    const target = Math.min(n, pool.length);
    while (idxs.length < target && guard < target * 30) {
      guard++;
      const i = Math.floor(Math.random() * pool.length);
      if (seen[i] || have.has(pool[i])) continue;
      seen[i] = true;
      idxs.push(i);
    }
    return idxs.map(function (i) { return pool[i]; });
  }

  // ---------- help table ----------
  function helpResponse() {
    const rows = INTENTS.filter(function (i) { return i.id !== 'help'; }).map(function (i, k) {
      return [String(k + 1), i.label, i.examples[0]];
    });
    return {
      command: 'SHOW_STATISTICS',
      params: { table: {
        title: '🤖 คำสั่ง AI Coach (' + rows.length + ' คำสั่ง)',
        columns: ['#', 'ทำอะไร', 'ตัวอย่างที่พิมพ์'],
        rows: rows,
        note: 'ผสมได้ในประโยคเดียว เช่น "gen 3L-8L 7L 40% แข่งอีก 45 วัน วันละ 60 นาที" · ค่าวันแข่ง/งบเวลาจะถูกจำไว้ใช้กับคำสั่งถัดไป (พิมพ์ "reset แผน" เพื่อล้าง)'
      } },
      message: 'นี่คือคำสั่งที่ผมเข้าใจครับ ตัวเลขทั้งหมดคำนวณจากคลัง CSW24 และ Cardbox ของคุณจริง',
      priority: 'low'
    };
  }

  // ---------- public ----------
  function respond(text) {
    if (!planner()) return null; // planner not loaded -> let CoachEngine fall back
    const s = parse(text);
    for (let i = 0; i < INTENTS.length; i++) {
      let matched = false;
      try { matched = INTENTS[i].match(s); } catch (e) { matched = false; }
      if (matched) {
        let out;
        try { out = INTENTS[i].run(s); } catch (e) {
          return { command: 'SHOW_STATISTICS', params: {}, message: 'คำนวณไม่สำเร็จ (' + INTENTS[i].id + ') ลองพิมพ์ใหม่อีกครั้งครับ', priority: 'low' };
        }
        if (out && SAFE_COMMANDS.indexOf(out.command) !== -1 && typeof out.message === 'string' && out.message) {
          out.__intent = INTENTS[i].id;
          return out;
        }
      }
    }
    return null; // no tournament-prep intent matched -> CoachEngine's own routing continues
  }

  function intentList() {
    return INTENTS.map(function (i) { return { id: i.id, label: i.label, examples: i.examples.slice() }; });
  }

  global.CoachIntents = {
    respond: respond,
    parse: parse,
    intentList: intentList,
    getSession: function () { return JSON.parse(JSON.stringify(session)); },
    resetSession: function () { session.days = null; session.minutesPerDay = null; session.coverage = {}; session.lengths = null; },
    INTENT_COUNT: INTENTS.length
  };
})(typeof window !== 'undefined' ? window : globalThis);
