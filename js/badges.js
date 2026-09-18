/* =========================================================
   CSW24 Word Lab — badge definitions
   Pure data + pure check functions. No DOM, no localStorage.
   Loaded before achievements.js.

   Each badge:
     id       unique string, used as storage key
     icon     emoji shown on the badge + toast
     name     {th, en}
     desc     {th, en} — how to unlock it
     check(stats) -> boolean   stats is the aggregate object
                                 built by achievements.js
   ========================================================= */

(function (global) {
  'use strict';

  const BADGES = [
    {
      id: 'first_word',
      icon: '🌱',
      name: { th: 'ก้าวแรก', en: 'First Step' },
      desc: { th: 'บันทึกคำศัพท์คำแรกลง Cardbox', en: 'Save your first word to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 1; }
    },
    {
      id: 'words_10',
      icon: '📚',
      name: { th: 'นักสะสมคำ', en: 'Word Collector' },
      desc: { th: 'บันทึกคำศัพท์ครบ 10 คำใน Cardbox', en: 'Save 10 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 10; }
    },
    {
      id: 'words_50',
      icon: '🗂️',
      name: { th: 'คลังคำใหญ่', en: 'Big Vocabulary' },
      desc: { th: 'บันทึกคำศัพท์ครบ 50 คำใน Cardbox', en: 'Save 50 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 50; }
    },
    {
      id: 'words_200',
      icon: '🏛️',
      name: { th: 'ห้องสมุดส่วนตัว', en: 'Personal Library' },
      desc: { th: 'บันทึกคำศัพท์ครบ 200 คำใน Cardbox', en: 'Save 200 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 200; }
    },
    {
      id: 'first_session',
      icon: '🎯',
      name: { th: 'เริ่มทบทวน', en: 'First Review' },
      desc: { th: 'ทำ session ทบทวนสำเร็จครั้งแรก', en: 'Complete your first study session' },
      check: function (s) { return s.sessionsCompleted >= 1; }
    },
    {
      id: 'sessions_10',
      icon: '🔁',
      name: { th: 'ขยันทบทวน', en: 'Dedicated Reviewer' },
      desc: { th: 'ทำ session ทบทวนสำเร็จครบ 10 ครั้ง', en: 'Complete 10 study sessions' },
      check: function (s) { return s.sessionsCompleted >= 10; }
    },
    {
      id: 'mastered_1',
      icon: '⭐',
      name: { th: 'เชี่ยวชาญคำแรก', en: 'First Mastery' },
      desc: { th: 'ทำคำศัพท์ให้ถึงสถานะ "เชี่ยวชาญ" คำแรก', en: 'Reach "Mastered" status on your first word' },
      check: function (s) { return s.masteredCount >= 1; }
    },
    {
      id: 'mastered_25',
      icon: '🌟',
      name: { th: 'ปรมาจารย์คำศัพท์', en: 'Word Master' },
      desc: { th: 'ทำคำศัพท์ให้ถึงสถานะ "เชี่ยวชาญ" ครบ 25 คำ', en: 'Reach "Mastered" status on 25 words' },
      check: function (s) { return s.masteredCount >= 25; }
    },
    {
      id: 'perfect_session',
      icon: '💯',
      name: { th: 'สมบูรณ์แบบ', en: 'Perfect Session' },
      desc: { th: 'ทบทวนถูกทั้งหมดในหนึ่ง session (อย่างน้อย 5 คำ)', en: 'Answer every card correctly in one session (5+ cards)' },
      check: function (s) { return s.hasPerfectSession; }
    },
    {
      id: 'anagram_10',
      icon: '🔤',
      name: { th: 'นักไข Anagram', en: 'Anagram Solver' },
      desc: { th: 'เปิดดู Anagram ครบ 10 ครั้ง', en: 'View Anagrams 10 times' },
      check: function (s) { return s.anagramViews >= 10; }
    },
    {
      id: 'typing_win',
      icon: '⌨️',
      name: { th: 'นิ้วไว', en: 'Fast Fingers' },
      desc: { th: 'พิมพ์คำศัพท์ถูกครบชุดในเกม Typing', en: 'Finish a round of the Typing minigame' },
      check: function (s) { return s.typingWins >= 1; }
    },
    {
      id: 'racks_10',
      icon: '🁢',
      name: { th: 'นักไข Rack', en: 'Rack Cracker' },
      desc: { th: 'หาคำถูกใน Random Racks ครบ 10 คำ', en: 'Find 10 correct words in Random Racks' },
      check: function (s) { return s.racksCorrectTotal >= 10; }
    },
    {
      id: 'alpha_clear',
      icon: '🔀',
      name: { th: 'เคลียร์ Alphagram', en: 'Alphagram Clear' },
      desc: { th: 'หาคำครบทุกคำในชุด Alphagram Blitz', en: 'Clear every solution in an Alphagram Blitz set' },
      check: function (s) { return s.alphaCleared >= 1; }
    },
    {
      id: 'marathon_finisher',
      icon: '⚡',
      name: { th: 'นักวิ่งมาราธอน', en: 'Marathon Finisher' },
      desc: { th: 'เล่น Time Attack Marathon จนจบครบทุกรอบเป็นครั้งแรก', en: 'Complete a full Time Attack Marathon session' },
      check: function (s) { return s.marathonCompleted >= 1; }
    },
    {
      id: 'marathon_streak_10',
      icon: '🔥⚡',
      name: { th: 'สายฟ้าต่อเนื่อง', en: 'Lightning Streak' },
      desc: { th: 'ตอบถูกต่อเนื่อง 10 รอบใน Time Attack Marathon', en: 'Reach a 10-answer streak in Time Attack Marathon' },
      check: function (s) { return s.marathonBestStreak >= 10; }
    },
    {
      id: 'streak_3',
      icon: '🔥',
      name: { th: 'ต่อเนื่อง 3 วัน', en: '3-Day Streak' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 3 วัน', en: 'Use the app on 3 different days in a row' },
      check: function (s) { return s.dayStreak >= 3; }
    },
    {
      id: 'streak_7',
      icon: '🔥',
      name: { th: 'ต่อเนื่อง 7 วัน', en: '7-Day Streak' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 7 วัน', en: 'Use the app on 7 different days in a row' },
      check: function (s) { return s.dayStreak >= 7; }
    },

    // ---------------------------------------------------------------
    // "แปลกๆ ดีๆ ยากๆ เป็นไปไม่ได้" set — weird / fun / hard /
    // near-impossible achievements. points across this group sum to 100.
    // ---------------------------------------------------------------
    {
      id: 'night_owl',
      icon: '🦉',
      points: 5,
      name: { th: 'นกฮูกยามดึก', en: 'Night Owl' },
      desc: { th: 'เข้าเล่น/ทบทวนช่วงตี 2 – ตี 5 (แปลกแฮะ นอนบ้างนะ)', en: 'Study or play between 2:00–4:59 AM (go to bed, seriously)' },
      check: function (s) { return !!s.hasNightOwlPlay; }
    },
    {
      id: 'early_bird',
      icon: '🐓',
      points: 5,
      name: { th: 'นกตื่นเช้า', en: 'Early Bird' },
      desc: { th: 'เข้าเล่น/ทบทวนช่วงตี 5 – 6 โมงเช้า', en: 'Study or play between 5:00–5:59 AM' },
      check: function (s) { return !!s.hasEarlyBirdPlay; }
    },
    {
      id: 'q_no_u',
      icon: '🐪',
      points: 5,
      name: { th: 'Q ไร้ U', en: 'Q Without U' },
      desc: { th: 'บันทึกคำที่มี Q แต่ไม่มี U ลง Cardbox (เช่น QI, QOPH)', en: 'Save a word with Q but no U to Cardbox (e.g. QI, QOPH)' },
      check: function (s) { return !!s.hasQNoU; }
    },
    {
      id: 'pangram_word',
      icon: '🌈',
      points: 5,
      name: { th: 'คำสายรุ้ง', en: 'Rainbow Word' },
      desc: { th: 'บันทึกคำยาว 7 ตัวขึ้นไปที่ไม่มีตัวอักษรซ้ำเลยสักตัว', en: 'Save a 7+ letter word with no repeated letters' },
      check: function (s) { return !!s.hasPangramWord; }
    },
    {
      id: 'typo_champion',
      icon: '🤦',
      points: 5,
      name: { th: 'เจ้าพ่อพิมพ์ผิด', en: 'Typo Champion' },
      desc: { th: 'พิมพ์ผิดสะสมครบ 50 ครั้งในเกม Typing (เหรียญนี้ไม่ได้ภูมิใจ แต่ก็ปลดล็อกได้)', en: 'Rack up 50 lifetime mistakes in the Typing minigame (a badge of dubious honor)' },
      check: function (s) { return s.typingMistakesTotal >= 50; }
    },
    {
      id: 'speed_demon',
      icon: '💨',
      points: 10,
      name: { th: 'นิ้วเทพ', en: 'Speed Demon' },
      desc: { th: 'จบเกม Typing (3 คำขึ้นไป) เฉลี่ยเร็วกว่า 1.5 วินาทีต่อคำ', en: 'Finish a Typing round (3+ words) averaging under 1.5s per word' },
      check: function (s) { return s.bestTypingWordsPerSec >= (1 / 1.5); }
    },
    {
      id: 'midnight_marathon',
      icon: '🏃‍♂️💥',
      points: 15,
      name: { th: 'มาราธอนไม่มีสะดุด', en: 'Unstoppable Marathon' },
      desc: { th: 'ตอบถูกต่อเนื่อง 50 รอบใน Time Attack Marathon โดยไม่พลาดเลย', en: 'Reach a 50-answer streak in Time Attack Marathon without a single miss' },
      check: function (s) { return s.marathonBestStreak >= 50; }
    },
    {
      id: 'word_hoarder_500',
      icon: '🐉',
      points: 15,
      name: { th: 'มังกรเฝ้าคลังคำ', en: 'Dragon\u2019s Hoard' },
      desc: { th: 'บันทึกคำศัพท์ครบ 500 คำใน Cardbox', en: 'Save 500 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 500; }
    },
    {
      id: 'the_completionist',
      icon: '👑',
      points: 15,
      name: { th: 'ผู้เก็บครบ', en: 'The Completionist' },
      desc: { th: 'ปลดล็อกเหรียญอื่นทั้งหมดในเกม', en: 'Unlock every other badge in the game' },
      check: function (s) { return s.otherBadgesTotalCount > 0 && s.otherBadgesUnlockedCount >= s.otherBadgesTotalCount; }
    },
    {
      id: 'the_impossible',
      icon: '🌌',
      points: 20,
      tier: 'legacy',
      name: { th: 'สิ่งที่เป็นไปไม่ได้', en: 'The Impossible' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 100 วันติดต่อกัน โดยไม่ขาดแม้แต่วันเดียว', en: 'Use the app on 100 consecutive days without missing a single one' },
      check: function (s) { return s.dayStreak >= 100; }
    },

    // =================================================================
    // 🚫 IMPOSSIBLE TIER (5) — realistically out of reach for almost
    // anyone. These exist to be bragged about, not grinded toward.
    // =================================================================
    {
      id: 'imp_year_streak',
      icon: '🪐',
      points: 3,
      tier: 'impossible',
      name: { th: 'หนึ่งปีไม่ขาด', en: 'The Unbroken Year' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 365 วันติดต่อกัน โดยไม่ขาดแม้แต่วันเดียว', en: 'Use the app on 365 consecutive days without missing one' },
      check: function (s) { return s.dayStreak >= 365; }
    },
    {
      id: 'imp_cardbox_2000',
      icon: '🏯',
      points: 3,
      tier: 'impossible',
      name: { th: 'จักรพรรดิคำศัพท์', en: 'The Vocabulary Emperor' },
      desc: { th: 'บันทึกคำศัพท์ครบ 2,000 คำใน Cardbox', en: 'Save 2,000 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 2000; }
    },
    {
      id: 'imp_marathon_streak_200',
      icon: '☄️',
      points: 3,
      tier: 'impossible',
      name: { th: 'สายฟ้าไม่มีวันดับ', en: 'The Streak That Never Dies' },
      desc: { th: 'ตอบถูกต่อเนื่อง 200 รอบใน Time Attack Marathon โดยไม่พลาดเลย', en: 'Reach a 200-answer streak in Time Attack Marathon without a single miss' },
      check: function (s) { return s.marathonBestStreak >= 200; }
    },
    {
      id: 'imp_mastered_500',
      icon: '🏔️',
      points: 3,
      tier: 'impossible',
      name: { th: 'ยอดเขาแห่งความเชี่ยวชาญ', en: 'The Summit of Mastery' },
      desc: { th: 'ทำคำศัพท์ให้ถึงสถานะ "เชี่ยวชาญ" ครบ 500 คำ', en: 'Reach "Mastered" status on 500 words' },
      check: function (s) { return s.masteredCount >= 500; }
    },
    {
      id: 'imp_odds_streak_100',
      icon: '🎲',
      points: 3,
      tier: 'impossible',
      name: { th: 'เทพเจ้าแห่งความน่าจะเป็น', en: 'The Probability Deity' },
      desc: { th: 'ตอบถูกต่อเนื่อง 100 ข้อใน Odds Trainer โดยไม่พลาดเลย', en: 'Answer 100 Odds Trainer questions correctly in a row without a single miss' },
      check: function (s) { return s.oddsBestStreak >= 100; }
    },

    // =================================================================
    // 🔥 NEAR-IMPOSSIBLE TIER (10) — very hard, but a dedicated player
    // could plausibly get here with real effort over time.
    // =================================================================
    {
      id: 'nimp_streak_60',
      icon: '🌕',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'สองเดือนไม่ขาด', en: 'Two Months Strong' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 60 วันติดต่อกัน', en: 'Use the app on 60 consecutive days' },
      check: function (s) { return s.dayStreak >= 60; }
    },
    {
      id: 'nimp_cardbox_1000',
      icon: '📖',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'สารานุกรมเดินได้', en: 'The Walking Encyclopedia' },
      desc: { th: 'บันทึกคำศัพท์ครบ 1,000 คำใน Cardbox', en: 'Save 1,000 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 1000; }
    },
    {
      id: 'nimp_mastered_200',
      icon: '🎖️',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'นายพลแห่งคำศัพท์', en: 'The Vocabulary General' },
      desc: { th: 'ทำคำศัพท์ให้ถึงสถานะ "เชี่ยวชาญ" ครบ 200 คำ', en: 'Reach "Mastered" status on 200 words' },
      check: function (s) { return s.masteredCount >= 200; }
    },
    {
      id: 'nimp_marathon_streak_100',
      icon: '⚡⚡',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'สายฟ้าคู่', en: 'Double Lightning' },
      desc: { th: 'ตอบถูกต่อเนื่อง 100 รอบใน Time Attack Marathon', en: 'Reach a 100-answer streak in Time Attack Marathon' },
      check: function (s) { return s.marathonBestStreak >= 100; }
    },
    {
      id: 'nimp_sessions_500',
      icon: '📅',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'ห้าร้อยครั้งไม่ท้อ', en: 'Five Hundred Sessions' },
      desc: { th: 'ทำ session ทบทวนสำเร็จครบ 500 ครั้ง', en: 'Complete 500 study sessions' },
      check: function (s) { return s.sessionsCompleted >= 500; }
    },
    {
      id: 'nimp_typing_perfect_speed',
      icon: '🚀',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'เร็วกว่าความคิด', en: 'Faster Than Thought' },
      desc: { th: 'จบเกม Typing (5 คำขึ้นไป) เฉลี่ยเร็วกว่า 0.8 วินาทีต่อคำ โดยไม่พิมพ์ผิดเลยในรอบนั้น', en: 'Finish a Typing round (5+ words) averaging under 0.8s per word with zero mistakes that round' },
      check: function (s) { return s.bestTypingWordsPerSec >= (1 / 0.8) && s.typingCleanRounds >= 1; }
    },
    {
      id: 'nimp_odds_500',
      icon: '🧮',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'นักคำนวณเจนสนาม', en: 'The Seasoned Calculator' },
      desc: { th: 'ตอบคำถามใน Odds Trainer สะสมครบ 500 ข้อ โดยตอบถูกอย่างน้อย 80%', en: 'Answer 500 Odds Trainer questions total with at least 80% accuracy' },
      check: function (s) { return s.oddsAnswered >= 500 && s.oddsAnswered > 0 && (s.oddsCorrect / s.oddsAnswered) >= 0.8; }
    },
    {
      id: 'nimp_bot_wins_50',
      icon: '🤖👑',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'ผู้พิชิตบอทตัวจริง', en: 'The True Bot Slayer' },
      desc: { th: 'ชนะเกม Play Game ที่เล่นกับบอทครบ 50 ครั้ง', en: 'Win 50 games against the bot in Play Game' },
      check: function (s) { return s.botGamesWon >= 50; }
    },
    {
      id: 'nimp_marathon_50',
      icon: '🏅',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'นักวิ่งห้าสิบมาราธอน', en: 'The Fifty-Marathon Runner' },
      desc: { th: 'เล่น Time Attack Marathon จนจบครบทุกรอบ รวม 50 ครั้ง', en: 'Complete a full Time Attack Marathon session 50 times' },
      check: function (s) { return s.marathonCompleted >= 50; }
    },
    {
      id: 'nimp_anagram_300',
      icon: '🧩',
      points: 2,
      tier: 'near_impossible',
      name: { th: 'ปรมาจารย์ Anagram', en: 'The Anagram Grandmaster' },
      desc: { th: 'เปิดดู Anagram สะสมครบ 300 ครั้ง', en: 'View Anagrams 300 times total' },
      check: function (s) { return s.anagramViews >= 300; }
    },

    // =================================================================
    // 💪 HARD TIER (10) — genuinely challenging, achievable within a
    // few dedicated weeks of play.
    // =================================================================
    {
      id: 'hard_streak_30',
      icon: '🗓️',
      points: 1,
      tier: 'hard',
      name: { th: 'หนึ่งเดือนไม่ขาด', en: 'A Full Month' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 30 วันติดต่อกัน', en: 'Use the app on 30 consecutive days' },
      check: function (s) { return s.dayStreak >= 30; }
    },
    {
      id: 'hard_cardbox_500',
      icon: '📦',
      points: 1,
      tier: 'hard',
      name: { th: 'คลังคำมหึมา', en: 'The Massive Stockpile' },
      desc: { th: 'บันทึกคำศัพท์ครบ 500 คำใน Cardbox (ถ้ายังไม่ได้ปลดล็อกเหรียญมังกรอยู่แล้ว)', en: 'Save 500 words to Cardbox' },
      check: function (s) { return s.cardboxTotal >= 500; }
    },
    {
      id: 'hard_mastered_100',
      icon: '💎',
      points: 1,
      tier: 'hard',
      name: { th: 'เพชรแห่งความเชี่ยวชาญ', en: 'Diamond Mastery' },
      desc: { th: 'ทำคำศัพท์ให้ถึงสถานะ "เชี่ยวชาญ" ครบ 100 คำ', en: 'Reach "Mastered" status on 100 words' },
      check: function (s) { return s.masteredCount >= 100; }
    },
    {
      id: 'hard_sessions_100',
      icon: '📈',
      points: 1,
      tier: 'hard',
      name: { th: 'ร้อยครั้งแห่งความเพียร', en: 'A Hundred Sessions' },
      desc: { th: 'ทำ session ทบทวนสำเร็จครบ 100 ครั้ง', en: 'Complete 100 study sessions' },
      check: function (s) { return s.sessionsCompleted >= 100; }
    },
    {
      id: 'hard_marathon_streak_30',
      icon: '⚡',
      points: 1,
      tier: 'hard',
      name: { th: 'ต่อเนื่องสามสิบ', en: 'Thirty in a Row' },
      desc: { th: 'ตอบถูกต่อเนื่อง 30 รอบใน Time Attack Marathon', en: 'Reach a 30-answer streak in Time Attack Marathon' },
      check: function (s) { return s.marathonBestStreak >= 30; }
    },
    {
      id: 'hard_typing_50',
      icon: '⌨️🔥',
      points: 1,
      tier: 'hard',
      name: { th: 'นิ้วเหล็ก', en: 'Iron Fingers' },
      desc: { th: 'จบรอบเกม Typing สะสมครบ 50 รอบ', en: 'Finish 50 rounds of the Typing minigame' },
      check: function (s) { return s.typingRoundsCompleted >= 50; }
    },
    {
      id: 'hard_racks_100',
      icon: '🁡',
      points: 1,
      tier: 'hard',
      name: { th: 'เจ้าแห่ง Rack', en: 'The Rack Overlord' },
      desc: { th: 'หาคำถูกใน Random Racks สะสมครบ 100 คำ', en: 'Find 100 correct words in Random Racks total' },
      check: function (s) { return s.racksCorrectTotal >= 100; }
    },
    {
      id: 'hard_bot_wins_10',
      icon: '🤖',
      points: 1,
      tier: 'hard',
      name: { th: 'ผู้ล้มบอท', en: 'The Bot Toppler' },
      desc: { th: 'ชนะเกม Play Game ที่เล่นกับบอทครบ 10 ครั้ง', en: 'Win 10 games against the bot in Play Game' },
      check: function (s) { return s.botGamesWon >= 10; }
    },
    {
      id: 'hard_odds_200',
      icon: '📊',
      points: 1,
      tier: 'hard',
      name: { th: 'นักสถิติมือใหม่ใจเก๋า', en: 'The Bold Statistician' },
      desc: { th: 'ตอบคำถามใน Odds Trainer สะสมครบ 200 ข้อ', en: 'Answer 200 Odds Trainer questions total' },
      check: function (s) { return s.oddsAnswered >= 200; }
    },
    {
      id: 'hard_alpha_50',
      icon: '🔀🔀',
      points: 1,
      tier: 'hard',
      name: { th: 'เคลียร์ Alphagram สายฟ้า', en: 'Alphagram Speedrunner' },
      desc: { th: 'เคลียร์ชุด Alphagram Blitz สำเร็จสะสมครบ 50 ชุด', en: 'Clear an Alphagram Blitz set 50 times total' },
      check: function (s) { return s.alphaCleared >= 50; }
    },

    // =================================================================
    // 🕵️ SECRET TIER — not shown until unlocked; weird, funny, specific,
    // for people poking at every corner of the app.
    // =================================================================
    {
      id: 'secret_first_cardbox_delete',
      icon: '💔',
      tier: 'secret',
      name: { th: 'ตัดใจ', en: 'Letting Go' },
      desc: { th: 'ลบคำศัพท์ออกจาก Cardbox เป็นครั้งแรก (ไม่เป็นไร บางคำก็ไม่เหมาะกับเรา)', en: 'Delete a word from your Cardbox for the first time (it happens, not every word is meant to be)' },
      check: function (s) { return s.cardboxDeleted >= 1; }
    },
    {
      id: 'secret_cardbox_purge',
      icon: '🔥📦',
      tier: 'secret',
      name: { th: 'ล้างบางคลังคำ', en: 'The Great Purge' },
      desc: { th: 'ลบคำศัพท์ออกจาก Cardbox สะสมครบ 20 คำ', en: 'Delete 20 words from your Cardbox over time' },
      check: function (s) { return s.cardboxDeleted >= 20; }
    },
    {
      id: 'secret_all_practice_modes',
      icon: '🗺️',
      tier: 'secret',
      name: { th: 'นักสำรวจตัวยง', en: 'The Thorough Explorer' },
      desc: { th: 'เปิดโหมดฝึกซ้อมขั้นสูงครบทุกโหมด (Odds, Vowel Dump, Rack Balance, Endgame, Parallel)', en: 'Open every advanced practice mode at least once (Odds, Vowel Dump, Rack Balance, Endgame, Parallel)' },
      check: function (s) { return !!s.hasUsedAllPracticeModes; }
    },
    {
      id: 'secret_odds_zero',
      icon: '😅',
      tier: 'secret',
      name: { th: 'ยังไม่ค่อยรู้เรื่องน่ะ', en: 'Still Working On It' },
      desc: { th: 'ตอบผิด 10 ข้อติดกันใน Odds Trainer (ไม่เป็นไร คณิตศาสตร์ก็ยากอยู่แล้ว)', en: 'Answer 10 Odds Trainer questions wrong in a row (hey, hypergeometric math is hard)' },
      check: function (s) { return s.oddsAnswered >= 10 && s.oddsCorrectStreak === 0 && (s.oddsAnswered - s.oddsCorrect) >= 10; }
    },
    {
      id: 'secret_vowel_dump_master',
      icon: '🍇',
      tier: 'secret',
      name: { th: 'สายกลางแห่งสระ', en: 'The Vowel Middle Path' },
      desc: { th: 'ตรวจคำตอบใน Vowel Dump Practice จนได้ผลลัพธ์ "สมดุลดี" ครบ 20 ครั้ง', en: 'Land in the "balanced" band 20 times in Vowel Dump Practice' },
      check: function (s) { return s.vowelDumpBalanced >= 20; }
    },
    {
      id: 'secret_rack_balance_hard_letters',
      icon: '🐫🐫',
      tier: 'secret',
      name: { th: 'เพื่อนซี้ตัวยาก', en: 'Friends With the Hard Letters' },
      desc: { th: 'สุ่มมือใน Rack Balance Analyzer ที่มีตัวยาก (J/Q/X/Z) ครบ 25 ครั้ง', en: 'Draw a rack containing a J/Q/X/Z in Rack Balance Analyzer 25 times' },
      check: function (s) { return s.rackBalanceHardLetterViews >= 25; }
    },
    {
      id: 'secret_endgame_curious',
      icon: '🔎',
      tier: 'secret',
      name: { th: 'ช่างสงสัยตอนจบเกม', en: 'The Endgame Detective' },
      desc: { th: 'เปิดดูคำตอบใน Endgame Trainer สะสมครบ 30 ครั้ง', en: 'Reveal an Endgame Trainer answer 30 times total' },
      check: function (s) { return s.endgameRevealed >= 30; }
    },
    {
      id: 'secret_parallel_fan',
      icon: '🧵',
      tier: 'secret',
      name: { th: 'สายเลี้ยว Parallel', en: 'The Parallel Enthusiast' },
      desc: { th: 'เปิดดูสถานการณ์ใน Parallel Play Finder สะสมครบ 30 ครั้ง', en: 'View a Parallel Play Finder scenario 30 times total' },
      check: function (s) { return s.parallelViews >= 30; }
    },
    {
      id: 'secret_bot_loss_streak',
      icon: '😢🤖',
      tier: 'secret',
      name: { th: 'บอทตัวนี้โหดจัง', en: 'This Bot Is Brutal' },
      desc: { th: 'เล่น Play Game จบเกมครบ 10 ครั้ง โดยยังไม่เคยชนะบอทเลยสักครั้ง', en: 'Finish 10 games in Play Game without a single win yet' },
      check: function (s) { return s.botGamesPlayed >= 10 && s.botGamesWon === 0; }
    },
    {
      id: 'secret_bot_big_move',
      icon: '💥',
      tier: 'secret',
      name: { th: 'แต้มมหาศาล', en: 'The Massive Play' },
      desc: { th: 'ทำแต้มจากคำเดียวได้ตั้งแต่ 100 แต้มขึ้นไปในเกม Play Game', en: 'Score 100+ points from a single word in Play Game' },
      check: function (s) { return s.botHighestScoringMove >= 100; }
    },
    {
      id: 'secret_marathon_zero',
      icon: '🫠',
      tier: 'secret',
      name: { th: 'เริ่มใหม่ก็ไม่เป็นไร', en: 'A Rough Start' },
      desc: { th: 'จบ Time Attack Marathon โดยตอบถูก 0 คำ (ครั้งหน้าดีขึ้นแน่นอน)', en: 'End a Time Attack Marathon session with 0 correct answers (next time will be better)' },
      check: function (s) { return s.marathonAbandonedZero >= 1; }
    },
    {
      id: 'secret_one_card_session',
      icon: '🃏',
      tier: 'secret',
      name: { th: 'ขอแค่คำเดียวพอ', en: 'Just One Card' },
      desc: { th: 'ทำ session ทบทวนสำเร็จโดยมีคำศัพท์แค่ 1 คำ', en: 'Complete a study session with exactly 1 card' },
      check: function (s) { return s.sessionsAtExactly1 >= 1; }
    },
    {
      id: 'secret_exporter',
      icon: '💾',
      tier: 'secret',
      name: { th: 'มือใหม่หัดสำรอง', en: 'The Backup Beginner' },
      desc: { th: 'ส่งออกความคืบหน้าเป็นไฟล์สำรองครั้งแรก', en: 'Export your progress to a backup file for the first time' },
      check: function (s) { return s.exportCount >= 1; }
    },
    {
      id: 'secret_backup_paranoid',
      icon: '💾💾💾',
      tier: 'secret',
      name: { th: 'ระแวงไฟล์หาย', en: 'Backup Paranoia' },
      desc: { th: 'ส่งออกความคืบหน้าเป็นไฟล์สำรองสะสมครบ 10 ครั้ง', en: 'Export your progress to a backup file 10 times total' },
      check: function (s) { return s.exportCount >= 10; }
    },
    {
      id: 'secret_importer',
      icon: '📥',
      tier: 'secret',
      name: { th: 'นำเข้าข้อมูล', en: 'The Data Importer' },
      desc: { th: 'นำเข้าไฟล์ความคืบหน้าที่เคยส่งออกไว้', en: 'Import a previously exported progress file' },
      check: function (s) { return s.importCount >= 1; }
    },
    {
      id: 'secret_settings_tinkerer',
      icon: '🛠️',
      tier: 'secret',
      name: { th: 'ช่างปรับแต่ง', en: 'The Tinkerer' },
      desc: { th: 'เปลี่ยนการตั้งค่าแอปสะสมครบ 20 ครั้ง', en: 'Change app settings 20 times total' },
      check: function (s) { return s.settingsChanged >= 20; }
    },
    {
      id: 'secret_long_word_anagram',
      icon: '🐍',
      tier: 'secret',
      name: { th: 'งูยักษ์แห่งคำศัพท์', en: 'The Word Serpent' },
      desc: { th: 'เปิดดู Anagram ของคำที่ยาวตั้งแต่ 12 ตัวอักษรขึ้นไป', en: 'View the Anagram of a word 12 or more letters long' },
      check: function (s) { return s.anagramLongestWord >= 12; }
    },
    {
      id: 'secret_typing_clean_10',
      icon: '🧼',
      tier: 'secret',
      name: { th: 'สะอาดหมดจด', en: 'Squeaky Clean' },
      desc: { th: 'จบรอบเกม Typing โดยไม่พิมพ์ผิดเลยสักครั้ง สะสมครบ 10 รอบ', en: 'Finish a Typing round with zero mistakes, 10 times total' },
      check: function (s) { return s.typingCleanRounds >= 10; }
    },
    {
      id: 'secret_typo_100',
      icon: '🤦‍♂️🤦‍♀️',
      tier: 'secret',
      name: { th: 'มือสั่นระดับตำนาน', en: 'Legendary Shaky Hands' },
      desc: { th: 'พิมพ์ผิดสะสมครบ 100 ครั้งในเกม Typing (เหรียญนี้ก็ยังไม่ได้ภูมิใจอยู่ดี)', en: 'Rack up 100 lifetime mistakes in the Typing minigame (still not something to brag about)' },
      check: function (s) { return s.typingMistakesTotal >= 100; }
    },
    {
      id: 'secret_streak_2',
      icon: '🌱🔥',
      tier: 'secret',
      name: { th: 'เริ่มก่อไฟ', en: 'Spark of a Streak' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 2 วัน (จุดเริ่มต้นของทุกสตรีค)', en: 'Use the app on 2 consecutive days (every streak starts somewhere)' },
      check: function (s) { return s.dayStreak >= 2; }
    },
    {
      id: 'secret_app_opens_50',
      icon: '🚪',
      tier: 'secret',
      name: { th: 'ขาประจำ', en: 'The Regular' },
      desc: { th: 'เปิดแอปสะสมครบ 50 ครั้ง', en: 'Open the app 50 times total' },
      check: function (s) { return s.appOpenCount >= 50; }
    },
    {
      id: 'secret_qi_hunter',
      icon: '🐪🐪',
      tier: 'secret',
      name: { th: 'นักล่า Q ตัวจริง', en: 'The True Q Hunter' },
      desc: { th: 'บันทึกคำที่มี Q แต่ไม่มี U ลง Cardbox ตั้งแต่ 2 คำที่ต่างกันขึ้นไป', en: 'Save 2 or more different words with Q but no U to Cardbox' },
      check: function (s) { return s._qNoUCount >= 2; }
    },
    {
      id: 'secret_completionist_hard',
      icon: '🏆',
      tier: 'secret',
      name: { th: 'ครบทุกด่านสายฮาร์ด', en: 'Hard-Tier Completionist' },
      desc: { th: 'ปลดล็อกเหรียญในระดับ "ยาก" ครบทุกอัน', en: 'Unlock every badge in the Hard tier' },
      check: function (s) { return s._hardTierComplete === true; }
    },
    {
      id: 'secret_near_impossible_complete',
      icon: '🥇',
      tier: 'secret',
      name: { th: 'แตะขอบฟ้า', en: 'Touching the Horizon' },
      desc: { th: 'ปลดล็อกเหรียญในระดับ "โคตรยาก" ครบทุกอัน', en: 'Unlock every badge in the Near-Impossible tier' },
      check: function (s) { return s._nearImpossibleComplete === true; }
    },
    {
      id: 'secret_night_and_early',
      icon: '🦉🐓',
      tier: 'secret',
      name: { th: 'ไม่หลับไม่นอน', en: 'Neither Sleeps Nor Wakes' },
      desc: { th: 'ปลดล็อกทั้ง "นกฮูกยามดึก" และ "นกตื่นเช้า" ในบัญชีเดียวกัน', en: 'Unlock both "Night Owl" and "Early Bird" on the same account' },
      check: function (s) { return !!s.hasNightOwlPlay && !!s.hasEarlyBirdPlay; }
    },
    {
      id: 'secret_first_odds_streak_5',
      icon: '🔥🎲',
      tier: 'secret',
      name: { th: 'เริ่มมั่นใจ', en: 'Finding Confidence' },
      desc: { th: 'ตอบถูกต่อเนื่อง 5 ข้อใน Odds Trainer เป็นครั้งแรก', en: 'Reach a 5-answer correct streak in Odds Trainer for the first time' },
      check: function (s) { return s.oddsBestStreak >= 5; }
    },
    {
      id: 'secret_pangram_hoarder',
      icon: '🌈🌈',
      tier: 'secret',
      name: { th: 'นักสะสมสายรุ้ง', en: 'The Rainbow Collector' },
      desc: { th: 'บันทึกคำยาว 7 ตัวขึ้นไปที่ไม่มีตัวอักษรซ้ำเลยสักตัว ลง Cardbox ตั้งแต่ 5 คำขึ้นไป', en: 'Save 5 or more different 7+ letter words with no repeated letters to Cardbox' },
      check: function (s) { return s._pangramCount >= 5; }
    },
    {
      id: 'secret_racks_1',
      icon: '🁠',
      tier: 'secret',
      name: { th: 'คำแรกจาก Rack', en: 'First Rack Find' },
      desc: { th: 'หาคำถูกใน Random Racks เป็นคำแรก', en: 'Find your first correct word in Random Racks' },
      check: function (s) { return s.racksCorrectTotal >= 1; }
    },
    {
      id: 'secret_tab_visited_settings',
      icon: '⚙️',
      tier: 'secret',
      name: { th: 'แอบดูการตั้งค่า', en: 'A Peek at Settings' },
      desc: { th: 'เปิดแท็บ Settings เป็นครั้งแรก', en: 'Open the Settings tab for the first time' },
      check: function (s) { return !!(s.tabsVisited && s.tabsVisited.settings); }
    },
    {
      id: 'secret_browse_wanderer',
      icon: '🧭',
      tier: 'secret',
      name: { th: 'นักเดินทางไร้จุดหมาย', en: 'The Aimless Wanderer' },
      desc: { th: 'เปิดแท็บ Browse เป็นครั้งแรก', en: 'Open the Browse tab for the first time' },
      check: function (s) { return !!(s.tabsVisited && s.tabsVisited.browse); }
    },
    {
      id: 'secret_perfect_and_clean',
      icon: '💯💨',
      tier: 'secret',
      name: { th: 'ทั้งเป๊ะทั้งไว', en: 'Flawless and Fast' },
      desc: { th: 'ปลดล็อกทั้ง "สมบูรณ์แบบครั้งแรก" และ "สะอาดครั้งแรก" ในบัญชีเดียวกัน', en: 'Unlock both "First Perfect Round" and "First Clean Round" on the same account' },
      check: function (s) { return s.perfectSessionCount >= 1 && s.typingCleanRounds >= 1; }
    },
    {
      id: 'secret_marathon_after_zero',
      icon: '🐦‍🔥',
      tier: 'secret',
      name: { th: 'ฟีนิกซ์คืนชีพ', en: 'The Phoenix Rises' },
      desc: { th: 'จบ Time Attack Marathon ด้วยสตรีค 20+ หลังจากเคยจบด้วย 0 คำถูกมาก่อน', en: 'Finish a marathon with a 20+ streak after once finishing one with 0 correct' },
      check: function (s) { return s.marathonAbandonedZero >= 1 && s.marathonBestStreak >= 20; }
    },
    {
      id: 'secret_typo_champion_path',
      icon: '⌨️🎯',
      tier: 'secret',
      name: { th: 'จากผิดสู่ถูก', en: 'From Mistakes to Mastery' },
      desc: { th: 'จบรอบเกม Typing สะสมครบ 20 รอบ (ไม่ว่าจะพิมพ์ผิดกี่ครั้งก็ตาม ทุกรอบคือการฝึกฝน)', en: 'Finish 20 rounds of the Typing minigame total (every round counts, mistakes included)' },
      check: function (s) { return s.typingRoundsCompleted >= 20; }
    },
    {
      id: 'secret_hundred_percent',
      icon: '🎊',
      tier: 'secret',
      name: { th: 'ครบร้อย!', en: 'A Hundred Percent!' },
      desc: { th: 'ปลดล็อกเหรียญความสำเร็จครบทุกอันในเกม รวมถึงเหรียญลับทั้งหมด', en: 'Unlock every single achievement in the game, secrets included' },
      check: function (s) { return s._allOtherUnlocked === true; }
    },
    {
      id: 'secret_due_date_fiddler',
      icon: '📅✏️',
      tier: 'secret',
      name: { th: 'นักเลื่อนกำหนดส่ง', en: 'The Due-Date Fiddler' },
      desc: { th: 'แก้ไขวันครบกำหนดทบทวนของคำศัพท์ด้วยตัวเองสะสมครบ 15 ครั้ง', en: 'Manually edit a word\'s review due date 15 times total' },
      check: function (s) { return s.cardboxEditCount >= 15; }
    },
    {
      id: 'secret_rack_balance_curious',
      icon: '🁢',
      tier: 'secret',
      name: { th: 'ช่างสำรวจมือไพ่', en: 'The Rack Curious' },
      desc: { th: 'สุ่มมือใน Rack Balance Analyzer สะสมครบ 50 ครั้ง', en: 'Draw a rack in Rack Balance Analyzer 50 times total' },
      check: function (s) { return s.rackBalanceViews >= 50; }
    },
    {
      id: 'secret_importer_loyal',
      icon: '📥📥',
      tier: 'secret',
      name: { th: 'นำเข้าซ้ำแล้วซ้ำเล่า', en: 'The Repeat Importer' },
      desc: { th: 'นำเข้าไฟล์ความคืบหน้าสะสมครบ 5 ครั้ง', en: 'Import a progress file 5 times total' },
      check: function (s) { return s.importCount >= 5; }
    },
    {
      id: 'secret_odds_first_try',
      icon: '🎯',
      tier: 'secret',
      name: { th: 'มือใหม่แต่ใจนิ่ง', en: 'Beginner\'s Nerve' },
      desc: { th: 'ตอบถูกข้อแรกที่ทำใน Odds Trainer', en: 'Get your very first Odds Trainer question correct' },
      check: function (s) { return s.oddsAnswered === 1 && s.oddsCorrect === 1; }
    },
    {
      id: 'secret_marathon_first',
      icon: '🏁',
      tier: 'secret',
      name: { th: 'เข้าเส้นชัยครั้งแรก', en: 'First Finish Line' },
      desc: { th: 'เล่น Time Attack Marathon จนจบเป็นครั้งแรก', en: 'Complete a Time Attack Marathon session for the first time' },
      check: function (s) { return s.marathonCompleted >= 1; }
    },
    {
      id: 'secret_alpha_first_clear',
      icon: '🔀',
      tier: 'secret',
      name: { th: 'เคลียร์ชุดแรก', en: 'First Clear' },
      desc: { th: 'เคลียร์ชุด Alphagram Blitz สำเร็จเป็นครั้งแรก', en: 'Clear an Alphagram Blitz set for the first time' },
      check: function (s) { return s.alphaCleared >= 1; }
    },
    {
      id: 'secret_word_length_9',
      icon: '🪱',
      tier: 'secret',
      name: { th: 'หนอนยักษ์คำศัพท์', en: 'The Word Worm' },
      desc: { th: 'เปิดดู Anagram ของคำที่ยาวตั้งแต่ 9 ตัวอักษรขึ้นไป', en: 'View the Anagram of a word 9 or more letters long' },
      check: function (s) { return s.anagramLongestWord >= 9; }
    },
    {
      id: 'secret_leech_fighter',
      icon: '🐛⚔️',
      tier: 'secret',
      name: { th: 'นักสู้กับปลิง', en: 'The Leech Fighter' },
      desc: { th: 'มีคำศัพท์ที่ติดสถานะ "Leech" อยู่ใน Cardbox อย่างน้อย 5 คำในเวลาเดียวกัน', en: 'Have at least 5 words marked as "Leech" in your Cardbox at once' },
      check: function (s) { return s.leechCount >= 5; }
    },
    {
      id: 'secret_first_perfect',
      icon: '✨',
      tier: 'secret',
      name: { th: 'สมบูรณ์แบบครั้งแรก', en: 'First Perfect Round' },
      desc: { th: 'ทำ session ทบทวนสำเร็จแบบถูกทั้งหมดเป็นครั้งแรก', en: 'Complete a study session with a perfect score for the first time' },
      check: function (s) { return s.perfectSessionCount >= 1; }
    },
    {
      id: 'secret_perfect_10',
      icon: '✨✨',
      tier: 'secret',
      name: { th: 'สมบูรณ์แบบสิบครั้ง', en: 'Ten Perfect Rounds' },
      desc: { th: 'ทำ session ทบทวนสำเร็จแบบถูกทั้งหมดสะสมครบ 10 ครั้ง', en: 'Complete a perfect-score study session 10 times total' },
      check: function (s) { return s.perfectSessionCount >= 10; }
    },
    {
      id: 'secret_racks_25',
      icon: '🁡🁡',
      tier: 'secret',
      name: { th: 'มือคุ้นเคยกับ Rack', en: 'Getting Rack-Savvy' },
      desc: { th: 'หาคำถูกใน Random Racks สะสมครบ 25 คำ', en: 'Find 25 correct words in Random Racks total' },
      check: function (s) { return s.racksCorrectTotal >= 25; }
    },
    {
      id: 'secret_bot_first_win',
      icon: '🤖🎉',
      tier: 'secret',
      name: { th: 'ชนะบอทครั้งแรก', en: 'First Bot Victory' },
      desc: { th: 'ชนะเกม Play Game ที่เล่นกับบอทเป็นครั้งแรก', en: 'Win your first game against the bot in Play Game' },
      check: function (s) { return s.botGamesWon >= 1; }
    },
    {
      id: 'secret_typing_mistake_free_first',
      icon: '🧼✨',
      tier: 'secret',
      name: { th: 'สะอาดครั้งแรก', en: 'First Clean Round' },
      desc: { th: 'จบรอบเกม Typing โดยไม่พิมพ์ผิดเลยเป็นครั้งแรก', en: 'Finish a Typing round with zero mistakes for the first time' },
      check: function (s) { return s.typingCleanRounds >= 1; }
    },
    {
      id: 'secret_streak_14',
      icon: '🔥🔥',
      tier: 'secret',
      name: { th: 'สองสัปดาห์ไม่ขาด', en: 'Two Weeks Solid' },
      desc: { th: 'เข้ามาทบทวน/เล่นต่อเนื่อง 14 วันติดต่อกัน', en: 'Use the app on 14 consecutive days' },
      check: function (s) { return s.dayStreak >= 14; }
    }
  ];

  const BADGES_BY_ID = {};
  BADGES.forEach(function (b) { BADGES_BY_ID[b.id] = b; });

  global.CSW24_BADGES = BADGES;
  global.CSW24_BADGES_BY_ID = BADGES_BY_ID;
})(window);
