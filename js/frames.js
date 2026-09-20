/* =========================================================
   CSW24 Word Lab — avatar frame definitions
   Pure data + pure check functions, mirrors badges.js.
   Loaded after achievement.js + badges.js (some checks read
   CSW24_BADGES_BY_ID / unlocked-badges state via stats).

   Each frame:
     id       unique string, used as storage key
     name     {th, en}
     desc     {th, en} — how to unlock it (shown in the picker)
     method   'default' | 'stat' | 'badge' | 'tier' | 'date' | 'secret' | 'custom'
     ring     CSS value for the frame ring (border-image / gradient / solid)
     glow     optional box-shadow color for the ring's outer glow
     motion   optional keyframe name (declared in frames-ui.js) for animated frames
     check(stats, ctx) -> boolean
              stats: the Achievements aggregate object
              ctx.unlockedBadges: { [badgeId]: timestamp }
              ctx.now: Date, evaluated at check-time (for 'date' frames)
   ========================================================= */

(function (global) {
  'use strict';

  function hasBadge(ctx, id) { return !!(ctx.unlockedBadges && ctx.unlockedBadges[id]); }
  function tierDone(ctx, tierName) {
    const all = global.CSW24_BADGES || [];
    const tierBadges = all.filter(function (b) { return b.tier === tierName; });
    return tierBadges.length > 0 && tierBadges.every(function (b) { return hasBadge(ctx, b.id); });
  }
  function inDateWindow(now, fromMD, toMD) {
    // fromMD/toMD are [month(1-12), day] — inclusive, same-year window.
    const m = now.getMonth() + 1, d = now.getDate();
    const cur = m * 100 + d, from = fromMD[0] * 100 + fromMD[1], to = toMD[0] * 100 + toMD[1];
    return cur >= from && cur <= to;
  }

  const FRAMES = [
    // ---------- default (always available) ----------
    {
      id: 'frame_none',
      name: { th: 'ไม่มีกรอบ', en: 'No Frame' },
      desc: { th: 'ค่าเริ่มต้น — ไม่มีกรอบรอบรูปโปรไฟล์', en: 'Default — no ring around the avatar' },
      method: 'default',
      ring: 'transparent',
      check: function () { return true; }
    },

    // ---------- stat-based: Cardbox / vocabulary size ----------
    {
      id: 'frame_sprout',
      name: { th: 'หน่ออ่อน', en: 'Sprout' },
      desc: { th: 'บันทึกคำศัพท์คำแรกลง Cardbox', en: 'Save your first word to Cardbox' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #86efac, #22c55e)',
      check: function (s) { return s.cardboxTotal >= 1; }
    },
    {
      id: 'frame_collector',
      name: { th: 'นักสะสม', en: 'Collector' },
      desc: { th: 'บันทึกคำศัพท์ครบ 50 คำใน Cardbox', en: 'Save 50 words to Cardbox' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
      check: function (s) { return s.cardboxTotal >= 50; }
    },
    {
      id: 'frame_archivist',
      name: { th: 'บรรณารักษ์', en: 'Archivist' },
      desc: { th: 'บันทึกคำศัพท์ครบ 200 คำใน Cardbox', en: 'Save 200 words to Cardbox' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #c4b5fd, #7c3aed)',
      glow: 'rgba(124,58,237,.45)',
      check: function (s) { return s.cardboxTotal >= 200; }
    },
    {
      id: 'frame_lexicon_lord',
      name: { th: 'เจ้าแห่งพจนานุกรม', en: 'Lexicon Lord' },
      desc: { th: 'บันทึกคำศัพท์ครบ 500 คำใน Cardbox', en: 'Save 500 words to Cardbox' },
      method: 'stat',
      ring: 'conic-gradient(from 0deg, #fbbf24, #f59e0b, #fbbf24)',
      glow: 'rgba(245,158,11,.5)',
      motion: 'frameSpin',
      check: function (s) { return s.cardboxTotal >= 500; }
    },

    // ---------- stat-based: mastery ----------
    {
      id: 'frame_first_star',
      name: { th: 'ดาวดวงแรก', en: 'First Star' },
      desc: { th: 'ทำคำศัพท์ให้ "เชี่ยวชาญ" คำแรก', en: 'Reach "Mastered" on your first word' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fde68a, #f59e0b)',
      check: function (s) { return s.masteredCount >= 1; }
    },
    {
      id: 'frame_word_master',
      name: { th: 'ปรมาจารย์คำศัพท์', en: 'Word Master' },
      desc: { th: 'ทำคำศัพท์ให้ "เชี่ยวชาญ" ครบ 25 คำ', en: 'Reach "Mastered" on 25 words' },
      method: 'stat',
      ring: 'conic-gradient(from 90deg, #fde68a, #f59e0b, #fde68a)',
      glow: 'rgba(245,158,11,.4)',
      check: function (s) { return s.masteredCount >= 25; }
    },
    {
      id: 'frame_perfectionist',
      name: { th: 'สมบูรณ์แบบ', en: 'Perfectionist' },
      desc: { th: 'ทบทวนถูกทั้งหมดใน 1 session (5+ คำ)', en: 'Answer every card right in one session (5+ cards)' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #f9a8d4, #ec4899)',
      check: function (s) { return !!s.hasPerfectSession; }
    },

    // ---------- stat-based: streak / consistency ----------
    {
      id: 'frame_streak_3',
      name: { th: 'ไฟติดแล้ว', en: 'Spark' },
      desc: { th: 'เข้าใช้งานต่อเนื่อง 3 วัน', en: 'Use the app 3 days in a row' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fca5a5, #ef4444)',
      check: function (s) { return s.dayStreak >= 3; }
    },
    {
      id: 'frame_streak_7',
      name: { th: 'หนึ่งสัปดาห์เต็ม', en: 'Full Week' },
      desc: { th: 'เข้าใช้งานต่อเนื่อง 7 วัน', en: 'Use the app 7 days in a row' },
      method: 'stat',
      ring: 'conic-gradient(from 180deg, #fca5a5, #ef4444, #fca5a5)',
      motion: 'framePulse',
      check: function (s) { return s.dayStreak >= 7; }
    },
    {
      id: 'frame_streak_30',
      name: { th: 'เดือนแห่งไฟ', en: 'Month on Fire' },
      desc: { th: 'เข้าใช้งานต่อเนื่อง 30 วัน', en: 'Use the app 30 days in a row' },
      method: 'stat',
      ring: 'conic-gradient(from 0deg, #fde047, #f97316, #ef4444, #f97316, #fde047)',
      glow: 'rgba(249,115,22,.55)',
      motion: 'frameSpin',
      check: function (s) { return s.dayStreak >= 30; }
    },
    {
      id: 'frame_night_owl',
      name: { th: 'นกฮูกราตรี', en: 'Night Owl' },
      desc: { th: 'เล่น/ทบทวนช่วงตี 2–5', en: 'Study between 2–5 AM' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #1e3a8a, #4338ca)',
      glow: 'rgba(67,56,202,.4)',
      check: function (s) { return !!s.hasNightOwlPlay; }
    },
    {
      id: 'frame_early_bird',
      name: { th: 'นกตื่นเช้า', en: 'Early Bird' },
      desc: { th: 'เล่น/ทบทวนช่วงตี 5–6', en: 'Study between 5–6 AM' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fde68a, #fb923c)',
      check: function (s) { return !!s.hasEarlyBirdPlay; }
    },

    // ---------- stat-based: sessions / practice volume ----------
    {
      id: 'frame_reviewer',
      name: { th: 'นักทบทวน', en: 'Reviewer' },
      desc: { th: 'ทำ session ทบทวนสำเร็จครบ 10 ครั้ง', en: 'Complete 10 study sessions' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #a7f3d0, #10b981)',
      check: function (s) { return s.sessionsCompleted >= 10; }
    },
    {
      id: 'frame_devoted',
      name: { th: 'ผู้ทุ่มเท', en: 'Devoted' },
      desc: { th: 'ทำ session ทบทวนสำเร็จครบ 50 ครั้ง', en: 'Complete 50 study sessions' },
      method: 'stat',
      ring: 'conic-gradient(from 45deg, #a7f3d0, #10b981, #a7f3d0)',
      glow: 'rgba(16,185,129,.4)',
      check: function (s) { return s.sessionsCompleted >= 50; }
    },
    {
      id: 'frame_all_rounder',
      name: { th: 'สายรอบด้าน', en: 'All-Rounder' },
      desc: { th: 'ใช้งานโหมดฝึกครบทุกโหมดอย่างน้อยคนละ 1 ครั้ง', en: 'Try every practice mode at least once' },
      method: 'stat',
      ring: 'conic-gradient(from 0deg, #7c9eff, #4ade9c, #7c9eff)',
      check: function (s) { return !!s.hasUsedAllPracticeModes; }
    },

    // ---------- stat-based: minigames ----------
    {
      id: 'frame_typist',
      name: { th: 'นักพิมพ์เร็ว', en: 'Speed Typist' },
      desc: { th: 'ชนะเกม Typing ครั้งแรก', en: 'Win the Typing minigame for the first time' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #bae6fd, #0ea5e9)',
      check: function (s) { return s.typingWins >= 1; }
    },
    {
      id: 'frame_clean_hands',
      name: { th: 'มือสะอาด', en: 'Clean Hands' },
      desc: { th: 'จบรอบ Typing โดยไม่พิมพ์ผิดเลย', en: 'Finish a Typing round with zero mistakes' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
      check: function (s) { return s.typingCleanRounds >= 1; }
    },
    {
      id: 'frame_odds_savant',
      name: { th: 'ผู้เชี่ยวชาญโอกาส', en: 'Odds Savant' },
      desc: { th: 'ตอบถูกต่อเนื่อง 10 ข้อใน Odds Trainer', en: 'Get a 10-answer correct streak in Odds Trainer' },
      method: 'stat',
      ring: 'conic-gradient(from 270deg, #ddd6fe, #8b5cf6, #ddd6fe)',
      check: function (s) { return s.oddsBestStreak >= 10; }
    },
    {
      id: 'frame_rack_tactician',
      name: { th: 'นักวางแผน Rack', en: 'Rack Tactician' },
      desc: { th: 'หาคำถูกใน Random Racks สะสมครบ 25 คำ', en: 'Find 25 correct words in Random Racks total' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fed7aa, #ea580c)',
      check: function (s) { return s.racksCorrectTotal >= 25; }
    },
    {
      id: 'frame_bot_slayer',
      name: { th: 'ผู้ปราบบอท', en: 'Bot Slayer' },
      desc: { th: 'ชนะเกม Play Game ที่เล่นกับบอทครั้งแรก', en: 'Win your first game against the bot' },
      method: 'stat',
      ring: 'conic-gradient(from 135deg, #94a3b8, #334155, #94a3b8)',
      glow: 'rgba(51,65,85,.5)',
      check: function (s) { return s.botGamesWon >= 1; }
    },
    {
      id: 'frame_grandmaster_bot',
      name: { th: 'ปรมาจารย์เกมกระดาน', en: 'Board Grandmaster' },
      desc: { th: 'ชนะบอทสะสมครบ 20 เกม', en: 'Win 20 games against the bot' },
      method: 'stat',
      ring: 'conic-gradient(from 0deg, #1e1b4b, #4338ca, #7c3aed, #4338ca, #1e1b4b)',
      glow: 'rgba(124,58,237,.55)',
      motion: 'frameSpin',
      check: function (s) { return s.botGamesWon >= 20; }
    },
    {
      id: 'frame_marathon_runner',
      name: { th: 'นักวิ่งมาราธอน', en: 'Marathon Runner' },
      desc: { th: 'จบ Marathon Mode สำเร็จ 5 ครั้ง', en: 'Complete Marathon Mode 5 times' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fbcfe8, #db2777)',
      check: function (s) { return s.marathonCompleted >= 5; }
    },
    {
      id: 'frame_endgame_scholar',
      name: { th: 'นักวิชาการปลายเกม', en: 'Endgame Scholar' },
      desc: { th: 'เปิดดูเฉลย Endgame Trainer ครบ 30 ครั้ง', en: 'Reveal 30 Endgame Trainer answers' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #cbd5e1, #475569)',
      check: function (s) { return s.endgameRevealed >= 30; }
    },
    {
      id: 'frame_vowel_balancer',
      name: { th: 'นักปรับสมดุลสระ', en: 'Vowel Balancer' },
      desc: { th: 'ทำ Vowel Dump Practice จนได้ผลลัพธ์ "สมดุล" ครบ 10 ครั้ง', en: 'Land "balanced" in Vowel Dump Practice 10 times' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #99f6e4, #14b8a6)',
      check: function (s) { return s.vowelDumpBalanced >= 10; }
    },

    // ---------- stat-based: exploration / misc ----------
    {
      id: 'frame_anagram_adept',
      name: { th: 'นักไข Anagram', en: 'Anagram Adept' },
      desc: { th: 'เปิดดู Anagram ครบ 10 ครั้ง', en: 'View Anagrams 10 times' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fef08a, #ca8a04)',
      check: function (s) { return s.anagramViews >= 10; }
    },
    {
      id: 'frame_pangram_hunter',
      name: { th: 'นักล่า Pangram', en: 'Pangram Hunter' },
      desc: { th: 'มีคำ 7+ ตัวอักษรไม่ซ้ำกันใน Cardbox', en: 'Have a 7+ letter word with all-distinct letters in Cardbox' },
      method: 'stat',
      ring: 'conic-gradient(from 45deg, #a5f3fc, #06b6d4, #a5f3fc)',
      check: function (s) { return !!s.hasPangramWord; }
    },
    {
      id: 'frame_q_no_u',
      name: { th: 'Q ไร้ U', en: 'Q Without U' },
      desc: { th: 'มีคำที่มี Q แต่ไม่มี U ใน Cardbox', en: 'Have a word with Q but no U in Cardbox' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #fecaca, #b91c1c)',
      check: function (s) { return !!s.hasQNoU; }
    },
    {
      id: 'frame_explorer',
      name: { th: 'นักสำรวจ', en: 'Explorer' },
      desc: { th: 'เปิดใช้งานทุกแท็บในแอปอย่างน้อยคนละ 1 ครั้ง', en: 'Open every tab in the app at least once' },
      method: 'stat',
      ring: 'conic-gradient(from 200deg, #bbf7d0, #4ade9c, #bbf7d0)',
      check: function (s) { return Object.keys(s.tabsVisited || {}).length >= 8; }
    },
    {
      id: 'frame_curator',
      name: { th: 'ภัณฑารักษ์', en: 'Curator' },
      desc: { th: 'ส่งออก (Export) ข้อมูลอย่างน้อย 3 ครั้ง', en: 'Export your data at least 3 times' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #ddd6fe, #6d28d9)',
      check: function (s) { return s.exportCount >= 3; }
    },
    {
      id: 'frame_veteran',
      name: { th: 'ผู้ช่ำชอง', en: 'Veteran' },
      desc: { th: 'เปิดแอปสะสมครบ 100 ครั้ง', en: 'Open the app 100 times' },
      method: 'stat',
      ring: 'conic-gradient(from 90deg, #fed7aa, #c2410c, #fed7aa)',
      glow: 'rgba(194,65,12,.4)',
      check: function (s) { return s.appOpenCount >= 100; }
    },

    // ---------- badge-based (tied to a specific existing badge) ----------
    {
      id: 'frame_first_step_echo',
      name: { th: 'เสียงสะท้อนก้าวแรก', en: 'Echo of the First Step' },
      desc: { th: 'ปลดล็อค badge "ก้าวแรก"', en: 'Unlock the "First Step" badge' },
      method: 'badge',
      ring: 'linear-gradient(135deg, #d9f99d, #65a30d)',
      check: function (s, ctx) { return hasBadge(ctx, 'first_word'); }
    },
    {
      id: 'frame_completionist_aura',
      name: { th: 'ออร่านักสะสมครบ', en: 'Completionist Aura' },
      desc: { th: 'ปลดล็อค badge "the_completionist"', en: 'Unlock "The Completionist" badge' },
      method: 'badge',
      ring: 'conic-gradient(from 0deg, #fef9c3, #eab308, #fef9c3)',
      glow: 'rgba(234,179,8,.5)',
      motion: 'frameSpin',
      check: function (s, ctx) { return hasBadge(ctx, 'the_completionist'); }
    },

    // ---------- tier-based (whole difficulty tier cleared) ----------
    {
      id: 'frame_hard_tier',
      name: { th: 'ผู้พิชิตระดับยาก', en: 'Hard-Tier Conqueror' },
      desc: { th: 'ปลดล็อค badge ครบทุกอันในระดับ "ยาก"', en: 'Unlock every badge in the "Hard" tier' },
      method: 'tier',
      ring: 'conic-gradient(from 0deg, #fecaca, #dc2626, #fecaca)',
      glow: 'rgba(220,38,38,.5)',
      check: function (s, ctx) { return tierDone(ctx, 'hard'); }
    },
    {
      id: 'frame_near_impossible',
      name: { th: 'เหนือขีดจำกัด', en: 'Beyond the Limit' },
      desc: { th: 'ปลดล็อค badge ครบทุกอันในระดับ "แทบเป็นไปไม่ได้"', en: 'Unlock every badge in the "Near Impossible" tier' },
      method: 'tier',
      ring: 'conic-gradient(from 0deg, #1e1b4b, #7c3aed, #db2777, #7c3aed, #1e1b4b)',
      glow: 'rgba(124,58,237,.65)',
      motion: 'frameSpin',
      check: function (s, ctx) { return tierDone(ctx, 'near_impossible'); }
    },
    {
      id: 'frame_hundred_percent',
      name: { th: '100% ผู้เชี่ยวชาญ', en: '100% Master' },
      desc: { th: 'ปลดล็อค badge ครบทุกอันในเกม', en: 'Unlock every badge in the game' },
      method: 'tier',
      ring: 'conic-gradient(from 0deg, #fde047, #fb923c, #ef4444, #a855f7, #3b82f6, #22d3ee, #4ade9c, #fde047)',
      glow: 'rgba(255,255,255,.5)',
      motion: 'frameSpin',
      check: function (s, ctx) {
        const all = global.CSW24_BADGES || [];
        return all.length > 0 && all.every(function (b) { return hasBadge(ctx, b.id); });
      }
    },

    // ---------- date / seasonal ----------
    {
      id: 'frame_new_year',
      name: { th: 'ปีใหม่', en: 'New Year' },
      desc: { th: 'เข้าใช้งานช่วงวันที่ 31 ธ.ค. – 2 ม.ค.', en: 'Open the app between Dec 31 – Jan 2' },
      method: 'date',
      ring: 'conic-gradient(from 0deg, #fde047, #facc15, #fde047)',
      glow: 'rgba(250,204,21,.5)',
      check: function (s, ctx) {
        const now = ctx.now;
        return (now.getMonth() === 11 && now.getDate() === 31) || (now.getMonth() === 0 && now.getDate() <= 2);
      }
    },
    {
      id: 'frame_songkran',
      name: { th: 'สงกรานต์', en: 'Songkran' },
      desc: { th: 'เข้าใช้งานช่วงวันที่ 13–15 เม.ย.', en: 'Open the app between Apr 13–15' },
      method: 'date',
      ring: 'linear-gradient(135deg, #93c5fd, #60a5fa, #f9fafb)',
      check: function (s, ctx) { return inDateWindow(ctx.now, [4, 13], [4, 15]); }
    },
    {
      id: 'frame_loy_krathong',
      name: { th: 'ลอยกระทง', en: 'Loy Krathong' },
      desc: { th: 'เข้าใช้งานในเดือนพฤศจิกายน', en: 'Open the app during November' },
      method: 'date',
      ring: 'conic-gradient(from 45deg, #fed7aa, #f97316, #fed7aa)',
      glow: 'rgba(249,115,22,.35)',
      check: function (s, ctx) { return ctx.now.getMonth() === 10; }
    },
    {
      id: 'frame_halloween',
      name: { th: 'ฮาโลวีน', en: 'Halloween' },
      desc: { th: 'เข้าใช้งานช่วงวันที่ 29–31 ต.ค.', en: 'Open the app between Oct 29–31' },
      method: 'date',
      ring: 'linear-gradient(135deg, #fb923c, #18181b)',
      check: function (s, ctx) { return inDateWindow(ctx.now, [10, 29], [10, 31]); }
    },
    {
      id: 'frame_christmas',
      name: { th: 'คริสต์มาส', en: 'Christmas' },
      desc: { th: 'เข้าใช้งานช่วงวันที่ 24–26 ธ.ค.', en: 'Open the app between Dec 24–26' },
      method: 'date',
      ring: 'linear-gradient(135deg, #86efac, #dc2626, #f8fafc)',
      check: function (s, ctx) { return inDateWindow(ctx.now, [12, 24], [12, 26]); }
    },

    // ---------- XP / level-ish stat combos ----------
    {
      id: 'frame_bronze_scholar',
      name: { th: 'นักวิชาการทองแดง', en: 'Bronze Scholar' },
      desc: { th: 'มีคะแนนรวม (session + mastered + minigame) อย่างน้อย 50', en: 'Reach a combined score of 50+ across sessions, mastery and minigames' },
      method: 'stat',
      ring: 'linear-gradient(135deg, #d6a570, #92400e)',
      check: function (s) {
        return (s.sessionsCompleted + s.masteredCount + s.typingWins + s.botGamesWon) >= 50;
      }
    },
    {
      id: 'frame_silver_scholar',
      name: { th: 'นักวิชาการเงิน', en: 'Silver Scholar' },
      desc: { th: 'มีคะแนนรวม (session + mastered + minigame) อย่างน้อย 150', en: 'Reach a combined score of 150+ across sessions, mastery and minigames' },
      method: 'stat',
      ring: 'conic-gradient(from 0deg, #e2e8f0, #94a3b8, #e2e8f0)',
      check: function (s) {
        return (s.sessionsCompleted + s.masteredCount + s.typingWins + s.botGamesWon) >= 150;
      }
    },
    {
      id: 'frame_golden_scholar',
      name: { th: 'นักวิชาการทองคำ', en: 'Golden Scholar' },
      desc: { th: 'มีคะแนนรวม (session + mastered + minigame) อย่างน้อย 400', en: 'Reach a combined score of 400+ across sessions, mastery and minigames' },
      method: 'stat',
      ring: 'conic-gradient(from 0deg, #fef08a, #eab308, #fef08a)',
      glow: 'rgba(234,179,8,.5)',
      motion: 'frameSpin',
      check: function (s) {
        return (s.sessionsCompleted + s.masteredCount + s.typingWins + s.botGamesWon) >= 400;
      }
    },

    // ---------- secret / quirky ----------
    {
      id: 'frame_secret_zero_marathon',
      name: { th: '???', en: '???' },
      desc: { th: 'ความลับ — ลองเล่น Marathon Mode ดูสิ', en: 'Secret — try playing Marathon Mode' },
      method: 'secret',
      ring: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #18181b 10px, #18181b 20px)',
      check: function (s) { return s.marathonAbandonedZero >= 1; }
    },
    {
      id: 'frame_secret_one_card',
      name: { th: '???', en: '???' },
      desc: { th: 'ความลับ — ลองทำ session ที่มีคำเดียว', en: 'Secret — try a session with exactly one card' },
      method: 'secret',
      ring: 'repeating-linear-gradient(135deg, #a855f7, #a855f7 8px, #18181b 8px, #18181b 16px)',
      check: function (s) { return s.sessionsAtExactly1 >= 1; }
    },
    {
      id: 'frame_secret_editor',
      name: { th: '???', en: '???' },
      desc: { th: 'ความลับ — ลองแก้ไขคำใน Cardbox ดู', en: 'Secret — try editing a Cardbox entry' },
      method: 'secret',
      ring: 'repeating-radial-gradient(circle, #22d3ee, #22d3ee 6px, #0f172a 6px, #0f172a 12px)',
      check: function (s) { return s.cardboxEditCount >= 1; }
    },
    {
      id: 'frame_secret_declutter',
      name: { th: '???', en: '???' },
      desc: { th: 'ความลับ — ลองลบคำใน Cardbox 20 คำ', en: 'Secret — try removing 20 words from Cardbox' },
      method: 'secret',
      ring: 'repeating-linear-gradient(90deg, #64748b, #64748b 10px, #1e293b 10px, #1e293b 20px)',
      check: function (s) { return s.cardboxDeleted >= 20; }
    },
    {
      id: 'frame_secret_polyglot_greeting',
      name: { th: '???', en: '???' },
      desc: { th: 'ความลับ — เก็บคำทักทายให้ครบ 20 แบบ', en: 'Secret — collect 20 different greetings' },
      method: 'secret',
      ring: 'conic-gradient(from 0deg, #f472b6, #a855f7, #6366f1, #f472b6)',
      glow: 'rgba(168,85,247,.45)',
      check: function (s) { return Object.keys(s.greetingsViewed || {}).length >= 20; }
    },

    // ---------- custom ----------
    {
      id: 'frame_custom',
      name: { th: 'กำหนดเอง', en: 'Custom' },
      desc: { th: 'อัปโหลดรูปกรอบของคุณเอง — ปลดล็อคได้เสมอ', en: 'Upload your own frame image — always available' },
      method: 'custom',
      ring: 'var(--frame-custom-ring, transparent)',
      check: function () { return true; }
    }
  ];

  const FRAMES_BY_ID = {};
  FRAMES.forEach(function (f) { FRAMES_BY_ID[f.id] = f; });

  global.CSW24_FRAMES = FRAMES;
  global.CSW24_FRAMES_BY_ID = FRAMES_BY_ID;
})(window);
