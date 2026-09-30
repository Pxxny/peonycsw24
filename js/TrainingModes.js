/* =========================================================
   CSW24 Word Lab — Daily Word Training: mode definitions
   =========================================================
   Scope: pure data + pure helper functions describing the 12
   daily training modes ("วันนี้สมองคุณไหวแค่ไหน?" — spec
   sections 1-2). No DOM, no localStorage, mirrors badges.js /
   frames.js's own "pure data" convention so it composes with
   the rest of the app the same way.

   Each mode:
     id          unique string, used as storage key / data-mode
     icon        emoji shown on the mode card
     name        {th, en}
     tagline     {th, en} — the short "สำหรับ..." line
     goal        {th, en} — the "เป้าหมาย" quote shown on the card
     stars       1-5, ⭐ count shown on the card (spec's ระดับ)
     timeMin     [min, max] minutes, or null for "varies" (โหมด 10)
     wordsApprox [min, max] words, or null (โหมด 10 depends on
                 how many lengths the learner picks)
     lengths     'all' (3-9) or null (โหมดที่ไม่ผูกความยาวตายตัว —
                 โหมด 10 ผู้ใช้เลือกเอง, จึงเป็น null ที่นี่)
     drillTypes  which of the app's existing drill types this mode
                 draws from — real types the app already has
                 (see AdaptiveQuiz.js / app.js Quiz+Learn tabs),
                 not invented ones
     recipe      ordered list of session steps (spec's "Daily Plan"
                 per mode, section 5) — each step is
                 { type, label:{th,en} } where `type` is one of
                 RECIPE_STEP_TYPES below
     dailyGoalMultiplier  how this mode should scale the existing
                 Dashboard Daily Goal (section 9's rule: จำชิล ๆ ต้อง
                 ลด Daily Goal, Full Grind ได้เพิ่ม) — a plain
                 multiplier on whatever goal size the learner
                 already has configured, 1 = unchanged
     needsBreaks boolean — session should insert an automatic break
                 (section 13; only the long modes: Marathon, Full Grind)
   ========================================================= */

(function (global) {
  'use strict';

  // The building blocks a mode's `recipe` is made of. Kept as a flat
  // enum so TrainingPlanner.js (daily plan builder, next phase) and any
  // renderer can switch on a fixed, known set rather than free strings.
  const RECIPE_STEP_TYPES = {
    NEW_WORDS: 'new_words',
    REVIEW: 'review',
    RECALL: 'recall',
    ANAGRAM: 'anagram',
    UNSCRAMBLE: 'unscramble',
    MISSING_LETTERS: 'missing_letters',
    REVERSE_RECALL: 'reverse_recall',
    MULTIPLE_CHOICE: 'multiple_choice',
    TIMED_QUIZ: 'timed_quiz',
    MIXED_QUIZ: 'mixed_quiz',
    WEAK_WORDS: 'weak_words',
    FINAL_TEST: 'final_test',
    BREAK: 'break',
    REVIEW_QUEUE: 'review_queue'
  };

  function step(type, th, en) {
    return { type: type, label: { th: th, en: en } };
  }

  const T = RECIPE_STEP_TYPES;

  const MODES = [
    {
      id: 'chill',
      icon: '🧘',
      name: { th: 'จำชิล ๆ', en: 'Easy Recall' },
      tagline: { th: 'สำหรับวันที่ไม่อยากเร่ง', en: 'For days you don\u2019t want to rush' },
      goal: { th: 'วันนี้ขอแค่จำได้ ไม่ต้องรีบ', en: 'Today, just remembering is enough' },
      stars: 1,
      timeMin: [15, 20],
      wordsApprox: [20, 30],
      drillTypes: ['flashcard', 'review'],
      recipe: [
        step(T.NEW_WORDS, 'คำใหม่ (จำนวนน้อย)', 'New words (small batch)'),
        step(T.REVIEW, 'ทบทวนเฉพาะคำที่ผิด', 'Review — mistakes only'),
        step(T.FINAL_TEST, 'จบ', 'Finish')
      ],
      dailyGoalMultiplier: 0.5,
      needsBreaks: false
    },
    {
      id: 'steady',
      icon: '🌱',
      name: { th: 'จำไม่เร่ง', en: 'Steady Pace' },
      tagline: { th: 'สำหรับฝึกแบบสบาย ๆ แต่สม่ำเสมอ', en: 'Relaxed but consistent practice' },
      goal: { th: 'ค่อย ๆ จำ แต่จำจริง', en: 'Slow and steady, but it sticks' },
      stars: 2,
      timeMin: [25, 30],
      wordsApprox: [30, 40],
      drillTypes: ['flashcard', 'review', 'recall', 'anagram', 'quiz'],
      recipe: [
        step(T.NEW_WORDS, 'คำใหม่ (ปานกลาง)', 'New words (moderate)'),
        step(T.REVIEW, 'ทบทวนระหว่างวัน', 'Review during the day'),
        step(T.RECALL, 'Recall', 'Recall'),
        step(T.ANAGRAM, 'Anagram', 'Anagram'),
        step(T.MIXED_QUIZ, 'Quiz สั้น ๆ', 'Short quiz'),
        step(T.FINAL_TEST, 'จบ', 'Finish')
      ],
      dailyGoalMultiplier: 0.8,
      needsBreaks: false
    },
    {
      id: 'marathon',
      icon: '🏃',
      name: { th: 'จำมาราธอน', en: 'Marathon' },
      tagline: { th: 'สำหรับวันที่มีเวลามาก', en: 'For days you have plenty of time' },
      goal: { th: 'ใช้เวลาวันนี้สร้างคลังศัพท์ให้ได้มากขึ้น', en: 'Use today to grow your vocabulary' },
      stars: 4,
      timeMin: [60, 120],
      wordsApprox: [80, 150],
      drillTypes: ['flashcard', 'review', 'recall', 'anagram', 'quiz'],
      recipe: [
        step(T.NEW_WORDS, 'คำใหม่ (ครบ 3-9 ตัว)', 'New words (all lengths 3-9)'),
        step(T.REVIEW, 'ทบทวน', 'Review'),
        step(T.MIXED_QUIZ, 'Quiz', 'Quiz'),
        step(T.BREAK, 'พัก', 'Break'),
        step(T.NEW_WORDS, 'คำใหม่ (ต่อ)', 'New words (continued)'),
        step(T.REVIEW, 'ทบทวน (ต่อ)', 'Review (continued)'),
        step(T.FINAL_TEST, 'Final Test', 'Final test')
      ],
      dailyGoalMultiplier: 1.5,
      needsBreaks: true
    },
    {
      id: 'speed',
      icon: '⚡',
      name: { th: 'จำสปีด', en: 'Speed Round' },
      tagline: { th: 'สำหรับวันที่มีเวลาน้อย', en: 'For days you\u2019re short on time' },
      goal: { th: 'เวลาน้อย แต่ยังรักษาความต่อเนื่อง', en: 'Little time, but keep the streak' },
      stars: 3,
      timeMin: [10, 15],
      wordsApprox: [10, 20],
      drillTypes: ['quiz', 'recall'],
      recipe: [
        step(T.TIMED_QUIZ, 'Quiz แบบรวดเร็ว', 'Quick quiz'),
        step(T.RECALL, 'Timed Recall', 'Timed recall'),
        step(T.ANAGRAM, 'Anagram', 'Anagram'),
        step(T.FINAL_TEST, 'จบ', 'Finish')
      ],
      dailyGoalMultiplier: 0.6,
      needsBreaks: false
    },
    {
      id: 'precision',
      icon: '🎯',
      name: { th: 'จำให้แม่น', en: 'Precision' },
      tagline: { th: 'เน้นคุณภาพมากกว่าปริมาณ', en: 'Quality over quantity' },
      goal: { th: 'จำให้แม่น ไม่ใช่แค่เคยเห็น', en: 'Really remember it, not just recognize it' },
      stars: 3,
      timeMin: [20, 30],
      wordsApprox: [15, 25],
      drillTypes: ['recall', 'review'],
      recipe: [
        step(T.NEW_WORDS, 'คำใหม่ (ไม่เยอะ)', 'New words (small batch)'),
        step(T.RECALL, 'Recall หลายรอบ', 'Recall — multiple passes'),
        step(T.WEAK_WORDS, 'คำที่ผิดกลับมาทันที', 'Mistakes come right back'),
        step(T.FINAL_TEST, 'ผ่านเกณฑ์', 'Meet the threshold')
      ],
      dailyGoalMultiplier: 0.7,
      needsBreaks: false
    },
    {
      id: 'rescue',
      icon: '🔥',
      name: { th: 'กู้ศัพท์ที่ลืม', en: 'Memory Rescue' },
      tagline: { th: 'สำหรับวันที่ต้องการจัดการคำศัพท์ที่ลืม', en: 'For clearing out forgotten words' },
      goal: { th: 'เคลียร์คำที่ค้างอยู่', en: 'Clear the backlog' },
      stars: 2,
      timeMin: [20, 30],
      wordsApprox: [20, 35],
      drillTypes: ['review', 'recall'],
      recipe: [
        step(T.WEAK_WORDS, 'ดึงคำที่เคยผิด/ไม่ได้ทบทวน/ใกล้ถึง Review', 'Pull mistakes / stale / due-soon words'),
        step(T.REVIEW, 'ทบทวน', 'Review'),
        step(T.FINAL_TEST, 'จบ', 'Finish')
      ],
      dailyGoalMultiplier: 0.7,
      needsBreaks: false
    },
    {
      id: 'brain_training',
      icon: '🧠',
      name: { th: 'Brain Training', en: 'Brain Training' },
      tagline: { th: 'ฝึกสมองด้วยโจทย์หลายรูปแบบ', en: 'Train with a mix of drill types' },
      goal: { th: 'สลับรูปแบบโจทย์ไปเรื่อย ๆ', en: 'Keep switching things up' },
      stars: 3,
      timeMin: [25, 35],
      wordsApprox: [25, 35],
      drillTypes: ['recall', 'anagram', 'unscramble', 'quiz'],
      recipe: [
        step(T.RECALL, 'Recall', 'Recall'),
        step(T.ANAGRAM, 'Anagram', 'Anagram'),
        step(T.UNSCRAMBLE, 'Unscramble', 'Unscramble'),
        step(T.MISSING_LETTERS, 'Missing Letters', 'Missing letters'),
        step(T.REVERSE_RECALL, 'Reverse Recall', 'Reverse recall'),
        step(T.MULTIPLE_CHOICE, 'Multiple Choice', 'Multiple choice'),
        step(T.TIMED_QUIZ, 'Timed Quiz', 'Timed quiz')
      ],
      dailyGoalMultiplier: 1,
      needsBreaks: false,
      shuffleRecipe: true // spec: "สุ่ม" order — renderer/planner may reorder these steps
    },
    {
      id: 'random_mix',
      icon: '🎲',
      name: { th: 'สุ่มไม่จำเจ', en: 'Random Mix' },
      tagline: { th: 'สุ่มความยาว/จำนวน/ประเภท/ลำดับ/ความยาก', en: 'Randomized length, count, type, order, difficulty' },
      goal: { th: 'ฝึกโดยไม่รู้สึกว่ากำลังทำตารางเดิมซ้ำ ๆ', en: 'Practice without it feeling repetitive' },
      stars: 3,
      timeMin: [20, 30],
      wordsApprox: [20, 30],
      drillTypes: ['recall', 'anagram', 'quiz'],
      recipe: [
        step(T.MIXED_QUIZ, 'สุ่มโจทย์', 'Randomized drill')
      ],
      dailyGoalMultiplier: 1,
      needsBreaks: false,
      randomized: true // planner should randomize length/count/type/order each time
    },
    {
      id: 'challenge',
      icon: '🏆',
      name: { th: 'Challenge', en: 'Challenge' },
      tagline: { th: 'สำหรับวันที่อยากท้าทายตัวเอง', en: 'For days you want to push yourself' },
      goal: { th: 'แข่งกับสถิติของตัวเอง ไม่จัดอันดับกับคนอื่น', en: 'Beat your own record, not other people' },
      stars: 4,
      timeMin: [30, 45],
      wordsApprox: [30, 50],
      drillTypes: ['quiz', 'anagram'],
      recipe: [
        step(T.TIMED_QUIZ, 'Challenge Goal', 'Challenge goal'),
        step(T.ANAGRAM, 'ทาย Anagram ให้ครบ', 'Clear the anagram set'),
        step(T.FINAL_TEST, 'Final Score', 'Final score')
      ],
      dailyGoalMultiplier: 1.2,
      needsBreaks: false
    },
    {
      id: 'length_focus',
      icon: '📚',
      name: { th: 'เจาะ Letters', en: 'Length Focus' },
      tagline: { th: 'เลือกความยาวที่อยากฝึกเอง (3-9 ตัว, เลือกได้หลายระดับ)', en: 'Pick which word lengths to drill (3-9 letters, multi-select)' },
      goal: { th: 'โฟกัสความยาวที่ต้องการ', en: 'Focus on the lengths you choose' },
      stars: null, // spec: ⭐⭐–⭐⭐⭐⭐ — depends entirely on how many/which lengths picked
      timeMin: null,
      wordsApprox: null,
      lengths: null, // user-selected, not fixed 'all'
      drillTypes: ['flashcard', 'review', 'recall', 'quiz'],
      recipe: [
        step(T.NEW_WORDS, 'คำใหม่ (ตามความยาวที่เลือก)', 'New words (chosen lengths)'),
        step(T.REVIEW, 'ทบทวน', 'Review'),
        step(T.FINAL_TEST, 'จบ', 'Finish')
      ],
      dailyGoalMultiplier: 1,
      needsBreaks: false,
      requiresLengthSelection: true
    },
    {
      id: 'review_day',
      icon: '🔄',
      name: { th: 'Review Day', en: 'Review Day' },
      tagline: { th: 'วันนี้เน้นทบทวน ไม่เน้นศัพท์ใหม่', en: 'Today is about review, not new words' },
      goal: { th: 'รักษาความจำของศัพท์เก่า', en: 'Keep old words from fading' },
      stars: 2,
      timeMin: [20, 40],
      wordsApprox: [20, 40],
      drillTypes: ['review', 'recall'],
      recipe: [
        step(T.REVIEW_QUEUE, 'คำที่ถึงกำหนด Review', 'Due-for-review words'),
        step(T.WEAK_WORDS, 'คำที่ตอบผิด/จำไม่แม่น/ไม่ได้เจอนาน', 'Mistakes / shaky / long-unseen words'),
        step(T.RECALL, 'Recall', 'Recall'),
        step(T.FINAL_TEST, 'Final Review', 'Final review')
      ],
      dailyGoalMultiplier: 0.8,
      needsBreaks: false
    },
    {
      id: 'full_grind',
      icon: '🚀',
      name: { th: 'Full Grind', en: 'Full Grind' },
      tagline: { th: 'โหมดฝึกเต็มรูปแบบ ครบ 3-9 ตัว', en: 'The complete workout, all lengths 3-9' },
      goal: { th: 'ฝึกแบบเต็มระบบในวันที่พร้อม', en: 'Go all-in when you\u2019re ready' },
      stars: 5,
      timeMin: [60, 120],
      wordsApprox: [100, 200],
      drillTypes: ['flashcard', 'review', 'recall', 'anagram', 'quiz'],
      recipe: [
        step(T.NEW_WORDS, 'New Words', 'New words'),
        step(T.REVIEW, 'Review', 'Review'),
        step(T.RECALL, 'Recall', 'Recall'),
        step(T.ANAGRAM, 'Anagram', 'Anagram'),
        step(T.TIMED_QUIZ, 'Timed Quiz', 'Timed quiz'),
        step(T.WEAK_WORDS, 'Weak Words', 'Weak words'),
        step(T.FINAL_TEST, 'Final Test', 'Final test')
      ],
      dailyGoalMultiplier: 2,
      needsBreaks: true,
      adaptiveWordCount: true // spec: "ระบบปรับจำนวนคำตามผลการฝึกของผู้ใช้"
    }
  ];

  const BY_ID = {};
  MODES.forEach(function (m) { BY_ID[m.id] = m; });

  function getMode(id) { return BY_ID[id] || null; }
  function allModes() { return MODES.slice(); }

  // A mode card's displayed time/word-count range as a string, honoring
  // "เจาะ Letters" having no fixed range (spec section 2, mode 10).
  function formatRange(range, unit) {
    if (!range) return null;
    return range[0] === range[1] ? (range[0] + unit) : (range[0] + '-' + range[1] + unit);
  }

  global.TrainingModes = {
    RECIPE_STEP_TYPES: RECIPE_STEP_TYPES,
    all: allModes,
    get: getMode,
    formatRange: formatRange
  };
})(typeof window !== 'undefined' ? window : globalThis);
