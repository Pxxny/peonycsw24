/* =========================================================
   CSW24 Word Lab — application logic
   Depends on words-data.js (CSW24_BY_LENGTH, CSW24_TOTAL_COUNT,
   CSW24_MIN_LEN, CSW24_MAX_LEN) being loaded first.
   ========================================================= */

(function () {
  'use strict';

  const SCRABBLE_VALUES = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8,
    K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1,
    U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
  };

  // Standard 100-tile English/CSW Scrabble bag composition (2 blanks).
  const TILE_BAG = {
    A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1,
    K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
    U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2
  };
  const TILE_BAG_TOTAL = 100;

  const CARDBOX_KEY = 'csw24_cardbox_v1';  const CARDBOX_SELECTION_KEY = 'csw24_cardbox_selection_v1';
  const CARDBOX_GROUPS_KEY = 'csw24_cardbox_groups_v1';
  const CUSTOM_KEY = 'csw24_custom_words_v1';
  const SETTINGS_KEY = 'csw24_settings_v1';
  const UNFAM_KEY = 'csw24_unfamiliar_v1';
  const NOTES_KEY = 'csw24_word_notes_v1';
  const HISTORY_KEY = 'csw24_word_history_v1';
  const LEARN_LOG_KEY = 'csw24_learn_log_v1';
  const DAILY_GOAL_KEY = 'csw24_daily_goal_v1';
  const DAY_MS = 86400000;

  // DD/MM/YYYY HH:MM:SS — used to show a Cardbox card's next-review time.
  function formatDueDate(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi + ':' + ss;
  }
  const PAGE_SIZE = 150;

  let uidCounter = 0;

  // ---------- i18n ----------

  const I18N = {
    th: {
      'tab.dashboard': '📊 Dashboard', 'tab.generate': '📝 สร้างคำศัพท์', 'tab.quiz': '🎯 แบบทดสอบ',
      'tab.cardbox': '🗂️ Cardbox', 'tab.addwords': '➕ เพิ่มคำศัพท์', 'tab.browse': '📖 คลังคำศัพท์', 'tab.builder': '🧩 Word Builder', 'tab.minigame': '🕹️ Minigame',
      'tab.play': '♟️ Play', 'tab.achievements': '🏆 Achievement', 'tab.settings': '⚙️ Setting',
      'tab.learn': '🎓 Learn',
      'learn.title': '🎓 Learn', 'learn.sub': 'เลือกความยาวคำศัพท์ที่ต้องการเรียน',
      'learn.extraSoon': '🚧 Extra — เร็วๆ นี้',
      'dash.learnBtn': '🎓 Learn',
      'ach.title': '🏆 Achievement', 'ach.sub': 'ปลดล็อกเหรียญตราจากการเรียนและเล่นมินิเกม ข้อมูลเก็บไว้ในเบราว์เซอร์นี้เท่านั้น',
      'app.title': 'CSW24 Word Lab',
      'app.subtitle': 'เจนคำศัพท์ · หา Anagram · เก็บลง Cardbox · ทบทวนแบบ Spaced Repetition · Minigame',
      'gen.title': 'สร้างรายการคำศัพท์',
      'gen.sub': 'สุ่มคำจากพจนานุกรม CSW24 กำหนดความยาวตัวอักษร (ช่วง) และจำนวนคำที่ต้องการ พร้อมดู Anagram และคะแนนของแต่ละคำ',
      'common.minLen': 'ความยาวต่ำสุด', 'common.maxLen': 'ความยาวสูงสุด', 'common.wordCount': 'จำนวนคำ',
      'common.randomize': '🎲 สุ่มคำศัพท์', 'common.selectAll': 'เลือกทั้งหมด', 'common.saveToCardbox': '💾 Save to Cardbox',
      'common.close': '✕ ปิด',
      'learnLevelDetail.nextReview': 'ทบทวนครั้งถัดไป',
      'dueEdit.title': 'ปรับวันทบทวนคำนี้เอง',
      'dueEdit.hint': 'ปรับวันที่ทบทวนครั้งถัดไปของคำนี้เอง (ไม่กระทบคำอื่น)',
      'dueEdit.currentLabel': 'ตอนนี้กำหนดไว้',
      'dueEdit.presetToday': 'วันนี้', 'dueEdit.presetTomorrow': 'พรุ่งนี้',
      'dueEdit.preset3d': '+3 วัน', 'dueEdit.preset1w': '+1 สัปดาห์',
      'dueEdit.preset2w': '+2 สัปดาห์', 'dueEdit.preset1m': '+1 เดือน',
      'dueEdit.customLabel': 'หรือกำหนดวัน-เวลาเอง',
      'dueEdit.save': '💾 บันทึก',
      'dueEdit.saved': '📅 ปรับวันทบทวนของ "{word}" เป็น {date} แล้ว',
      'quiz.title': 'แบบทดสอบ — เลือกคำเก็บใน Cardbox',
      'quiz.sub': 'สุ่มคำศัพท์ชุดใหม่ (ค่าเริ่มต้น 50 คำ) เลือกคำที่ถูกใจอยากจำ แล้วกด Save to Cardbox เพื่อเก็บไว้ทบทวน',
      'cardbox.addTitle': '➕ เพิ่มคำศัพท์เข้า Cardbox', 'cardbox.addLabel': 'คำศัพท์ (บรรทัดละคำ)',
      'cardbox.addSub': 'พิมพ์คำศัพท์ทีละบรรทัด (Enter ขึ้นบรรทัดใหม่ เว้นวรรคได้) ระบบจะแนะนำคำที่ใกล้เคียงขณะพิมพ์ ทุกคำที่เพิ่มต้องมีอยู่ใน CSW24 เท่านั้น — คำที่ไม่มีจะขึ้นแจ้งเตือนและไม่ถูกเพิ่ม',
      'cardbox.addBtn': '💾 เพิ่มเข้า Cardbox', 'cardbox.addClear': 'ล้างช่องพิมพ์',
      'cardbox.addOk': 'มีใน CSW24', 'cardbox.addNotFound': 'ไม่พบคำนี้ใน CSW24',
      'cardbox.addAlready': 'มีใน Cardbox แล้ว',
      'cardbox.addWillAdd': 'จะเพิ่ม {n} คำ', 'cardbox.addWillSkipInvalid': 'ข้าม {n} คำที่ไม่มีใน CSW24',
      'cardbox.addWillSkipDup': 'ข้าม {n} คำที่มีอยู่แล้ว',
      'cardbox.addNoneEntered': 'กรุณาพิมพ์คำศัพท์ก่อน',
      'cardbox.addRejected': '⚠️ {n} คำไม่มีใน CSW24 ไม่ถูกเพิ่ม: {words}',
      'cardbox.addSuccess': '💾 เพิ่ม {n} คำเข้า Cardbox แล้ว', 'cardbox.addAlreadyCount': '{n} คำมีอยู่แล้ว',
      'cardbox.title': 'การ์ดของฉัน (Cardbox)', 'cardbox.studyMode': 'รูปแบบ Quiz',
      'cardbox.anagramOrder': 'การเรียงตัวอักษร', 'cardbox.studyCount': 'จำนวนคำที่ทบทวน', 'cardbox.start': '▶ เริ่มทบทวน',
      'cardbox.anagramCycleInterval': 'Cycle Interval (คำที่ข้าม/ผิดจะวนกลับมาอีกกี่คำ)',
      'cardbox.selectedCount': 'เลือกแล้ว 0 คำ', 'cardbox.studySelected': '▶ ทบทวนคำที่เลือก',
      'cardbox.searchLabel': '🔍 ค้นหาคำใน Cardbox', 'cardbox.sortLabel': 'เรียงลำดับ',
      'cardbox.sortRecent': 'เพิ่มล่าสุดก่อน', 'cardbox.sortRoundsDesc': 'จำนวนรอบเรียน: มาก→น้อย',
      'cardbox.sortRoundsAsc': 'จำนวนรอบเรียน: น้อย→มาก', 'cardbox.sortAlpha': 'ตัวอักษร (A→Z)',
      'cardbox.sortProbDesc': 'Probability: มากไปน้อย', 'cardbox.sortProbAsc': 'Probability: น้อยไปมาก',
      'cardbox.sortPlayDesc': 'Playability: มากไปน้อย', 'cardbox.sortPlayAsc': 'Playability: น้อยไปมาก',
      'cardbox.anagramReviewStart': '📖 Anagram Review', 'cardbox.anagramReviewSelected': '📖 Anagram Review คำที่เลือก',
      'cardbox.reviewSecondsLabel': 'วินาที', 'cardbox.reviewExit': '↩ ออกจาก Review',
      'cardbox.reviewStartStudy': '▶ เริ่มเรียนคำชุดนี้',
      'cardboxGroups.title': '📦 Group คำศัพท์ (บันทึกไว้หลายชุด)',
      'cardboxGroups.sub': 'ติ๊กเลือกคำที่ต้องการในรายการ Cardbox ด้านบนก่อน แล้วกดปุ่มนี้เพื่อบันทึกรายชื่อคำที่เลือกไว้เป็น "Group" (ไม่ลบของเดิมใน Cardbox) ตั้งชื่อได้ พอต้องการกลับมาติ๊กเลือกชุดคำเดิมอีกครั้ง กด "โหลดเข้า Cardbox" ระบบจะติ๊กเลือกคำในรายการ Cardbox ให้ตรงกับตอนที่บันทึกไว้ (คำไหนถูกลบออกจาก Cardbox ไปแล้วจะข้าม)',
      'cardboxGroups.addBtn': '➕ เพิ่ม Group จากคำที่เลือกไว้',
      'cardboxGroups.namePrompt': 'ตั้งชื่อ Group (เว้นว่างได้ ระบบจะตั้งชื่อให้อัตโนมัติ)',
      'cardboxGroups.emptyCardbox': 'Cardbox ว่างอยู่ ไม่มีอะไรให้บันทึกเป็น Group',
      'cardboxGroups.noSelection': 'ยังไม่ได้ติ๊กเลือกคำเลย — เลือกคำที่ต้องการในรายการ Cardbox ก่อน',
      'cardboxGroups.saved': '📦 บันทึก Group "{name}" แล้ว ({n} คำ)',
      'cardboxGroups.empty': 'ยังไม่มี Group ที่บันทึกไว้',
      'cardboxGroups.wordCount': '{n} คำ',
      'cardboxGroups.load': '▶ โหลดเข้า Cardbox',
      'cardboxGroups.rename': '✏️ เปลี่ยนชื่อ',
      'cardboxGroups.delete': '🗑️ ลบ',
      'cardboxGroups.loadSelectDone': '✅ ติ๊กเลือกคำใน Group "{name}" แล้ว ({n} คำ)',
      'cardboxGroups.loadSelectDoneMissing': '✅ ติ๊กเลือกคำใน Group "{name}" แล้ว ({n} คำ, ข้าม {missing} คำที่ไม่มีใน Cardbox แล้ว)',
      'cardboxGroups.deleteConfirm': 'ต้องการลบ Group "{name}" ใช่หรือไม่? (ลบแล้วกู้คืนไม่ได้)',
      'cardboxGroups.deleted': '🗑️ ลบ Group "{name}" แล้ว',
      'cardboxGroups.renamePrompt': 'ตั้งชื่อใหม่ให้ Group',
      'cardboxLeech.badge': 'Leech', 'cardboxLeech.badgeTitle': 'ตอบผิด/ข้ามติดกัน {n} ครั้ง',
      'cardboxLeech.sortLeechDesc': '🐛 Leech ก่อน (ผิดติดกันมาก→น้อย)',
      'cardboxLeech.filterOnly': '🐛 แสดงเฉพาะคำที่ติด Leech',
      'cardboxLeech.studyBtn': '🐛 ฝึกเฉพาะคำที่ติด Leech',
      'cardboxLeech.countHint': 'มี {n} คำที่ติด Leech อยู่ตอนนี้',
      'cardboxLeech.noneToast': 'ตอนนี้ไม่มีคำที่ติด Leech เลย 🎉',
      'cardboxLeech.thresholdLabel': '🐛 ผิดติดกันกี่ครั้งให้ติด Leech',
      'cardboxLeech.thresholdHint': 'ถ้าตอบผิด (หรือข้าม) คำเดิมติดกันครบตามจำนวนนี้ คำนั้นจะถูก flag เป็น "Leech" ให้แยกไปฝึกเฉพาะได้ง่ายขึ้น — ตอบถูกครั้งเดียวจะปลด flag ทันที',
      'browse.title': 'คลังคำศัพท์ทั้งหมด', 'browse.search': '🔍 ค้นหา (Enter)', 'browse.clear': 'ล้างตัวกรอง', 'browse.sortLabel': 'เรียงลำดับ',
      'browse.wordSearchLabel': '🔍 ค้นหาคำศัพท์', 'browse.selectedCount': 'เลือกแล้ว 0 คำ', 'browse.saveSelected': '💾 บันทึกที่เลือกลง Cardbox',
      'builder.title': '🧩 Word Builder',
      'builder.sub': 'พิมพ์ชุดตัวอักษร (Rack) เช่น TISANE? หรือ SATIRE? — ระบบจะแสดงคำศัพท์ทุกคำที่ประกอบขึ้นได้จากตัวอักษรเหล่านั้น',
      'builder.rackLabel': 'ตัวอักษร (Rack)', 'builder.build': '🧩 หาคำศัพท์',
      'builder.sortLenDesc': 'ความยาว: มากไปน้อย', 'builder.sortLenAsc': 'ความยาว: น้อยไปมาก',
      'mini.title': '🕹️ Minigame', 'mini.typing': '⌨️ พิมพ์ศัพท์ Random', 'mini.racks': '🁢 Random Racks',
      'mini.alpha': '🔀 Alphagram Blitz', 'mini.marathon': '⚡ Time Attack Marathon', 'mini.realmarathon': '🏃 Marathon',
      'mini.startGame': '▶ เริ่มเกม', 'mini.newRack': '▶ สุ่ม Rack ใหม่',
      'dash.title': 'Dashboard', 'dash.sub': 'ภาพรวมความคืบหน้าในการเรียนคำศัพท์ของคุณ ข้อมูลทั้งหมดเก็บไว้ในเบราว์เซอร์นี้เท่านั้น',
      'dash.mastered': 'เชี่ยวชาญ', 'dash.reset': '♻ Reset ความคืบหน้าทั้งหมด',
      'dash.learnBtnMastered': '🎓 Learn — ชำนาญแล้ว {n} คำ',
      'dash.suggested': 'คำแนะนำสำหรับวันนี้', 'dash.suggestedSub': 'สุ่มมาให้ตอนเปิดเว็บ (รีเฉพาะตอนรีเฟรชหน้า) ความยาวตามที่ตั้งไว้ในหน้า Setting',
      'dash.suggestedRefresh': '🔁 สุ่มใหม่ (ไม่รอ refresh หน้า)',
      'settings.title': '⚙️ Setting', 'settings.sub': 'ตั้งค่าภาษา สีเว็บ และช่วงความยาวคำแนะนำของ Dashboard',
      'settings.language': 'ภาษา / Language', 'settings.themePreset': 'ธีมสี (Preset)',
      'settings.customBoard': 'สีพื้นบอร์ด', 'settings.customBrass': 'สีเน้น (Brass)',
      'settings.customTeal': 'สีเทียบรอง (Teal)', 'settings.customCream': 'สีตัวหนังสือ',
      'settings.themeReset': '↺ คืนค่าเริ่มต้น', 'settings.dashRange': 'ช่วงความยาวคำแนะนำใน Dashboard',
      'settings.min': 'ต่ำสุด', 'settings.max': 'สูงสุด', 'settings.count': 'จำนวนคำ',
      'settings.importExport': 'นำเข้า / ส่งออกข้อมูล',
      'settings.importExportSub': 'สำรองความคืบหน้าไว้เป็นไฟล์ หรือเพิ่มคำศัพท์ของคุณเองเข้าไปใช้งานร่วมกับพจนานุกรม CSW24',
      'settings.exportProgress': '⬇ ส่งออกความคืบหน้า (JSON)', 'settings.importProgress': '⬆ นำเข้าความคืบหน้า (JSON)',
      'settings.importWords': '⬆ นำเข้ารายการคำศัพท์ของฉัน (.txt)', 'settings.includeCustom': 'รวมคำที่นำเข้าเองตอนสุ่ม/ค้นหา',
      'settings.studySession': 'เซสชันทบทวน (Cardbox)',
      'settings.studySessionSub': 'ปรับพฤติกรรมระหว่างทำ Quiz ในเซสชันทบทวน',
      'settings.showHooks': 'แสดง Hook (Front/Back) ของคำ',
      'settings.showHooksHint': 'เมื่อเปิด: ทุกที่ที่แสดงคำศัพท์จะโชว์ตัวอักษรที่เติมหน้า/หลังคำแล้วได้เป็นคำใหม่ทันที',
      'settings.anagramAutoReshuffle': 'สลับตัวอักษร Anagram อัตโนมัติหลังตอบ',
      'settings.anagramAutoReshuffleHint': 'เมื่อเปิด: หลังตอบครบ/ข้ามคำใน Anagram แล้ว ระหว่างรอไปคำถัดไป ตัวอักษรจะสลับที่ใหม่ให้เองทุกกี่วินาทีตามที่ตั้ง',
      'settings.anagramReshuffleSeconds': 'สลับทุกกี่วินาที'
    },
    en: {
      'tab.dashboard': '📊 Dashboard', 'tab.generate': '📝 Generate', 'tab.quiz': '🎯 Quiz',
      'tab.cardbox': '🗂️ Cardbox', 'tab.addwords': '➕ Add Words', 'tab.browse': '📖 Word Browser', 'tab.builder': '🧩 Word Builder', 'tab.minigame': '🕹️ Minigame',
      'tab.play': '♟️ Play', 'tab.achievements': '🏆 Achievements', 'tab.settings': '⚙️ Settings',
      'tab.learn': '🎓 Learn',
      'learn.title': '🎓 Learn', 'learn.sub': 'Choose the word length you want to learn',
      'learn.extraSoon': '🚧 Extra — coming soon',
      'dash.learnBtn': '🎓 Learn',
      'ach.title': '🏆 Achievements', 'ach.sub': 'Unlock badges by studying and playing minigames. All data is stored in this browser only.',
      'app.title': 'CSW24 Word Lab',
      'app.subtitle': 'Generate words · Find Anagrams · Save to Cardbox · Spaced Repetition review · Minigames',
      'gen.title': 'Generate word list',
      'gen.sub': 'Randomize words from the CSW24 dictionary, set a length range and word count, view Anagrams and each word\u2019s score.',
      'common.minLen': 'Min length', 'common.maxLen': 'Max length', 'common.wordCount': 'Word count',
      'common.randomize': '🎲 Randomize', 'common.selectAll': 'Select all', 'common.saveToCardbox': '💾 Save to Cardbox',
      'common.close': '✕ Close',
      'learnLevelDetail.nextReview': 'Next review',
      'dueEdit.title': 'Edit this word\u2019s review date',
      'dueEdit.hint': 'Manually move this word\u2019s next review date (other words are unaffected)',
      'dueEdit.currentLabel': 'Currently set to',
      'dueEdit.presetToday': 'Today', 'dueEdit.presetTomorrow': 'Tomorrow',
      'dueEdit.preset3d': '+3 days', 'dueEdit.preset1w': '+1 week',
      'dueEdit.preset2w': '+2 weeks', 'dueEdit.preset1m': '+1 month',
      'dueEdit.customLabel': 'Or set an exact date/time',
      'dueEdit.save': '💾 Save',
      'dueEdit.saved': '📅 Moved "{word}"\u2019s review date to {date}',
      'quiz.title': 'Quiz — pick words to save to Cardbox',
      'quiz.sub': 'Randomize a fresh batch (default 50), select the words you want to learn, then Save to Cardbox.',
      'cardbox.addTitle': '➕ Add words to Cardbox', 'cardbox.addLabel': 'Words (one per line)',
      'cardbox.addSub': 'Type one word per line (Enter for a new line, spaces are fine). You\u2019ll get live suggestions as you type. Every word must exist in CSW24 — anything not found shows a notification and is not added.',
      'cardbox.addBtn': '💾 Add to Cardbox', 'cardbox.addClear': 'Clear input',
      'cardbox.addOk': 'In CSW24', 'cardbox.addNotFound': 'Not found in CSW24',
      'cardbox.addAlready': 'Already in Cardbox',
      'cardbox.addWillAdd': 'Will add {n} word(s)', 'cardbox.addWillSkipInvalid': 'skipping {n} not in CSW24',
      'cardbox.addWillSkipDup': 'skipping {n} already added',
      'cardbox.addNoneEntered': 'Type a word first',
      'cardbox.addRejected': '⚠️ {n} word(s) not in CSW24, not added: {words}',
      'cardbox.addSuccess': '💾 Added {n} word(s) to Cardbox', 'cardbox.addAlreadyCount': '{n} already there',
      'cardbox.title': 'My Cards (Cardbox)', 'cardbox.studyMode': 'Study mode',
      'cardbox.anagramOrder': 'Letter order', 'cardbox.studyCount': 'Words to review', 'cardbox.start': '▶ Start review',
      'cardbox.anagramCycleInterval': 'Cycle interval (cards before a skipped/wrong word repeats)',
      'cardbox.selectedCount': '0 selected', 'cardbox.studySelected': '▶ Study selected',
      'cardbox.searchLabel': '🔍 Search in Cardbox', 'cardbox.sortLabel': 'Sort by',
      'cardbox.sortRecent': 'Recently added', 'cardbox.sortRoundsDesc': 'Study rounds: high→low',
      'cardbox.sortRoundsAsc': 'Study rounds: low→high', 'cardbox.sortAlpha': 'Alphabetical (A→Z)',
      'cardbox.sortProbDesc': 'Probability: high→low', 'cardbox.sortProbAsc': 'Probability: low→high',
      'cardbox.sortPlayDesc': 'Playability: high→low', 'cardbox.sortPlayAsc': 'Playability: low→high',
      'cardbox.anagramReviewStart': '📖 Anagram Review', 'cardbox.anagramReviewSelected': '📖 Anagram Review selected',
      'cardbox.reviewSecondsLabel': 'seconds', 'cardbox.reviewExit': '↩ Exit Review',
      'cardbox.reviewStartStudy': '▶ Start studying this set',
      'cardboxGroups.title': '📦 Word Groups (save multiple sets)',
      'cardboxGroups.sub': 'Tick the words you want in the Cardbox list above, then use this to save the selected words as a named "Group" (nothing in your Cardbox is deleted). Later, hit "Load into Cardbox" to re-tick that same set of words in the Cardbox list (any word no longer in your Cardbox is skipped).',
      'cardboxGroups.addBtn': '➕ Add Group from selected words',
      'cardboxGroups.namePrompt': 'Name this Group (leave blank for an auto-generated name)',
      'cardboxGroups.emptyCardbox': 'Cardbox is empty — nothing to save as a Group',
      'cardboxGroups.noSelection': 'No words selected — tick the words you want in the Cardbox list first',
      'cardboxGroups.saved': '📦 Saved Group "{name}" ({n} words)',
      'cardboxGroups.empty': 'No Groups saved yet',
      'cardboxGroups.wordCount': '{n} words',
      'cardboxGroups.load': '▶ Load into Cardbox',
      'cardboxGroups.rename': '✏️ Rename',
      'cardboxGroups.delete': '🗑️ Delete',
      'cardboxGroups.loadSelectDone': '✅ Selected Group "{name}" in Cardbox ({n} words)',
      'cardboxGroups.loadSelectDoneMissing': '✅ Selected Group "{name}" in Cardbox ({n} words, skipped {missing} no longer in Cardbox)',
      'cardboxGroups.deleteConfirm': 'Delete Group "{name}"? This cannot be undone.',
      'cardboxGroups.deleted': '🗑️ Deleted Group "{name}"',
      'cardboxGroups.renamePrompt': 'Rename this Group',
      'cardboxLeech.badge': 'Leech', 'cardboxLeech.badgeTitle': 'Missed/skipped {n} times in a row',
      'cardboxLeech.sortLeechDesc': '🐛 Leeches first (most→least consecutive misses)',
      'cardboxLeech.filterOnly': '🐛 Show only leeches',
      'cardboxLeech.studyBtn': '🐛 Drill leeches only',
      'cardboxLeech.countHint': '{n} word(s) currently flagged as leeches',
      'cardboxLeech.noneToast': 'No leeches right now — nice! 🎉',
      'cardboxLeech.thresholdLabel': '🐛 Consecutive misses before a word becomes a leech',
      'cardboxLeech.thresholdHint': 'If a word is answered wrong (or skipped) this many times in a row, it gets flagged as a "Leech" so you can drill it separately. One correct answer clears the flag immediately.',
      'browse.title': 'Full word dictionary', 'browse.search': '🔍 Search (Enter)', 'browse.clear': 'Clear filters', 'browse.sortLabel': 'Sort by',
      'browse.wordSearchLabel': '🔍 Search for a word', 'browse.selectedCount': '0 selected', 'browse.saveSelected': '💾 Save selected to Cardbox',
      'builder.title': '🧩 Word Builder',
      'builder.sub': 'Type a rack of letters like TISANE? or SATIRE? — every dictionary word buildable from those letters will be listed.',
      'builder.rackLabel': 'Letters (Rack)', 'builder.build': '🧩 Find words',
      'builder.sortLenDesc': 'Length: high→low', 'builder.sortLenAsc': 'Length: low→high',
      'mini.title': '🕹️ Minigame', 'mini.typing': '⌨️ Random Word Typing', 'mini.racks': '🁢 Random Racks',
      'mini.alpha': '🔀 Alphagram Blitz', 'mini.marathon': '⚡ Time Attack Marathon', 'mini.realmarathon': '🏃 Marathon',
      'mini.startGame': '▶ Start game', 'mini.newRack': '▶ New rack',
      'dash.title': 'Dashboard', 'dash.sub': 'Overview of your word-learning progress. All data is stored in this browser only.',
      'dash.mastered': 'Mastered', 'dash.reset': '♻ Reset all progress',
      'dash.learnBtnMastered': '🎓 Learn — Mastered {n} words',
      'dash.suggested': 'Suggested for today', 'dash.suggestedSub': 'Randomized when the page loads (refreshes only on page reload). Length set in Settings.',
      'dash.suggestedRefresh': '🔁 Reshuffle (without reloading)',
      'settings.title': '⚙️ Settings', 'settings.sub': 'Set language, site colors, and the Dashboard suggested-word length range.',
      'settings.language': 'Language / ภาษา', 'settings.themePreset': 'Color theme (presets)',
      'settings.customBoard': 'Board color', 'settings.customBrass': 'Accent (brass)',
      'settings.customTeal': 'Secondary (teal)', 'settings.customCream': 'Text color',
      'settings.themeReset': '↺ Reset to default', 'settings.dashRange': 'Dashboard suggested-word length range',
      'settings.min': 'Min', 'settings.max': 'Max', 'settings.count': 'Count',
      'settings.importExport': 'Import / Export data',
      'settings.importExportSub': 'Back up your progress to a file, or add your own words to use alongside the CSW24 dictionary.',
      'settings.exportProgress': '⬇ Export progress (JSON)', 'settings.importProgress': '⬆ Import progress (JSON)',
      'settings.importWords': '⬆ Import my word list (.txt)', 'settings.includeCustom': 'Include imported words in randomize/search',
      'settings.studySession': 'Study session (Cardbox)',
      'settings.studySessionSub': 'Adjust behavior while taking Quizzes in a review session.',
      'settings.showHooks': 'Show word hooks (front/back)',
      'settings.showHooksHint': 'When on: everywhere a word is shown, letters that extend it into a new word (front or back) are displayed right away.',
      'settings.anagramAutoReshuffle': 'Auto-reshuffle Anagram tiles after answering',
      'settings.anagramAutoReshuffleHint': 'When on: after finishing or skipping an Anagram card, while waiting to move to the next one, the letter tiles reshuffle every N seconds.',
      'settings.anagramReshuffleSeconds': 'Reshuffle every (seconds)'
    }
  };

  const THEME_PRESETS = [
    { id: 'felt', name: { th: 'เขียวบอร์ด (Default)', en: 'Felt Green (Default)' }, board0: '#0f1c17', board1: '#16241f', board2: '#1d2f28', rail: '#274236', brass: '#d1a53d', brassDeep: '#a97f20', teal: '#4aa596', tealDeep: '#2f7469', cream: '#f6f1e4' },
    { id: 'navy', name: { th: 'น้ำเงินราตรี', en: 'Midnight Navy' }, board0: '#0b1220', board1: '#111a2e', board2: '#182640', rail: '#2c3e5e', brass: '#e0a94a', brassDeep: '#b2812c', teal: '#5aa9e6', tealDeep: '#3c7fb8', cream: '#eef2fb' },
    { id: 'plum', name: { th: 'ม่วงเบอร์กันดี', en: 'Plum Burgundy' }, board0: '#1a0f18', board1: '#25151f', board2: '#331e2c', rail: '#4a2c40', brass: '#dba15a', brassDeep: '#ad7739', teal: '#c76b8a', tealDeep: '#9b4e69', cream: '#f6ecef' },
    { id: 'slate', name: { th: 'เทาหิน', en: 'Slate Gray' }, board0: '#14171a', board1: '#1c2024', board2: '#262b31', rail: '#3a414a', brass: '#c9a24a', brassDeep: '#9c7c33', teal: '#5bb0a3', tealDeep: '#3d7f75', cream: '#f0f1f3' },
    { id: 'clay', name: { th: 'ดินเผาอุ่น', en: 'Warm Clay' }, board0: '#1c1410', board1: '#261b15', board2: '#33251c', rail: '#4a3527', brass: '#e2a13c', brassDeep: '#b3791f', teal: '#6f9c7e', tealDeep: '#4e735a', cream: '#f7eee1' }
  ];

  let settings = {
    lang: 'th',
    themePreset: 'felt',
    customColors: null, // {board,brass,teal,cream} or null
    dashMin: 5, dashMax: 9, dashCount: 12,
    dueTimePreset: '24h', // 1h,5h,12h,24h,1d,2d,5d,10d,30d,custom
    dueTimeCustomValue: 3, dueTimeCustomUnit: 'd',
    fontFamily: 'inter', fontScale: 1,
    showHooks: true,
    anagramCycleInterval: 3,
    anagramAutoReshuffle: false, anagramReshuffleSeconds: 3,
    leechThreshold: 4
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) settings = Object.assign(settings, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function t(key) {
    const dict = I18N[settings.lang] || I18N.th;
    return dict[key] || I18N.th[key] || key;
  }

  function applyI18n() {
    document.documentElement.lang = settings.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
  }

  const FONT_OPTIONS = [
    { id: 'inter', label: 'Inter (ค่าเริ่มต้น)', body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
    { id: 'atkinson', label: 'Atkinson Hyperlegible (อ่านง่าย)', body: "'Atkinson Hyperlegible', -apple-system, sans-serif" },
    { id: 'lexend', label: 'Lexend (อ่านง่าย)', body: "'Lexend', -apple-system, sans-serif" },
    { id: 'sarabun', label: 'Sarabun (ไทย)', body: "'Sarabun', -apple-system, sans-serif" },
    { id: 'system', label: 'ตัวอักษรระบบ (System)', body: "system-ui, -apple-system, Segoe UI, sans-serif" }
  ];

  function applyFontSettings() {
    const root = document.documentElement.style;
    const opt = FONT_OPTIONS.find(function (o) { return o.id === settings.fontFamily; }) || FONT_OPTIONS[0];
    root.setProperty('--font-body', opt.body);
    root.setProperty('--font-scale', settings.fontScale || 1);
  }

  function applyTheme() {
    const root = document.documentElement.style;
    if (settings.customColors) {
      const c = settings.customColors;
      root.setProperty('--board-0', c.board);
      root.setProperty('--board-1', shadeColor(c.board, 8));
      root.setProperty('--board-2', shadeColor(c.board, 16));
      root.setProperty('--rail', shadeColor(c.board, 30));
      root.setProperty('--brass', c.brass);
      root.setProperty('--brass-deep', shadeColor(c.brass, -20));
      root.setProperty('--teal', c.teal);
      root.setProperty('--teal-deep', shadeColor(c.teal, -20));
      root.setProperty('--cream', c.cream);
    } else {
      const preset = THEME_PRESETS.find(function (p) { return p.id === settings.themePreset; }) || THEME_PRESETS[0];
      root.setProperty('--board-0', preset.board0);
      root.setProperty('--board-1', preset.board1);
      root.setProperty('--board-2', preset.board2);
      root.setProperty('--rail', preset.rail);
      root.setProperty('--brass', preset.brass);
      root.setProperty('--brass-deep', preset.brassDeep);
      root.setProperty('--teal', preset.teal);
      root.setProperty('--teal-deep', preset.tealDeep);
      root.setProperty('--cream', preset.cream);
    }
  }

  function shadeColor(hex, percent) {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.min(255, Math.max(0, Math.round(r + (percent / 100) * 255)));
    g = Math.min(255, Math.max(0, Math.round(g + (percent / 100) * 255)));
    b = Math.min(255, Math.max(0, Math.round(b + (percent / 100) * 255)));
    return '#' + [r, g, b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function initSettingsTab() {
    const presetWrap = document.getElementById('themePresetChips');

    function refreshPresetChips() {
      presetWrap.querySelectorAll('.theme-preset-chip').forEach(function (btn) {
        btn.classList.toggle('active', !settings.customColors && settings.themePreset === btn.dataset.preset);
      });
    }

    function renderPresetChips() {
      presetWrap.innerHTML = THEME_PRESETS.map(function (p) {
        return '<button type="button" class="theme-preset-chip" data-preset="' + p.id + '">' +
          '<span class="theme-preset-swatch" style="background:' + p.brass + '"></span>' +
          (p.name[settings.lang] || p.name.th) + '</button>';
      }).join('');
      presetWrap.querySelectorAll('.theme-preset-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          settings.themePreset = btn.dataset.preset;
          settings.customColors = null;
          saveSettings();
          applyTheme();
          refreshPresetChips();
          syncColorInputsToCurrentTheme();
        });
      });
      refreshPresetChips();
    }

    // language chips
    const langBtns = { th: document.getElementById('langThBtn'), en: document.getElementById('langEnBtn') };
    function refreshLangChips() {
      Object.keys(langBtns).forEach(function (k) { langBtns[k].classList.toggle('active', settings.lang === k); });
    }
    Object.keys(langBtns).forEach(function (k) {
      langBtns[k].addEventListener('click', function () {
        settings.lang = k;
        saveSettings();
        refreshLangChips();
        applyI18n();
        renderPresetChips();
        renderDashboard();
        renderCardboxTab();
        renderCardboxGroups();
      });
    });
    refreshLangChips();

    // theme preset chips (initial render)
    renderPresetChips();

    // custom color pickers
    const boardInput = document.getElementById('themeColorBoard');
    const brassInput = document.getElementById('themeColorBrass');
    const tealInput = document.getElementById('themeColorTeal');
    const creamInput = document.getElementById('themeColorCream');

    function syncColorInputsToCurrentTheme() {
      const preset = THEME_PRESETS.find(function (p) { return p.id === settings.themePreset; }) || THEME_PRESETS[0];
      const c = settings.customColors || { board: preset.board0, brass: preset.brass, teal: preset.teal, cream: preset.cream };
      boardInput.value = c.board;
      brassInput.value = c.brass;
      tealInput.value = c.teal;
      creamInput.value = c.cream;
    }
    syncColorInputsToCurrentTheme();

    function applyCustomFromInputs() {
      settings.customColors = {
        board: boardInput.value, brass: brassInput.value, teal: tealInput.value, cream: creamInput.value
      };
      saveSettings();
      applyTheme();
      refreshPresetChips();
    }
    [boardInput, brassInput, tealInput, creamInput].forEach(function (inp) {
      inp.addEventListener('input', applyCustomFromInputs);
    });

    document.getElementById('themeResetBtn').addEventListener('click', function () {
      settings.customColors = null;
      settings.themePreset = 'felt';
      saveSettings();
      applyTheme();
      refreshPresetChips();
      syncColorInputsToCurrentTheme();
    });

    // font family + size
    const fontFamilyWrap = document.getElementById('fontFamilyChips');
    fontFamilyWrap.innerHTML = FONT_OPTIONS.map(function (o) {
      return '<button type="button" class="mode-chip" data-font="' + o.id + '">' + o.label + '</button>';
    }).join('');
    function refreshFontFamilyChips() {
      fontFamilyWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.font === settings.fontFamily);
      });
    }
    refreshFontFamilyChips();
    fontFamilyWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.fontFamily = btn.dataset.font;
        saveSettings();
        applyFontSettings();
        refreshFontFamilyChips();
      });
    });

    const fontSizeWrap = document.getElementById('fontSizeChips');
    function refreshFontSizeChips() {
      fontSizeWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
        btn.classList.toggle('active', parseFloat(btn.dataset.size) === settings.fontScale);
      });
    }
    refreshFontSizeChips();
    fontSizeWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.fontScale = parseFloat(btn.dataset.size);
        saveSettings();
        applyFontSettings();
        refreshFontSizeChips();
      });
    });

    // dashboard suggested-word range settings
    const dashMinInput = document.getElementById('dashRangeMin');
    const dashMaxInput = document.getElementById('dashRangeMax');
    const dashCountInput = document.getElementById('dashRangeCount');
    dashMinInput.value = settings.dashMin;
    dashMaxInput.value = settings.dashMax;
    dashCountInput.value = settings.dashCount;
    [dashMinInput, dashMaxInput, dashCountInput].forEach(function (inp) {
      inp.addEventListener('change', function () {
        let min = parseInt(dashMinInput.value, 10) || CSW24_MIN_LEN;
        let max = parseInt(dashMaxInput.value, 10) || CSW24_MAX_LEN;
        let count = parseInt(dashCountInput.value, 10) || 12;
        min = Math.max(CSW24_MIN_LEN, Math.min(min, CSW24_MAX_LEN));
        max = Math.max(CSW24_MIN_LEN, Math.min(max, CSW24_MAX_LEN));
        if (min > max) { const t2 = min; min = max; max = t2; }
        count = Math.max(1, Math.min(count, 60));
        settings.dashMin = min; settings.dashMax = max; settings.dashCount = count;
        dashMinInput.value = min; dashMaxInput.value = max; dashCountInput.value = count;
        saveSettings();
      });
    });

    // show-hooks toggle (front/back hooks displayed inline wherever a word shows)
    const showHooksToggle = document.getElementById('showHooksToggle');
    showHooksToggle.checked = settings.showHooks !== false;
    showHooksToggle.addEventListener('change', function () {
      settings.showHooks = showHooksToggle.checked;
      saveSettings();
      // re-render whichever view is currently open so the change is visible
      // immediately without requiring navigation.
      if (document.getElementById('tab-dashboard').classList.contains('active')) renderDashboard();
      if (document.getElementById('tab-cardbox').classList.contains('active')) renderCardboxTab();
    });

    // anagram auto-reshuffle: while an Anagram card is unsolved, the tile
    // rack reshuffles itself on a timer instead of staying static.
    const anagramAutoReshuffleToggle = document.getElementById('anagramAutoReshuffleToggle');
    const anagramReshuffleSecondsInput = document.getElementById('anagramReshuffleSeconds');
    anagramAutoReshuffleToggle.checked = !!settings.anagramAutoReshuffle;
    anagramReshuffleSecondsInput.value = settings.anagramReshuffleSeconds || 3;
    anagramAutoReshuffleToggle.addEventListener('change', function () {
      settings.anagramAutoReshuffle = anagramAutoReshuffleToggle.checked;
      saveSettings();
    });
    anagramReshuffleSecondsInput.addEventListener('change', function (e) {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      v = Math.min(v, 30);
      e.target.value = v;
      settings.anagramReshuffleSeconds = v;
      saveSettings();
    });

    // leech threshold: how many consecutive misses on one card before it
    // gets flagged as a "leech" (see updateCardResult).
    const leechThresholdInput = document.getElementById('leechThresholdInput');
    leechThresholdInput.value = settings.leechThreshold || 4;
    leechThresholdInput.addEventListener('change', function (e) {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 2) v = 2;
      v = Math.min(v, 20);
      e.target.value = v;
      settings.leechThreshold = v;
      saveSettings();
    });
  }

  // ---------- generic helpers ----------

  function sortLetters(word) {
    return word.split('').sort().join('');
  }

  function wordScore(word) {
    let s = 0;
    for (let i = 0; i < word.length; i++) s += SCRABBLE_VALUES[word[i]] || 0;
    return s;
  }

  function letterCounts(str) {
    const m = {};
    for (let i = 0; i < str.length; i++) m[str[i]] = (m[str[i]] || 0) + 1;
    return m;
  }

  function isSubsetOfCounts(word, rackCounts) {
    const wc = letterCounts(word);
    for (const ch in wc) {
      if ((rackCounts[ch] || 0) < wc[ch]) return false;
    }
    return true;
  }

  // ---------- Hooks (front/back single-letter extensions) ----------
  // A "hook" is a single letter that, added to the front or back of a word,
  // forms another valid dictionary word of length+1. E.g. AA -> BAA (front
  // hook B) or AAL (back hook L). We cache a Set per word-length so repeated
  // hook lookups (26 letters x 2 sides, for every word shown) stay O(1) each
  // instead of re-scanning the whole length-pool per check.
  const _lengthSetCache = {};
  function lengthSet(L) {
    const cacheKey = L + (includeCustomEnabled() ? ':custom' : '');
    if (_lengthSetCache[cacheKey]) return _lengthSetCache[cacheKey];
    const pool = lengthPool(L);
    const set = new Set(pool);
    _lengthSetCache[cacheKey] = set;
    return set;
  }

  function getHooks(word) {
    const front = [];
    const back = [];
    const longerSet = lengthSet(word.length + 1);
    if (longerSet.size) {
      for (let c = 65; c <= 90; c++) {
        const letter = String.fromCharCode(c);
        if (longerSet.has(letter + word)) front.push(letter);
        if (longerSet.has(word + letter)) back.push(letter);
      }
    }
    return { front: front, back: back };
  }

  // One extra level of hooks beyond getHooks(): for each single-letter back
  // hook (e.g. GODSO + N -> GODSON), also check whether *that* resulting
  // word has back hooks of its own (GODSON + S -> GODSONS). Surfaces
  // "hook chains" a plain one-letter hook list doesn't show, so the user
  // can see a word is buildable in more than one step. Kept shallow (one
  // extra level, back hooks only) to stay cheap enough for the word-detail
  // click path — this is not meant to be a full recursive tree (the
  // Word Growth Tree screen already covers that).
  function getChainedBackHooks(word, backHooks) {
    const chains = [];
    backHooks.forEach(function (letter) {
      const extended = word + letter;
      const next = getHooks(extended);
      if (next.back.length) chains.push({ word: extended, hooks: next.back });
    });
    return chains;
  }

  // Common CSW-legal inflection suffixes to test against a word. Two kinds:
  //  - "add" patterns just append the suffix straight on (CAT -> CATS).
  //  - "y" patterns apply only to words ending in Y, replacing the Y before
  //    adding the suffix (ACIDY -> drop Y -> ACID + IER -> ACIDIER). This
  //    covers the classic adjective comparative/superlative pattern
  //    (-Y/-IER/-IEST) plus a few related -Y swaps.
  const INFLECTION_SUFFIXES = [
    { suffix: 'S', label: '+S' },
    { suffix: 'ES', label: '+ES' },
    { suffix: 'ED', label: '+ED' },
    { suffix: 'ING', label: '+ING' },
    { suffix: 'ER', label: '+ER' },
    { suffix: 'EST', label: '+EST' },
    { suffix: 'LY', label: '+LY' }
  ];
  const Y_SWAP_SUFFIXES = [
    { suffix: 'IER', label: '-Y+IER' },
    { suffix: 'IEST', label: '-Y+IEST' },
    { suffix: 'IED', label: '-Y+IED' },
    { suffix: 'ILY', label: '-Y+ILY' },
    { suffix: 'IES', label: '-Y+IES' },
    { suffix: 'INESS', label: '-Y+INESS' }
  ];

  // Finds valid CSW24 words formed by inflecting `word` — plain suffixes
  // (CAT -> CATS) and, for words ending in Y, the Y-replacement forms an
  // adjective like ACIDY takes for comparative/superlative (ACIDY ->
  // ACIDIER, ACIDIEST). Returns a list of { form, label } for whichever
  // combinations actually land on a real dictionary word.
  function getInflections(word) {
    const results = [];
    const seen = new Set();
    function tryForm(form, label) {
      if (seen.has(form)) return;
      seen.add(form);
      if (form !== word && lengthSet(form.length).has(form)) results.push({ form: form, label: label });
    }
    INFLECTION_SUFFIXES.forEach(function (s) { tryForm(word + s.suffix, s.label); });
    if (word.length > 1 && word.charAt(word.length - 1) === 'Y') {
      const stem = word.slice(0, -1);
      Y_SWAP_SUFFIXES.forEach(function (s) { tryForm(stem + s.suffix, s.label); });
    }
    return results;
  }

  // ---------- word detail: unfamiliar marks, notes, definitions ----------

  let _unfamCache = null;
  function loadUnfamiliar() {
    if (_unfamCache) return _unfamCache;
    try { _unfamCache = JSON.parse(localStorage.getItem(UNFAM_KEY) || '[]'); }
    catch (e) { _unfamCache = []; }
    return _unfamCache;
  }
  function isUnfamiliar(word) { return loadUnfamiliar().indexOf(word) !== -1; }
  function toggleUnfamiliar(word) {
    const list = loadUnfamiliar();
    const i = list.indexOf(word);
    if (i === -1) list.push(word); else list.splice(i, 1);
    localStorage.setItem(UNFAM_KEY, JSON.stringify(list));
    return i === -1; // true = now marked
  }

  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function getNote(word) { return loadNotes()[word] || ''; }
  function setNote(word, text) {
    const notes = loadNotes();
    if (text) notes[word] = text; else delete notes[word];
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  // ---------- word history log (every time a word is encountered anywhere) ----------
  // { word: [{t: ms, mode: 'quiz'|'generate'|'cardbox'|'suggested'|'typing'|'racks'|'alpha'|'marathon'}, ...] }
  // Capped per-word to keep storage bounded on words seen very often.
  const HISTORY_CAP_PER_WORD = 200;
  let _historyCache = null;
  function loadHistory() {
    if (_historyCache) return _historyCache;
    try { _historyCache = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); }
    catch (e) { _historyCache = {}; }
    return _historyCache;
  }
  const MODE_LABELS = {
    quiz: 'แบบทดสอบ', generate: 'สร้างคำศัพท์', cardbox: 'ทบทวน Cardbox',
    suggested: 'คำแนะนำ Dashboard', typing: 'พิมพ์ศัพท์ (Minigame)',
    racks: 'Random Racks (Minigame)', alpha: 'Alphagram Blitz (Minigame)',
    learn: 'Learn (ด่าน)',
    marathon: 'Time Attack Marathon (Minigame)', browse: 'คลังคำศัพท์'
  };
  function logWordEncounter(word, mode) {
    if (!word || !mode) return;
    const hist = loadHistory();
    const list = hist[word] || (hist[word] = []);
    list.push({ t: Date.now(), mode: mode });
    if (list.length > HISTORY_CAP_PER_WORD) list.splice(0, list.length - HISTORY_CAP_PER_WORD);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  }
  function getWordHistory(word) {
    return (loadHistory()[word] || []).slice().reverse(); // most recent first
  }

  // Longest dictionary suffix/prefix this word is built from (e.g. RETINAS
  // -> suffix +S off RETINA). Simple heuristic: strip 1 letter and check the
  // remainder is a valid shorter word.
  function suffixInfo(word) {
    if (word.length < 2) return null;
    const base = word.slice(0, -1);
    if (lengthSet(base.length).has(base)) return '+' + word.slice(-1) + ' (จาก ' + base + ')';
    return null;
  }
  function prefixInfo(word) {
    if (word.length < 2) return null;
    const base = word.slice(1);
    if (lengthSet(base.length).has(base)) return word.charAt(0) + '+ (จาก ' + base + ')';
    return null;
  }

  // Definition lookup via the Free Dictionary API (dictionaryapi.dev) — no
  // API key or signup needed. Silently returns '' on any failure (offline,
  // word not found, obscure Scrabble-only word not in a general dictionary)
  // so the UI just omits the definition rather than showing an error.
  const _defCache = {};
  function fetchDefinition(word, cb) {
    if (_defCache[word] !== undefined) { cb(_defCache[word]); return; }
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase()))
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (arr) {
        let text = '';
        if (Array.isArray(arr) && arr[0] && arr[0].meanings && arr[0].meanings[0]) {
          const def = arr[0].meanings[0].definitions && arr[0].meanings[0].definitions[0];
          if (def && def.definition) text = def.definition;
        }
        _defCache[word] = text;
        cb(text);
      })
      .catch(function () { _defCache[word] = ''; cb(''); });
  }

  // ---------- word "Probability" and "Playability" ----------
  // Probability: chance of drawing exactly this word's letters (as a set,
  // any order) in a single random draw of word.length tiles from the full
  // 100-tile bag (2 blanks). This is the standard combinatorial word-study
  // stat used by tools like Zyzzyva: (ways to draw this letter multiset,
  // counting blanks-as-any-letter) / (total ways to draw N tiles from 100).
  // Playability: a 0-100 relative ease score, ranking each word against all
  // other words of the same length by that same probability (higher =
  // easier/more likely to be drawable).

  const _nCrCache = {};
  function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    const key = n + '_' + r;
    if (_nCrCache[key] !== undefined) return _nCrCache[key];
    r = Math.min(r, n - r);
    let result = 1;
    for (let i = 0; i < r; i++) {
      result = (result * (n - i)) / (i + 1);
    }
    _nCrCache[key] = result;
    return result;
  }

  // Computes: sum over ways to cover `blanksForWord` letter-instances (from
  // `counts`) with blanks, of [ product over letters of C(bagCount[ch], directCopiesNeeded) ]
  // times C(remaining blanks, 0..) handled by caller for extra/filler tiles.
  // For simplicity and correctness at rack sizes actually used (<=15, mostly <=7),
  // we do a direct recursive allocation over the (small) set of distinct letters.
  function distributeBlanksWays(counts, blanksForWord) {
    const letters = Object.keys(counts);
    let totalWays = 0;
    function recurse(i, blanksLeft, product) {
      if (i === letters.length) {
        if (blanksLeft === 0) totalWays += product;
        return;
      }
      const ch = letters[i];
      const need = counts[ch];
      const bagHas = TILE_BAG[ch] || 0;
      const maxBlankHere = Math.min(need, blanksLeft);
      for (let b = 0; b <= maxBlankHere; b++) {
        const directNeeded = need - b;
        const ways = nCr(bagHas, directNeeded);
        if (ways === 0 && directNeeded > 0) continue;
        recurse(i + 1, blanksLeft - b, product * ways);
      }
    }
    recurse(0, blanksForWord, 1);
    return totalWays;
  }

  const _wordProbCache = {};
  // Returns probability (0-1) of drawing this word's letters in a random
  // draw of word.length tiles from the 100-tile bag (fillers can be anything).
  function wordDrawProbability(word) {
    if (_wordProbCache[word] !== undefined) return _wordProbCache[word];
    const n = word.length;
    if (n < 1 || n > TILE_BAG_TOTAL) { _wordProbCache[word] = 0; return 0; }
    const counts = letterCounts(word);
    const need = n; // total letters needed = word length (no repeats beyond counts)
    const blanksAvail = TILE_BAG['?'];
    let favorable = 0;
    // For each number of blanks used to cover word letters (0..min(need,2)):
    for (let blanksForWord = 0; blanksForWord <= Math.min(need, blanksAvail); blanksForWord++) {
      const allocateWays = distributeBlanksWays(counts, blanksForWord);
      if (allocateWays === 0) continue;
      // Ways to choose *which* physical blank tile(s) out of the bag's 2
      // blanks are the ones drawn (blanks are separate tiles in the bag).
      const chooseBlankWays = nCr(blanksAvail, blanksForWord);
      // drawSize === word.length here, so no extra filler tiles are needed.
      favorable += allocateWays * chooseBlankWays;
    }
    const totalWays = nCr(TILE_BAG_TOTAL, n);
    const prob = totalWays > 0 ? favorable / totalWays : 0;
    _wordProbCache[word] = prob;
    return prob;
  }

  // Playability: percentile rank (0-100) of this word's draw probability
  // among all CSW24 words of the same length. Higher = relatively easier
  // to draw/play than other words of that length. Cached per length.
  const _playabilityRankCache = {};
  function _playabilityRankData(L) {
    if (!_playabilityRankCache[L]) {
      const pool = (typeof lengthPool === 'function' ? lengthPool(L) : (CSW24_BY_LENGTH[L] || []));
      const probs = pool.map(function (w) { return wordDrawProbability(w); });
      const sorted = probs.slice().sort(function (a, b) { return a - b; });
      const max = sorted.length ? sorted[sorted.length - 1] : 0;
      _playabilityRankCache[L] = { pool: pool, sorted: sorted, max: max };
    }
    return _playabilityRankCache[L];
  }

  function wordPlayability(word) {
    const data = _playabilityRankData(word.length);
    const sorted = data.sorted;
    if (!sorted.length) return 0;
    const p = wordDrawProbability(word);
    // Binary search for rank position (percentile of words at or below this probability)
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < p) lo = mid + 1; else hi = mid;
    }
    const percentile = sorted.length > 1 ? (lo / (sorted.length - 1)) * 100 : 100;
    return Math.round(percentile);
  }

  // Probability normalized against the easiest-to-draw word of the same
  // length (that word = 100%), so the displayed number is always a
  // readable 0-100% instead of a tiny fraction like 0.0035%.
  function wordProbabilityNormalizedPct(word) {
    const data = _playabilityRankData(word.length);
    if (!data.max) return 0;
    const p = wordDrawProbability(word);
    return Math.round((p / data.max) * 100);
  }

  // For "big" tiles, longer words need a smaller tile size or they can't
  // realistically fit/wrap on a phone screen (a 15-letter word at full size
  // is wider than most viewports). This only kicks in for the big size,
  // since small/rack tiles are already compact.
  function lengthTileSizeClass(sizeClass, length) {
    if (sizeClass !== 'big') return sizeClass;
    if (length >= 13) return 'big longer-word';
    if (length >= 10) return 'big long-word';
    return sizeClass;
  }

  function tileRowHTML(word, sizeClass) {
    sizeClass = lengthTileSizeClass(sizeClass || '', word.length);
    return '<span class="tile-word">' + word.split('').map(function (ch) {
      return '<span class="letter-tile ' + sizeClass + '">' + ch +
        '<span class="pv">' + (SCRABBLE_VALUES[ch] || '') + '</span></span>';
    }).join('') + '</span>';
  }

  function blankTileRowHTML(length, sizeClass) {
    sizeClass = lengthTileSizeClass(sizeClass || '', length);
    let out = '<span class="tile-word">';
    for (let i = 0; i < length; i++) {
      out += '<span class="letter-tile blank ' + sizeClass + '">&nbsp;</span>';
    }
    return out + '</span>';
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- custom word pool ----------

  let customWords = [];
  let customByLength = {};

  function loadCustomWords() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      customWords = raw ? JSON.parse(raw) : [];
    } catch (e) {
      customWords = [];
    }
    rebuildCustomIndex();
  }

  function saveCustomWords() {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customWords));
  }

  function rebuildCustomIndex() {
    customByLength = {};
    customWords.forEach(function (w) {
      (customByLength[w.length] = customByLength[w.length] || []).push(w);
    });
    // custom words changed the length pools, so any cached hook/anagram
    // length-sets built from the old pools are now stale.
    for (const k in _lengthSetCache) delete _lengthSetCache[k];
  }

  function includeCustomEnabled() {
    const el = document.getElementById('includeCustomWords');
    return !!(el && el.checked && customWords.length);
  }

  // central pool accessor — everything that needs a word list by length
  // should go through here so custom imported words participate everywhere.
  function lengthPool(L) {
    const base = CSW24_BY_LENGTH[L] || [];
    if (includeCustomEnabled() && customByLength[L] && customByLength[L].length) {
      return base.concat(customByLength[L]);
    }
    return base;
  }

  function getAnagrams(word) {
    const key = sortLetters(word);
    const pool = lengthPool(word.length);
    const partners = [];
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      if (w !== word && sortLetters(w) === key) partners.push(w);
    }
    return partners;
  }

  // ---------- Stem system (6-letter combos that extend to many 7-letter bingos) ----------
  //
  // A "stem" here is a 6-letter alphagram (unordered letter set). Its value is how many
  // of the 26 letters, when added to it, form at least one valid 7-letter word — the
  // standard Scrabble/CSW sense of "stem" (e.g. SATIRE + one letter = 8+ bingos).
  // This is deliberately NOT the alphagram-partner-count used by Alphagram Blitz — that
  // measures how many 7-letter words share one fixed 7-letter letter-set, which answers a
  // different question ("how many words are anagrams of each other") than "how flexible is
  // this 6-letter base for building bingos".
  //
  // The table is built once lazily (it's a single pass over the 6- and 7-letter lists) and
  // cached, since it doesn't depend on custom words settings changing per-call — if custom
  // words toggle changes, callers can force a rebuild via stemInvalidateCache().

  const ALPHABET_26 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let stemTableCache = null; // Map<alphagramKey6, { key, letterHits: Map<letter, string[]>, total }>
  let stemTableCacheSignature = null;

  function stemPoolSignature() {
    // Cheap signature so we know whether to rebuild (custom words toggle, or custom list length).
    return (includeCustomEnabled() ? 'custom:' + (customByLength[6] || []).length + ',' + (customByLength[7] || []).length : 'base');
  }

  function stemBuildTable() {
    const words6 = lengthPool(6);
    const words7 = lengthPool(7);

    // Group 6-letter words by alphagram, just so we know which 6-letter keys actually
    // correspond to at least one real word (a stem should itself be a playable word/rack,
    // not just any arbitrary letter combination).
    const key6ToWords = new Map();
    for (let i = 0; i < words6.length; i++) {
      const w = words6[i];
      const key = sortLetters(w);
      if (!key6ToWords.has(key)) key6ToWords.set(key, []);
      key6ToWords.get(key).push(w);
    }

    const table = new Map();

    for (let i = 0; i < words7.length; i++) {
      const w7 = words7[i];
      // Try removing each letter position to see which 6-letter base(s) this word extends.
      // Using a Set of 6-letter keys already tried for this word avoids duplicate work when
      // w7 has repeated letters (e.g. removing either 'S' in a word with two S's gives the
      // same 6-letter remainder).
      const triedKeys = new Set();
      for (let pos = 0; pos < w7.length; pos++) {
        const removedLetter = w7[pos];
        const remainder = w7.slice(0, pos) + w7.slice(pos + 1);
        const key6 = sortLetters(remainder);
        if (triedKeys.has(key6)) continue;
        triedKeys.add(key6);
        if (!key6ToWords.has(key6)) continue; // remainder isn't itself a real 6-letter word/rack

        let entry = table.get(key6);
        if (!entry) {
          entry = { key: key6, letterHits: new Map(), total: 0 };
          table.set(key6, entry);
        }
        if (!entry.letterHits.has(removedLetter)) entry.letterHits.set(removedLetter, []);
        const bucket = entry.letterHits.get(removedLetter);
        if (bucket.indexOf(w7) === -1) bucket.push(w7);
      }
    }

    for (const entry of table.values()) {
      entry.total = entry.letterHits.size; // number of distinct letters that unlock >=1 bingo
      entry.words6 = key6ToWords.get(entry.key) || [];
    }

    return table;
  }

  function stemGetTable() {
    const sig = stemPoolSignature();
    if (!stemTableCache || stemTableCacheSignature !== sig) {
      stemTableCache = stemBuildTable();
      stemTableCacheSignature = sig;
    }
    return stemTableCache;
  }

  function stemInvalidateCache() {
    stemTableCache = null;
    stemTableCacheSignature = null;
  }

  // Returns the top N 6-letter stems ranked by how many distinct letters extend them to a
  // 7-letter word (descending). Each result:
  //   { key, words6: [...], total, letterHits: Map<letter, word7[]> }
  function stemTopStems(count) {
    const table = stemGetTable();
    const entries = Array.from(table.values());
    entries.sort(function (a, b) { return b.total - a.total || a.key.localeCompare(b.key); });
    return entries.slice(0, Math.max(1, count || 20));
  }

  // Returns the full stem entry for a specific 6-letter word (any valid anagram of it),
  // or null if that letter combination isn't tracked (i.e. extends to no 7-letter word).
  function stemLookup(word6) {
    const table = stemGetTable();
    return table.get(sortLetters(word6)) || null;
  }

  // Convenience: for a given 6-letter word, list { letter, words7 } sorted by letter A-Z,
  // for rendering "add this letter -> these bingos" in a study UI.
  function stemExtensionsFor(word6) {
    const entry = stemLookup(word6);
    if (!entry) return [];
    return ALPHABET_26
      .filter(function (letter) { return entry.letterHits.has(letter); })
      .map(function (letter) { return { letter: letter, words7: entry.letterHits.get(letter).slice().sort() }; });
  }

  function pickRandomWords(min, max, count) {
    const lengths = [];
    let totalWeight = 0;
    for (let L = min; L <= max; L++) {
      const arr = lengthPool(L);
      if (arr && arr.length) {
        lengths.push({ L: L, w: arr.length });
        totalWeight += arr.length;
      }
    }
    if (!lengths.length) return [];
    const target = Math.min(count, totalWeight);
    const seen = new Set();
    const result = [];
    let guard = 0;
    while (result.length < target && guard < target * 60 + 200) {
      guard++;
      let r = Math.random() * totalWeight;
      let chosenLen = lengths[lengths.length - 1].L;
      for (let i = 0; i < lengths.length; i++) {
        if (r < lengths[i].w) { chosenLen = lengths[i].L; break; }
        r -= lengths[i].w;
      }
      const arr = lengthPool(chosenLen);
      const w = arr[Math.floor(Math.random() * arr.length)];
      if (!seen.has(w)) { seen.add(w); result.push(w); }
    }
    return result;
  }

  // ---------- shared word-row + anagram toggle rendering ----------

  function hookSummaryHTML(word) {
    if (!settings.showHooks) return '';
    const hooks = getHooks(word);
    if (!hooks.front.length && !hooks.back.length) return '';
    let html = '<div class="word-hooks">';
    if (hooks.front.length) {
      html += '<span class="hook-group hook-front"><span class="hook-label">Front:</span>' +
        hooks.front.map(function (l) { return '<span class="hook-letter">' + l + '</span>'; }).join('') +
        '</span>';
    }
    if (hooks.back.length) {
      html += '<span class="hook-group hook-back"><span class="hook-label">Back:</span>' +
        hooks.back.map(function (l) { return '<span class="hook-letter">' + l + '</span>'; }).join('') +
        '</span>';
    }
    html += '</div>';
    return html;
  }

  // `selection` lets different tabs (Word Browser, Generate, Dashboard) each
  // keep their own independently-checked Set of words while sharing the same
  // row markup/behavior. `checkClass` distinguishes each tab's checkboxes so
  // their change-listeners don't pick up checkboxes belonging to another tab.
  function wordRowHTML(word, showCheckbox, selection, checkClass, idx) {
    uidCounter++;
    const uid = uidCounter;
    const sel = selection || browseState.selected;
    const cls = checkClass || 'browse-check';
    const checkboxHTML = showCheckbox
      ? '<label class="card-row-select"><input type="checkbox" class="' + cls + '" data-word="' + word + '"' +
        (sel.has(word) ? ' checked' : '') + '></label>'
      : '';
    const idxHTML = idx !== undefined ? '<span class="word-idx">#' + idx + '</span>' : '';
    const unfamCls = isUnfamiliar(word) ? ' word-unfamiliar' : '';
    return (
      '<div class="word-row word-row-clickable' + unfamCls + '" data-word="' + word + '">' +
        '<div class="word-row-top">' +
          checkboxHTML +
          idxHTML +
          '<div>' + tileRowHTML(word) + '</div>' +
          '<div class="word-meta">' +
            '<span class="meta-item">' + word.length + ' ตัวอักษร</span>' +
            '<span class="meta-item">' + wordScore(word) + ' คะแนน</span>' +
            '<span class="meta-item">Prob ' + wordProbabilityNormalizedPct(word) + '%</span>' +
            '<span class="meta-item">Play ' + wordPlayability(word) + '</span>' +
          '</div>' +
          hookSummaryHTML(word) +
          '<button class="anagram-toggle" data-uid="' + uid + '" data-word="' + word + '">🔤 ดู Anagram</button>' +
        '</div>' +
        '<div class="anagram-detail" id="anagram-' + uid + '"></div>' +
      '</div>'
    );
  }

  function browseWordRowHTML(word, idx) {
    return wordRowHTML(word, true, browseState.selected, 'browse-check', idx);
  }

  function bindAnagramToggles(container) {
    container.querySelectorAll('.anagram-toggle').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        const uid = btn.dataset.uid;
        const word = btn.dataset.word;
        const detail = document.getElementById('anagram-' + uid);
        const isOpen = detail.classList.contains('open');
        if (isOpen) {
          detail.classList.remove('open');
          btn.textContent = '🔤 ดู Anagram';
          return;
        }
        if (!detail.dataset.built) {
          const key = sortLetters(word);
          const partners = getAnagrams(word);
          let html = '<div class="key-row"><span class="key-label">เรียงตามตัวอักษร:</span>' + tileRowHTML(key, 'small') + '</div>';
          if (partners.length) {
            html += '<div class="key-row"><span class="key-label">คำ Anagram (' + partners.length + '):</span></div>';
            html += '<div class="anagram-partners">' + partners.map(function (p) {
              return '<span class="anagram-chip">' + p + '</span>';
            }).join('') + '</div>';
          } else {
            html += '<div class="no-anagram">ไม่มีคำอื่นที่เป็น Anagram ของคำนี้ในพจนานุกรม</div>';
          }
          detail.innerHTML = html;
          detail.dataset.built = '1';
        }
        detail.classList.add('open');
        btn.textContent = '🔤 ซ่อน Anagram';
        if (window.Achievements) window.Achievements.record('anagram_view');
      });
    });
  }

  // ---------- word detail modal ----------

  // Renders the HOOK row: the plain front/back one-letter hooks, plus (if
  // any back hook itself leads to a word with further back hooks) a
  // "chain" line so a word like GODSO shows not just "+N -> GODSON" but
  // that GODSON can then take "+S -> GODSONS" too.
  function hookDetailHTML(word, hooks) {
    let html = (hooks.front.length ? '‹ ' + hooks.front.join(',') + word : '—') + ' / ' +
      (hooks.back.length ? word + hooks.back.join(',') + ' ›' : '—');
    const chains = getChainedBackHooks(word, hooks.back);
    if (chains.length) {
      html += '<div class="wd-hook-chains">' + chains.map(function (c) {
        return '<div class="wd-hook-chain-line">' +
          '<span class="wd-hook-chain-word">' + c.word + '</span>' +
          ' + <span class="hook-letter" style="background:var(--teal-deep);color:var(--cream)">' +
          c.hooks.join('</span><span class="hook-letter" style="background:var(--teal-deep);color:var(--cream);margin-left:2px">') +
          '</span> → ' +
          c.hooks.map(function (l) { return c.word + l; }).join(', ') +
        '</div>';
      }).join('') + '</div>';
    }
    return html;
  }

  // Renders the FORMS row: valid inflected forms of the word (plurals,
  // -ED/-ING, comparative/superlative -ER/-EST, and for -Y adjectives like
  // ACIDY the -Y -> -IER/-IEST/etc swap forms), each tagged with which
  // suffix pattern produced it.
  function inflectionFormsHTML(word) {
    const forms = getInflections(word);
    if (!forms.length) return '<span style="opacity:0.6">ไม่มีรูปแปรที่พบใน CSW24</span>';
    return forms.map(function (f) {
      return '<span class="wd-form-chip"><span class="wd-form-word">' + f.form + '</span>' +
        '<span class="wd-form-label">' + f.label + '</span></span>';
    }).join('');
  }

  function openWordDetail(word) {
    const overlay = document.getElementById('wordDetailOverlay');
    document.getElementById('wdWord').textContent = word;
    document.getElementById('wdDef').textContent = 'กำลังโหลดความหมาย...';
    fetchDefinition(word, function (text) {
      document.getElementById('wdDef').textContent = text || 'ไม่พบความหมาย';
    });

    const idx = browseState.results.indexOf(word);
    const inLenMode = browseState.activeLength !== 'all';
    document.getElementById('wdProp').textContent =
      (inLenMode ? 'คำที่ ' : 'คำที่ ') + (idx !== -1 ? idx + 1 : '?') +
      (inLenMode ? ' (Prob ' + wordProbabilityNormalizedPct(word) + '%)' : '');

    const box = loadCardbox();
    const card = box.find(function (c) { return c.word === word; });
    document.getElementById('wdRank').textContent = card ? statusLabel(card.status) : 'ยังไม่เรียน';
    document.getElementById('wdCardboxNote').textContent = card ? 'มีอยู่ใน Cardbox แล้ว' : '';
    const addBtn = document.getElementById('wdAddCardboxBtn');
    addBtn.style.display = card ? 'none' : '';
    addBtn.onclick = function () {
      addWordsToCardbox([word]);
      showToast('เพิ่ม ' + word + ' เข้า Cardbox แล้ว');
      openWordDetail(word);
    };

    // "+?" combos: only the letters that actually extend this word (back
    // hooks), plus any longer words this word is a prefix of.
    const hooks = getHooks(word);
    const longerSet = lengthSet(word.length + 1);
    const extensions = [];
    for (let c = 65; c <= 90; c++) {
      const l = String.fromCharCode(c);
      if (longerSet.has(word + l)) extensions.push(word + l);
    }
    let plusHTML = '<span class="wd-label">' + word + ' + ?</span>';
    if (hooks.back.length) {
      plusHTML += hooks.back.map(function (l) {
        return '<span class="wd-plus-slot wd-plus-valid">' + l + '</span>';
      }).join('');
    } else {
      plusHTML += '<span style="opacity:0.6">ไม่มีตัวต่อท้ายได้</span>';
    }
    if (extensions.length) {
      plusHTML += '<div style="margin-top:6px">' + extensions.join(', ') + '</div>';
    }
    document.getElementById('wdPlusRow').innerHTML = plusHTML;

    document.getElementById('wdHook').innerHTML = hookDetailHTML(word, hooks);
    document.getElementById('wdSuffix').textContent = suffixInfo(word) || 'ไม่มี';
    document.getElementById('wdPrefix').textContent = prefixInfo(word) || 'ไม่มี';
    const wdFormsEl = document.getElementById('wdForms');
    if (wdFormsEl) wdFormsEl.innerHTML = inflectionFormsHTML(word);
    const anagrams = getAnagrams(word);
    document.getElementById('wdAnagram').textContent = anagrams.length ? [word].concat(anagrams).join(', ') : word;

    const noteInput = document.getElementById('wdNoteInput');
    noteInput.value = getNote(word);
    noteInput.onblur = function () { setNote(word, noteInput.value.trim()); };

    document.getElementById('wdFullPageBtn').onclick = function () {
      openWordFullPage(word);
    };

    const unfamBtn = document.getElementById('wdUnfamBtn');
    unfamBtn.textContent = isUnfamiliar(word) ? '✓ มาร์กแล้ว (กดเพื่อยกเลิก)' : '✍ มาร์กว่าไม่คุ้น';
    unfamBtn.onclick = function () {
      toggleUnfamiliar(word);
      unfamBtn.textContent = isUnfamiliar(word) ? '✓ มาร์กแล้ว (กดเพื่อยกเลิก)' : '✍ มาร์กว่าไม่คุ้น';
      const row = document.querySelector('.word-row[data-word="' + word + '"]');
      if (row) row.classList.toggle('word-unfamiliar', isUnfamiliar(word));
    };

    overlay.style.display = 'flex';
  }

  // ---------- word full page (Word Growth Tree + history) ----------

  document.getElementById('wdCloseBtn').addEventListener('click', function () {
    document.getElementById('wordDetailOverlay').style.display = 'none';
  });
  document.getElementById('wordDetailOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'wordDetailOverlay') e.currentTarget.style.display = 'none';
  });

  function wordGrowthChildren(word) {
    // One-letter extensions in either direction, capped at 8 total letters
    // per the growth-tree concept shown in the reference screenshot.
    if (word.length >= 8) return [];
    const hooks = getHooks(word);
    const children = [];
    hooks.front.forEach(function (l) { children.push({ word: l + word, tag: l + '+' }); });
    hooks.back.forEach(function (l) { children.push({ word: word + l, tag: '+' + l }); });
    return children;
  }

  let _wfpZoom = 1;
  function wfpSetZoom(z) {
    _wfpZoom = Math.max(0.5, Math.min(2, z));
    document.getElementById('wfpTree').style.transform = 'scale(' + _wfpZoom + ')';
    document.getElementById('wfpZoomPct').textContent = Math.round(_wfpZoom * 100) + '%';
  }
  document.getElementById('wfpZoomInBtn').addEventListener('click', function () { wfpSetZoom(_wfpZoom + 0.1); });
  document.getElementById('wfpZoomOutBtn').addEventListener('click', function () { wfpSetZoom(_wfpZoom - 0.1); });
  document.getElementById('wfpResetViewBtn').addEventListener('click', function () {
    wfpSetZoom(1);
    document.getElementById('wfpTreeViewport').scrollTo(0, 0);
  });
  document.getElementById('wfpExpandAllBtn').addEventListener('click', function () {
    document.querySelectorAll('#wfpTree .wfp-node-def[data-pending]').forEach(function (el) {
      const w = el.dataset.word;
      fetchDefinition(w, function (text) { el.textContent = text ? '[' + w.length + '] ' + text : ''; });
      el.removeAttribute('data-pending');
    });
  });

  // Distinct colors per anagram group, so words that are anagrams of each
  // other (same letters, different order) visually share a color — the
  // same convention as the reference Word Growth Tree design.
  const WFP_GROUP_COLORS = ['#e879c8', '#7dd3fc', '#facc15', '#86efac', '#fca5a5', '#c4b5fd'];
  function wfpGroupColor(word) {
    const key = sortLetters(word);
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return WFP_GROUP_COLORS[hash % WFP_GROUP_COLORS.length];
  }

  const NODE_W = 200, NODE_H = 74, ROW_GAP = 14, COL_GAP = 140;

  function renderWordTree(word) {
    const children = wordGrowthChildren(word);
    const canvas = document.getElementById('wfpTree');
    wfpSetZoom(1);

    const rootX = 0, rootY = Math.max(0, (children.length - 1) * (NODE_H + ROW_GAP)) / 2;
    const childX = COL_GAP + 140;

    let html = '<svg class="wfp-tree-svg" id="wfpTreeSvg"></svg>';
    html += '<div class="wfp-node wfp-node-root" style="left:' + rootX + 'px;top:' + rootY + 'px;width:140px;min-height:' + NODE_H + 'px">' +
      '<span class="wfp-node-tag">ROOT</span><span class="wfp-node-word">' + word + '</span>' +
      '</div>';
    html += '<div class="wfp-node-paths" style="left:' + rootX + 'px;top:' + (rootY + NODE_H + 8) + 'px">' + children.length + ' PATHS</div>';

    if (!children.length) {
      html += '<div class="wfp-tree-empty" style="position:absolute;left:' + childX + 'px;top:' + rootY + 'px">ไม่มีคำที่เติมต่อได้อีก (หรือถึง 8 ตัวอักษรแล้ว)</div>';
    } else {
      children.forEach(function (c, i) {
        const y = i * (NODE_H + ROW_GAP);
        const color = wfpGroupColor(c.word);
        html += '<div class="wfp-node wfp-node-child" data-word="' + c.word + '" style="left:' + childX + 'px;top:' + y + 'px;width:' + NODE_W + 'px;border-color:' + color + '55">' +
          '<span class="wfp-node-tag" style="background:' + color + '33;color:' + color + '">' + c.tag + '</span>' +
          '<span class="wfp-node-word">' + c.word + '</span>' +
          '<span class="wfp-node-def" data-pending data-word="' + c.word + '">กำลังโหลด...</span>' +
          '</div>';
      });
    }
    canvas.innerHTML = html;
    canvas.style.width = (childX + NODE_W + 40) + 'px';
    canvas.style.height = (Math.max(rootY + NODE_H + 40, children.length * (NODE_H + ROW_GAP)) + 40) + 'px';

    // Draw connector lines root -> each child (simple curved bezier).
    const svg = document.getElementById('wfpTreeSvg');
    svg.setAttribute('width', canvas.style.width);
    svg.setAttribute('height', canvas.style.height);
    let paths = '';
    const startX = 140, startY = rootY + NODE_H / 2;
    children.forEach(function (c, i) {
      const endY = i * (NODE_H + ROW_GAP) + NODE_H / 2;
      const midX = (startX + childX) / 2;
      paths += '<path class="wfp-tree-edge" d="M' + startX + ',' + startY + ' C' + midX + ',' + startY + ' ' + midX + ',' + endY + ' ' + childX + ',' + endY + '"/>';
    });
    svg.innerHTML = paths;

    // Lazily fetch each visible child's definition (first 6 only up-front;
    // "กางทุกกิ่ง" fetches the rest on demand) to avoid firing a burst of
    // network requests for words the person may never look at.
    canvas.querySelectorAll('.wfp-node-def[data-pending]').forEach(function (el, i) {
      if (i >= 6) return;
      const w = el.dataset.word;
      fetchDefinition(w, function (text) { el.textContent = text ? '[' + w.length + '] ' + text : ''; });
      el.removeAttribute('data-pending');
    });

    canvas.querySelectorAll('.wfp-node-child').forEach(function (node) {
      node.addEventListener('click', function () { openWordFullPage(node.dataset.word); });
    });
  }

  function renderWordHistoryInto(word, summaryElId, listElId) {
    const hist = getWordHistory(word);
    const summaryEl = document.getElementById(summaryElId);
    const listEl = document.getElementById(listElId);
    if (!hist.length) {
      summaryEl.textContent = '';
      listEl.innerHTML = '<div class="wd-history-empty">ยังไม่เคยเจอคำนี้เลย</div>';
    } else {
      const counts = {};
      hist.forEach(function (h) { counts[h.mode] = (counts[h.mode] || 0) + 1; });
      summaryEl.textContent = 'เจอทั้งหมด ' + hist.length + ' ครั้ง — ' +
        Object.keys(counts).map(function (m) { return (MODE_LABELS[m] || m) + ' ' + counts[m]; }).join(', ');
      listEl.innerHTML = hist.slice(0, 30).map(function (h) {
        const d = new Date(h.t);
        return '<div class="wd-history-item"><span>' + (MODE_LABELS[h.mode] || h.mode) + '</span>' +
          '<span>' + d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + '</span></div>';
      }).join('');
    }
  }

  // The full page is its own overlay, stacked above the quick-detail modal.
  // It never touches Browse tab state (search box, sort, filters, scroll),
  // so closing/back always leaves Browse exactly as the person left it.
  function openWordFullPage(word) {
    document.getElementById('wfpWord').textContent = word;
    renderWordTree(word);
    renderWordHistoryInto(word, 'wfpHistorySummary', 'wfpHistoryList');
    document.getElementById('wordFullPageOverlay').style.display = 'flex';
  }

  document.getElementById('wfpCloseBtn').addEventListener('click', function () {
    document.getElementById('wordFullPageOverlay').style.display = 'none';
  });
  document.getElementById('wfpBackBtn').addEventListener('click', function () {
    document.getElementById('wordFullPageOverlay').style.display = 'none';
  });
  document.getElementById('wordFullPageOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'wordFullPageOverlay') e.currentTarget.style.display = 'none';
  });



  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ---------- cardbox storage + spaced repetition ----------

  let _cardboxCache = null;
  function loadCardbox() {
    if (_cardboxCache) return _cardboxCache;
    try {
      const raw = localStorage.getItem(CARDBOX_KEY);
      _cardboxCache = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _cardboxCache = [];
    }
    return _cardboxCache;
  }

  function saveCardbox(list) {
    _cardboxCache = list;
    localStorage.setItem(CARDBOX_KEY, JSON.stringify(list));
  }

  const HOUR_MS = 3600000;

  const DUE_PRESET_MS = {
    '1h': 1 * HOUR_MS, '5h': 5 * HOUR_MS, '12h': 12 * HOUR_MS, '24h': 24 * HOUR_MS,
    '1d': 1 * DAY_MS, '2d': 2 * DAY_MS, '5d': 5 * DAY_MS, '10d': 10 * DAY_MS, '30d': 30 * DAY_MS
  };

  function currentDueOffsetMs() {
    if (settings.dueTimePreset === 'custom') {
      const val = Math.max(1, parseInt(settings.dueTimeCustomValue, 10) || 1);
      const unitMs = settings.dueTimeCustomUnit === 'h' ? HOUR_MS : DAY_MS;
      return val * unitMs;
    }
    return DUE_PRESET_MS[settings.dueTimePreset] || DUE_PRESET_MS['24h'];
  }

  function newCard(word) {
    const now = Date.now();
    return {
      word: word, addedAt: now, status: 'new',
      correct: 0, incorrect: 0, skipped: 0, lastReviewed: null, lastCorrectAt: null,
      interval: 0, ease: 2.5, reps: 0, due: now + currentDueOffsetMs(),
      streak: 0, leech: false
    };
  }

  function addWordsToCardbox(words) {
    const box = loadCardbox();
    const existing = new Set(box.map(function (c) { return c.word; }));
    let added = 0;
    words.forEach(function (w) {
      if (!existing.has(w)) {
        box.push(newCard(w));
        existing.add(w);
        added++;
      }
    });
    saveCardbox(box);
    return added;
  }

  function removeFromCardbox(word) {
    const box = loadCardbox().filter(function (c) { return c.word !== word; });
    saveCardbox(box);
  }

  // ---------- cardbox groups (saved word-selection sets) ----------
  // A "group" is a named snapshot of which Cardbox words were ticked at
  // save time. It does NOT add/remove/replace any cards — "Load into
  // Cardbox" just re-ticks those same words in the Cardbox list so the
  // learner can pick the set back up (e.g. to study just that group).

  let _cardboxGroupsCache = null;
  function loadCardboxGroups() {
    if (_cardboxGroupsCache) return _cardboxGroupsCache;
    try {
      const raw = localStorage.getItem(CARDBOX_GROUPS_KEY);
      _cardboxGroupsCache = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _cardboxGroupsCache = [];
    }
    return _cardboxGroupsCache;
  }

  function saveCardboxGroups(list) {
    _cardboxGroupsCache = list;
    localStorage.setItem(CARDBOX_GROUPS_KEY, JSON.stringify(list));
  }

  function nextAutoGroupName() {
    const groups = loadCardboxGroups();
    const today = new Date().toISOString().slice(0, 10);
    let n = 1;
    let name = 'Group ' + today;
    const existing = new Set(groups.map(function (g) { return g.name; }));
    while (existing.has(name)) { n++; name = 'Group ' + today + ' (' + n + ')'; }
    return name;
  }

  // Copies the given cards (cards + SRS progress) into a new named group.
  // Does NOT touch the current Cardbox. `cards` should be the subset the
  // learner picked (falls back to the whole Cardbox if omitted). Returns
  // the created group, or null if there was nothing to save.
  function addCardboxGroup(name, cards) {
    const source = cards || loadCardbox();
    if (!source.length) return null;
    const groups = loadCardboxGroups();
    const group = {
      id: 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: (name && name.trim()) ? name.trim() : nextAutoGroupName(),
      createdAt: Date.now(),
      cards: JSON.parse(JSON.stringify(source))
    };
    groups.unshift(group);
    saveCardboxGroups(groups);
    return group;
  }

  function renameCardboxGroup(groupId, newName) {
    const groups = loadCardboxGroups();
    const group = groups.find(function (g) { return g.id === groupId; });
    if (!group || !newName || !newName.trim()) return false;
    group.name = newName.trim();
    saveCardboxGroups(groups);
    return true;
  }

  function deleteCardboxGroup(groupId) {
    const groups = loadCardboxGroups().filter(function (g) { return g.id !== groupId; });
    saveCardboxGroups(groups);
  }

  function patchLegacyCard(card) {
    if (card.ease == null) card.ease = 2.5;
    if (card.reps == null) card.reps = 0;
    if (card.interval == null) card.interval = 0;
    if (card.due == null) card.due = Date.now();
    if (card.skipped == null) card.skipped = 0;
    if (card.lastCorrectAt === undefined) card.lastCorrectAt = null;
    if (card.streak == null) card.streak = 0;
    if (card.leech == null) card.leech = false;
    return card;
  }

  // simplified SM-2 style spaced repetition
  function updateCardResult(word, isCorrect, hintUsed, isSkipped) {
    const box = loadCardbox();
    const card = box.find(function (c) { return c.word === word; });
    if (!card) return null;
    patchLegacyCard(card);

    if (isCorrect) card.correct++;
    else card.incorrect++;
    if (isSkipped) card.skipped++;
    card.lastReviewed = Date.now();

    // Leech detection: a "leech" is a word the learner keeps getting wrong
    // over and over, in a row — it tracks a *consecutive*-miss streak (not
    // total misses), separate from the SM-2 ease/interval math below, so a
    // word that's wrong 5 times scattered across weeks isn't a leech, but
    // one that's wrong N times in a row is. One correct answer clears it.
    if (isCorrect) {
      card.streak = 0;
      card.leech = false;
    } else {
      card.streak = (card.streak || 0) + 1;
      if (card.streak >= (settings.leechThreshold || 4)) card.leech = true;
    }

    if (isCorrect) {
      card.lastCorrectAt = card.lastReviewed;
      if (card.reps === 0) card.interval = 1;
      else if (card.reps === 1) card.interval = 3;
      else card.interval = Math.max(1, Math.round(card.interval * card.ease));
      card.reps++;
      // A correct answer reached with a hint means the word wasn't fully
      // recalled unaided, so it gets a smaller ease boost (and slightly
      // shorter next interval) than a clean, unhinted recall.
      card.ease = Math.min(3.2, card.ease + (hintUsed ? 0.03 : 0.1));
      if (hintUsed) card.interval = Math.max(1, Math.round(card.interval * 0.6));
    } else {
      card.reps = 0;
      card.interval = 1;
      // Giving up (skip) means the word wasn't attempted at all, which is
      // a weaker signal than a genuine wrong guess — nudge ease down a
      // little harder so a skipped word resurfaces sooner than a word the
      // learner actually tried and got wrong.
      card.ease = Math.max(1.3, card.ease - (isSkipped ? 0.3 : 0.2));
    }
    card.due = Date.now() + card.interval * DAY_MS;

    if (card.correct >= 3) card.status = 'mastered';
    else if (card.correct >= 1) card.status = 'learning';
    else card.status = 'new';

    saveCardbox(box);
    return card;
  }

  function statusLabel(status) {
    if (status === 'mastered') return 'เชี่ยวชาญ';
    if (status === 'learning') return 'กำลังเรียน';
    return 'คำใหม่';
  }

  // Manually sets a card's next-review date (a simplified, per-word override
  // on top of SM-2). Re-derives `interval` from the new due date (days from
  // now) so a later correct/incorrect answer still grows/shrinks sensibly
  // from wherever the learner moved it, rather than jumping back to the old
  // schedule. Ease and reps are left untouched — this only moves the date.
  function setCardDueDate(word, dueMs) {
    const box = loadCardbox();
    const card = box.find(function (c) { return c.word === word; });
    if (!card) return null;
    patchLegacyCard(card);
    card.due = dueMs;
    const daysFromNow = Math.max(1, Math.round((dueMs - Date.now()) / DAY_MS));
    card.interval = daysFromNow;
    saveCardbox(box);
    return card;
  }

  // ---------- tab navigation ----------

  let browseInitialized = false;

  function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const defaultBtn = document.querySelector('.tab-btn[data-tab="dashboard"]');
    if (defaultBtn) {
      defaultBtn.classList.add('active');
      updateCurrentTabLabel(defaultBtn);
    }
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () { activateTab(btn.dataset.tab); });
    });
  }

  // Programmatic tab switch, shared by the tab-bar click handler and any
  // code (e.g. Learn's Review button) that needs to jump to a tab and run
  // its usual on-activate side effects without the user clicking it.
  function activateTab(tabName) {
    const btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    const panel = document.getElementById('tab-' + tabName);
    if (!btn || !panel) return;
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    panel.classList.add('active');
    updateCurrentTabLabel(btn);
    if (tabName === 'cardbox') renderCardboxTab();
    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'settings') { renderDashboard(); }
    if (tabName === 'achievements' && window.Achievements) window.Achievements.renderTab();
    if (tabName === 'stats') renderStatsTab();
    if (tabName === 'play' && window.PlayGame) window.PlayGame.init();
    if (tabName === 'browse' && !browseInitialized) {
      browseInitialized = true;
      initBrowseChips();
      runBrowseSearch();
    }
    scrollActiveTabIntoView(btn);
  }

  function updateCurrentTabLabel(btn) {
    const label = document.getElementById('currentTabLabel');
    if (label) label.textContent = btn.textContent.trim();
  }

  function scrollActiveTabIntoView(btn) {
    if (btn && btn.scrollIntoView) {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  // ---------- Generator tab ----------

  const genState = { words: [], selected: new Set() };

  function renderGenResults() {
    const wrap = document.getElementById('genResults');
    wrap.innerHTML = genState.words.map(function (word) {
      return wordRowHTML(word, true, genState.selected, 'gen-check');
    }).join('');
    bindAnagramToggles(wrap);

    let totalScore = 0;
    genState.words.forEach(function (w) { totalScore += wordScore(w); });
    document.getElementById('genSummaryLine').textContent =
      'รวม ' + genState.words.length + ' คำ · คะแนนรวม ' + totalScore + ' แต้ม';

    genState.selected = new Set();
    updateGenSelectedCount();
    const genSelectAllCb = document.getElementById('genSelectAll');
    if (genSelectAllCb) genSelectAllCb.checked = false;
  }

  function updateGenSelectedCount() {
    const el = document.getElementById('genSelectedCount');
    if (!el) return;
    const n = genState.selected.size;
    el.textContent = (settings.lang === 'en' ? n + ' selected' : 'เลือกแล้ว ' + n + ' คำ');
  }

  function initGenerator() {
    document.getElementById('totalWordsLabel').textContent = CSW24_TOTAL_COUNT.toLocaleString('en-US');

    document.getElementById('genBtn').addEventListener('click', function () {
      let min = parseInt(document.getElementById('genMin').value, 10) || CSW24_MIN_LEN;
      let max = parseInt(document.getElementById('genMax').value, 10) || CSW24_MAX_LEN;
      let count = parseInt(document.getElementById('genCount').value, 10) || 10;
      min = Math.max(CSW24_MIN_LEN, Math.min(min, CSW24_MAX_LEN));
      max = Math.max(CSW24_MIN_LEN, Math.min(max, CSW24_MAX_LEN));
      if (min > max) { const t = min; min = max; max = t; }
      count = Math.max(1, Math.min(count, 300));

      const words = pickRandomWords(min, max, count);
      if (!words.length) { showToast('ไม่พบคำศัพท์ในช่วงความยาวที่เลือก'); return; }
      if (words.length < count) showToast('มีคำในช่วงนี้ได้แค่ ' + words.length + ' คำ');
      words.forEach(function (w) { logWordEncounter(w, 'generate'); });
      genState.words = words;
      document.getElementById('genResultsPanel').style.display = '';
      document.getElementById('exportTitle').textContent =
        'รายการคำศัพท์ · ' + min + '-' + max + ' ตัวอักษร · ' + words.length + ' คำ';
      renderGenResults();
    });

    document.getElementById('exportPdfBtn').addEventListener('click', exportPDF);
    document.getElementById('exportJpgBtn').addEventListener('click', function () { exportImage('jpg'); });
    document.getElementById('exportPngBtn').addEventListener('click', function () { exportImage('png'); });

    document.getElementById('genResults').addEventListener('change', function (e) {
      const cb = e.target.closest('.gen-check');
      if (!cb) return;
      const word = cb.dataset.word;
      if (cb.checked) genState.selected.add(word);
      else genState.selected.delete(word);
      updateGenSelectedCount();
      const selectAllCb = document.getElementById('genSelectAll');
      if (selectAllCb) {
        selectAllCb.checked = genState.words.length > 0 &&
          genState.words.every(function (w) { return genState.selected.has(w); });
      }
    });

    document.getElementById('genSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      if (checked) genState.words.forEach(function (w) { genState.selected.add(w); });
      else genState.words.forEach(function (w) { genState.selected.delete(w); });
      document.querySelectorAll('#genResults .gen-check').forEach(function (cb) { cb.checked = checked; });
      updateGenSelectedCount();
    });

    document.getElementById('genSaveBtn').addEventListener('click', function () {
      if (!genState.selected.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const added = addWordsToCardbox(Array.from(genState.selected));
      showToast('บันทึกลง Cardbox แล้ว ' + added + ' คำ');
      if (window.Achievements) window.Achievements.record('cardbox_add');
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function exportImage(type) {
    if (!genState.words.length) { showToast('กรุณาสุ่มคำศัพท์ก่อน export'); return; }
    showToast('กำลังสร้างไฟล์...');
    const target = document.getElementById('exportCapture');
    const canvas = await html2canvas(target, { backgroundColor: '#16241f', scale: 2 });
    const mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mime, 0.95);
    downloadDataUrl(dataUrl, 'csw24-wordlist.' + type);
    showToast('ดาวน์โหลด ' + type.toUpperCase() + ' แล้ว');
  }

  // ---------- LeXpert-style PDF export ----------
  // Mimics the classic LeXpert "Probable/General Words" list layouts.
  // Two independent options control the layout:
  //  - includeAnagrams: group words that share an alphagram under one
  //    alphagram label (e.g. "AABEINRT ATABRINE S" / "RABATINE S").
  //    Off = a plain one-word-per-line list, sorted alphabetically.
  //  - includeHooks: show front hooks (space then concatenated letters
  //    before the word, e.g. "P REOBTAIN") and back hooks (concatenated
  //    letters right after the word, e.g. "BARITONE S").

  function lexpertDateLabel() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date();
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + yy;
  }

  function buildLexpertGroups(words, includeAnagrams, includeHooks) {
    function hooksFor(w) {
      if (!includeHooks) return { front: '', back: '' };
      const hooks = getHooks(w);
      return { front: hooks.front.join(''), back: hooks.back.join('') };
    }

    if (!includeAnagrams) {
      // Plain list: one alphagram-less "group" per word, sorted alphabetically.
      const sorted = words.slice().sort();
      return sorted.map(function (w) {
        const h = hooksFor(w);
        return { key: '', lines: [{ front: h.front, word: w, back: h.back }] };
      });
    }

    const byKey = {};
    words.forEach(function (w) {
      const key = sortLetters(w);
      (byKey[key] || (byKey[key] = [])).push(w);
    });
    const keys = Object.keys(byKey).sort();
    return keys.map(function (key) {
      const groupWords = byKey[key].slice().sort();
      return {
        key: key,
        lines: groupWords.map(function (w) {
          const h = hooksFor(w);
          return { front: h.front, word: w, back: h.back };
        })
      };
    });
  }

  async function exportPDF() {
    if (!genState.words.length) { showToast('กรุณาสุ่มคำศัพท์ก่อน export'); return; }
    showToast('กำลังสร้าง PDF...');

    const includeAnagrams = !!document.getElementById('exportIncludeAnagrams').checked;
    const includeHooks = !!document.getElementById('exportIncludeHooks').checked;

    const jsPDFCtor = window.jspdf.jsPDF;
    const pdf = new jsPDFCtor('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const lineH = 13;
    const fontSize = 10;
    const keyColW = includeAnagrams ? 62 : 0;  // width reserved for the alphagram column
    const hookColW = includeHooks ? 20 : 0;    // width reserved for the front-hook column

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(fontSize);

    const groups = buildLexpertGroups(genState.words, includeAnagrams, includeHooks);
    const lens = genState.words.map(function (w) { return w.length; });
    const minLen = Math.min.apply(null, lens);
    const maxLen = Math.max.apply(null, lens);
    const lenLabel = minLen === maxLen ? (minLen + 'Letter') : (minLen + '-' + maxLen + 'Letter');
    const styleLabel = includeAnagrams ? 'Probable' : 'General';
    const listTitle = 'Untitled (' + lenLabel + '.' + styleLabel + '.All)';
    const dateLabel = lexpertDateLabel();

    let page = 1;
    let y = margin;

    function drawFooter(pageNum) {
      pdf.setFontSize(8);
      pdf.text('CSW24 Word Lab - generated word list', margin, pageH - 18);
      pdf.setFontSize(fontSize);
    }

    function drawHeader() {
      pdf.setFontSize(9);
      pdf.text(dateLabel + '  ' + listTitle, margin, margin - 14);
      const pageLabel = 'Page ' + page + '/{total_pages_count}';
      pdf.text(pageLabel, pageW - margin - pdf.getTextWidth('Page ' + page + '/00'), margin - 14);
      pdf.setFontSize(fontSize);
      pdf.setLineWidth(0.5);
      pdf.line(margin, margin - 8, pageW - margin, margin - 8);
    }

    function newPage() {
      drawFooter(page);
      pdf.addPage();
      page++;
      y = margin;
      drawHeader();
    }

    drawHeader();

    groups.forEach(function (group) {
      group.lines.forEach(function (line, i) {
        if (y > pageH - margin - lineH) newPage();
        if (includeAnagrams) {
          const keyText = i === 0 ? group.key : '';
          pdf.text(keyText, margin, y);
        }
        const frontX = margin + keyColW;
        if (line.front) pdf.text(line.front, frontX + hookColW - pdf.getTextWidth(line.front), y);
        const wordX = margin + keyColW + hookColW + (includeAnagrams || includeHooks ? 4 : 0);
        pdf.text(line.word, wordX, y);
        if (line.back) pdf.text(' ' + line.back, wordX + pdf.getTextWidth(line.word), y);
        y += lineH;
      });
    });

    drawFooter(page);
    pdf.putTotalPages('{total_pages_count}');
    pdf.save('csw24-wordlist-lexpert.pdf');
    showToast('ดาวน์โหลด PDF แล้ว');
  }

  // ---------- Quiz tab (generate 50, select, save) ----------

  const quizState = { words: [], selected: new Set() };

  function renderQuizList() {
    const wrap = document.getElementById('quizList');
    wrap.innerHTML = quizState.words.map(function (word, idx) {
      return (
        '<label class="quiz-item">' +
          '<input type="checkbox" class="quiz-check" data-word="' + word + '">' +
          '<span class="qi-index">' + (idx + 1) + '</span>' +
          tileRowHTML(word, 'small') +
          '<span class="word-meta">' + wordScore(word) + ' pts</span>' +
        '</label>'
      );
    }).join('');

    wrap.querySelectorAll('.quiz-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) quizState.selected.add(cb.dataset.word);
        else quizState.selected.delete(cb.dataset.word);
        updateQuizSelectedCount();
      });
    });
    quizState.selected = new Set();
    updateQuizSelectedCount();
    document.getElementById('quizSelectAll').checked = false;
  }

  function updateQuizSelectedCount() {
    document.getElementById('quizSelectedCount').textContent = 'เลือกแล้ว ' + quizState.selected.size + ' คำ';
  }

  function initQuizTab() {
    document.getElementById('quizGenBtn').addEventListener('click', function () {
      let min = parseInt(document.getElementById('quizMin').value, 10) || CSW24_MIN_LEN;
      let max = parseInt(document.getElementById('quizMax').value, 10) || CSW24_MAX_LEN;
      let count = parseInt(document.getElementById('quizCount').value, 10) || 50;
      min = Math.max(CSW24_MIN_LEN, Math.min(min, CSW24_MAX_LEN));
      max = Math.max(CSW24_MIN_LEN, Math.min(max, CSW24_MAX_LEN));
      if (min > max) { const t = min; min = max; max = t; }
      count = Math.max(5, Math.min(count, 200));

      const words = pickRandomWords(min, max, count);
      if (!words.length) { showToast('ไม่พบคำศัพท์ในช่วงความยาวที่เลือก'); return; }
      words.forEach(function (w) { logWordEncounter(w, 'quiz'); });
      quizState.words = words;
      document.getElementById('quizListPanel').style.display = '';
      renderQuizList();
    });

    document.getElementById('quizSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      document.querySelectorAll('.quiz-check').forEach(function (cb) {
        cb.checked = checked;
        if (checked) quizState.selected.add(cb.dataset.word);
        else quizState.selected.delete(cb.dataset.word);
      });
      updateQuizSelectedCount();
    });

    document.getElementById('quizSaveBtn').addEventListener('click', function () {
      if (!quizState.selected.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const added = addWordsToCardbox(Array.from(quizState.selected));
      showToast('บันทึกลง Cardbox แล้ว ' + added + ' คำ');
      if (window.Achievements) window.Achievements.record('cardbox_add');
    });
  }

  // ---------- Cardbox tab ----------

  function renderCardboxTab() {
    const box = loadCardbox();
    const now = Date.now();
    const dueCount = box.filter(function (c) { return (c.due || 0) <= now; }).length;

    document.getElementById('cardboxCount').textContent = box.length;
    document.getElementById('cardboxDueCount').textContent =
      box.length ? dueCount + ' คำถึงกำหนดทบทวนตอนนี้' : '';

    const leechCount = box.filter(function (c) { return c.leech; }).length;
    const leechRow = document.getElementById('leechStudyRow');
    if (leechRow) leechRow.style.display = leechCount ? '' : 'none';
    const leechHint = document.getElementById('leechCountHint');
    if (leechHint) leechHint.textContent = leechCount ? t('cardboxLeech.countHint').replace('{n}', leechCount) : '';

    // Filter by search query (if any) + sort by the chosen order, reset pagination to the top.
    cardboxRenderState.sorted = cardboxFilteredSorted(box);
    cardboxRenderState.shown = 0;

    // Drop any selected words that no longer exist in the cardbox.
    const stillPresent = new Set(box.map(function (c) { return c.word; }));
    let selectionChanged = false;
    cardboxRenderState.selected.forEach(function (w) {
      if (!stillPresent.has(w)) { cardboxRenderState.selected.delete(w); selectionChanged = true; }
    });
    if (selectionChanged) saveCardboxSelection();

    const listEl = document.getElementById('cardboxList');
    if (!box.length) {
      listEl.innerHTML = '<div class="empty-state">ยังไม่มีคำศัพท์ใน Cardbox — ไปที่แท็บ "แบบทดสอบ" เพื่อเลือกคำที่อยากจำ</div>';
      document.getElementById('cardboxLoadMoreWrap').style.display = 'none';
    } else if (!cardboxRenderState.sorted.length) {
      listEl.innerHTML = '<div class="empty-state">ไม่พบคำที่ตรงกับคำค้นหา</div>';
      document.getElementById('cardboxLoadMoreWrap').style.display = 'none';
    } else {
      listEl.innerHTML = '';
      renderCardboxPage(true);
    }

    const selectAllCb = document.getElementById('cardboxSelectAll');
    if (selectAllCb) {
      selectAllCb.checked = cardboxRenderState.sorted.length > 0 &&
        cardboxRenderState.sorted.every(function (c) { return cardboxRenderState.selected.has(c.word); });
    }
    updateCardboxSelectedCount();

    const studyCountInput = document.getElementById('studyCount');
    studyCountInput.max = Math.max(1, box.length);
    if (parseInt(studyCountInput.value, 10) > box.length) studyCountInput.value = Math.max(1, box.length);

    const minLenInput = document.getElementById('studyMinLen');
    const maxLenInput = document.getElementById('studyMaxLen');
    if (minLenInput && maxLenInput && box.length && !minLenInput.dataset.touched && !maxLenInput.dataset.touched) {
      const lens = box.map(function (c) { return c.word.length; });
      minLenInput.value = Math.min.apply(null, lens);
      maxLenInput.value = Math.max.apply(null, lens);
    }
  }

  // Cardbox list is paginated like the Word Browser (PAGE_SIZE per page) and
  // uses a single delegated click listener instead of one per row, so large
  // cardboxes (hundreds/thousands of cards) don't lag the UI.
  const cardboxRenderState = { sorted: [], shown: 0, selected: loadCardboxSelection(), search: '', sort: 'recent', leechOnly: false };

  // Persists the set of ticked words to localStorage so an accidental
  // refresh/reload doesn't lose which words the learner had picked out —
  // otherwise they'd have to search and re-tick everything from scratch.
  function loadCardboxSelection() {
    try {
      const raw = localStorage.getItem(CARDBOX_SELECTION_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveCardboxSelection() {
    try {
      localStorage.setItem(CARDBOX_SELECTION_KEY, JSON.stringify(Array.from(cardboxRenderState.selected)));
    } catch (e) { /* ignore */ }
  }

  function cardboxSortCompare(sort) {
    if (sort === 'rounds-desc') return function (a, b) { return (b.correct + b.incorrect) - (a.correct + a.incorrect); };
    if (sort === 'rounds-asc') return function (a, b) { return (a.correct + a.incorrect) - (b.correct + b.incorrect); };
    if (sort === 'alpha') return function (a, b) { return a.word < b.word ? -1 : (a.word > b.word ? 1 : 0); };
    if (sort === 'prob-desc') return function (a, b) { return wordProbabilityNormalizedPct(b.word) - wordProbabilityNormalizedPct(a.word); };
    if (sort === 'prob-asc') return function (a, b) { return wordProbabilityNormalizedPct(a.word) - wordProbabilityNormalizedPct(b.word); };
    if (sort === 'play-desc') return function (a, b) { return wordPlayability(b.word) - wordPlayability(a.word); };
    if (sort === 'play-asc') return function (a, b) { return wordPlayability(a.word) - wordPlayability(b.word); };
    if (sort === 'leech-desc') return function (a, b) {
      if ((b.leech ? 1 : 0) !== (a.leech ? 1 : 0)) return (b.leech ? 1 : 0) - (a.leech ? 1 : 0);
      return (b.streak || 0) - (a.streak || 0);
    };
    return function (a, b) { return b.addedAt - a.addedAt; };
  }

  // Cardbox search: a plain query does a substring match like before. But if
  // the query contains '?' (a blank), treat it as a rack — same convention
  // as Word Builder (e.g. "TISANE?") — and show only Cardbox words that can
  // actually be built from those rack letters (blanks covering any letters
  // the rack doesn't have).
  function cardboxFilteredSorted(box) {
    const q = cardboxRenderState.search;
    let filtered;
    if (q && q.indexOf('?') !== -1) {
      const rackLetters = q.replace(/[^A-Z?]/g, '');
      const blankCount = (rackLetters.match(/\?/g) || []).length;
      const rackCounts = letterCounts(rackLetters.replace(/\?/g, ''));
      filtered = box.filter(function (c) { return isSubsetOfCountsWithBlanks(c.word, rackCounts, blankCount); });
    } else {
      filtered = q ? box.filter(function (c) { return c.word.indexOf(q) !== -1; }) : box.slice();
    }
    if (cardboxRenderState.leechOnly) filtered = filtered.filter(function (c) { return c.leech; });
    filtered.sort(cardboxSortCompare(cardboxRenderState.sort));
    return filtered;
  }

  // ---------- Cardbox: per-word due date editor (simplified SM-2 override) ----------
  // Lets the learner manually move one word's next-review date without
  // touching any other card's schedule. Presets nudge from "now"; the
  // datetime-local input allows an exact custom date/time.

  let dueEditWord = null;

  function localDatetimeInputValue(ms) {
    const d = new Date(ms);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function openDueEdit(word) {
    const card = loadCardbox().find(function (c) { return c.word === word; });
    if (!card) return;
    dueEditWord = word;
    document.getElementById('dueEditWord').textContent = word;
    document.getElementById('dueEditCurrent').textContent =
      t('dueEdit.currentLabel') + ': ' + formatDueDate(card.due);
    document.getElementById('dueEditCustom').value = localDatetimeInputValue(card.due || Date.now());
    document.getElementById('dueEditOverlay').style.display = 'flex';
  }

  function closeDueEdit() {
    dueEditWord = null;
    document.getElementById('dueEditOverlay').style.display = 'none';
  }

  function applyCardDueUpdate(newDueMs) {
    if (!dueEditWord) return;
    const card = setCardDueDate(dueEditWord, newDueMs);
    if (!card) return;
    renderCardboxTab();
    // If the Learn level-detail list is open behind this overlay, refresh
    // its rows too so the new due date shows without needing to reopen it.
    const lldList = document.getElementById('lldList');
    if (lldList && lldList.querySelector('[data-word="' + dueEditWord + '"]')) {
      const byWord = learnCardboxByWord();
      lldList.querySelectorAll('.lld-row').forEach(function (row) {
        const btn = row.querySelector('.lld-due-edit-btn');
        if (btn && btn.dataset.word === dueEditWord) {
          row.outerHTML = lldRowHTML(dueEditWord, byWord[dueEditWord]);
        }
      });
    }
    showToast(t('dueEdit.saved').replace('{word}', dueEditWord).replace('{date}', formatDueDate(card.due)));
    closeDueEdit();
  }

  function initDueEditOverlay() {
    const overlay = document.getElementById('dueEditOverlay');
    if (!overlay) return;

    document.getElementById('dueEditCloseBtn').addEventListener('click', closeDueEdit);
    overlay.addEventListener('click', function (e) {
      if (e.target.id === 'dueEditOverlay') closeDueEdit();
    });

    document.getElementById('dueEditPresets').addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-days]');
      if (!btn) return;
      const days = parseInt(btn.dataset.days, 10);
      const newDue = Date.now() + days * DAY_MS;
      document.getElementById('dueEditCustom').value = localDatetimeInputValue(newDue);
    });

    document.getElementById('dueEditSaveBtn').addEventListener('click', function () {
      const val = document.getElementById('dueEditCustom').value;
      if (!val) return;
      const ms = new Date(val).getTime();
      if (isNaN(ms)) return;
      applyCardDueUpdate(ms);
    });
  }

  function cardboxRowHTML(c, now) {
    const isDue = (c.due || 0) <= now;
    const checked = cardboxRenderState.selected.has(c.word) ? ' checked' : '';
    return (
      '<div class="card-row' + (c.leech ? ' is-leech' : '') + '">' +
        '<label class="card-row-select"><input type="checkbox" class="cardbox-check" data-word="' + c.word + '"' + checked + '></label>' +
        '<div>' + tileRowHTML(c.word, 'small') + '</div>' +
        '<div class="card-row-meta">' +
          (c.leech ? '<span class="status-pill status-leech" title="' + t('cardboxLeech.badgeTitle').replace('{n}', c.streak) + '">🐛 ' + t('cardboxLeech.badge') + '</span>' : '') +
          (isDue ? '<span class="status-pill status-learning">⏰ ถึงกำหนด</span>' : '') +
          '<span class="status-pill status-' + c.status + '">' + statusLabel(c.status) + '</span>' +
          '<span>✓' + c.correct + ' ✗' + c.incorrect + '</span>' +
          '<button class="due-edit-btn" data-word="' + c.word + '" title="' + t('dueEdit.title') + '">📅 ' + formatDueDate(c.due) + '</button>' +
          '<button class="remove-card-btn" data-word="' + c.word + '" title="ลบออกจาก Cardbox">✕</button>' +
        '</div>' +
      '</div>'
    );
  }

  function updateCardboxSelectedCount() {
    const el = document.getElementById('cardboxSelectedCount');
    if (!el) return;
    const n = cardboxRenderState.selected.size;
    el.textContent = (settings.lang === 'en' ? n + ' selected' : 'เลือกแล้ว ' + n + ' คำ');
  }

  function renderCardboxPage(reset) {
    const listEl = document.getElementById('cardboxList');
    if (reset) listEl.innerHTML = '';
    const now = Date.now();
    const slice = cardboxRenderState.sorted.slice(cardboxRenderState.shown, cardboxRenderState.shown + PAGE_SIZE);
    listEl.insertAdjacentHTML('beforeend', slice.map(function (c) { return cardboxRowHTML(c, now); }).join(''));
    cardboxRenderState.shown += slice.length;
    document.getElementById('cardboxLoadMoreWrap').style.display =
      cardboxRenderState.shown < cardboxRenderState.sorted.length ? '' : 'none';
  }

  function initCardboxList() {
    const listEl = document.getElementById('cardboxList');
    // Single delegated listener for remove buttons + select checkboxes, current and future.
    listEl.addEventListener('click', function (e) {
      const dueBtn = e.target.closest('.due-edit-btn');
      if (dueBtn) { openDueEdit(dueBtn.dataset.word); return; }

      const btn = e.target.closest('.remove-card-btn');
      if (!btn) return;
      const word = btn.dataset.word;
      removeFromCardbox(word);
      // Remove just this row + update in-memory sorted list, instead of a full re-render.
      const row = btn.closest('.card-row');
      if (row) row.remove();
      cardboxRenderState.sorted = cardboxRenderState.sorted.filter(function (c) { return c.word !== word; });
      cardboxRenderState.shown = Math.max(0, cardboxRenderState.shown - 1);
      cardboxRenderState.selected.delete(word);
      saveCardboxSelection();
      document.getElementById('cardboxCount').textContent = loadCardbox().length;
      updateCardboxSelectedCount();
      const selectAllCb = document.getElementById('cardboxSelectAll');
      if (selectAllCb) selectAllCb.checked = false;
      showToast('ลบคำออกจาก Cardbox แล้ว');
      if (!loadCardbox().length) {
        listEl.innerHTML = '<div class="empty-state">ยังไม่มีคำศัพท์ใน Cardbox — ไปที่แท็บ "แบบทดสอบ" เพื่อเลือกคำที่อยากจำ</div>';
        document.getElementById('cardboxLoadMoreWrap').style.display = 'none';
      }
    });

    listEl.addEventListener('change', function (e) {
      const cb = e.target.closest('.cardbox-check');
      if (!cb) return;
      const word = cb.dataset.word;
      if (cb.checked) cardboxRenderState.selected.add(word);
      else cardboxRenderState.selected.delete(word);
      saveCardboxSelection();
      updateCardboxSelectedCount();
      const selectAllCb = document.getElementById('cardboxSelectAll');
      if (selectAllCb) {
        selectAllCb.checked = cardboxRenderState.sorted.length > 0 &&
          cardboxRenderState.sorted.every(function (c) { return cardboxRenderState.selected.has(c.word); });
      }
    });

    document.getElementById('cardboxLoadMoreBtn').addEventListener('click', function () {
      renderCardboxPage(false);
    });

    document.getElementById('cardboxSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      // Only affect words in the current (possibly search-filtered) result
      // set — selections made under a different search stay untouched.
      if (checked) {
        cardboxRenderState.sorted.forEach(function (c) { cardboxRenderState.selected.add(c.word); });
      } else {
        cardboxRenderState.sorted.forEach(function (c) { cardboxRenderState.selected.delete(c.word); });
      }
      saveCardboxSelection();
      // Update checkboxes currently rendered on screen.
      listEl.querySelectorAll('.cardbox-check').forEach(function (cb) { cb.checked = checked; });
      updateCardboxSelectedCount();
    });

    let cardboxSearchTimer = null;
    document.getElementById('cardboxSearch').addEventListener('input', function (e) {
      clearTimeout(cardboxSearchTimer);
      cardboxSearchTimer = setTimeout(function () {
        cardboxRenderState.search = e.target.value.trim().toUpperCase();
        renderCardboxTab();
      }, 200);
    });

    document.getElementById('cardboxSortSelect').addEventListener('change', function (e) {
      cardboxRenderState.sort = e.target.value;
      renderCardboxTab();
    });

    document.getElementById('cardboxLeechOnly').addEventListener('change', function (e) {
      cardboxRenderState.leechOnly = e.target.checked;
      renderCardboxTab();
    });

    document.getElementById('startLeechStudyBtn').addEventListener('click', function () {
      const leeches = loadCardbox().filter(function (c) { return c.leech; });
      if (!leeches.length) { showToast(t('cardboxLeech.noneToast')); return; }
      const mode = document.getElementById('studyMode').value;
      const anagramOrder = document.getElementById('anagramOrder').value;
      const cycleInterval = parseInt(document.getElementById('anagramCycleInterval').value, 10);
      startStudySession(shuffle(leeches.slice()), mode, anagramOrder, cycleInterval);
    });

    document.getElementById('studySelectedBtn').addEventListener('click', function () {
      const selectedWords = cardboxRenderState.selected;
      if (!selectedWords.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const box = loadCardbox();
      const queue = box.filter(function (c) { return selectedWords.has(c.word); });
      if (!queue.length) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }

      const mode = document.getElementById('studyMode').value;
      const anagramOrder = document.getElementById('anagramOrder').value;
      const cycleInterval = parseInt(document.getElementById('anagramCycleInterval').value, 10);
      startStudySession(queue, mode, anagramOrder, cycleInterval);
    });

    document.getElementById('anagramReviewSelectedBtn').addEventListener('click', function () {
      const selectedWords = cardboxRenderState.selected;
      if (!selectedWords.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const words = Array.from(selectedWords).sort();
      startAnagramReview(words, parseInt(document.getElementById('reviewSeconds').value, 10) || 5);
    });
  }

  // ---------- Add words panel (multi-line entry + autocomplete + CSW24 validation) ----------

  function initAddWordsPanel() {
    const input = document.getElementById('addWordsInput');
    const suggestBox = document.getElementById('addWordsSuggest');
    const preview = document.getElementById('addWordsPreview');
    const hint = document.getElementById('addWordsHint');
    const addBtn = document.getElementById('addWordsBtn');
    const clearBtn = document.getElementById('clearAddWordsBtn');
    if (!input || !suggestBox || !preview || !addBtn) return;

    let suggestItems = [];
    let suggestActive = -1;

    // Checks a single word against the full CSW24 dictionary (+ custom
    // words, if the user has that option enabled) using the same
    // length-bucketed Set lookup the rest of the app uses.
    function isValidCswWord(w) {
      if (!w) return false;
      return lengthSet(w.length).has(w);
    }

    function currentWordAndCaret() {
      const val = input.value;
      const caret = input.selectionStart == null ? val.length : input.selectionStart;
      // Find the token (run of non-whitespace) the caret is currently inside,
      // so suggestions track whichever word is actively being typed even if
      // it's not the last line/token.
      let start = caret;
      while (start > 0 && !/\s/.test(val[start - 1])) start--;
      let end = caret;
      while (end < val.length && !/\s/.test(val[end])) end++;
      return { word: val.slice(start, end).toUpperCase(), start: start, end: end };
    }

    function hideSuggest() {
      suggestBox.style.display = 'none';
      suggestBox.innerHTML = '';
      suggestItems = [];
      suggestActive = -1;
    }

    function renderSuggest(prefix) {
      if (!prefix || prefix.length < 2) { hideSuggest(); return; }
      const results = [];
      for (let L = CSW24_MIN_LEN; L <= CSW24_MAX_LEN && results.length < 8; L++) {
        if (L < prefix.length) continue;
        const pool = lengthPool(L);
        for (let i = 0; i < pool.length && results.length < 8; i++) {
          if (pool[i].indexOf(prefix) === 0) results.push(pool[i]);
        }
      }
      if (!results.length) { hideSuggest(); return; }
      suggestItems = results;
      suggestActive = -1;
      suggestBox.innerHTML = results.map(function (w) {
        return '<div class="add-words-suggest-item" data-word="' + w + '">' +
          '<span>' + w + '</span><span class="aw-len">' + w.length + '</span></div>';
      }).join('');
      suggestBox.style.display = '';
      suggestBox.querySelectorAll('.add-words-suggest-item').forEach(function (el) {
        el.addEventListener('mousedown', function (e) {
          e.preventDefault();
          applySuggestion(el.dataset.word);
        });
      });
    }

    function applySuggestion(word) {
      const tok = currentWordAndCaret();
      const val = input.value;
      const before = val.slice(0, tok.start);
      const after = val.slice(tok.end);
      input.value = before + word + after;
      const pos = before.length + word.length;
      input.focus();
      input.setSelectionRange(pos, pos);
      hideSuggest();
      renderPreview();
    }

    function highlightActive() {
      const items = suggestBox.querySelectorAll('.add-words-suggest-item');
      items.forEach(function (el, i) { el.classList.toggle('active', i === suggestActive); });
      if (suggestActive >= 0 && items[suggestActive]) {
        items[suggestActive].scrollIntoView({ block: 'nearest' });
      }
    }

    // Parses the textarea into individual candidate words (one per line;
    // extra whitespace on a line splits into separate words too), checks
    // each against CSW24, and renders a status list + summary hint. Returns
    // the set of words that validated clean and aren't already duplicated
    // within the box, ready to be added.
    function renderPreview() {
      const raw = input.value;
      const tokens = raw.split(/\s+/).map(function (w) { return w.trim().toUpperCase(); }).filter(Boolean);
      const box = loadCardbox();
      const already = new Set(box.map(function (c) { return c.word; }));

      if (!tokens.length) {
        preview.innerHTML = '';
        hint.textContent = '';
        addBtn.disabled = false;
        return;
      }

      const seen = new Set();
      const rows = tokens.map(function (w) {
        const isDup = already.has(w) || seen.has(w);
        seen.add(w);
        const valid = isValidCswWord(w);
        let cls = 'aw-invalid', icon = '❌', status = t('cardbox.addNotFound');
        if (valid && isDup) { cls = 'aw-dup'; icon = '➖'; status = t('cardbox.addAlready'); }
        else if (valid) { cls = 'aw-valid'; icon = '✅'; status = t('cardbox.addOk'); }
        return { w: w, cls: cls, icon: icon, status: status, valid: valid, isDup: isDup };
      });

      preview.innerHTML = rows.map(function (r) {
        return '<div class="aw-line ' + r.cls + '"><span class="aw-icon">' + r.icon + '</span>' +
          '<span class="aw-word">' + r.w + '</span><span class="aw-status">' + r.status + '</span></div>';
      }).join('');

      const toAdd = rows.filter(function (r) { return r.valid && !r.isDup; }).length;
      const invalidCount = rows.filter(function (r) { return !r.valid; }).length;
      const dupCount = rows.filter(function (r) { return r.valid && r.isDup; }).length;

      let msg = t('cardbox.addWillAdd').replace('{n}', toAdd);
      if (invalidCount) msg += ' · ' + t('cardbox.addWillSkipInvalid').replace('{n}', invalidCount);
      if (dupCount) msg += ' · ' + t('cardbox.addWillSkipDup').replace('{n}', dupCount);
      hint.textContent = msg;
    }

    input.addEventListener('input', function () {
      renderPreview();
      const tok = currentWordAndCaret();
      renderSuggest(tok.word);
    });

    input.addEventListener('keydown', function (e) {
      if (suggestBox.style.display !== 'none' && suggestItems.length) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          suggestActive = Math.min(suggestItems.length - 1, suggestActive + 1);
          highlightActive();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          suggestActive = Math.max(0, suggestActive - 1);
          highlightActive();
          return;
        }
        if ((e.key === 'Tab' || e.key === 'Enter') && suggestActive >= 0) {
          e.preventDefault();
          applySuggestion(suggestItems[suggestActive]);
          return;
        }
        if (e.key === 'Escape') { hideSuggest(); return; }
      }
    });

    input.addEventListener('blur', function () {
      // Slight delay so a mousedown on a suggestion item still registers
      // before the dropdown is torn down.
      setTimeout(hideSuggest, 120);
    });

    clearBtn.addEventListener('click', function () {
      input.value = '';
      hideSuggest();
      renderPreview();
      input.focus();
    });

    addBtn.addEventListener('click', function () {
      const raw = input.value;
      const tokens = raw.split(/\s+/).map(function (w) { return w.trim().toUpperCase(); }).filter(Boolean);
      if (!tokens.length) { showToast(t('cardbox.addNoneEntered')); return; }

      const uniqueTokens = Array.from(new Set(tokens));
      const valid = [];
      const invalid = [];
      uniqueTokens.forEach(function (w) {
        if (isValidCswWord(w)) valid.push(w); else invalid.push(w);
      });

      if (invalid.length) {
        // Every word must exist in CSW24 — surface exactly which ones don't
        // so the user can fix or drop them, and never add anything invalid.
        const shown = invalid.slice(0, 5).join(', ') + (invalid.length > 5 ? ', …' : '');
        showToast(t('cardbox.addRejected').replace('{n}', invalid.length).replace('{words}', shown));
      }

      if (valid.length) {
        const added = addWordsToCardbox(valid);
        const dup = valid.length - added;
        let msg = t('cardbox.addSuccess').replace('{n}', added);
        if (dup) msg += ' (' + t('cardbox.addAlreadyCount').replace('{n}', dup) + ')';
        showToast(msg);
        renderCardboxTab();
        renderDashboard();
      }

      if (!invalid.length && valid.length) {
        input.value = '';
        preview.innerHTML = '';
        hint.textContent = '';
        hideSuggest();
      } else {
        renderPreview();
      }
    });

    renderPreview();
  }

  function initCardboxTab() {
    document.getElementById('studyMode').addEventListener('change', function (e) {
      const isAnagram = e.target.value === 'anagram';
      document.getElementById('anagramOrderField').style.display = isAnagram ? '' : 'none';
      document.getElementById('anagramCycleField').style.display = isAnagram ? '' : 'none';
    });
    document.getElementById('anagramOrderField').style.display = 'none';
    document.getElementById('anagramCycleField').style.display = 'none';

    const cycleInput = document.getElementById('anagramCycleInterval');
    cycleInput.value = settings.anagramCycleInterval;
    cycleInput.addEventListener('change', function (e) {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      v = Math.min(v, 20);
      e.target.value = v;
      settings.anagramCycleInterval = v;
      saveSettings();
    });

    document.getElementById('studyMinLen').addEventListener('change', function (e) { e.target.dataset.touched = '1'; });
    document.getElementById('studyMaxLen').addEventListener('change', function (e) { e.target.dataset.touched = '1'; });

    document.getElementById('startStudyBtn').addEventListener('click', function () {
      const box = loadCardbox();
      if (!box.length) { showToast('Cardbox ว่างอยู่ — เลือกคำศัพท์จากแท็บแบบทดสอบก่อน'); return; }

      const mode = document.getElementById('studyMode').value;
      const anagramOrder = document.getElementById('anagramOrder').value;
      const dueOnly = document.getElementById('dueOnlyToggle').checked;
      const minLen = Math.max(1, parseInt(document.getElementById('studyMinLen').value, 10) || 1);
      const maxLen = Math.max(minLen, parseInt(document.getElementById('studyMaxLen').value, 10) || 99);
      const now = Date.now();

      let pool = dueOnly ? box.filter(function (c) { return (c.due || 0) <= now; }) : box.slice();
      pool = pool.filter(function (c) { return c.word.length >= minLen && c.word.length <= maxLen; });
      if (!pool.length) {
        showToast(dueOnly
          ? 'ไม่มีคำที่ถึงกำหนดทบทวนในช่วงความยาวนี้ — ลองปรับความยาวหรือปิด "เฉพาะคำที่ถึงกำหนด"'
          : 'ไม่มีคำใน Cardbox ที่อยู่ในช่วงความยาวนี้');
        return;
      }
      pool.sort(function (a, b) { return (a.due || 0) - (b.due || 0); });

      let n = parseInt(document.getElementById('studyCount').value, 10) || pool.length;
      n = Math.max(1, Math.min(n, pool.length));

      const queue = dueOnly ? pool.slice(0, n) : shuffle(pool).slice(0, n);
      const cycleInterval = parseInt(document.getElementById('anagramCycleInterval').value, 10);
      startStudySession(queue, mode, anagramOrder, cycleInterval);
    });

    document.getElementById('startAnagramReviewBtn').addEventListener('click', function () {
      const box = loadCardbox();
      if (!box.length) { showToast('Cardbox ว่างอยู่ — เลือกคำศัพท์จากแท็บแบบทดสอบก่อน'); return; }

      const dueOnly = document.getElementById('dueOnlyToggle').checked;
      const minLen = Math.max(1, parseInt(document.getElementById('studyMinLen').value, 10) || 1);
      const maxLen = Math.max(minLen, parseInt(document.getElementById('studyMaxLen').value, 10) || 99);
      const now = Date.now();

      let pool = dueOnly ? box.filter(function (c) { return (c.due || 0) <= now; }) : box.slice();
      pool = pool.filter(function (c) { return c.word.length >= minLen && c.word.length <= maxLen; });
      if (!pool.length) {
        showToast(dueOnly
          ? 'ไม่มีคำที่ถึงกำหนดทบทวนในช่วงความยาวนี้ — ลองปรับความยาวหรือปิด "เฉพาะคำที่ถึงกำหนด"'
          : 'ไม่มีคำใน Cardbox ที่อยู่ในช่วงความยาวนี้');
        return;
      }

      let n = parseInt(document.getElementById('studyCount').value, 10) || pool.length;
      n = Math.max(1, Math.min(n, pool.length));

      // Review mode is for browsing, not grading, so it keeps a stable
      // A→Z order rather than the shuffled/due-first order used for quizzes.
      const words = pool.map(function (c) { return c.word; }).sort().slice(0, n);
      startAnagramReview(words, parseInt(document.getElementById('reviewSeconds').value, 10) || 5);
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      if (!confirm('ต้องการรีเซ็ตความคืบหน้าทั้งหมด และลบคำศัพท์ทั้งหมดใน Cardbox ใช่หรือไม่?')) return;
      localStorage.removeItem(CARDBOX_KEY);
      renderCardboxTab();
      renderDashboard();
      showToast('รีเซ็ตความคืบหน้าเรียบร้อยแล้ว');
    });
  }

  // ---------- Due-time preset controls ----------

  const DUE_PRESET_LABEL_TH = {
    '1h': '1 ชั่วโมง', '5h': '5 ชั่วโมง', '12h': '12 ชั่วโมง', '24h': '24 ชั่วโมง',
    '1d': '1 วัน', '2d': '2 วัน', '5d': '5 วัน', '10d': '10 วัน', '30d': '30 วัน'
  };

  function renderDueTimeSummary() {
    const summaryEl = document.getElementById('dueTimeSummary');
    if (!summaryEl) return;
    if (settings.dueTimePreset === 'custom') {
      const val = Math.max(1, parseInt(settings.dueTimeCustomValue, 10) || 1);
      const unitLabel = settings.dueTimeCustomUnit === 'h' ? (val === 1 ? 'ชั่วโมง' : 'ชั่วโมง') : (val === 1 ? 'วัน' : 'วัน');
      summaryEl.textContent = val + ' ' + unitLabel;
    } else {
      summaryEl.textContent = DUE_PRESET_LABEL_TH[settings.dueTimePreset] || '24 ชั่วโมง';
    }
  }

  function initDueTimeControls() {
    const chipWrap = document.getElementById('dueTimePresetChips');
    const customRow = document.getElementById('dueTimeCustomRow');
    const customValueInput = document.getElementById('dueTimeCustomValue');
    const customUnitSelect = document.getElementById('dueTimeCustomUnit');
    if (!chipWrap) return;

    // restore saved state into UI
    chipWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.due === settings.dueTimePreset);
    });
    customRow.style.display = settings.dueTimePreset === 'custom' ? '' : 'none';
    customValueInput.value = settings.dueTimeCustomValue;
    customUnitSelect.value = settings.dueTimeCustomUnit;
    renderDueTimeSummary();

    chipWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        chipWrap.querySelectorAll('.mode-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        settings.dueTimePreset = btn.dataset.due;
        customRow.style.display = settings.dueTimePreset === 'custom' ? '' : 'none';
        saveSettings();
        renderDueTimeSummary();
      });
    });

    customValueInput.addEventListener('change', function () {
      settings.dueTimeCustomValue = Math.max(1, parseInt(customValueInput.value, 10) || 1);
      customValueInput.value = settings.dueTimeCustomValue;
      saveSettings();
      renderDueTimeSummary();
    });

    customUnitSelect.addEventListener('change', function () {
      settings.dueTimeCustomUnit = customUnitSelect.value;
      saveSettings();
      renderDueTimeSummary();
    });
  }

  // ---------- Study session ----------

  const session = { queue: [], index: 0, mode: 'flashcard', anagramOrder: 'alpha', cycleInterval: 3, correct: 0, incorrect: 0, flipped: false, hintLevel: 0, hintUsed: false, missed: [], reshuffleHandle: null };

  function stopAnagramReshuffle() {
    if (session.reshuffleHandle) { clearInterval(session.reshuffleHandle); session.reshuffleHandle = null; }
  }

  // ---------- Anagram Review (passive, no typing/grading) ----------

  const review = { queue: [], index: 0, seconds: 5, timerHandle: null, playing: false, originTab: 'cardbox', onExit: null };

  // originTab/onExit let other tabs (e.g. Learn's level-intro Review button)
  // borrow the Cardbox tab's Anagram Review panel without losing their own
  // place: endAnagramReview() switches back to whichever tab launched it
  // instead of always landing on Cardbox.
  function startAnagramReview(cards, seconds, opts) {
    if (!cards.length) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
    // Dedupe by alphagram: since each card already shows every anagram
    // partner together, showing ALIENOR then AILERON then ALERION as
    // separate cards would just repeat the same group 3 times.
    const seenKeys = new Set();
    cards = cards.filter(function (w) {
      const key = sortLetters(w);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    if (!cards.length) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
    opts = opts || {};
    review.queue = cards;
    review.index = 0;
    review.seconds = Math.max(1, seconds || 5);
    review.playing = false;
    review.originTab = opts.originTab || 'cardbox';
    review.onExit = typeof opts.onExit === 'function' ? opts.onExit : null;
    if (review.timerHandle) { clearInterval(review.timerHandle); review.timerHandle = null; }
    if (review.originTab !== 'cardbox') activateTab('cardbox');
    document.getElementById('reviewSeconds').value = review.seconds;
    document.getElementById('cardboxSetup').style.display = 'none';
    document.getElementById('cardboxList').style.display = 'none';
    document.getElementById('anagramReview').classList.add('open');
    document.addEventListener('keydown', reviewKeyHandler);
    renderReviewCard();
  }

  function endAnagramReview() {
    reviewStop();
    document.removeEventListener('keydown', reviewKeyHandler);
    document.getElementById('anagramReview').classList.remove('open');
    document.getElementById('cardboxSetup').style.display = '';
    document.getElementById('cardboxList').style.display = '';
    const originTab = review.originTab;
    const onExit = review.onExit;
    review.originTab = 'cardbox';
    review.onExit = null;
    if (originTab !== 'cardbox') {
      activateTab(originTab);
      if (onExit) onExit();
    }
  }

  function reviewStop() {
    if (review.timerHandle) { clearInterval(review.timerHandle); review.timerHandle = null; }
    review.playing = false;
    const btn = document.getElementById('reviewPlayBtn');
    if (btn) btn.textContent = '▶';
  }

  function reviewPlay() {
    if (review.index >= review.queue.length - 1) return;
    review.playing = true;
    const btn = document.getElementById('reviewPlayBtn');
    if (btn) btn.textContent = '⏸';
    if (review.timerHandle) clearInterval(review.timerHandle);
    review.timerHandle = setInterval(function () {
      if (review.index >= review.queue.length - 1) { reviewStop(); return; }
      review.index++;
      renderReviewCard();
    }, review.seconds * 1000);
  }

  function reviewGoto(i) {
    review.index = Math.max(0, Math.min(i, review.queue.length - 1));
    reviewStop();
    renderReviewCard();
  }

  function renderReviewCard() {
    const total = review.queue.length;
    const i = review.index;
    const word = review.queue[i];

    document.getElementById('reviewProgressLabel').textContent =
      'คำที่ ' + (i + 1) + ' / ' + total + '   ·   ⌨️ ← → = เลื่อนคำ · Space = เล่น/หยุด · Esc = ออก';
    document.getElementById('reviewBarFill').style.width = (total ? Math.round(((i + 1) / total) * 100) : 0) + '%';
    document.getElementById('reviewPromptLabel').textContent =
      'Review Anagram: ' + word + ' (' + word.length + ' ตัวอักษร)';
    document.getElementById('reviewTiles').innerHTML = tileRowHTML(sortLetters(word), 'big');
    document.getElementById('reviewCurrentWord').textContent = sortLetters(word);

    const answers = Array.from(new Set([word].concat(getAnagrams(word)))).sort();
    const listEl = document.getElementById('reviewAnswerList');
    if (!answers.length) {
      listEl.innerHTML = '<span class="review-empty">ไม่พบคำในพจนานุกรม</span>';
    } else {
      listEl.innerHTML = answers.map(function (w) {
        return '<span class="review-word' + (w === word ? ' is-target' : '') + '">' + w + '</span>';
      }).join('');
    }

    document.getElementById('reviewFooterHint').textContent =
      'แสดง ' + (i + 1) + '/' + total + ' คำ · พบ ' + answers.length + ' Anagram';

    document.getElementById('reviewFirstBtn').disabled = i === 0;
    document.getElementById('reviewPrevBtn').disabled = i === 0;
    document.getElementById('reviewNextBtn').disabled = i >= total - 1;
    document.getElementById('reviewLastBtn').disabled = i >= total - 1;

    // Reached the last card — offer a direct way to jump into a proper
    // study/quiz session on the same set of words instead of forcing the
    // learner back to the setup screen to rebuild the selection.
    const startStudyBtn = document.getElementById('reviewStartStudyBtn');
    if (startStudyBtn) startStudyBtn.style.display = (i >= total - 1) ? '' : 'none';

    if (i >= total - 1) reviewStop();
  }

  function reviewKeyHandler(e) {
    if (e.key === 'Escape') { e.preventDefault(); endAnagramReview(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); reviewGoto(review.index + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); reviewGoto(review.index - 1); return; }
    if (e.key === ' ') {
      e.preventDefault();
      if (review.playing) reviewStop(); else reviewPlay();
    }
  }

  function initAnagramReview() {
    document.getElementById('reviewFirstBtn').addEventListener('click', function () { reviewGoto(0); });
    document.getElementById('reviewPrevBtn').addEventListener('click', function () { reviewGoto(review.index - 1); });
    document.getElementById('reviewNextBtn').addEventListener('click', function () { reviewGoto(review.index + 1); });
    document.getElementById('reviewLastBtn').addEventListener('click', function () { reviewGoto(review.queue.length - 1); });
    document.getElementById('reviewPlayBtn').addEventListener('click', function () {
      if (review.playing) reviewStop(); else reviewPlay();
    });
    document.getElementById('reviewSeconds').addEventListener('change', function (e) {
      let v = parseInt(e.target.value, 10) || 5;
      v = Math.max(1, Math.min(60, v));
      e.target.value = v;
      review.seconds = v;
      if (review.playing) { reviewStop(); reviewPlay(); }
    });
    document.getElementById('reviewExitBtn').addEventListener('click', endAnagramReview);

    document.getElementById('reviewStartStudyBtn').addEventListener('click', function () {
      const words = review.queue.slice();
      if (!words.length) return;
      const box = loadCardbox();
      const byWord = {};
      box.forEach(function (c) { byWord[c.word] = c; });
      // Reuse the existing cardbox card (so SM-2 progress carries over) when
      // available, otherwise fall back to a plain word wrapper — Anagram
      // Review can include words that aren't in the Cardbox at all.
      const queue = words.map(function (w) { return byWord[w] || { word: w }; });

      endAnagramReview();
      startStudySession(queue, 'anagram', document.getElementById('anagramOrder').value || 'alpha');
    });
  }


  function sessionKeyHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (confirm('ต้องการออกจากเซสชันทบทวนหรือไม่?')) endStudySession();
      return;
    }
    if (e.key === 'Enter') {
      const nextBtn = document.getElementById('anagramNextBtn') ||
        document.getElementById('recallNextBtn') || document.getElementById('sessionFinishBtn');
      // Skip the global "jump to Next" shortcut when the Next button is
      // hidden (e.g. Instant Learn is active) — that button element can
      // still be in the DOM with display:none, and letting this fire would
      // silently advance the session out from under an in-progress drill.
      // Also skip if the focused control is Instant Learn's own form —
      // that form has its own Enter/submit handling.
      const inInstantLearn = document.getElementById('ilInput') === document.activeElement;
      if (nextBtn && nextBtn.offsetParent !== null && !inInstantLearn) { e.preventDefault(); nextBtn.click(); return; }
    }
    if (session.mode === 'flashcard') {
      if (!session.flipped && (e.key === 'Enter' || e.code === 'Space')) {
        const flipBtn = document.getElementById('flipBtn');
        if (flipBtn) { e.preventDefault(); flipBtn.click(); }
      } else if (session.flipped) {
        if (e.key === 'Enter') {
          const k = document.getElementById('knowBtn');
          if (k) { e.preventDefault(); k.click(); }
        } else if (e.key === 'Backspace') {
          const d = document.getElementById('dontKnowBtn');
          if (d) { e.preventDefault(); d.click(); }
        }
      }
    }
  }

  // In anagram mode, cards that share the same alphagram (e.g. ALIENOR /
  // AILERON / ALERION) should appear as a single card rather than one
  // card per word, since answering one is really the same "find the
  // anagram set" task. Keep the first-seen card of each alphagram group.
  function dedupeByAlphagram(cards) {
    const seen = new Set();
    const result = [];
    for (let i = 0; i < cards.length; i++) {
      const key = sortLetters(cards[i].word);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(cards[i]);
    }
    return result;
  }

  function startStudySession(cards, mode, anagramOrder, cycleInterval) {
    if (mode === 'anagram') cards = dedupeByAlphagram(cards);
    session.queue = cards;
    session.index = 0;
    session.mode = mode;
    session.anagramOrder = anagramOrder;
    session.cycleInterval = cycleInterval != null ? cycleInterval : settings.anagramCycleInterval;
    session.correct = 0;
    session.incorrect = 0;
    session.hintLevel = 0;
    session.hintUsed = false;
    session.missed = [];
    document.getElementById('cardboxSetup').style.display = 'none';
    document.getElementById('cardboxList').style.display = 'none';
    document.getElementById('studySession').classList.add('open');
    document.addEventListener('keydown', sessionKeyHandler);
    renderSessionCard();
  }

  function endStudySession() {
    stopAnagramReshuffle();
    document.removeEventListener('keydown', sessionKeyHandler);
    document.getElementById('studySession').classList.remove('open');
    document.getElementById('cardboxSetup').style.display = '';
    document.getElementById('cardboxList').style.display = '';
    renderCardboxTab();
  }

  function updateSessionProgressBar() {
    const total = session.queue.length;
    document.getElementById('sessionProgressLabel').textContent =
      'คำที่ ' + Math.min(session.index + 1, total) + ' / ' + total +
      '   ·   ถูก ' + session.correct + '   ผิด ' + session.incorrect +
      '   ·   ⌨️ Enter = ตอบ/ถัดไป · Esc = ออก';
    const pct = total ? Math.round((session.index / total) * 100) : 0;
    document.getElementById('sessionBarFill').style.width = pct + '%';
  }

  function recordAnswer(word, isCorrect, hintUsed, isSkipped) {
    const card = updateCardResult(word, isCorrect, hintUsed, isSkipped);
    logWordEncounter(word, 'cardbox');
    if (isCorrect) {
      session.correct++;
    } else {
      session.incorrect++;
      // Zyzzyva-style: keep a de-duped list of every word missed this
      // session so the end summary can show it for a quick review pass.
      if (session.missed.indexOf(word) === -1) session.missed.push(word);
    }
    return card;
  }

  function nextCard() {
    stopAnagramReshuffle();
    session.index++;
    session.flipped = false;
    session.hintLevel = 0;
    session.hintUsed = false;
    renderSessionCard();
  }

  function renderSessionCard() {
    updateSessionProgressBar();
    const area = document.getElementById('sessionArea');

    if (session.index >= session.queue.length) {
      const total = session.queue.length;
      const pct = total ? Math.round((session.correct / total) * 100) : 0;
      const missedWords = session.missed.slice().sort();
      const missedHTML = missedWords.length
        ? '<div class="session-missed-block">' +
            '<div class="session-missed-title">❌ คำที่พลาด (' + missedWords.length + ' คำ):</div>' +
            '<div class="anagram-partners">' +
              missedWords.map(function (w) { return '<span class="anagram-chip">' + w + '</span>'; }).join('') +
            '</div>' +
          '</div>'
        : '<p class="session-missed-none">🎉 ไม่มีคำที่พลาดเลย ตอบถูกครบทุกคำ!</p>';

      area.innerHTML =
        '<div class="session-summary">' +
          '<div class="session-prompt-label">จบเซสชันทบทวนแล้ว</div>' +
          '<div class="big-stat">' + pct + '%</div>' +
          '<p>ตอบถูก ' + session.correct + ' / ' + total + ' คำ · ตอบผิด ' + session.incorrect + ' คำ</p>' +
          missedHTML +
          '<div class="session-controls">' +
            (missedWords.length ? '<button class="btn btn-outline" id="sessionStudyMissedBtn">🔁 ทบทวนเฉพาะคำที่พลาด</button>' : '') +
            '<button class="btn btn-primary" id="sessionFinishBtn">เสร็จสิ้น</button>' +
          '</div>' +
        '</div>';
      document.getElementById('sessionFinishBtn').addEventListener('click', endStudySession);
      const studyMissedBtn = document.getElementById('sessionStudyMissedBtn');
      if (studyMissedBtn) {
        studyMissedBtn.addEventListener('click', function () {
          const box = loadCardbox();
          const missedSet = new Set(missedWords);
          const missedCards = box.filter(function (c) { return missedSet.has(c.word); });
          if (!missedCards.length) { showToast('ไม่พบคำที่พลาดใน Cardbox'); return; }
          startStudySession(missedCards, session.mode, session.anagramOrder, session.cycleInterval);
        });
      }
      if (window.Achievements) {
        window.Achievements.record('session_complete', {
          total: total, correct: session.correct, incorrect: session.incorrect
        });
      }
      return;
    }

    const card = session.queue[session.index];
    const word = card.word;

    if (session.mode === 'flashcard') renderFlashcard(area, word);
    else if (session.mode === 'anagram') renderAnagramCard(area, word);
    else renderRecallCard(area, word);
  }

  function renderFlashcard(area, word) {
    const scrambled = shuffle(word.split('')).join('');
    if (!session.flipped) {
      area.innerHTML =
        '<div class="session-card">' +
          '<div class="session-prompt-label">Flashcard · แตะเพื่อดูคำตอบ (หรือกด Enter)</div>' +
          tileRowHTML(scrambled, 'big') +
          '<div class="session-controls"><button class="btn btn-primary" id="flipBtn">🔄 พลิกไพ่</button></div>' +
        '</div>';
      document.getElementById('flipBtn').addEventListener('click', function () {
        session.flipped = true;
        renderFlashcard(area, word);
      });
    } else {
      const partners = getAnagrams(word);
      area.innerHTML =
        '<div class="session-card">' +
          '<div class="session-prompt-label">คำตอบ · Enter = จำได้ · Backspace = ยังไม่รู้</div>' +
          tileRowHTML(word, 'big') +
          '<div class="word-meta">' + wordScore(word) + ' คะแนน' + (partners.length ? ' · Anagram: ' + partners.join(', ') : '') + '</div>' +
          hookSummaryHTML(word) +
          '<div class="session-controls">' +
            '<button class="btn btn-outline" id="dontKnowBtn">✗ ยังไม่รู้</button>' +
            '<button class="btn btn-teal" id="knowBtn">✓ จำได้</button>' +
          '</div>' +
        '</div>';
      document.getElementById('knowBtn').addEventListener('click', function () { recordAnswer(word, true); nextCard(); });
      document.getElementById('dontKnowBtn').addEventListener('click', function () { recordAnswer(word, false); nextCard(); });
    }
  }

  function renderAnagramCard(area, word) {
    const letters = session.anagramOrder === 'alpha' ? sortLetters(word) : shuffle(word.split('')).join('');
    session.hintLevel = 0;

    // A scrambled rack of letters can legitimately spell more than one
    // dictionary word (e.g. EGL -> LEG or GEL). When that happens, the
    // learner must find every one of them before moving on.
    const validGroup = [word].concat(getAnagrams(word));
    const found = new Set();
    let wrongStreak = false;

    area.innerHTML =
      '<div class="session-card">' +
        '<div class="session-prompt-label">Anagram · เรียงตัวอักษรให้เป็นคำศัพท์' +
          (validGroup.length > 1 ? ' (มี ' + validGroup.length + ' คำตอบ ต้องหาให้ครบ)' : '') +
        '</div>' +
        '<div id="anagramTileRow">' + tileRowHTML(letters, 'big') + '</div>' +
        (validGroup.length > 1 ? '<div class="anagram-found-progress" id="anagramFoundProgress">พบแล้ว 0 / ' + validGroup.length + ' คำ</div>' : '') +
        (validGroup.length > 1 ? '<div class="anagram-partners" id="anagramFoundList"></div>' : '') +
        '<form class="session-answer-form" id="anagramForm">' +
          '<input type="text" id="anagramInput" autocomplete="off" placeholder="พิมพ์คำตอบ — ตรวจให้อัตโนมัติ" autofocus>' +
        '</form>' +
        '<div class="session-controls">' +
          '<button type="button" class="btn btn-outline btn-sm" id="anagramHintBtn">💡 Hint</button>' +
          '<button type="button" class="btn btn-outline btn-sm" id="anagramSkipBtn">⏭ ข้าม / ยอมแพ้</button>' +
        '</div>' +
        '<div class="field-hint" id="anagramHintText"></div>' +
        '<div class="session-feedback" id="anagramFeedback"></div>' +
        '<div class="session-word-stats" id="anagramWordStats" style="display:none"></div>' +
        '<div class="session-controls" id="anagramNextWrap" style="display:none">' +
          '<button class="btn btn-outline" id="anagramInstantLearnBtn">⚡ Instant Learn</button>' +
          '<button class="btn btn-teal" id="anagramNextBtn">ต่อไป (Enter) →</button>' +
        '</div>' +
        '<div id="instantLearnArea"></div>' +
      '</div>';

    function stopReshuffle() {
      stopAnagramReshuffle();
    }

    const form = document.getElementById('anagramForm');
    const input = document.getElementById('anagramInput');
    const feedback = document.getElementById('anagramFeedback');
    const hintBtn = document.getElementById('anagramHintBtn');
    // The `autofocus` attribute only fires on the element's very first
    // insertion in some browsers/webviews — replacing area.innerHTML on
    // every card doesn't reliably re-trigger it, so the learner ends up
    // having to click the input box before every single word. Focus it
    // explicitly on every render instead.
    input.focus();
    const hintText = document.getElementById('anagramHintText');
    const progressEl = document.getElementById('anagramFoundProgress');
    const foundListEl = document.getElementById('anagramFoundList');

    function renderFoundList() {
      if (!foundListEl) return;
      foundListEl.innerHTML = Array.from(found).sort().map(function (w) {
        return '<span class="anagram-chip">' + w + '</span>';
      }).join('');
    }

    hintBtn.addEventListener('click', function () {
      // Reveal one more letter each click, up to word.length - 1 so the
      // final letter is never handed over for free. Also nudge the ease
      // factor down slightly so hinted cards resurface a bit sooner —
      // using a hint means the word wasn't fully recalled unaided.
      const maxHint = Math.max(1, word.length - 1);
      if (session.hintLevel < maxHint) {
        session.hintLevel++;
        session.hintUsed = true;
      }
      const revealed = word.slice(0, session.hintLevel).split('').join(' ');
      const blanks = word.length - session.hintLevel;
      hintText.textContent = '💡 ' + revealed + (blanks > 0 ? '  ' + '_ '.repeat(blanks).trim() : '') +
        ' (' + session.hintLevel + '/' + word.length + ' ตัวอักษร)';
      if (session.hintLevel >= maxHint) {
        hintBtn.disabled = true;
        hintBtn.textContent = '💡 Hint (สูงสุดแล้ว)';
      }
    });

    const skipBtn = document.getElementById('anagramSkipBtn');
    skipBtn.addEventListener('click', function () {
      // Give-up: reveal every valid answer, mark the card wrong (not just
      // "no hint used" — giving up is treated the same as an incorrect
      // attempt for grading/spaced-repetition purposes), and let the
      // learner move on instead of getting stuck on a word they can't get.
      input.value = '';
      input.disabled = true;
      feedback.textContent = '⏭ ข้ามคำนี้ — เฉลย: ' + validGroup.slice().sort().join(', ');
      feedback.className = 'session-feedback wrong';
      found.clear();
      finishCard(true);
    });

    function renderWordStats(card, isSkipped, allCorrect) {
      const statsEl = document.getElementById('anagramWordStats');
      if (!statsEl || !card) return;
      const seen = card.correct + card.incorrect;
      const lastCorrectText = card.lastCorrectAt ? formatDueDate(card.lastCorrectAt) : 'ยังไม่เคยตอบถูก';
      const interval = Math.max(0, session.cycleInterval != null ? session.cycleInterval : settings.anagramCycleInterval);
      const cycleNote = !allCorrect
        ? '<div class="word-stats-row">🔄 คำนี้จะวนกลับมาอีกครั้งใน ' + interval + ' คำถัดไป (Cycle Interval)</div>'
        : '';
      statsEl.style.display = '';
      statsEl.innerHTML =
        '<div class="word-stats-row">🔁 เจอคำนี้ครั้งที่ ' + seen + ' · ✓ ตอบถูกครั้งที่ ' + card.correct +
          (card.skipped ? ' · ⏭ ข้ามไปแล้ว ' + card.skipped + ' ครั้ง' : '') +
        '</div>' +
        cycleNote +
        '<div class="word-stats-row">🕐 ตอบถูกล่าสุด: ' + lastCorrectText + '</div>' +
        '<div class="word-stats-row word-stats-due">📅 ทบทวนครั้งถัดไป: ' + formatDueDate(card.due) + '</div>';
    }

    function cycleBackIfNeeded(allCorrect) {
      // A wrong or skipped word doesn't just vanish for the rest of the
      // session — it's reinserted a configurable number of cards later
      // so the learner sees it again while it's still fresh, instead of
      // only meeting it again on the next scheduled spaced-repetition day.
      if (allCorrect) return;
      const interval = Math.max(0, session.cycleInterval != null ? session.cycleInterval : settings.anagramCycleInterval);
      const currentCard = session.queue[session.index];
      let insertAt = session.index + 1 + interval;
      if (insertAt > session.queue.length) insertAt = session.queue.length;
      session.queue.splice(insertAt, 0, currentCard);
    }

    function finishCard(isSkipped) {
      stopReshuffle();
      input.disabled = true;
      hintBtn.disabled = true;
      skipBtn.disabled = true;
      const allCorrect = found.size === validGroup.length;
      const card = recordAnswer(word, allCorrect, session.hintUsed, isSkipped);
      cycleBackIfNeeded(allCorrect);
      renderWordStats(card, isSkipped, allCorrect);

      // Post-answer reshuffle: once the card is done (correct, wrong, or
      // skipped) and we're just waiting to move to the next card, keep
      // re-scrambling the tile rack for fun/visual flair during that wait.
      // Stopped the instant we actually advance.
      if (settings.anagramAutoReshuffle) {
        const tileRowEl = document.getElementById('anagramTileRow');
        const intervalMs = Math.max(1, settings.anagramReshuffleSeconds || 3) * 1000;
        session.reshuffleHandle = setInterval(function () {
          if (!tileRowEl || !document.body.contains(tileRowEl)) { stopAnagramReshuffle(); return; }
          tileRowEl.innerHTML = tileRowHTML(shuffle(word.split('')).join(''), 'big');
        }, intervalMs);
      }

      document.getElementById('anagramNextWrap').style.display = '';
      document.getElementById('anagramNextBtn').addEventListener('click', nextCard);
      document.getElementById('anagramInstantLearnBtn').addEventListener('click', function () {
        startInstantLearn(validGroup);
      });
    }

    // ---------- Instant Learn (post-card, ungraded typing drill) ----------
    // Shows the full answer for a moment, then has the learner retype it —
    // either a fixed 5 reps or "until I've got it" (learner ends it
    // manually) — purely for memorization. Never touches stats, cardbox
    // scheduling, or session.correct/incorrect.
    function startInstantLearn(words) {
      stopReshuffle();
      document.getElementById('anagramNextWrap').style.display = 'none';
      const wrap = document.getElementById('instantLearnArea');

      wrap.innerHTML =
        '<div class="instant-learn-block">' +
          '<div class="session-prompt-label">⚡ Instant Learn · ดูคำให้จำ แล้วพิมพ์ซ้ำ (ไม่บันทึกสถิติ)</div>' +
          '<div class="anagram-partners">' +
            words.slice().sort().map(function (w) { return '<span class="anagram-chip">' + w + '</span>'; }).join('') +
          '</div>' +
          '<div class="field" style="margin-top:0.8rem">' +
            '<label>โหมดพิมพ์ซ้ำ</label>' +
            '<div class="btn-row">' +
              '<button type="button" class="btn btn-outline btn-sm il-mode-btn active" data-mode="count">พิมพ์ 5 รอบ</button>' +
              '<button type="button" class="btn btn-outline btn-sm il-mode-btn" data-mode="free">พิมพ์จนกว่าจะจำได้</button>' +
            '</div>' +
          '</div>' +
          '<div id="instantLearnDrill" style="margin-top:0.9rem"></div>' +
        '</div>';

      const drillEl = document.getElementById('instantLearnDrill');
      let mode = 'count';

      wrap.querySelectorAll('.il-mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          wrap.querySelectorAll('.il-mode-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          mode = btn.dataset.mode;
          runDrill();
        });
      });

      function runDrill() {
        let round = 0; // a round = typing every word in the group once
        const targetRounds = 5; // fixed default round count for "count" mode
        let order = [];
        let posInRound = 0;

        function shuffle(arr) {
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
          }
          return a;
        }

        function startRound() {
          order = words.length > 1 ? shuffle(words) : words.slice();
          posInRound = 0;
        }
        startRound();

        function renderRep() {
          const currentTarget = order[posInRound];
          const roundLabel = mode === 'count' ? ' (รอบ ' + (round + 1) + '/' + targetRounds + ')' : ' (จบไปแล้ว ' + round + ' รอบ)';
          const wordLabel = words.length > 1 ? ' · คำที่ ' + (posInRound + 1) + '/' + words.length : '';
          drillEl.innerHTML =
            '<div class="session-prompt-label">พิมพ์คำนี้อีกครั้ง' + roundLabel + wordLabel + '</div>' +
            tileRowHTML(currentTarget, 'big') +
            '<form class="session-answer-form" id="ilForm">' +
              '<input type="text" id="ilInput" autocomplete="off" placeholder="พิมพ์คำด้านบนให้ตรงกัน" autofocus>' +
            '</form>' +
            '<div class="session-feedback" id="ilFeedback"></div>' +
            (mode === 'free' ? '<div class="session-controls"><button type="button" class="btn btn-outline btn-sm" id="ilDoneBtn">✅ จำได้แล้ว จบ Instant Learn</button></div>' : '');

          const ilForm = document.getElementById('ilForm');
          const ilInput = document.getElementById('ilInput');
          const ilFeedback = document.getElementById('ilFeedback');
          ilInput.focus();

          const doneBtn = document.getElementById('ilDoneBtn');
          if (doneBtn) doneBtn.addEventListener('click', endInstantLearn);

          ilForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const guess = ilInput.value.trim().toUpperCase();
            if (!guess) return;
            if (guess === currentTarget) {
              ilFeedback.textContent = '✓ ถูกต้อง!';
              ilFeedback.className = 'session-feedback correct';
              posInRound++;
              if (posInRound >= order.length) {
                // completed every word in this round
                round++;
                if (mode === 'count' && round >= targetRounds) {
                  setTimeout(endInstantLearn, 500);
                  return;
                }
                startRound();
              }
              setTimeout(renderRep, 400);
            } else {
              ilFeedback.textContent = '✗ ยังไม่ตรง ลองอีกครั้ง';
              ilFeedback.className = 'session-feedback wrong';
              ilInput.value = '';
            }
          });
        }
        renderRep();
      }

      function endInstantLearn() {
        wrap.innerHTML = '<p class="session-missed-none">⚡ จบ Instant Learn แล้ว</p>';
        document.getElementById('anagramNextWrap').style.display = '';
      }

      runDrill();
    }

    // Live-checks whatever is currently typed, letter by letter — no Enter
    // or submit button needed. Fires on every keystroke; a guess is only
    // evaluated once its length matches a real candidate word, so partial
    // typing along the way doesn't flash a false "wrong".
    function checkTyped() {
      const guess = input.value.trim().toUpperCase();
      if (!guess) { feedback.textContent = ''; feedback.className = 'session-feedback'; return; }

      if (found.has(guess)) {
        feedback.textContent = 'พิมพ์คำนี้ไปแล้ว ลองคำอื่น (เหลืออีก ' + (validGroup.length - found.size) + ' คำ)';
        feedback.className = 'session-feedback wrong';
        return;
      }

      // Only judge once the guess is at least as long as the shortest
      // remaining valid word — otherwise every keystroke along the way to
      // a correct word would momentarily show as "wrong".
      const minRemainingLen = Math.min.apply(null, validGroup.filter(function (w) { return !found.has(w); }).map(function (w) { return w.length; }));
      if (guess.length < minRemainingLen) { feedback.textContent = ''; feedback.className = 'session-feedback'; return; }

      const isValid = validGroup.indexOf(guess) !== -1;

      if (isValid) {
        found.add(guess);
        wrongStreak = false;
        input.value = '';

        if (progressEl) progressEl.textContent = 'พบแล้ว ' + found.size + ' / ' + validGroup.length + ' คำ';
        renderFoundList();

        if (found.size < validGroup.length) {
          // Still missing at least one valid word — keep the input open
          // and do not allow moving to the next card yet.
          feedback.textContent = '✓ ถูกต้อง! ' + guess + ' — หาคำที่เหลืออีก ' + (validGroup.length - found.size) + ' คำ';
          feedback.className = 'session-feedback correct';
          input.focus();
          return;
        }

        feedback.textContent = '✓ ถูกต้องครบทุกคำ! ' + Array.from(found).join(', ') +
          (session.hintUsed ? '  (ใช้ Hint ช่วย)' : '');
        feedback.className = 'session-feedback correct';
        finishCard();
      } else if (guess.length >= word.length) {
        // Typed at least as many letters as the target word but it's not
        // a valid answer — flag it as wrong right away.
        wrongStreak = true;
        feedback.textContent = '✗ ยังไม่ถูก ลองอีกครั้ง' +
          (found.size ? ' (พบแล้ว ' + found.size + ' / ' + validGroup.length + ' คำ)' : '');
        feedback.className = 'session-feedback wrong';
      } else {
        feedback.textContent = '';
        feedback.className = 'session-feedback';
      }
    }

    input.addEventListener('input', checkTyped);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  }

  function renderRecallCard(area, word) {
    area.innerHTML =
      '<div class="session-card">' +
        '<div class="session-prompt-label">Active Recall · นึกคำศัพท์จากความจำ (' + word.length + ' ตัวอักษร)</div>' +
        blankTileRowHTML(word.length, 'big') +
        '<form class="session-answer-form" id="recallForm">' +
          '<input type="text" id="recallInput" autocomplete="off" placeholder="พิมพ์คำตอบแล้วกด Enter" autofocus>' +
          '<button class="btn btn-primary" type="submit">ตรวจคำตอบ</button>' +
        '</form>' +
        '<div class="session-feedback" id="recallFeedback"></div>' +
        '<div class="session-controls" id="recallNextWrap" style="display:none">' +
          '<button class="btn btn-teal" id="recallNextBtn">ต่อไป (Enter) →</button>' +
        '</div>' +
      '</div>';

    const form = document.getElementById('recallForm');
    const feedback = document.getElementById('recallFeedback');
    // Same reasoning as the Anagram card: explicitly focus the input on
    // every render, since `autofocus` doesn't reliably refire when the
    // element is replaced via innerHTML on each new word.
    document.getElementById('recallInput').focus();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = document.getElementById('recallInput');
      const guess = input.value.trim().toUpperCase();
      if (!guess) return;
      const isCorrect = guess === word;
      input.disabled = true;
      form.querySelector('button').disabled = true;
      if (isCorrect) {
        feedback.textContent = '✓ ถูกต้อง!';
        feedback.className = 'session-feedback correct';
      } else {
        feedback.textContent = '✗ ยังไม่ถูก — คำตอบคือ ' + word;
        feedback.className = 'session-feedback wrong';
      }
      recordAnswer(word, isCorrect);
      document.getElementById('recallNextWrap').style.display = '';
      document.getElementById('recallNextBtn').addEventListener('click', nextCard);
    });
  }

  // ---------- Learn tab ----------
  // Each word length is split into "levels" of 10 words each, in a fixed
  // order (alphabetical for short/easy lengths, most-probable-first for
  // longer lengths where alphabetical order would front-load obscure
  // words). Every 10th level is a "boss" level that mixes in words drawn
  // from the levels just completed, as a review checkpoint.

  const LEARN_WORDS_PER_LEVEL = 10;
  const LEARN_BOSS_EVERY = 10;
  // Lengths where "hardest/rarest word first" (alphabetical) would be a bad
  // learning order — sort by draw probability instead (common/easy first).
  const LEARN_PROB_SORT_LENGTHS = { 7: true, 8: true, 9: true };

  const learnState = { activeLength: null };
  const _learnLevelWordsCache = {};

  function learnLevelWords(L) {
    if (_learnLevelWordsCache[L]) return _learnLevelWordsCache[L];
    const pool = (typeof lengthPool === 'function' ? lengthPool(L) : (CSW24_BY_LENGTH[L] || [])).slice();
    if (LEARN_PROB_SORT_LENGTHS[L]) {
      pool.sort(function (a, b) { return wordDrawProbability(b) - wordDrawProbability(a) || a.localeCompare(b); });
    } else {
      pool.sort(function (a, b) { return a.localeCompare(b); });
    }
    _learnLevelWordsCache[L] = pool;
    return pool;
  }

  // Total number of levels for a length, including boss levels interleaved
  // every LEARN_BOSS_EVERY regular levels.
  function learnLevelCount(L) {
    const words = learnLevelWords(L);
    const regularLevels = Math.ceil(words.length / LEARN_WORDS_PER_LEVEL);
    const bossLevels = Math.floor(regularLevels / LEARN_BOSS_EVERY);
    return regularLevels + bossLevels;
  }

  // Maps a 1-based display level index to either a regular word slice or a
  // boss review slice pulled from the preceding regular levels. Boss levels
  // land at a fixed spot in the display sequence (every LEARN_BOSS_EVERY
  // regular levels get one extra display slot after them), so both the
  // regular level number and the display index can be computed directly
  // instead of scanning from level 1 each call.
  function learnLevelInfo(L, levelIndex) {
    const words = learnLevelWords(L);
    const regularLevels = Math.ceil(words.length / LEARN_WORDS_PER_LEVEL);
    if (regularLevels <= 0) return null;
    // Every full block of LEARN_BOSS_EVERY regular levels occupies
    // LEARN_BOSS_EVERY + 1 display slots (the boss level tacked on).
    const blockSpan = LEARN_BOSS_EVERY + 1;
    const blockIndex = Math.floor((levelIndex - 1) / blockSpan);
    const posInBlock = (levelIndex - 1) % blockSpan; // 0..LEARN_BOSS_EVERY
    const regularBase = blockIndex * LEARN_BOSS_EVERY;

    if (posInBlock < LEARN_BOSS_EVERY) {
      const r = regularBase + posInBlock + 1;
      if (r > regularLevels) return null;
      const start = (r - 1) * LEARN_WORDS_PER_LEVEL;
      return {
        kind: 'regular', regularLevel: r,
        words: words.slice(start, start + LEARN_WORDS_PER_LEVEL)
      };
    }

    // Boss slot: only exists once the block's regular levels are complete.
    const regularSeen = regularBase + LEARN_BOSS_EVERY;
    if (regularSeen > regularLevels) return null;
    const bossNum = blockIndex + 1;
    const rangeStart = regularBase * LEARN_WORDS_PER_LEVEL;
    const rangeEnd = regularSeen * LEARN_WORDS_PER_LEVEL;
    const span = words.slice(rangeStart, Math.min(rangeEnd, words.length));
    const reviewWords = span.filter(function (_, i) { return i % Math.max(1, Math.floor(span.length / LEARN_WORDS_PER_LEVEL)) === 0; }).slice(0, LEARN_WORDS_PER_LEVEL);
    return { kind: 'boss', bossNumber: bossNum, coversLevels: [regularBase + 1, regularSeen], words: reviewWords };
  }

  // ---------- Learn: per-answer log (word, length, correct/incorrect, time) ----------

  let _learnLogCache = null;
  function loadLearnLog() {
    if (_learnLogCache) return _learnLogCache;
    try { _learnLogCache = JSON.parse(localStorage.getItem(LEARN_LOG_KEY) || '[]'); }
    catch (e) { _learnLogCache = []; }
    return _learnLogCache;
  }
  function saveLearnLog(list) {
    _learnLogCache = list;
    localStorage.setItem(LEARN_LOG_KEY, JSON.stringify(list));
  }
  const LEARN_LOG_CAP = 5000;
  function logLearnAnswer(word, len, isCorrect) {
    const log = loadLearnLog();
    log.push({ word: word, len: len, correct: !!isCorrect, t: Date.now() });
    if (log.length > LEARN_LOG_CAP) log.splice(0, log.length - LEARN_LOG_CAP);
    saveLearnLog(log);
  }
  function startOfTodayMs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // Today's accuracy for a given length, from the answer log (not lifetime
  // Cardbox totals, which never reset day to day).
  function learnTodayStats(L) {
    const since = startOfTodayMs();
    const log = loadLearnLog();
    let correct = 0, total = 0;
    const newWordsToday = new Set();
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      if (e.len !== L || e.t < since) continue;
      total++;
      if (e.correct) correct++;
    }
    const box = loadCardbox();
    box.forEach(function (c) {
      if (c.word.length === L && c.addedAt >= since) newWordsToday.add(c.word);
    });
    return {
      accuracyPct: total ? Math.round((correct / total) * 100) : null,
      answeredToday: total,
      newToday: newWordsToday.size
    };
  }

  // Cardbox-derived stats scoped to one word length.
  function learnLengthCardStats(L) {
    const box = loadCardbox().filter(function (c) { return c.word.length === L; });
    const now = Date.now();
    let mastered = 0, dueCount = 0, anagramDone = 0;
    box.forEach(function (c) {
      if (c.status === 'mastered') mastered++;
      if ((c.due || 0) <= now) dueCount++;
      // "anagram done" = words in this length the learner has gotten right
      // at least once (mirrors card.status graduating out of 'new').
      if (c.correct >= 1) anagramDone++;
    });
    const totalInLength = (CSW24_BY_LENGTH[L] || []).length;
    return { mastered: mastered, dueCount: dueCount, anagramDone: anagramDone, totalInLength: totalInLength, inCardbox: box.length };
  }

  function learnLevelProgress(L, levelWords, byWordMap) {
    const byWord = byWordMap || (function () {
      const box = loadCardbox();
      const m = {};
      box.forEach(function (c) { m[c.word] = c; });
      return m;
    })();
    let done = 0;
    levelWords.forEach(function (w) {
      const c = byWord[w];
      if (c && c.correct >= 1) done++;
    });
    return { done: done, total: levelWords.length };
  }

  function learnCardboxByWord() {
    const box = loadCardbox();
    const m = {};
    box.forEach(function (c) { m[c.word] = c; });
    return m;
  }

  function initLearnTab() {
    const wrap = document.getElementById('learnLenChips');
    if (!wrap) return;
    wrap.querySelectorAll('.length-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('.length-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (btn.dataset.len === 'extra') {
          learnState.activeLength = 'extra';
          renderLearnContent();
          return;
        }
        learnState.activeLength = parseInt(btn.dataset.len, 10);
        renderLearnContent();
      });
    });

    const dashLearnBtn = document.getElementById('dashLearnBtn');
    if (dashLearnBtn) {
      dashLearnBtn.addEventListener('click', function () {
        const learnTabBtn = document.querySelector('.tab-btn[data-tab="learn"]');
        if (learnTabBtn) learnTabBtn.click();
      });
    }

    const lldOverlay = document.getElementById('learnLevelDetailOverlay');
    const lldCloseBtn = document.getElementById('lldCloseBtn');
    if (lldCloseBtn) lldCloseBtn.addEventListener('click', closeLearnLevelDetail);
    if (lldOverlay) {
      lldOverlay.addEventListener('click', function (e) {
        if (e.target.id === 'learnLevelDetailOverlay') closeLearnLevelDetail();
      });
    }
    const lldList = document.getElementById('lldList');
    if (lldList) {
      lldList.addEventListener('click', function (e) {
        const dueBtn = e.target.closest('.lld-due-edit-btn');
        if (dueBtn) openDueEdit(dueBtn.dataset.word);
      });
    }
  }

  function renderLearnContent() {
    const card = document.getElementById('learnContentCard');
    const content = document.getElementById('learnContent');
    if (!card || !content) return;
    const L = learnState.activeLength;
    if (L == null) {
      card.style.display = 'none';
      content.innerHTML = '';
      return;
    }
    if (L === 'extra') {
      card.style.display = '';
      renderLearnExtraMenu(content);
      return;
    }
    card.style.display = '';

    const today = learnTodayStats(L);
    const stats = learnLengthCardStats(L);
    const masteredPct = stats.totalInLength ? ((stats.mastered / stats.totalInLength) * 100).toFixed(1) : '0.0';
    const anagramFrac = stats.anagramDone + '/' + stats.totalInLength;
    const accuracyLabel = today.accuracyPct == null ? '—' : today.accuracyPct + '%';

    let html = '';
    html += '<div class="learn-summary-line">';
    html += 'แม่นแล้ว ' + masteredPct + '% / ท่องไปแล้ว ' + stats.inCardbox + ' / ' + stats.totalInLength + ' คำ • ' + anagramFrac + ' anagram';
    html += '</div>';

    html += '<div class="stat-grid learn-stat-grid">';
    html += statCard(accuracyLabel, 'ความแม่นยำวันนี้', 'teal');
    html += statCard(stats.dueCount, 'ถึงกำหนดทบทวน', 'brass');
    html += statCard(today.newToday, 'คำใหม่วันนี้', '');
    html += '</div>';

    const levelCount = learnLevelCount(L);
    // Next not-yet-completed level: first level whose words aren't all
    // marked correct at least once yet (falls back to level 1).
    const byWordForStart = learnCardboxByWord();
    let startLevel = 1;
    for (let lv = 1; lv <= levelCount; lv++) {
      const info = learnLevelInfo(L, lv);
      if (!info) break;
      const prog = learnLevelProgress(L, info.words, byWordForStart);
      if (prog.done < prog.total) { startLevel = lv; break; }
      startLevel = lv + 1;
    }
    if (startLevel > levelCount) startLevel = levelCount;

    html += '<div class="btn-row">';
    html += '<button class="btn btn-primary" id="learnStartBtn" data-level="' + startLevel + '">▶ เริ่มเรียนเลย 10 คำ (Level ' + startLevel + ')</button>';
    html += '</div>';

    html += '<div id="learnLevelListWrap"></div>';

    content.innerHTML = html;

    const startBtn = document.getElementById('learnStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        startLearnLevel(L, parseInt(startBtn.dataset.level, 10));
      });
    }

    // Long lengths (7L-9L) can have thousands of levels — render a
    // page at a time instead of the whole list, so the tab stays fast
    // on mobile. The initial page is the one containing startLevel.
    const LEVELS_PER_PAGE = 50;
    const initialPage = Math.floor((startLevel - 1) / LEVELS_PER_PAGE);
    renderLearnLevelPage(L, levelCount, initialPage, LEVELS_PER_PAGE);
  }

  function renderLearnLevelPage(L, levelCount, page, pageSize) {
    const wrap = document.getElementById('learnLevelListWrap');
    if (!wrap) return;
    const totalPages = Math.max(1, Math.ceil(levelCount / pageSize));
    page = Math.max(0, Math.min(page, totalPages - 1));
    const from = page * pageSize + 1;
    const to = Math.min(levelCount, (page + 1) * pageSize);

    let html = '';
    if (totalPages > 1) {
      html += '<div class="learn-level-pager">';
      html += '<button type="button" class="btn btn-outline btn-sm" id="learnPagePrev"' + (page === 0 ? ' disabled' : '') + '>← ก่อนหน้า</button>';
      html += '<span>Level ' + from + '–' + to + ' / ' + levelCount + '</span>';
      html += '<button type="button" class="btn btn-outline btn-sm" id="learnPageNext"' + (page === totalPages - 1 ? ' disabled' : '') + '>ถัดไป →</button>';
      html += '</div>';
    }

    html += '<div class="learn-level-list" id="learnLevelList">';
    const byWord = learnCardboxByWord();
    for (let lv = from; lv <= to; lv++) {
      const info = learnLevelInfo(L, lv);
      if (!info) continue;
      const prog = learnLevelProgress(L, info.words, byWord);
      const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
      const isBoss = info.kind === 'boss';
      html += '<div class="learn-level-row' + (isBoss ? ' learn-level-boss' : '') + '" data-level="' + lv + '">';
      html += '<div class="learn-level-info">';
      if (isBoss) {
        html += '<span class="learn-level-badge boss">👑 Boss ' + info.bossNumber + '</span>';
        html += '<span class="learn-level-sub">ทบทวน Level ' + info.coversLevels[0] + '–' + info.coversLevels[1] + '</span>';
      } else {
        html += '<span class="learn-level-badge">Level ' + lv + '</span>';
        html += '<span class="learn-level-sub">' + info.words[0] + '–' + info.words[info.words.length - 1] + '</span>';
      }
      html += '</div>';
      html += '<div class="learn-level-progress"><div class="learn-level-bar"><div class="learn-level-bar-fill" style="width:' + pct + '%"></div></div><span>' + prog.done + '/' + prog.total + '</span></div>';
      html += '<button type="button" class="btn btn-outline btn-sm learn-level-start" data-level="' + lv + '">▶ เริ่ม</button>';
      html += '</div>';
    }
    html += '</div>';

    wrap.innerHTML = html;

    wrap.querySelectorAll('.learn-level-start').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        startLearnLevel(L, parseInt(btn.dataset.level, 10));
      });
    });
    wrap.querySelectorAll('.learn-level-row').forEach(function (row) {
      row.addEventListener('click', function () {
        openLearnLevelDetail(L, parseInt(row.dataset.level, 10));
      });
    });
    const prevBtn = document.getElementById('learnPagePrev');
    if (prevBtn) prevBtn.addEventListener('click', function () { renderLearnLevelPage(L, levelCount, page - 1, pageSize); });
    const nextBtn = document.getElementById('learnPageNext');
    if (nextBtn) nextBtn.addEventListener('click', function () { renderLearnLevelPage(L, levelCount, page + 1, pageSize); });
  }

  // ---------- Learn: level detail overlay ----------
  // Tapping anywhere on a level row (other than the "▶ เริ่ม" button itself)
  // opens this — a per-word breakdown of that level: how many times each
  // word has been answered right/wrong, and when it's next due for review.

  function lldRowHTML(word, card) {
    const c = card || null;
    const correct = c ? c.correct : 0;
    const incorrect = c ? c.incorrect : 0;
    const dueStr = c && c.due ? formatDueDate(c.due) : '—';
    const isLeech = !!(c && c.leech);
    return (
      '<div class="lld-row' + (isLeech ? ' is-leech' : '') + '">' +
        '<span class="lld-word">' + word + (isLeech ? ' 🐛' : '') + '</span>' +
        '<span class="lld-stats">✓ ' + correct + '&nbsp;&nbsp;✗ ' + incorrect + '</span>' +
        (c
          ? '<button class="due-edit-btn lld-due-edit-btn" data-word="' + word + '" title="' + t('dueEdit.title') + '">📅 ' + dueStr + '</button>'
          : '<span class="lld-due">' + t('learnLevelDetail.nextReview') + ': ' + dueStr + '</span>') +
      '</div>'
    );
  }

  function openLearnLevelDetail(L, levelIndex) {
    const info = learnLevelInfo(L, levelIndex);
    if (!info || !info.words.length) return;
    const byWord = learnCardboxByWord();
    const isBoss = info.kind === 'boss';

    document.getElementById('lldTitle').textContent = isBoss
      ? '👑 Boss ' + info.bossNumber + ' — ' + L + 'L'
      : 'Level ' + levelIndex + ' — ' + L + 'L';
    document.getElementById('lldSub').textContent =
      (isBoss ? ('ทบทวน Level ' + info.coversLevels[0] + '–' + info.coversLevels[1] + ' • ') : '') +
      info.words.length + ' คำ: ' + info.words[0] + '–' + info.words[info.words.length - 1];

    const listEl = document.getElementById('lldList');
    listEl.innerHTML = info.words.map(function (w) { return lldRowHTML(w, byWord[w]); }).join('');

    const startBtn = document.getElementById('lldStartBtn');
    startBtn.onclick = function () {
      closeLearnLevelDetail();
      startLearnLevel(L, levelIndex);
    };

    document.getElementById('learnLevelDetailOverlay').style.display = 'flex';
  }

  function closeLearnLevelDetail() {
    document.getElementById('learnLevelDetailOverlay').style.display = 'none';
  }

  // ---------- Learn: in-level session (Anagram drill wrapped in a level shell) ----------
  // Reuses the same typing/scoring mechanic as Cardbox's Anagram mode
  // (type the scrambled word, hints, multi-answer racks) but keeps its own
  // queue/state so it never touches the Cardbox review session, and wraps
  // each level with a level-intro, progress dots, and an end-of-level
  // summary screen instead of dropping straight into a bare word queue.

  const learnSession = {
    length: null, levelIndex: null, info: null, queue: [], index: 0,
    correct: 0, incorrect: 0, results: [], hintLevel: 0, hintUsed: false
  };

  function startLearnLevel(L, levelIndex) {
    const info = learnLevelInfo(L, levelIndex);
    if (!info || !info.words.length) { showToast('ไม่พบคำในด่านนี้'); return; }
    // Make sure every word in the level exists as a Cardbox card so
    // recordAnswer's SM-2 scheduling has something to update.
    addWordsToCardbox(info.words);

    learnSession.length = L;
    learnSession.levelIndex = levelIndex;
    learnSession.info = info;
    learnSession.queue = info.words.slice();
    learnSession.index = 0;
    learnSession.correct = 0;
    learnSession.incorrect = 0;
    learnSession.results = [];

    document.getElementById('learnContentCard').style.display = 'none';
    document.getElementById('learnSessionCard').style.display = '';
    renderLearnLevelIntro();
  }

  function endLearnLevel() {
    document.getElementById('learnSessionCard').style.display = 'none';
    document.getElementById('learnContentCard').style.display = '';
    renderLearnContent();
  }

  function renderLearnDots() {
    const dotsEl = document.getElementById('learnLevelDots');
    if (!dotsEl) return;
    dotsEl.innerHTML = learnSession.queue.map(function (_, i) {
      let cls = 'learn-level-dot';
      if (i < learnSession.results.length) {
        cls += learnSession.results[i] ? ' dot-correct' : ' dot-wrong';
      } else if (i === learnSession.index) {
        cls += ' dot-current';
      }
      return '<span class="' + cls + '"></span>';
    }).join('');
  }

  function updateLearnProgressBar() {
    const total = learnSession.queue.length;
    document.getElementById('learnSessionProgressLabel').textContent =
      'คำที่ ' + Math.min(learnSession.index + 1, total) + ' / ' + total +
      '   ·   ถูก ' + learnSession.correct + '   ผิด ' + learnSession.incorrect;
    const pct = total ? Math.round((learnSession.index / total) * 100) : 0;
    document.getElementById('learnSessionBarFill').style.width = pct + '%';
    renderLearnDots();
  }

  function renderLearnLevelIntro() {
    updateLearnProgressBar();
    const area = document.getElementById('learnSessionArea');
    const info = learnSession.info;
    const isBoss = info.kind === 'boss';
    let html = '<div class="learn-level-intro' + (isBoss ? ' boss' : '') + '">';
    if (isBoss) {
      html += '<div class="learn-level-intro-badge">👑 ด่านบอส ' + info.bossNumber + '</div>';
      html += '<p class="panel-sub">ทบทวนคำจาก Level ' + info.coversLevels[0] + '–' + info.coversLevels[1] + ' (' + learnSession.length + 'L) — ' + info.words.length + ' คำ</p>';
    } else {
      html += '<div class="learn-level-intro-badge">Level ' + learnSession.levelIndex + '</div>';
      html += '<p class="panel-sub">' + learnSession.length + 'L · ' + info.words.length + ' คำ</p>';
    }
    html += '<div class="session-controls"><button class="btn btn-primary" id="learnLevelGoBtn">▶ เริ่ม</button>' +
      '<button class="btn btn-outline" id="learnLevelReviewBtn">📖 Review</button>' +
      '<button class="btn btn-outline" id="learnLevelBackBtn">↩ กลับ</button></div>';
    html += '</div>';
    area.innerHTML = html;
    document.getElementById('learnLevelGoBtn').addEventListener('click', renderLearnCard);
    document.getElementById('learnLevelBackBtn').addEventListener('click', endLearnLevel);
    // Same passive browse-through-the-cards Review used by Cardbox, so the
    // learner can preview this level's words (and their anagram partners)
    // before committing to the typing drill. Reuses the Cardbox review
    // panel, then returns to this same level-intro screen on exit.
    document.getElementById('learnLevelReviewBtn').addEventListener('click', function () {
      const L = learnSession.length, levelIndex = learnSession.levelIndex;
      startAnagramReview(info.words.slice(), parseInt(document.getElementById('reviewSeconds') ? document.getElementById('reviewSeconds').value : 5, 10) || 5, {
        originTab: 'learn',
        onExit: function () {
          document.getElementById('learnContentCard').style.display = 'none';
          document.getElementById('learnSessionCard').style.display = '';
          startLearnLevel(L, levelIndex);
        }
      });
    });
  }

  function renderLearnCard() {
    updateLearnProgressBar();
    const area = document.getElementById('learnSessionArea');

    if (learnSession.index >= learnSession.queue.length) {
      renderLearnSummaryDispatch();
      return;
    }

    const word = learnSession.queue[learnSession.index];
    const letters = sortLetters(word);
    learnSession.hintLevel = 0;
    learnSession.hintUsed = false;

    const validGroup = [word].concat(getAnagrams(word));
    const found = new Set();

    area.innerHTML =
      '<div class="session-card">' +
        '<div class="session-prompt-label">เรียงตัวอักษรให้เป็นคำศัพท์' +
          (validGroup.length > 1 ? ' (มี ' + validGroup.length + ' คำตอบ ต้องหาให้ครบ)' : '') +
        '</div>' +
        tileRowHTML(letters, 'big') +
        (validGroup.length > 1 ? '<div class="anagram-found-progress" id="learnFoundProgress">พบแล้ว 0 / ' + validGroup.length + ' คำ</div>' : '') +
        (validGroup.length > 1 ? '<div class="anagram-partners" id="learnFoundList"></div>' : '') +
        '<form class="session-answer-form" id="learnAnagramForm">' +
          '<input type="text" id="learnAnagramInput" autocomplete="off" placeholder="พิมพ์คำตอบ — ตรวจให้อัตโนมัติ" autofocus>' +
        '</form>' +
        '<div class="session-controls">' +
          '<button type="button" class="btn btn-outline btn-sm" id="learnHintBtn">💡 Hint</button>' +
          '<button type="button" class="btn btn-outline btn-sm" id="learnSkipBtn">⏭ ข้าม / ยอมแพ้</button>' +
        '</div>' +
        '<div class="field-hint" id="learnHintText"></div>' +
        '<div class="session-feedback" id="learnFeedback"></div>' +
        '<div class="session-controls" id="learnNextWrap" style="display:none">' +
          '<button class="btn btn-outline" id="learnInstantLearnBtn">⚡ Instant Learn</button>' +
          '<button class="btn btn-teal" id="learnNextBtn">ต่อไป (Enter) →</button>' +
        '</div>' +
      '</div>';

    const form = document.getElementById('learnAnagramForm');
    const input = document.getElementById('learnAnagramInput');
    const feedback = document.getElementById('learnFeedback');
    const hintBtn = document.getElementById('learnHintBtn');
    const hintText = document.getElementById('learnHintText');
    const progressEl = document.getElementById('learnFoundProgress');
    const foundListEl = document.getElementById('learnFoundList');
    input.focus();

    function renderFoundList() {
      if (!foundListEl) return;
      foundListEl.innerHTML = Array.from(found).sort().map(function (w) {
        return '<span class="anagram-chip">' + w + '</span>';
      }).join('');
    }

    hintBtn.addEventListener('click', function () {
      const maxHint = Math.max(1, word.length - 1);
      if (learnSession.hintLevel < maxHint) {
        learnSession.hintLevel++;
        learnSession.hintUsed = true;
      }
      const revealed = word.slice(0, learnSession.hintLevel).split('').join(' ');
      const blanks = word.length - learnSession.hintLevel;
      hintText.textContent = '💡 ' + revealed + (blanks > 0 ? '  ' + '_ '.repeat(blanks).trim() : '') +
        ' (' + learnSession.hintLevel + '/' + word.length + ' ตัวอักษร)';
      if (learnSession.hintLevel >= maxHint) {
        hintBtn.disabled = true;
        hintBtn.textContent = '💡 Hint (สูงสุดแล้ว)';
      }
    });

    const skipBtn = document.getElementById('learnSkipBtn');
    skipBtn.addEventListener('click', function () {
      input.value = '';
      input.disabled = true;
      feedback.textContent = '⏭ ข้ามคำนี้ — เฉลย: ' + validGroup.slice().sort().join(', ');
      feedback.className = 'session-feedback wrong';
      found.clear();
      finishLearnCard(word, false, true, validGroup);
    });

    function checkTyped() {
      const guess = input.value.trim().toUpperCase();
      if (!guess) { feedback.textContent = ''; feedback.className = 'session-feedback'; return; }
      if (found.has(guess)) {
        feedback.textContent = 'พิมพ์คำนี้ไปแล้ว ลองคำอื่น (เหลืออีก ' + (validGroup.length - found.size) + ' คำ)';
        feedback.className = 'session-feedback wrong';
        return;
      }
      const minRemainingLen = Math.min.apply(null, validGroup.filter(function (w) { return !found.has(w); }).map(function (w) { return w.length; }));
      if (guess.length < minRemainingLen) { feedback.textContent = ''; feedback.className = 'session-feedback'; return; }

      const isValid = validGroup.indexOf(guess) !== -1;
      if (isValid) {
        found.add(guess);
        if (progressEl) progressEl.textContent = 'พบแล้ว ' + found.size + ' / ' + validGroup.length + ' คำ';
        renderFoundList();
        input.value = '';
        if (found.size === validGroup.length) {
          feedback.textContent = '✓ ถูกต้องครบทุกคำ!';
          feedback.className = 'session-feedback correct';
          input.disabled = true;
          finishLearnCard(word, true, false, validGroup);
        } else {
          feedback.textContent = '✓ ถูกต้อง! หาต่ออีก ' + (validGroup.length - found.size) + ' คำ';
          feedback.className = 'session-feedback correct';
        }
      } else {
        feedback.textContent = '✗ ยังไม่ถูก ลองอีกครั้ง';
        feedback.className = 'session-feedback wrong';
      }
    }

    input.addEventListener('input', checkTyped);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  }

  function finishLearnCard(word, allCorrect, isSkipped, validGroup) {
    const hintBtn = document.getElementById('learnHintBtn');
    const skipBtn = document.getElementById('learnSkipBtn');
    const input = document.getElementById('learnAnagramInput');
    if (hintBtn) hintBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    if (input) input.disabled = true;

    // The learner had to type every word in validGroup (all anagram
    // solutions for this rack) to pass the card, so every one of those
    // words should get full credit — not just the queue's primary `word`.
    // Otherwise partner words never accumulate `correct` (they stay stuck
    // at "new"/0% in Cardbox and level-progress stats), even though the
    // learner clearly recalled them.
    const wordsToCredit = (validGroup && validGroup.length) ? validGroup : [word];
    if (isSkipped) {
      // A skip only "fails" the word actually shown/given up on; partner
      // words the learner never got a chance to type shouldn't be marked
      // wrong.
      recordAnswer(word, false, learnSession.hintUsed, true);
      logLearnAnswer(word, learnSession.length, false);
      logWordEncounter(word, 'learn');
    } else {
      addWordsToCardbox(wordsToCredit);
      wordsToCredit.forEach(function (w) {
        recordAnswer(w, allCorrect, learnSession.hintUsed, false);
        logLearnAnswer(w, w.length, allCorrect);
        logWordEncounter(w, 'learn');
      });
    }
    if (allCorrect) learnSession.correct++; else learnSession.incorrect++;
    learnSession.results.push(allCorrect);

    // A scrambled rack that has multiple valid answers (e.g. AEINORT ->
    // OTARINE / NOTAIRE) puts every one of those words into the level's
    // queue individually. Once the learner has cleared the whole group
    // from this single card, drop any of its still-queued partner words
    // so the same rack doesn't come back around as a second (or third)
    // card later in the session.
    if (validGroup && validGroup.length > 1) {
      const remaining = validGroup.filter(function (w) { return w !== word; });
      for (let i = learnSession.queue.length - 1; i > learnSession.index; i--) {
        if (remaining.indexOf(learnSession.queue[i]) !== -1) {
          learnSession.queue.splice(i, 1);
        }
      }
    }

    renderLearnDots();

    const nextWrap = document.getElementById('learnNextWrap');
    if (nextWrap) {
      nextWrap.style.display = '';
      document.getElementById('learnNextBtn').addEventListener('click', nextLearnCard);
      const ilBtn = document.getElementById('learnInstantLearnBtn');
      if (ilBtn) {
        ilBtn.addEventListener('click', function () {
          startLearnInstantLearn(validGroup && validGroup.length ? validGroup : [word]);
        });
      }
    }
  }

  // ---------- Learn: Instant Learn (same ungraded typing-drill mechanic
  // used in Cardbox's Anagram mode) — shows the answer(s), then has the
  // learner retype until memorized. Never touches stats/scheduling. ----------
  function startLearnInstantLearn(words) {
    const nextWrap = document.getElementById('learnNextWrap');
    if (nextWrap) nextWrap.style.display = 'none';
    const area = document.getElementById('learnSessionArea');
    const wrap = document.createElement('div');
    wrap.id = 'learnInstantLearnArea';
    area.appendChild(wrap);

    wrap.innerHTML =
      '<div class="instant-learn-block">' +
        '<div class="session-prompt-label">⚡ Instant Learn · ดูคำให้จำ แล้วพิมพ์ซ้ำ (ไม่บันทึกสถิติ)</div>' +
        '<div class="anagram-partners">' +
          words.slice().sort().map(function (w) { return '<span class="anagram-chip">' + w + '</span>'; }).join('') +
        '</div>' +
        '<div class="field" style="margin-top:0.8rem">' +
          '<label>โหมดพิมพ์ซ้ำ</label>' +
          '<div class="btn-row">' +
            '<button type="button" class="btn btn-outline btn-sm il-mode-btn active" data-mode="count">พิมพ์ 5 รอบ</button>' +
            '<button type="button" class="btn btn-outline btn-sm il-mode-btn" data-mode="free">พิมพ์จนกว่าจะจำได้</button>' +
          '</div>' +
        '</div>' +
        '<div id="learnInstantLearnDrill" style="margin-top:0.9rem"></div>' +
      '</div>';

    const drillEl = document.getElementById('learnInstantLearnDrill');
    let mode = 'count';

    wrap.querySelectorAll('.il-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('.il-mode-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        mode = btn.dataset.mode;
        runDrill();
      });
    });

    function runDrill() {
      let round = 0; // a round = typing every word in the group once
      const targetRounds = 5;
      let order = [];
      let posInRound = 0;

      function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
      }

      function startRound() {
        order = words.length > 1 ? shuffle(words) : words.slice();
        posInRound = 0;
      }
      startRound();

      function renderRep() {
        const currentTarget = order[posInRound];
        const roundLabel = mode === 'count' ? ' (รอบ ' + (round + 1) + '/' + targetRounds + ')' : ' (จบไปแล้ว ' + round + ' รอบ)';
        const wordLabel = words.length > 1 ? ' · คำที่ ' + (posInRound + 1) + '/' + words.length : '';
        drillEl.innerHTML =
          '<div class="session-prompt-label">พิมพ์คำนี้อีกครั้ง' + roundLabel + wordLabel + '</div>' +
          tileRowHTML(currentTarget, 'big') +
          '<form class="session-answer-form" id="learnIlForm">' +
            '<input type="text" id="learnIlInput" autocomplete="off" placeholder="พิมพ์คำด้านบนให้ตรงกัน" autofocus>' +
          '</form>' +
          '<div class="session-feedback" id="learnIlFeedback"></div>' +
          (mode === 'free' ? '<div class="session-controls"><button type="button" class="btn btn-outline btn-sm" id="learnIlDoneBtn">✅ จำได้แล้ว จบ Instant Learn</button></div>' : '');

        const ilForm = document.getElementById('learnIlForm');
        const ilInput = document.getElementById('learnIlInput');
        const ilFeedback = document.getElementById('learnIlFeedback');
        ilInput.focus();

        const doneBtn = document.getElementById('learnIlDoneBtn');
        if (doneBtn) doneBtn.addEventListener('click', endInstantLearn);

        ilForm.addEventListener('submit', function (e) {
          e.preventDefault();
          const guess = ilInput.value.trim().toUpperCase();
          if (!guess) return;
          if (guess === currentTarget) {
            ilFeedback.textContent = '✓ ถูกต้อง!';
            ilFeedback.className = 'session-feedback correct';
            posInRound++;
            if (posInRound >= order.length) {
              // completed every word in this round
              round++;
              if (mode === 'count' && round >= targetRounds) {
                setTimeout(endInstantLearn, 500);
                return;
              }
              startRound();
            }
            setTimeout(renderRep, 400);
          } else {
            ilFeedback.textContent = '✗ ยังไม่ตรง ลองอีกครั้ง';
            ilFeedback.className = 'session-feedback wrong';
            ilInput.value = '';
          }
        });
      }
      renderRep();
    }

    function endInstantLearn() {
      wrap.innerHTML = '<p class="session-missed-none">⚡ จบ Instant Learn แล้ว</p>';
      if (nextWrap) nextWrap.style.display = '';
    }

    runDrill();
  }

  function nextLearnCard() {
    learnSession.index++;
    renderLearnCard();
  }

  function renderLearnLevelSummary() {
    const total = learnSession.queue.length;
    const pct = total ? Math.round((learnSession.correct / total) * 100) : 0;
    const stars = pct >= 90 ? '⭐⭐⭐' : pct >= 70 ? '⭐⭐' : pct >= 40 ? '⭐' : '·';
    const info = learnSession.info;
    const area = document.getElementById('learnSessionArea');
    area.innerHTML =
      '<div class="session-summary">' +
        '<div class="session-prompt-label">' + (info.kind === 'boss' ? '👑 จบด่านบอสแล้ว' : 'จบ Level ' + learnSession.levelIndex + ' แล้ว') + '</div>' +
        '<div class="learn-summary-stars">' + stars + '</div>' +
        '<div class="big-stat">' + pct + '%</div>' +
        '<p>ตอบถูก ' + learnSession.correct + ' / ' + total + ' คำ · ตอบผิด ' + learnSession.incorrect + ' คำ</p>' +
        '<div class="session-controls">' +
          '<button class="btn btn-outline" id="learnBackToListBtn">↩ กลับไปหน้า Level</button>' +
          (learnSession.levelIndex < learnLevelCount(learnSession.length) ? '<button class="btn btn-primary" id="learnNextLevelBtn">▶ Level ถัดไป</button>' : '') +
        '</div>' +
      '</div>';
    document.getElementById('learnBackToListBtn').addEventListener('click', endLearnLevel);
    const nextLevelBtn = document.getElementById('learnNextLevelBtn');
    if (nextLevelBtn) {
      nextLevelBtn.addEventListener('click', function () {
        startLearnLevel(learnSession.length, learnSession.levelIndex + 1);
      });
    }
    if (window.Achievements) {
      window.Achievements.record('session_complete', {
        total: total, correct: learnSession.correct, incorrect: learnSession.incorrect
      });
    }
  }

  // ---------- Learn: Extra drills (JQXZ, Dump Vowels, Dump Consonants) ----------
  //
  // Separate from the regular Level/Boss system above — these are themed
  // word pools (letter-focused) rather than the full alphabetical level
  // ladder, so they get their own lightweight menu + session flow that
  // reuses the same anagram-typing card UI pattern as renderLearnCard.

  const LEARN_EXTRA_VOWELS = ['A', 'E', 'I', 'O', 'U'];
  const LEARN_EXTRA_CONSONANTS = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z'];
  const LEARN_EXTRA_JQXZ_LENGTHS = [3, 4, 5, 6];
  const LEARN_EXTRA_DUMP_LENGTHS = [2, 3, 4, 5, 6];

  const learnExtraState = { view: 'menu', category: null, letter: null, length: null };
  const _learnExtraPoolCache = {};

  function learnExtraJqxzWords(L) {
    const key = 'jqxz:' + L;
    if (_learnExtraPoolCache[key]) return _learnExtraPoolCache[key];
    const pool = (lengthPool(L) || []).filter(function (w) { return /[JQXZ]/.test(w); });
    pool.sort(function (a, b) { return a.localeCompare(b); });
    _learnExtraPoolCache[key] = pool;
    return pool;
  }

  // "Dump vowel V" — words whose only vowel letter (A/E/I/O/U) is V itself
  // (may repeat), so learners drill the shape of words built around one
  // vowel without other vowels muddying the pattern.
  function learnExtraDumpVowelWords(letter, L) {
    const key = 'dv:' + letter + ':' + L;
    if (_learnExtraPoolCache[key]) return _learnExtraPoolCache[key];
    const pool = (lengthPool(L) || []).filter(function (w) {
      let hasLetter = false;
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (LEARN_EXTRA_VOWELS.indexOf(ch) !== -1) {
          if (ch !== letter) return false;
          hasLetter = true;
        }
      }
      return hasLetter;
    });
    pool.sort(function (a, b) { return a.localeCompare(b); });
    _learnExtraPoolCache[key] = pool;
    return pool;
  }

  // "Dump consonant C" — every word of this length that contains C at
  // least once (simple presence filter; consonants are common enough that
  // an "only this consonant" filter like the vowel version would be too
  // thin at longer lengths).
  function learnExtraDumpConsonantWords(letter, L) {
    const key = 'dc:' + letter + ':' + L;
    if (_learnExtraPoolCache[key]) return _learnExtraPoolCache[key];
    const pool = (lengthPool(L) || []).filter(function (w) { return w.indexOf(letter) !== -1; });
    pool.sort(function (a, b) { return a.localeCompare(b); });
    _learnExtraPoolCache[key] = pool;
    return pool;
  }

  function learnExtraCategoryLabel(cat) {
    if (cat === 'jqxz') return 'JQXZ';
    if (cat === 'vowel') return 'Dump Vowels';
    if (cat === 'consonant') return 'Dump พยัญชนะ';
    return cat;
  }

  function renderLearnExtraMenu(content) {
    learnExtraState.view = 'menu';
    let html = '<p class="panel-sub">เลือกหมวดแบบฝึกหัด Extra</p>';
    html += '<div class="learn-extra-cat-list">';
    html += learnExtraCatCardHTML('jqxz', '🔤 JQXZ', 'คำที่มีตัวอักษร J, Q, X หรือ Z — ความยาว 3L–6L');
    html += learnExtraCatCardHTML('vowel', '🅰️ Dump Vowels', 'ฝึกคำที่มีสระตัวเดียวกันซ้ำ (A, E, I, O, U) — ความยาว 2L–6L');
    html += learnExtraCatCardHTML('consonant', '🔠 Dump พยัญชนะ', 'ฝึกคำตามพยัญชนะที่เลือก — ความยาว 2L–6L');
    html += '</div>';
    content.innerHTML = html;

    content.querySelectorAll('.learn-extra-cat-card').forEach(function (card) {
      card.addEventListener('click', function () {
        renderLearnExtraPicker(content, card.dataset.cat);
      });
    });
  }

  function learnExtraCatCardHTML(cat, title, sub) {
    return '<div class="learn-extra-cat-card" data-cat="' + cat + '">' +
      '<div class="learn-extra-cat-title">' + title + '</div>' +
      '<div class="learn-extra-cat-sub">' + sub + '</div>' +
    '</div>';
  }

  function renderLearnExtraPicker(content, cat) {
    learnExtraState.view = 'picker';
    learnExtraState.category = cat;
    learnExtraState.letter = null;

    let html = '<div class="learn-extra-header">' +
      '<button type="button" class="btn btn-outline btn-sm" id="learnExtraBackBtn">← กลับ</button>' +
      '<h3 class="learn-extra-title">' + learnExtraCategoryLabel(cat) + '</h3>' +
    '</div>';

    if (cat === 'jqxz') {
      html += '<p class="panel-sub">เลือกความยาวคำ</p>';
      html += '<div class="chip-row chip-row-lg" id="learnExtraLenChips">';
      LEARN_EXTRA_JQXZ_LENGTHS.forEach(function (L) {
        const n = learnExtraJqxzWords(L).length;
        html += '<button type="button" class="length-chip" data-len="' + L + '">' + L + 'L<br><small>' + n + '</small></button>';
      });
      html += '</div>';
      content.innerHTML = html;
      content.querySelectorAll('#learnExtraLenChips .length-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const L = parseInt(btn.dataset.len, 10);
          const words = learnExtraJqxzWords(L);
          startLearnExtraSession(words, L, 'JQXZ · ' + L + 'L');
        });
      });
    } else {
      const letters = cat === 'vowel' ? LEARN_EXTRA_VOWELS : LEARN_EXTRA_CONSONANTS;
      const lengths = LEARN_EXTRA_DUMP_LENGTHS;
      html += '<p class="panel-sub">1) เลือกตัวอักษร</p>';
      html += '<div class="chip-row chip-row-lg" id="learnExtraLetterChips">';
      letters.forEach(function (letter) {
        html += '<button type="button" class="length-chip" data-letter="' + letter + '">' + letter + '</button>';
      });
      html += '</div>';
      html += '<p class="panel-sub" style="margin-top:1rem">2) เลือกความยาวคำ</p>';
      html += '<div class="chip-row chip-row-lg" id="learnExtraLenChips">';
      lengths.forEach(function (L) {
        html += '<button type="button" class="length-chip" data-len="' + L + '" disabled>' + L + 'L</button>';
      });
      html += '</div>';
      html += '<div id="learnExtraLenHint" class="field-hint"></div>';
      content.innerHTML = html;

      const letterBtns = content.querySelectorAll('#learnExtraLetterChips .length-chip');
      const lenBtns = content.querySelectorAll('#learnExtraLenChips .length-chip');
      const hintEl = document.getElementById('learnExtraLenHint');

      function poolFor(letter, L) {
        return cat === 'vowel' ? learnExtraDumpVowelWords(letter, L) : learnExtraDumpConsonantWords(letter, L);
      }

      function refreshLenCounts() {
        const letter = learnExtraState.letter;
        lenBtns.forEach(function (btn) {
          const L = parseInt(btn.dataset.len, 10);
          if (!letter) {
            btn.disabled = true;
            btn.innerHTML = L + 'L';
            return;
          }
          const n = poolFor(letter, L).length;
          btn.disabled = n === 0;
          btn.innerHTML = L + 'L<br><small>' + n + '</small>';
        });
        hintEl.textContent = letter ? '' : 'เลือกตัวอักษรก่อน';
      }
      refreshLenCounts();

      letterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          letterBtns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          learnExtraState.letter = btn.dataset.letter;
          refreshLenCounts();
        });
      });
      lenBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          const L = parseInt(btn.dataset.len, 10);
          const letter = learnExtraState.letter;
          if (!letter) return;
          const words = poolFor(letter, L);
          const label = (cat === 'vowel' ? 'Dump Vowel ' : 'Dump ') + letter + ' · ' + L + 'L';
          startLearnExtraSession(words, L, label);
        });
      });
    }

    document.getElementById('learnExtraBackBtn').addEventListener('click', function () {
      renderLearnExtraMenu(content);
    });
  }

  // Extra sessions reuse learnSession/renderLearnCard's per-word anagram
  // drill, but the queue is a themed word pool rather than a fixed
  // 10-word level, so it gets its own intro/summary instead of the
  // Level/Boss ones (which assume learnSession.levelIndex is meaningful).
  function startLearnExtraSession(words, L, label) {
    if (!words || !words.length) { showToast('ไม่พบคำในหมวดนี้'); return; }
    const capped = words.length > 40 ? shuffle(words).slice(0, 40) : words.slice();
    addWordsToCardbox(capped);

    learnSession.length = L;
    learnSession.levelIndex = null;
    learnSession.info = { kind: 'extra', label: label, words: capped };
    learnSession.queue = capped;
    learnSession.index = 0;
    learnSession.correct = 0;
    learnSession.incorrect = 0;
    learnSession.results = [];

    document.getElementById('learnContentCard').style.display = 'none';
    document.getElementById('learnSessionCard').style.display = '';
    renderLearnExtraIntro();
  }

  function renderLearnExtraIntro() {
    updateLearnProgressBar();
    const area = document.getElementById('learnSessionArea');
    const info = learnSession.info;
    let html = '<div class="learn-level-intro">' +
      '<div class="learn-level-intro-badge">✨ Extra</div>' +
      '<p class="panel-sub">' + info.label + ' — ' + info.words.length + ' คำ' + (info.words.length > 40 ? ' (สุ่ม 40 จากทั้งหมด)' : '') + '</p>' +
      '<div class="session-controls"><button class="btn btn-primary" id="learnLevelGoBtn">▶ เริ่ม</button>' +
      '<button class="btn btn-outline" id="learnLevelReviewBtn">📖 Review</button>' +
      '<button class="btn btn-outline" id="learnLevelBackBtn">↩ กลับ</button></div>' +
    '</div>';
    area.innerHTML = html;
    document.getElementById('learnLevelGoBtn').addEventListener('click', renderLearnCard);
    document.getElementById('learnLevelBackBtn').addEventListener('click', endLearnExtraSession);
    document.getElementById('learnLevelReviewBtn').addEventListener('click', function () {
      const words = info.words.slice();
      startAnagramReview(words, parseInt(document.getElementById('reviewSeconds') ? document.getElementById('reviewSeconds').value : 5, 10) || 5, {
        originTab: 'learn',
        onExit: function () {
          document.getElementById('learnContentCard').style.display = 'none';
          document.getElementById('learnSessionCard').style.display = '';
          renderLearnExtraIntro();
        }
      });
    });
  }

  function endLearnExtraSession() {
    document.getElementById('learnSessionCard').style.display = 'none';
    document.getElementById('learnContentCard').style.display = '';
    learnState.activeLength = 'extra';
    renderLearnContent();
    // Return to the picker for the category/letter just practiced instead
    // of dropping back to the top-level Extra menu.
    const content = document.getElementById('learnContent');
    if (content && learnExtraState.category) {
      renderLearnExtraPicker(content, learnExtraState.category);
    }
  }

  // renderLearnCard() (defined above) already branches its end-of-queue
  // case to renderLearnLevelSummary(); extend that branch point for
  // 'extra' sessions by wrapping the summary renderer.
  const _renderLearnLevelSummaryBase = renderLearnLevelSummary;
  function renderLearnSummaryDispatch() {
    if (learnSession.info && learnSession.info.kind === 'extra') {
      renderLearnExtraSummary();
    } else {
      _renderLearnLevelSummaryBase();
    }
  }

  function renderLearnExtraSummary() {
    const total = learnSession.queue.length;
    const pct = total ? Math.round((learnSession.correct / total) * 100) : 0;
    const stars = pct >= 90 ? '⭐⭐⭐' : pct >= 70 ? '⭐⭐' : pct >= 40 ? '⭐' : '·';
    const info = learnSession.info;
    const area = document.getElementById('learnSessionArea');
    area.innerHTML =
      '<div class="session-summary">' +
        '<div class="session-prompt-label">✨ จบ ' + info.label + ' แล้ว</div>' +
        '<div class="learn-summary-stars">' + stars + '</div>' +
        '<div class="big-stat">' + pct + '%</div>' +
        '<p>ตอบถูก ' + learnSession.correct + ' / ' + total + ' คำ · ตอบผิด ' + learnSession.incorrect + ' คำ</p>' +
        '<div class="session-controls">' +
          '<button class="btn btn-outline" id="learnExtraBackToListBtn">↩ กลับไปหน้าเลือก</button>' +
          '<button class="btn btn-primary" id="learnExtraRetryBtn">🔁 ฝึกซ้ำหมวดนี้</button>' +
        '</div>' +
      '</div>';
    document.getElementById('learnExtraBackToListBtn').addEventListener('click', endLearnExtraSession);
    document.getElementById('learnExtraRetryBtn').addEventListener('click', function () {
      startLearnExtraSession(info.words, learnSession.length, info.label);
    });
    if (window.Achievements) {
      window.Achievements.record('session_complete', {
        total: total, correct: learnSession.correct, incorrect: learnSession.incorrect
      });
    }
  }

  // ---------- Dashboard ----------

  function renderDashboard() {
    const box = loadCardbox();
    const now = Date.now();
    const total = box.length;
    const counts = { new: 0, learning: 0, mastered: 0 };
    let totalCorrect = 0, totalIncorrect = 0, dueCount = 0;
    box.forEach(function (c) {
      counts[c.status] = (counts[c.status] || 0) + 1;
      totalCorrect += c.correct;
      totalIncorrect += c.incorrect;
      if ((c.due || 0) <= now) dueCount++;
    });

    document.getElementById('dashStatGrid').innerHTML =
      statCard(total, 'คำใน Cardbox', '') +
      statCard(dueCount, 'ถึงกำหนดทบทวน', 'brass') +
      statCard(counts.learning, 'กำลังเรียน', '') +
      statCard(counts.mastered, 'เชี่ยวชาญ', 'teal') +
      statCard(totalCorrect + totalIncorrect, 'จำนวนครั้งที่ทบทวน', '');

    const pct = total ? Math.round((counts.mastered / total) * 100) : 0;
    document.getElementById('dashDonut').style.setProperty('--p', pct);
    document.getElementById('dashPct').textContent = pct + '%';

    document.getElementById('dashLegend').innerHTML =
      legendItem('var(--teal)', 'เชี่ยวชาญ', counts.mastered) +
      legendItem('var(--brass)', 'กำลังเรียน', counts.learning) +
      legendItem('#3a4a42', 'คำใหม่', counts.new);

    document.getElementById('customWordsCount').textContent =
      customWords.length ? 'คำศัพท์ที่นำเข้าเอง: ' + customWords.length + ' คำ' : 'ยังไม่มีคำศัพท์ที่นำเข้าเอง';

    const dashLearnBtnEl = document.getElementById('dashLearnBtn');
    if (dashLearnBtnEl) dashLearnBtnEl.textContent = t('dash.learnBtnMastered').replace('{n}', counts.mastered);

    renderDashActions(box, now, dueCount);
    renderDashSuggested();
  }

  function statCard(num, label, cls) {
    return '<div class="stat-card ' + cls + '"><div class="stat-num">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  // ---------- Stats tab: top words by various counts ----------
  const STATS_TOP_N = 20;

  function statsRankListHTML(pairs, unitLabel) {
    if (!pairs.length) return '<div class="empty-state">ยังไม่มีข้อมูล</div>';
    return '<div class="stats-rank-list">' + pairs.map(function (p, i) {
      return '<div class="stats-rank-row">' +
        '<span class="stats-rank-num">' + (i + 1) + '</span>' +
        '<span class="stats-rank-word">' + p.word + '</span>' +
        '<span class="stats-rank-count">' + p.count + ' ' + unitLabel + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function topFromCounts(countMap, n) {
    return Object.keys(countMap)
      .map(function (w) { return { word: w, count: countMap[w] }; })
      .filter(function (p) { return p.count > 0; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, n);
  }

  function renderStatsTab() {
    const hist = loadHistory();

    // 1) เจอบ่อยที่สุด: รวมทุก mode ในประวัติ
    const seenCounts = {};
    // 5) พิมพ์บ่อยที่สุด: เฉพาะ mode 'typing'
    const typingCounts = {};
    // 4) เรียนบ่อยที่สุด: เฉพาะ mode 'learn'
    const learnCounts = {};
    Object.keys(hist).forEach(function (word) {
      const events = hist[word];
      seenCounts[word] = events.length;
      let typingN = 0, learnN = 0;
      events.forEach(function (e) {
        if (e.mode === 'typing') typingN++;
        if (e.mode === 'learn') learnN++;
      });
      if (typingN) typingCounts[word] = typingN;
      if (learnN) learnCounts[word] = learnN;
    });

    // 2) ถูกบ่อยที่สุด / 3) ผิดบ่อยที่สุด: จาก Cardbox (สะสมทุกครั้งที่ทบทวน)
    const box = loadCardbox();
    const correctCounts = {}, incorrectCounts = {};
    box.forEach(function (c) {
      if (c.correct) correctCounts[c.word] = c.correct;
      if (c.incorrect) incorrectCounts[c.word] = c.incorrect;
    });

    const seenEl = document.getElementById('statsSeenList');
    if (seenEl) seenEl.innerHTML = statsRankListHTML(topFromCounts(seenCounts, STATS_TOP_N), 'ครั้ง');

    const correctEl = document.getElementById('statsCorrectList');
    if (correctEl) correctEl.innerHTML = statsRankListHTML(topFromCounts(correctCounts, STATS_TOP_N), 'ครั้ง');

    const incorrectEl = document.getElementById('statsIncorrectList');
    if (incorrectEl) incorrectEl.innerHTML = statsRankListHTML(topFromCounts(incorrectCounts, STATS_TOP_N), 'ครั้ง');

    const learnEl = document.getElementById('statsLearnList');
    if (learnEl) learnEl.innerHTML = statsRankListHTML(topFromCounts(learnCounts, STATS_TOP_N), 'ครั้ง');

    const typingEl = document.getElementById('statsTypingList');
    if (typingEl) typingEl.innerHTML = statsRankListHTML(topFromCounts(typingCounts, STATS_TOP_N), 'ครั้ง');
  }

  // ---------- Dashboard: REVIEW / time-studied / Daily Goal ----------
  // Rough per-word time estimate for the ETA shown on the REVIEW button —
  // not a measured average, just a simple assumption so the number is more
  // useful than a bare word count.
  const REVIEW_SECONDS_PER_WORD = 12;

  function renderDashActions(box, now, dueCount) {
    const etaMin = Math.max(1, Math.round((dueCount * REVIEW_SECONDS_PER_WORD) / 60));
    const reviewDetail = document.getElementById('dashReviewDetail');
    if (reviewDetail) {
      reviewDetail.innerHTML = dueCount
        ? 'ถึงกำหนดแล้ว <strong>' + dueCount + '</strong> คำ · ~' + etaMin + ' นาที'
        : 'ไม่มีคำถึงกำหนดตอนนี้';
    }

    const time = studyTimeStats();
    const timeDetail = document.getElementById('dashTimeDetail');
    if (timeDetail) {
      timeDetail.textContent = 'วันนี้ ' + formatMinutes(time.todayMinutes) + ' · ทั้งหมด ' + formatMinutes(time.totalMinutes);
    }

    const goal = dashGoalInfo(box, now);
    const goalDetail = document.getElementById('dashGoalDetail');
    if (goalDetail) {
      goalDetail.innerHTML = 'ถึงกำหนดวันนี้ <strong>' + goal.dueToday + '</strong> คำ · Anagram <strong>' + goal.anagramToday + '</strong>';
    }
  }

  function formatMinutes(min) {
    if (min < 60) return min + ' นาที';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + ' ชม.' + (m ? ' ' + m + ' นาที' : '');
  }

  // Estimates time spent studying from the global word-encounter log
  // (every mode logs a timestamp there via logWordEncounter). Consecutive
  // encounters within SESSION_GAP_MS of each other are treated as one
  // continuous study session; each answer also counts a small floor so a
  // lone encounter still registers instead of adding zero.
  const SESSION_GAP_MS = 2 * 60 * 1000; // 2 minutes idle = new session
  const PER_ANSWER_FLOOR_MS = 4 * 1000; // assume >=4s spent per answer

  function studyTimeStats() {
    const hist = loadHistory();
    const events = [];
    Object.keys(hist).forEach(function (word) {
      hist[word].forEach(function (e) { events.push(e.t); });
    });
    events.sort(function (a, b) { return a - b; });

    const since = startOfTodayMs();
    let totalMs = 0, todayMs = 0;
    for (let i = 0; i < events.length; i++) {
      const t = events[i];
      const prev = i > 0 ? events[i - 1] : null;
      const gap = prev != null ? t - prev : null;
      const durationMs = (gap != null && gap < SESSION_GAP_MS) ? gap : PER_ANSWER_FLOOR_MS;
      totalMs += durationMs;
      if (t >= since) todayMs += durationMs;
    }
    return {
      totalMinutes: Math.round(totalMs / 60000),
      todayMinutes: Math.round(todayMs / 60000)
    };
  }

  function dashGoalInfo(box, now) {
    const dueToday = box.filter(function (c) { return (c.due || 0) <= now; }).length;
    const since = startOfTodayMs();
    const log = loadLearnLog();
    let anagramToday = 0;
    for (let i = 0; i < log.length; i++) {
      if (log[i].t >= since) anagramToday++;
    }
    return { dueToday: dueToday, anagramToday: anagramToday };
  }

  function initDashActions() {
    const reviewBtn = document.getElementById('dashReviewBtn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function () {
        const box = loadCardbox();
        const now = Date.now();
        const pool = box.filter(function (c) { return (c.due || 0) <= now; });
        if (!pool.length) { showToast('ไม่มีคำที่ถึงกำหนดทบทวนตอนนี้'); return; }
        pool.sort(function (a, b) { return (a.due || 0) - (b.due || 0); });
        const tabBtn = document.querySelector('.tab-btn[data-tab="cardbox"]');
        if (tabBtn) tabBtn.click();
        startStudySession(pool, 'flashcard', 'alpha', settings.anagramCycleInterval);
      });
    }

    const timeBtn = document.getElementById('dashTimeBtn');
    if (timeBtn) {
      timeBtn.addEventListener('click', function () {
        const time = studyTimeStats();
        showToast('วันนี้เรียนไป ' + formatMinutes(time.todayMinutes) + ' · รวมทั้งหมด ' + formatMinutes(time.totalMinutes));
      });
    }

    const goalBtn = document.getElementById('dashGoalBtn');
    const goalModal = document.getElementById('dashGoalModal');
    if (goalBtn && goalModal) {
      goalBtn.addEventListener('click', function () {
        goalViewDate = dateKeyToday();
        renderGoalModal();
        goalModal.hidden = false;
      });
      const closeBtn = document.getElementById('dashGoalCloseBtn');
      if (closeBtn) closeBtn.addEventListener('click', function () { goalModal.hidden = true; });
      goalModal.addEventListener('click', function (e) {
        if (e.target === goalModal) goalModal.hidden = true;
      });
    }

    const prevBtn = document.getElementById('dashGoalPrevDay');
    const nextBtn = document.getElementById('dashGoalNextDay');
    if (prevBtn) prevBtn.addEventListener('click', function () { shiftGoalDate(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { shiftGoalDate(1); });

    // Daily Goal type picker — picks a length to study for the viewed date,
    // saved per-date so switching days keeps each day's own goal/progress.
    const goalTypeRow = document.getElementById('dashGoalTypeRow');
    if (goalTypeRow) {
      goalTypeRow.querySelectorAll('.mode-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          const goalType = chip.dataset.goal;
          const bestL = computeGoalLength(goalType);
          saveDailyGoalEntry(goalViewDate, { goal: goalType, length: bestL });
          renderGoalModal();
        });
      });
    }
  }

  // ---------- Daily Goal: per-date state ----------
  let goalViewDate = null; // 'YYYY-MM-DD' of the date currently shown in the modal

  function dateKeyToday() { return dateKeyFromMs(Date.now()); }
  function dateKeyFromMs(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function msFromDateKey(key) {
    const parts = key.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  }

  function loadDailyGoals() {
    try { return JSON.parse(localStorage.getItem(DAILY_GOAL_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function saveDailyGoalEntry(dateKey, entry) {
    const all = loadDailyGoals();
    all[dateKey] = entry;
    localStorage.setItem(DAILY_GOAL_KEY, JSON.stringify(all));
  }

  function shiftGoalDate(deltaDays) {
    const ms = msFromDateKey(goalViewDate) + deltaDays * 86400000;
    goalViewDate = dateKeyFromMs(ms);
    renderGoalModal();
  }

  function renderGoalModal() {
    const todayKey = dateKeyToday();
    const label = document.getElementById('dashGoalDateLabel');
    if (label) {
      const d = new Date(msFromDateKey(goalViewDate));
      const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      label.textContent = goalViewDate === todayKey ? 'วันนี้ (' + dateStr + ')' : dateStr;
    }

    // Stats shown (due/anagram) are based on the viewed date's start-of-day,
    // so past days show what was due/logged as of that day.
    const box = loadCardbox();
    const refMs = msFromDateKey(goalViewDate);
    const goal = dashGoalInfo(box, refMs + 86400000 - 1);
    document.getElementById('dashGoalStatGrid').innerHTML =
      statCard(goal.dueToday, 'ถึงกำหนด', 'brass') +
      statCard(goal.anagramToday, 'ANAGRAM', 'teal');

    const goalTypeRow = document.getElementById('dashGoalTypeRow');
    const saved = loadDailyGoals()[goalViewDate];
    if (goalTypeRow) {
      goalTypeRow.querySelectorAll('.mode-chip').forEach(function (c) {
        c.classList.toggle('active', !!saved && c.dataset.goal === saved.goal);
      });
    }

    const resultEl = document.getElementById('dashGoalResult');
    if (resultEl) {
      if (saved) {
        resultEl.innerHTML = '<p class="panel-sub">แนะนำ: คำยาว <strong>' + saved.length + '</strong> ตัวอักษร</p>' +
          '<button type="button" class="btn btn-teal btn-sm" id="dashGoalGoBtn">ไปเรียนเลย →</button>';
        const goBtn = document.getElementById('dashGoalGoBtn');
        if (goBtn) goBtn.addEventListener('click', function () { goToLearnLength(saved.length); });
      } else {
        resultEl.innerHTML = '';
      }
    }
  }

  // Picks which word-length fits each goal type, based on current Cardbox stats.
  function computeGoalLength(goalType) {
    const lengths = [2, 3, 4, 5, 6, 7, 8, 9];
    let statsByLen = lengths.map(function (L) { return { L: L, s: learnLengthCardStats(L) }; });

    let bestL = null;
    if (goalType === 'everyday') {
      // ทำทุกวัน: ความยาวที่มีคำ due เยอะสุด (ถ้าไม่มีเลย ใช้ความยาวที่เรียนสะสมมากสุด)
      statsByLen.sort(function (a, b) { return b.s.dueCount - a.s.dueCount; });
      bestL = statsByLen[0].s.dueCount > 0 ? statsByLen[0].L :
        statsByLen.slice().sort(function (a, b) { return b.s.inCardbox - a.s.inCardbox; })[0].L;
    } else if (goalType === 'formula') {
      // จำสูตร: คำสั้น (2-4 ตัวอักษร) ที่ยังเหลือให้เรียนเยอะสุด
      const shortLens = statsByLen.filter(function (x) { return x.L <= 4; });
      shortLens.sort(function (a, b) { return (b.s.totalInLength - b.s.inCardbox) - (a.s.totalInLength - a.s.inCardbox); });
      bestL = shortLens[0].L;
    } else if (goalType === 'stem') {
      // จำ Stem: ความยาวกลาง (5-7) ที่เรียนไปแล้วบ้าง แต่ยัง mastered ไม่เยอะ
      const midLens = statsByLen.filter(function (x) { return x.L >= 5 && x.L <= 7 && x.s.inCardbox > 0; });
      const pool = midLens.length ? midLens : statsByLen.filter(function (x) { return x.L >= 5 && x.L <= 7; });
      pool.sort(function (a, b) { return (a.s.mastered / (a.s.inCardbox || 1)) - (b.s.mastered / (b.s.inCardbox || 1)); });
      bestL = pool[0].L;
    } else if (goalType === 'serious') {
      // จริงจัง: ความยาวที่ยาก/ยาวสุดที่เริ่มเรียนแล้ว (8-9), ไม่งั้น fallback 7
      const hardLens = statsByLen.filter(function (x) { return x.L >= 8; });
      hardLens.sort(function (a, b) { return b.s.inCardbox - a.s.inCardbox; });
      bestL = hardLens[0].s.inCardbox > 0 ? hardLens[0].L : 7;
    }
    return bestL == null ? 5 : bestL;
  }

  // Jumps to the Learn tab set to the given length.
  function goToLearnLength(L) {
    const goalModal = document.getElementById('dashGoalModal');
    if (goalModal) goalModal.hidden = true;

    const learnTabBtn = document.querySelector('.tab-btn[data-tab="learn"]');
    if (learnTabBtn) learnTabBtn.click();

    learnState.activeLength = L;
    document.querySelectorAll('#learnLenChips .length-chip').forEach(function (b) {
      b.classList.toggle('active', b.dataset.len == String(L));
    });
    renderLearnContent();
    showToast('แนะนำ: คำยาว ' + L + ' ตัวอักษร สำหรับเป้าหมายนี้');
  }

  // ---------- Dashboard: suggested words (fixed for the page load, unless reshuffled) ----------

  let dashSuggestedWords = null;
  const dashSelected = new Set();

  function generateDashSuggested() {
    dashSuggestedWords = pickRandomWords(settings.dashMin, settings.dashMax, settings.dashCount);
    dashSuggestedWords.forEach(function (w) { logWordEncounter(w, 'suggested'); });
  }

  function updateDashSelectedCount() {
    const el = document.getElementById('dashSelectedCount');
    if (!el) return;
    el.textContent = (settings.lang === 'en' ? dashSelected.size + ' selected' : 'เลือกแล้ว ' + dashSelected.size + ' คำ');
  }

  function renderDashSuggested() {
    if (!dashSuggestedWords) generateDashSuggested();
    const wrap = document.getElementById('dashSuggestedWords');
    if (!wrap) return;
    dashSelected.clear();
    const dashSelectAllCb = document.getElementById('dashSelectAll');
    if (dashSelectAllCb) dashSelectAllCb.checked = false;
    if (!dashSuggestedWords.length) {
      wrap.innerHTML = '<div class="empty-state">ไม่พบคำศัพท์ในช่วงความยาวที่ตั้งไว้ — ปรับได้ที่หน้า Setting</div>';
      updateDashSelectedCount();
      return;
    }
    wrap.innerHTML = dashSuggestedWords.map(function (word) {
      return wordRowHTML(word, true, dashSelected, 'dash-check');
    }).join('');
    bindAnagramToggles(wrap);
    updateDashSelectedCount();
  }

  function initDashSuggested() {
    document.getElementById('dashSuggestedRefreshBtn').addEventListener('click', function () {
      generateDashSuggested();
      renderDashSuggested();
    });

    document.getElementById('dashSuggestedWords').addEventListener('change', function (e) {
      const cb = e.target.closest('.dash-check');
      if (!cb) return;
      const word = cb.dataset.word;
      if (cb.checked) dashSelected.add(word);
      else dashSelected.delete(word);
      updateDashSelectedCount();
      const selectAllCb = document.getElementById('dashSelectAll');
      if (selectAllCb) {
        selectAllCb.checked = (dashSuggestedWords || []).length > 0 &&
          dashSuggestedWords.every(function (w) { return dashSelected.has(w); });
      }
    });

    document.getElementById('dashSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      const words = dashSuggestedWords || [];
      if (checked) words.forEach(function (w) { dashSelected.add(w); });
      else words.forEach(function (w) { dashSelected.delete(w); });
      document.querySelectorAll('#dashSuggestedWords .dash-check').forEach(function (cb) { cb.checked = checked; });
      updateDashSelectedCount();
    });

    document.getElementById('dashSaveBtn').addEventListener('click', function () {
      if (!dashSelected.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const added = addWordsToCardbox(Array.from(dashSelected));
      showToast('บันทึกลง Cardbox แล้ว ' + added + ' คำ');
      if (window.Achievements) window.Achievements.record('cardbox_add');
    });
  }

  function legendItem(color, label, count) {
    return '<div class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' + label + ' (' + count + ')</div>';
  }

  // ---------- Import / Export ----------

  function initImportExport() {
    document.getElementById('exportProgressBtn').addEventListener('click', function () {
      const box = loadCardbox();
      const blob = new Blob([JSON.stringify(box, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      downloadDataUrl(url, 'csw24-progress-backup-' + today + '.json');
      showToast('ส่งออกความคืบหน้าแล้ว (' + box.length + ' คำ)');
    });

    document.getElementById('importProgressInput').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) throw new Error('bad format');
          const box = loadCardbox();
          const byWord = {};
          box.forEach(function (c) { byWord[c.word] = c; });
          let added = 0, updated = 0;
          imported.forEach(function (item) {
            if (!item || !item.word) return;
            const word = String(item.word).toUpperCase();
            const card = Object.assign(newCard(word), item, { word: word });
            patchLegacyCard(card);
            if (byWord[word]) updated++; else added++;
            byWord[word] = card;
          });
          saveCardbox(Object.values(byWord));
          renderCardboxTab();
          renderDashboard();
          showToast('นำเข้าความคืบหน้าแล้ว (เพิ่มใหม่ ' + added + ' · อัปเดต ' + updated + ')');
        } catch (err) {
          showToast('ไฟล์ไม่ถูกต้อง ไม่สามารถนำเข้าได้');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    document.getElementById('importWordsInput').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        const lines = reader.result.split(/\r?\n/);
        const existing = new Set(customWords);
        let added = 0, skipped = 0;
        lines.forEach(function (line) {
          const w = line.trim().toUpperCase();
          if (!w) return;
          if (!/^[A-Z]{2,15}$/.test(w)) { skipped++; return; }
          if (existing.has(w)) { skipped++; return; }
          existing.add(w);
          customWords.push(w);
          added++;
        });
        rebuildCustomIndex();
        saveCustomWords();
        renderDashboard();
        showToast('นำเข้าคำศัพท์ใหม่ ' + added + ' คำ (ข้าม ' + skipped + ' คำที่ซ้ำ/ไม่ถูกรูปแบบ)');
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  // ---------- Dedicated Cardbox export/import (replace semantics) ----------

  function initCardboxImportExport() {
    const exportBtn = document.getElementById('exportCardboxBtn');
    const importInput = document.getElementById('importCardboxInput');
    if (!exportBtn || !importInput) return;

    exportBtn.addEventListener('click', function () {
      const box = loadCardbox();
      if (!box.length) { showToast('Cardbox ว่างอยู่ ไม่มีอะไรให้ Export'); return; }
      const blob = new Blob([JSON.stringify(box, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      downloadDataUrl(url, 'csw24-cardbox-' + today + '.json');
      showToast('Export Cardbox แล้ว (' + box.length + ' คำ) — เก็บไฟล์นี้ไว้ก่อน Import ชุดใหม่');
    });

    importInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const imported = JSON.parse(reader.result);
          if (!Array.isArray(imported)) throw new Error('bad format');
          const currentCount = loadCardbox().length;
          if (currentCount > 0) {
            const ok = confirm(
              'Cardbox ปัจจุบันมี ' + currentCount + ' คำ การ Import จะ "แทนที่ทั้งหมด" ด้วยไฟล์นี้ ' +
              '(แนะนำ Export เก็บไว้ก่อนถ้ายังไม่ได้ทำ) ต้องการดำเนินการต่อหรือไม่?'
            );
            if (!ok) { e.target.value = ''; return; }
          }
          const cleaned = [];
          const seen = new Set();
          imported.forEach(function (item) {
            if (!item || !item.word) return;
            const word = String(item.word).toUpperCase();
            if (seen.has(word)) return;
            seen.add(word);
            const card = Object.assign(newCard(word), item, { word: word });
            patchLegacyCard(card);
            cleaned.push(card);
          });
          saveCardbox(cleaned);
          renderCardboxTab();
          renderDashboard();
          showToast('Import Cardbox แล้ว — แทนที่ด้วย ' + cleaned.length + ' คำ');
        } catch (err) {
          showToast('ไฟล์ไม่ถูกต้อง ไม่สามารถ Import ได้');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  // ---------- Cardbox groups tab (save/load named snapshots) ----------

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cardboxGroupRowHTML(g) {
    const dateStr = formatDueDate(g.createdAt);
    return (
      '<div class="card-row group-row" data-group-id="' + g.id + '">' +
        '<div>' +
          '<div class="group-row-name">' + escapeHtml(g.name) + '</div>' +
          '<div class="field-hint">' + dateStr + '</div>' +
        '</div>' +
        '<div class="group-row-meta">' +
          '<span class="status-pill status-new">' + t('cardboxGroups.wordCount').replace('{n}', g.cards.length) + '</span>' +
          '<div class="group-row-actions">' +
            '<button class="btn btn-primary btn-sm group-load-btn" data-group-id="' + g.id + '">' + t('cardboxGroups.load') + '</button>' +
            '<button class="btn btn-outline btn-sm group-rename-btn" data-group-id="' + g.id + '">' + t('cardboxGroups.rename') + '</button>' +
            '<button class="btn btn-outline btn-sm group-delete-btn" data-group-id="' + g.id + '">' + t('cardboxGroups.delete') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderCardboxGroups() {
    const listEl = document.getElementById('cardboxGroupsList');
    if (!listEl) return;
    const groups = loadCardboxGroups();
    if (!groups.length) {
      listEl.innerHTML = '<div class="empty-state">' + t('cardboxGroups.empty') + '</div>';
      return;
    }
    listEl.innerHTML = groups.map(cardboxGroupRowHTML).join('');
  }

  function initCardboxGroups() {
    const addBtn = document.getElementById('addCardboxGroupBtn');
    const listEl = document.getElementById('cardboxGroupsList');
    if (!addBtn || !listEl) return;

    addBtn.addEventListener('click', function () {
      const box = loadCardbox();
      const selectedWords = cardboxRenderState.selected;
      if (!selectedWords.size) { showToast(t('cardboxGroups.noSelection')); return; }
      const selectedCards = box.filter(function (c) { return selectedWords.has(c.word); });
      if (!selectedCards.length) { showToast(t('cardboxGroups.noSelection')); return; }
      const name = window.prompt(t('cardboxGroups.namePrompt'), '');
      if (name === null) return; // user cancelled
      const group = addCardboxGroup(name, selectedCards);
      if (!group) { showToast(t('cardboxGroups.noSelection')); return; }
      renderCardboxGroups();
      showToast(t('cardboxGroups.saved').replace('{name}', group.name).replace('{n}', group.cards.length));
    });

    listEl.addEventListener('click', function (e) {
      const loadBtn = e.target.closest('.group-load-btn');
      const renameBtn = e.target.closest('.group-rename-btn');
      const deleteBtn = e.target.closest('.group-delete-btn');

      if (loadBtn) {
        // "Load into Cardbox" re-ticks (selects) this group's words in the
        // Cardbox list — it does NOT add/replace any cards. Words from the
        // group that no longer exist in the current Cardbox are skipped.
        const groupId = loadBtn.dataset.groupId;
        const groups = loadCardboxGroups();
        const group = groups.find(function (g) { return g.id === groupId; });
        if (!group) return;
        const box = loadCardbox();
        const present = new Set(box.map(function (c) { return c.word; }));
        let selected = 0, missing = 0;
        cardboxRenderState.selected.clear();
        group.cards.forEach(function (c) {
          if (present.has(c.word)) { cardboxRenderState.selected.add(c.word); selected++; }
          else missing++;
        });
        saveCardboxSelection();
        renderCardboxTab();
        if (missing > 0) {
          showToast(t('cardboxGroups.loadSelectDoneMissing')
            .replace('{name}', group.name).replace('{n}', selected).replace('{missing}', missing));
        } else {
          showToast(t('cardboxGroups.loadSelectDone').replace('{name}', group.name).replace('{n}', selected));
        }
        return;
      }

      if (renameBtn) {
        const groupId = renameBtn.dataset.groupId;
        const groups = loadCardboxGroups();
        const group = groups.find(function (g) { return g.id === groupId; });
        if (!group) return;
        const newName = window.prompt(t('cardboxGroups.renamePrompt'), group.name);
        if (newName === null) return;
        if (renameCardboxGroup(groupId, newName)) renderCardboxGroups();
        return;
      }

      if (deleteBtn) {
        const groupId = deleteBtn.dataset.groupId;
        const groups = loadCardboxGroups();
        const group = groups.find(function (g) { return g.id === groupId; });
        if (!group) return;
        const ok = window.confirm(t('cardboxGroups.deleteConfirm').replace('{name}', group.name));
        if (!ok) return;
        deleteCardboxGroup(groupId);
        renderCardboxGroups();
        showToast(t('cardboxGroups.deleted').replace('{name}', group.name));
        return;
      }
    });
  }

  // ---------- Word browser tab ----------

  const browseState = { activeLength: 'all', results: [], shown: 0, sort: 'alpha', selected: new Set(), limit: 0 };

  const BROWSE_FILTER_IDS = [
    'browseWordSearch',
    'filterStarts', 'filterEnds', 'filterContains', 'filterContainsAll',
    'filterScoreMin', 'filterScoreMax', 'filterPattern', 'filterRack',
    'filterVowelMin', 'filterVowelMax'
  ];

  function initBrowseChips() {
    const wrap = document.getElementById('browseLengthChips');
    let html = '<button class="length-chip active" data-len="all">ทั้งหมด</button>';
    for (let L = CSW24_MIN_LEN; L <= CSW24_MAX_LEN; L++) {
      html += '<button class="length-chip" data-len="' + L + '">' + L + '</button>';
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('.length-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        wrap.querySelectorAll('.length-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        browseState.activeLength = btn.dataset.len === 'all' ? 'all' : parseInt(btn.dataset.len, 10);
        const sortSel = document.getElementById('browseSortSelect');
        if (browseState.activeLength === 7) {
          browseState.sort = 'prob-desc';
          if (sortSel) sortSel.value = 'prob-desc';
        } else {
          browseState.sort = 'alpha';
          if (sortSel) sortSel.value = 'alpha';
        }
        runBrowseSearch();
      });
    });

    // Progressive search: re-run the search in real time as the person types,
    // debounced so fast typing doesn't re-filter the whole dictionary on
    // every single keystroke. Enter still triggers an immediate search.
    let browseDebounceHandle = null;
    BROWSE_FILTER_IDS.forEach(function (id) {
      const el = document.getElementById(id);
      el.addEventListener('input', function () {
        if (browseDebounceHandle) clearTimeout(browseDebounceHandle);
        browseDebounceHandle = setTimeout(runBrowseSearch, 200);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          if (browseDebounceHandle) clearTimeout(browseDebounceHandle);
          runBrowseSearch();
        }
      });
    });
    document.getElementById('browseSearchBtn').addEventListener('click', runBrowseSearch);
    document.getElementById('browseClearBtn').addEventListener('click', function () {
      BROWSE_FILTER_IDS.forEach(function (id) { document.getElementById(id).value = ''; });
      document.getElementById('browseLimitInput').value = '0';
      runBrowseSearch();
    });

    const browseLimitEl = document.getElementById('browseLimitInput');
    browseLimitEl.addEventListener('input', function () {
      if (browseDebounceHandle) clearTimeout(browseDebounceHandle);
      browseDebounceHandle = setTimeout(runBrowseSearch, 200);
    });
    browseLimitEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (browseDebounceHandle) clearTimeout(browseDebounceHandle);
        runBrowseSearch();
      }
    });
    document.getElementById('browseLoadMoreBtn').addEventListener('click', function () { renderBrowseResults(false); });
    document.getElementById('browseSortSelect').addEventListener('change', function (e) {
      browseState.sort = e.target.value;
      applyBrowseSort();
      browseState.shown = 0;
      renderBrowseResults(true);
    });

    document.getElementById('browseResults').addEventListener('change', function (e) {
      const cb = e.target.closest('.browse-check');
      if (!cb) return;
      const word = cb.dataset.word;
      if (cb.checked) browseState.selected.add(word);
      else browseState.selected.delete(word);
      updateBrowseSelectedCount();
      const selectAllCb = document.getElementById('browseSelectAll');
      if (selectAllCb) {
        selectAllCb.checked = browseState.results.length > 0 &&
          browseState.results.every(function (w) { return browseState.selected.has(w); });
      }
    });

    // Clicking a word row (but not its checkbox or anagram toggle) opens the
    // word detail modal.
    document.getElementById('browseResults').addEventListener('click', function (e) {
      if (e.target.closest('.browse-check') || e.target.closest('.anagram-toggle')) return;
      const row = e.target.closest('.word-row');
      if (row) openWordDetail(row.dataset.word);
    });


    document.getElementById('browseSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      if (checked) {
        browseState.results.forEach(function (w) { browseState.selected.add(w); });
      } else {
        // Only deselect words that are part of the current result set —
        // leaves any selection made under a different filter untouched.
        browseState.results.forEach(function (w) { browseState.selected.delete(w); });
      }
      document.querySelectorAll('#browseResults .browse-check').forEach(function (cb) { cb.checked = checked; });
      updateBrowseSelectedCount();
    });

    document.getElementById('browseSaveBtn').addEventListener('click', function () {
      if (!browseState.selected.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const added = addWordsToCardbox(Array.from(browseState.selected));
      showToast('บันทึกลง Cardbox แล้ว ' + added + ' คำ');
      if (window.Achievements) window.Achievements.record('cardbox_add');
    });
  }

  function updateBrowseSelectedCount() {
    const el = document.getElementById('browseSelectedCount');
    if (!el) return;
    const n = browseState.selected.size;
    el.textContent = (settings.lang === 'en' ? n + ' selected' : 'เลือกแล้ว ' + n + ' คำ');
  }

  const VOWELS = { A: 1, E: 1, I: 1, O: 1, U: 1 };

  function vowelRatioPct(word) {
    let v = 0;
    for (let i = 0; i < word.length; i++) if (VOWELS[word[i]]) v++;
    return (v / word.length) * 100;
  }

  // Pattern like "C_C" or "?AT": '_' and '?' match any single letter,
  // any other character must match exactly. Length must match the word.
  function wordMatchesPattern(word, pattern) {
    if (word.length !== pattern.length) return false;
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i];
      if (p === '_' || p === '?') continue;
      if (p !== word[i]) return false;
    }
    return true;
  }

  // Rack string like "AEINRT" or "AEIN?T" ('?' = blank, matches any letter).
  // The word must be fully buildable from the given letters (each rack
  // letter usable once), independent of position/order.
  function wordPlayableFromRack(word, rackCounts, blankCount) {
    return isSubsetOfCountsWithBlanks(word, rackCounts, blankCount);
  }

  function wordMatchesFilters(word, f) {
    if (f.wordSearch && word.indexOf(f.wordSearch) === -1) return false;
    if (f.starts && !word.startsWith(f.starts)) return false;
    if (f.ends && !word.endsWith(f.ends)) return false;
    if (f.contains && word.indexOf(f.contains) === -1) return false;
    if (f.containsAll && !wordContainsLettersAnywhere(word, f.containsAll)) return false;
    if (f.scoreMin != null && wordScore(word) < f.scoreMin) return false;
    if (f.scoreMax != null && wordScore(word) > f.scoreMax) return false;
    if (f.pattern && !wordMatchesPattern(word, f.pattern)) return false;
    if (f.rackCounts && !wordPlayableFromRack(word, f.rackCounts, f.rackBlanks)) return false;
    if (f.vowelMin != null && vowelRatioPct(word) < f.vowelMin) return false;
    if (f.vowelMax != null && vowelRatioPct(word) > f.vowelMax) return false;
    return true;
  }

  function runBrowseSearch() {
    const wordSearch = document.getElementById('browseWordSearch').value.trim().toUpperCase();
    const starts = document.getElementById('filterStarts').value.trim().toUpperCase();
    const ends = document.getElementById('filterEnds').value.trim().toUpperCase();
    const contains = document.getElementById('filterContains').value.trim().toUpperCase();
    const containsAllRaw = document.getElementById('filterContainsAll').value.trim().toUpperCase();
    const scoreMinRaw = document.getElementById('filterScoreMin').value;
    const scoreMaxRaw = document.getElementById('filterScoreMax').value;
    const patternRaw = document.getElementById('filterPattern').value.trim().toUpperCase();
    const rackRaw = document.getElementById('filterRack').value.trim().toUpperCase();
    const vowelMinRaw = document.getElementById('filterVowelMin').value;
    const vowelMaxRaw = document.getElementById('filterVowelMax').value;

    let rackCounts = null;
    let rackBlanks = 0;
    if (rackRaw) {
      const rackLetters = rackRaw.replace(/[^A-Z?]/g, '');
      rackBlanks = (rackLetters.match(/\?/g) || []).length;
      rackCounts = letterCounts(rackLetters.replace(/\?/g, ''));
    }

    const f = {
      wordSearch: wordSearch ? wordSearch.replace(/[^A-Z]/g, '') : null,
      starts: starts, ends: ends, contains: contains,
      containsAll: containsAllRaw ? containsAllRaw.replace(/[^A-Z?]/g, '') : null,
      scoreMin: scoreMinRaw ? parseInt(scoreMinRaw, 10) : null,
      scoreMax: scoreMaxRaw ? parseInt(scoreMaxRaw, 10) : null,
      pattern: patternRaw ? patternRaw.replace(/[^A-Z_?]/g, '') : null,
      rackCounts: rackCounts, rackBlanks: rackBlanks,
      vowelMin: vowelMinRaw ? parseFloat(vowelMinRaw) : null,
      vowelMax: vowelMaxRaw ? parseFloat(vowelMaxRaw) : null
    };
    const hasFilters = !!(
      f.wordSearch || starts || ends || contains || f.containsAll || f.scoreMin != null || f.scoreMax != null ||
      f.pattern || f.rackCounts || f.vowelMin != null || f.vowelMax != null
    );

    let candidates = [];
    if (f.pattern) {
      // Pattern search implies a fixed word length, so narrow to that length
      // directly instead of scanning every length in the dictionary.
      candidates = lengthPool(f.pattern.length);
    } else if (browseState.activeLength === 'all') {
      for (let L = CSW24_MIN_LEN; L <= CSW24_MAX_LEN; L++) candidates = candidates.concat(lengthPool(L));
    } else {
      candidates = lengthPool(browseState.activeLength);
    }

    const results = hasFilters ? candidates.filter(function (w) { return wordMatchesFilters(w, f); }) : candidates;
    browseState.results = results;
    browseState.shown = 0;
    applyBrowseSort();

    // Display limit: 0 (or blank/invalid) means "show all". When set, trim
    // the sorted result set down to the first N words — this also makes
    // "Select All" and Load More naturally respect the limit, since they
    // both operate on browseState.results.
    const limitRaw = parseInt(document.getElementById('browseLimitInput').value, 10);
    const limit = (isFinite(limitRaw) && limitRaw > 0) ? limitRaw : 0;
    browseState.limit = limit;
    const totalMatched = browseState.results.length;
    if (limit > 0 && browseState.results.length > limit) {
      browseState.results = browseState.results.slice(0, limit);
    }

    document.getElementById('browseResultCount').textContent =
      (limit > 0 && totalMatched > limit)
        ? 'พบ ' + totalMatched.toLocaleString('en-US') + ' คำ · แสดง ' + browseState.results.length.toLocaleString('en-US') + ' คำ (จำกัดไว้)'
        : 'พบ ' + totalMatched.toLocaleString('en-US') + ' คำ';
    renderBrowseResults(true);
    const selectAllCb = document.getElementById('browseSelectAll');
    if (selectAllCb) {
      selectAllCb.checked = browseState.results.length > 0 &&
        browseState.results.every(function (w) { return browseState.selected.has(w); });
    }
  }

  // Sorts browseState.results in place according to browseState.sort.
  // "alpha" keeps the natural dictionary order words were gathered in
  // (already alphabetical per length bucket). The Prob sorts use each
  // word's normalized draw-probability percentile (see wordPlayability /
  // wordProbabilityNormalizedPct above) so mixed-length result sets still
  // compare fairly across different word lengths.
  function applyBrowseSort() {
    const sort = browseState.sort;
    if (sort === 'prob-desc' || sort === 'prob-asc' || sort === 'play-desc' || sort === 'play-asc') {
      const isPlay = sort === 'play-desc' || sort === 'play-asc';
      const dir = (sort === 'prob-desc' || sort === 'play-desc') ? -1 : 1;
      const keyFn = isPlay ? wordPlayability : wordProbabilityNormalizedPct;
      // Precompute each word's key once (Schwartzian transform) instead of
      // recomputing it inside the comparator — on a large result set the
      // sort makes O(n log n) comparisons, so calling the scoring function
      // twice per comparison was doing millions of redundant lookups.
      const withKey = browseState.results.map(function (w) {
        return { w: w, p: keyFn(w) };
      });
      withKey.sort(function (a, b) {
        if (a.p !== b.p) return (a.p - b.p) * dir;
        return a.w < b.w ? -1 : (a.w > b.w ? 1 : 0);
      });
      browseState.results = withKey.map(function (x) { return x.w; });
    } else {
      browseState.results.sort(function (a, b) { return a < b ? -1 : (a > b ? 1 : 0); });
    }
  }

  function renderBrowseResults(reset) {
    const wrap = document.getElementById('browseResults');
    if (reset) wrap.innerHTML = '';
    const slice = browseState.results.slice(browseState.shown, browseState.shown + PAGE_SIZE);
    // Render only the new slice into a detached fragment and scan just that
    // fragment for anagram-toggle buttons to bind — scanning the whole
    // (potentially huge) container on every "Load More" click is what made
    // paging through large result sets increasingly slow.
    const temp = document.createElement('div');
    temp.innerHTML = slice.map(function (w, i) { return browseWordRowHTML(w, browseState.shown + i + 1); }).join('');
    bindAnagramToggles(temp);
    while (temp.firstChild) wrap.appendChild(temp.firstChild);
    browseState.shown += slice.length;
    document.getElementById('browseLoadMoreWrap').style.display =
      browseState.shown < browseState.results.length ? '' : 'none';
  }

  // ---------- Minigame: typing ----------

  const TG_SAVE_KEY = 'csw24_typing_progress_v1';

  const tg = { words: [], index: 0, strict: false, mistakes: 0, startTime: 0, timerHandle: null, mode: 'random', showAnagram: false, typed: [], typedSelected: new Set(), containsAll: '', startsWith: '' };

  function tgWordsForLetterMode(len) {
    // All words of a single chosen length, sorted A→Z.
    let pool = lengthPool(len).slice();
    pool = Array.from(new Set(pool)).sort();
    return pool;
  }

  // Letters (and optional '?' wildcards) must all be present in the word
  // somewhere, regardless of position/order. Repeated letters in the needle
  // require that many occurrences in the word (e.g. "NN" needs 2 N's).
  // Each '?' in the needle is a wildcard that can cover any one missing letter,
  // like a Scrabble blank tile.
  function wordContainsLettersAnywhere(word, needle) {
    const clean = (needle || '').toUpperCase().replace(/[^A-Z?]/g, '');
    if (!clean) return true;
    const blankCount = (clean.match(/\?/g) || []).length;
    const letters = clean.replace(/\?/g, '');
    const needCounts = letterCounts(letters);
    const wordCounts = letterCounts(word);
    let blanksUsed = 0;
    for (const ch in needCounts) {
      const have = wordCounts[ch] || 0;
      const short = needCounts[ch] - have;
      if (short > 0) blanksUsed += short;
    }
    return blanksUsed <= blankCount;
  }

  function tgApplyContainsAllFilter(words, needle) {
    if (!needle || !needle.trim()) return words;
    return words.filter(function (w) { return wordContainsLettersAnywhere(w, needle); });
  }

  function tgApplyStartsWithFilter(words, prefix) {
    const clean = (prefix || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) return words;
    return words.filter(function (w) { return w.startsWith(clean); });
  }

  function tgWordsFromCardbox() {
    return loadCardbox().map(function (c) { return c.word; });
  }

  function tgWordsFromSuggested() {
    if (!dashSuggestedWords) generateDashSuggested();
    return (dashSuggestedWords || []).slice();
  }

  function tgSaveProgress() {
    try {
      localStorage.setItem(TG_SAVE_KEY, JSON.stringify({
        words: tg.words, index: tg.index, mistakes: tg.mistakes, startTime: tg.startTime,
        strict: tg.strict, showAnagram: tg.showAnagram, mode: tg.mode, containsAll: tg.containsAll,
        startsWith: tg.startsWith, typed: tg.typed
      }));
    } catch (e) { /* ignore */ }
  }

  function tgLoadProgress() {
    try {
      const raw = localStorage.getItem(TG_SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.words) || !data.words.length) return null;
      if (typeof data.index !== 'number' || data.index >= data.words.length) return null;
      return data;
    } catch (e) { return null; }
  }

  function tgClearProgress() {
    localStorage.removeItem(TG_SAVE_KEY);
  }

  function tgRefreshResumeBtn() {
    const btn = document.getElementById('tgResumeBtn');
    if (!btn) return;
    const saved = tgLoadProgress();
    if (saved) {
      btn.style.display = '';
      btn.textContent = '↩ เล่นต่อจากที่ค้างไว้ (' + saved.index + '/' + saved.words.length + ')';
    } else {
      btn.style.display = 'none';
    }
  }

  function initTypingGame() {
    const modeBtns = {
      random: document.getElementById('tgModeRandomBtn'),
      letter: document.getElementById('tgModeLetterBtn'),
      cardbox: document.getElementById('tgModeCardboxBtn'),
      suggested: document.getElementById('tgModeSuggestedBtn')
    };
    const rangeRow = document.getElementById('tgRangeRow');
    const countField = document.getElementById('tgCountField');
    const letterNote = document.getElementById('tgLetterNote');
    const maxField = document.getElementById('tgMax').closest('.field');

    function refreshModeChips() {
      Object.keys(modeBtns).forEach(function (m) { modeBtns[m].classList.toggle('active', tg.mode === m); });
      const isLetter = tg.mode === 'letter';
      const isSourceMode = tg.mode === 'cardbox' || tg.mode === 'suggested';
      rangeRow.style.display = isSourceMode ? 'none' : '';
      letterNote.style.display = isLetter ? '' : 'none';
      countField.style.display = isLetter ? 'none' : '';
      if (maxField) maxField.style.display = isLetter ? 'none' : '';
    }
    Object.keys(modeBtns).forEach(function (m) {
      modeBtns[m].addEventListener('click', function () { tg.mode = m; refreshModeChips(); });
    });
    refreshModeChips();

    const containsAllToggle = document.getElementById('tgContainsAllToggle');
    const containsAllField = document.getElementById('tgContainsAllField');
    containsAllToggle.addEventListener('change', function () {
      containsAllField.style.display = containsAllToggle.checked ? '' : 'none';
    });

    document.getElementById('tgStartBtn').addEventListener('click', function () {
      let words;
      const startsWithPre = document.getElementById('tgStartsWith').value.trim();
      if (tg.mode === 'letter') {
        let len = parseInt(document.getElementById('tgMin').value, 10) || CSW24_MIN_LEN;
        len = Math.max(CSW24_MIN_LEN, Math.min(len, CSW24_MAX_LEN));
        words = tgWordsForLetterMode(len);
        const containsAllPre = containsAllToggle.checked ? document.getElementById('tgContainsAllInput').value : '';
        if (containsAllPre) words = tgApplyContainsAllFilter(words, containsAllPre);
        if (startsWithPre) words = tgApplyStartsWithFilter(words, startsWithPre);
      } else if (tg.mode === 'cardbox') {
        words = tgWordsFromCardbox();
        const containsAllPre = containsAllToggle.checked ? document.getElementById('tgContainsAllInput').value : '';
        if (containsAllPre) words = tgApplyContainsAllFilter(words, containsAllPre);
        if (startsWithPre) words = tgApplyStartsWithFilter(words, startsWithPre);
        if (!words.length) { showToast('Cardbox ยังไม่มีคำศัพท์ที่ตรงเงื่อนไข'); return; }
      } else if (tg.mode === 'suggested') {
        words = tgWordsFromSuggested();
        const containsAllPre = containsAllToggle.checked ? document.getElementById('tgContainsAllInput').value : '';
        if (containsAllPre) words = tgApplyContainsAllFilter(words, containsAllPre);
        if (startsWithPre) words = tgApplyStartsWithFilter(words, startsWithPre);
        if (!words.length) { showToast('ยังไม่มีคำแนะนำจาก Dashboard ที่ตรงเงื่อนไข'); return; }
      } else {
        let min = parseInt(document.getElementById('tgMin').value, 10) || CSW24_MIN_LEN;
        let max = parseInt(document.getElementById('tgMax').value, 10) || CSW24_MAX_LEN;
        let count = parseInt(document.getElementById('tgCount').value, 10) || 10;
        min = Math.max(CSW24_MIN_LEN, Math.min(min, CSW24_MAX_LEN));
        max = Math.max(CSW24_MIN_LEN, Math.min(max, CSW24_MAX_LEN));
        if (min > max) { const t2 = min; min = max; max = t2; }
        count = Math.max(1, count);

        const containsAllPre = containsAllToggle.checked ? document.getElementById('tgContainsAllInput').value : '';
        if (containsAllPre || startsWithPre) {
          // Filter the full candidate pool by the substring/prefix first,
          // then randomly sample `count` from the matches — filtering
          // after picking would silently shrink the result set below
          // what the user asked for.
          let pool = [];
          for (let L = min; L <= max; L++) pool = pool.concat(lengthPool(L));
          pool = tgApplyContainsAllFilter(pool, containsAllPre);
          pool = tgApplyStartsWithFilter(pool, startsWithPre);
          words = shuffle(pool.slice()).slice(0, Math.min(count, pool.length));
        } else {
          words = pickRandomWords(min, max, count);
        }
      }

      const containsAll = containsAllToggle.checked ? document.getElementById('tgContainsAllInput').value : '';
      if (!words.length) { showToast('ไม่พบคำศัพท์ที่ตรงกับเงื่อนไขที่เลือก'); return; }

      tg.words = words;
      tg.strict = document.getElementById('tgStrict').checked;
      tg.showAnagram = document.getElementById('tgShowAnagramToggle').checked;
      tg.containsAll = containsAll;
      tg.startsWith = startsWithPre;
      tg.typed = [];
      tg.typedSelected = new Set();
      tgRestart();
      document.getElementById('typingPlay').style.display = '';
      document.getElementById('tgTypedPanel').style.display = 'none';
    });

    document.getElementById('tgResumeBtn').addEventListener('click', function () {
      const saved = tgLoadProgress();
      if (!saved) { tgRefreshResumeBtn(); return; }
      tg.words = saved.words;
      tg.index = saved.index;
      tg.mistakes = saved.mistakes || 0;
      tg.startTime = saved.startTime || Date.now();
      tg.strict = !!saved.strict;
      tg.showAnagram = !!saved.showAnagram;
      tg.mode = saved.mode || 'random';
      tg.containsAll = saved.containsAll || '';
      tg.startsWith = saved.startsWith || '';
      tg.typed = saved.typed || [];
      tg.typedSelected = new Set();
      if (tg.timerHandle) clearInterval(tg.timerHandle);
      tg.timerHandle = setInterval(tgUpdateTimer, 500);
      tgRenderPlay();
      document.getElementById('typingPlay').style.display = '';
      document.getElementById('tgTypedPanel').style.display = 'none';
    });

    tgRefreshResumeBtn();
  }

  function tgRestart() {
    tg.index = 0;
    tg.mistakes = 0;
    tg.startTime = Date.now();
    if (tg.timerHandle) clearInterval(tg.timerHandle);
    tg.timerHandle = setInterval(tgUpdateTimer, 500);
    tgSaveProgress();
    tgRenderPlay();
  }

  function tgFormatTime(ms) {
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return mm + ':' + ss;
  }

  function tgUpdateTimer() {
    const el = document.getElementById('tgTimer');
    if (el) el.textContent = tgFormatTime(Date.now() - tg.startTime);
  }

  function tgRenderPlay() {
    const word = tg.words[tg.index];
    const area = document.getElementById('typingPlay');
    const pct = Math.round((tg.index / tg.words.length) * 100);
    area.innerHTML =
      '<div class="session-progress">คำที่ ' + (tg.index + 1) + ' / ' + tg.words.length +
        ' · พลาด ' + tg.mistakes + ' ครั้ง · เวลา <span id="tgTimer">' + tgFormatTime(Date.now() - tg.startTime) + '</span></div>' +
      '<div class="session-bar"><div class="session-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="session-card">' +
        '<div class="session-prompt-label">พิมพ์คำนี้ให้ตรงทุกตัวอักษร' + (tg.strict ? ' · โหมดเข้มงวด: พิมพ์ผิด = เริ่มใหม่' : '') + '</div>' +
        '<div class="tile-word" id="tgTargetTiles">' + word.split('').map(function (ch) {
          return '<span class="letter-tile ' + lengthTileSizeClass('big', word.length) + ' type-letter">' + ch + '</span>';
        }).join('') + '</div>' +
        '<input type="text" id="tgInput" class="session-answer-form-input" autocomplete="off" autofocus>' +
        (tg.showAnagram ?
          '<div class="session-controls"><button class="btn btn-outline btn-sm" id="tgAnagramHintBtn">🔤 ดู Anagram ของคำนี้</button></div>' +
          '<div class="anagram-detail" id="tgAnagramHintDetail"></div>'
          : '') +
      '</div>';

    const input = document.getElementById('tgInput');
    input.addEventListener('input', function () { tgHandleInput(word, input); });
    input.focus();

    if (tg.showAnagram) {
      const hintBtn = document.getElementById('tgAnagramHintBtn');
      hintBtn.addEventListener('click', function () {
        const detail = document.getElementById('tgAnagramHintDetail');
        const isOpen = detail.classList.contains('open');
        if (isOpen) { detail.classList.remove('open'); hintBtn.textContent = '🔤 ดู Anagram ของคำนี้'; return; }
        const key = sortLetters(word);
        const partners = getAnagrams(word);
        let html = '<div class="key-row"><span class="key-label">เรียงตามตัวอักษร:</span>' + tileRowHTML(key, 'small') + '</div>';
        if (partners.length) {
          html += '<div class="key-row"><span class="key-label">คำ Anagram (' + partners.length + '):</span></div>';
          html += '<div class="anagram-partners">' + partners.map(function (p) { return '<span class="anagram-chip">' + p + '</span>'; }).join('') + '</div>';
        } else {
          html += '<div class="no-anagram">ไม่มีคำอื่นที่เป็น Anagram ของคำนี้ในพจนานุกรม</div>';
        }
        detail.innerHTML = html;
        detail.classList.add('open');
        hintBtn.textContent = '🔤 ซ่อน Anagram';
        input.focus();
      });
    }
  }

  function tgHandleInput(word, input) {
    let val = input.value.toUpperCase();
    if (val.length > word.length) { val = val.slice(0, word.length); input.value = val; }

    const tiles = document.querySelectorAll('#tgTargetTiles .letter-tile');
    let mismatch = false;
    for (let i = 0; i < tiles.length; i++) {
      tiles[i].classList.remove('correct-letter', 'wrong-letter');
      if (i < val.length) {
        if (val[i] === word[i]) tiles[i].classList.add('correct-letter');
        else { tiles[i].classList.add('wrong-letter'); mismatch = true; }
      }
    }

    if (mismatch) {
      tg.mistakes++;
      if (tg.strict) {
        showToast('พิมพ์ผิด! เริ่มใหม่ตั้งแต่คำแรก');
        tg.typed = [];
        tg.typedSelected = new Set();
        tgRestart();
        return;
      }
      return;
    }

    if (val === word) {
      input.disabled = true;
      tg.typed.push(word);
      logWordEncounter(word, 'typing');
      tg.index++;
      tgSaveProgress();
      setTimeout(function () {
        if (tg.index >= tg.words.length) tgFinish();
        else tgRenderPlay();
      }, 200);
    }
  }

  function tgFinish() {
    if (tg.timerHandle) { clearInterval(tg.timerHandle); tg.timerHandle = null; }
    tgClearProgress();
    const elapsed = Date.now() - tg.startTime;
    const area = document.getElementById('typingPlay');
    area.innerHTML =
      '<div class="session-summary">' +
        '<div class="session-prompt-label">จบเกม!</div>' +
        '<div class="big-stat">' + tgFormatTime(elapsed) + '</div>' +
        '<p>พิมพ์ครบ ' + tg.words.length + ' คำ · พลาดทั้งหมด ' + tg.mistakes + ' ครั้ง</p>' +
        '<div class="session-controls"><button class="btn btn-primary" id="tgPlayAgainBtn">🔁 เล่นอีกครั้ง</button></div>' +
      '</div>';
    document.getElementById('tgPlayAgainBtn').addEventListener('click', function () {
      tg.typed = [];
      tg.typedSelected = new Set();
      document.getElementById('tgTypedPanel').style.display = 'none';
      tgRestart();
    });
    tgRenderTypedPanel();
    tgRefreshResumeBtn();
    if (window.Achievements) window.Achievements.record('typing_win');
  }

  // ---------- Minigame typing: "typed words so far" review + save panel ----------

  function tgRenderTypedPanel() {
    const panel = document.getElementById('tgTypedPanel');
    if (!tg.typed.length) { panel.style.display = 'none'; return; }
    panel.style.display = '';

    const wrap = document.getElementById('tgTypedList');
    wrap.innerHTML = tg.typed.map(function (word, idx) {
      return (
        '<label class="quiz-item">' +
          '<input type="checkbox" class="tg-typed-check" data-word="' + word + '">' +
          '<span class="qi-index">' + (idx + 1) + '</span>' +
          tileRowHTML(word, 'small') +
          '<span class="word-meta">' + wordScore(word) + ' pts · Prob ' +
            wordProbabilityNormalizedPct(word) + '% · Play ' + wordPlayability(word) + '</span>' +
        '</label>'
      );
    }).join('');

    wrap.querySelectorAll('.tg-typed-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) tg.typedSelected.add(cb.dataset.word);
        else tg.typedSelected.delete(cb.dataset.word);
        tgUpdateTypedSelectedCount();
      });
    });
    tg.typedSelected = new Set();
    tgUpdateTypedSelectedCount();
    document.getElementById('tgTypedSelectAll').checked = false;
  }

  function tgUpdateTypedSelectedCount() {
    document.getElementById('tgTypedSelectedCount').textContent = 'เลือกแล้ว ' + tg.typedSelected.size + ' คำ';
  }

  function initTgTypedPanel() {
    document.getElementById('tgTypedSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      document.querySelectorAll('.tg-typed-check').forEach(function (cb) {
        cb.checked = checked;
        if (checked) tg.typedSelected.add(cb.dataset.word);
        else tg.typedSelected.delete(cb.dataset.word);
      });
      tgUpdateTypedSelectedCount();
    });
    document.getElementById('tgTypedSaveBtn').addEventListener('click', function () {
      if (!tg.typedSelected.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const added = addWordsToCardbox(Array.from(tg.typedSelected));
      showToast('บันทึกลง Cardbox แล้ว ' + added + ' คำ');
      if (window.Achievements) window.Achievements.record('cardbox_add');
    });
  }

  // ---------- Minigame: random racks ----------

  const rg = { rack: [], blanks: 0, solutions: new Set(), found: new Set(), score: 0, revealed: false };
  const RG_LETTER_BAG = 'AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ';
  const RG_BLANK_CHANCE = 0.12; // per-tile chance of drawing a blank when the option is enabled

  function initRacksGame() {
    document.getElementById('rgStartBtn').addEventListener('click', rgStart);
  }

  // A word is buildable from the rack if, after using rack letters directly,
  // any leftover required letters can be covered by the rack's blank count.
  function isSubsetOfCountsWithBlanks(word, rackCounts, blankCount) {
    const wc = letterCounts(word);
    let blanksNeeded = 0;
    for (const ch in wc) {
      const have = rackCounts[ch] || 0;
      if (have < wc[ch]) blanksNeeded += (wc[ch] - have);
    }
    return blanksNeeded <= blankCount;
  }

  function rgStart() {
    let size = parseInt(document.getElementById('rgSize').value, 10) || 7;
    size = Math.max(4, Math.min(size, 10));
    const allowBlank = document.getElementById('rgAllowBlank').checked;

    const letters = [];
    let blanks = 0;
    for (let i = 0; i < size; i++) {
      if (allowBlank && Math.random() < RG_BLANK_CHANCE) { blanks++; letters.push('?'); }
      else letters.push(RG_LETTER_BAG[Math.floor(Math.random() * RG_LETTER_BAG.length)]);
    }
    rg.rack = letters;
    rg.blanks = blanks;

    const rackCounts = letterCounts(letters.filter(function (ch) { return ch !== '?'; }).join(''));
    const solutions = new Set();
    for (let L = 2; L <= size; L++) {
      const pool = lengthPool(L);
      for (let i = 0; i < pool.length; i++) {
        if (isSubsetOfCountsWithBlanks(pool[i], rackCounts, blanks)) solutions.add(pool[i]);
      }
    }
    rg.solutions = solutions;
    rg.found = new Set();
    rg.score = 0;
    rg.revealed = false;

    document.getElementById('racksPlay').style.display = '';
    rgRenderPlay();
  }

  function rgTileRowWithBlanks(letters, sizeClass) {
    sizeClass = sizeClass || '';
    return '<span class="tile-word">' + letters.map(function (ch) {
      if (ch === '?') return '<span class="letter-tile blank-rack ' + sizeClass + '">★<span class="pv">0</span></span>';
      return '<span class="letter-tile ' + sizeClass + '">' + ch + '<span class="pv">' + (SCRABBLE_VALUES[ch] || '') + '</span></span>';
    }).join('') + '</span>';
  }

  function rgRenderPlay() {
    const area = document.getElementById('racksPlay');
    const foundChips = Array.from(rg.found).sort().map(function (w) {
      return '<span class="anagram-chip">' + w + ' (' + wordScore(w) + ')</span>';
    }).join('');

    area.innerHTML =
      '<div class="session-progress">พบแล้ว ' + rg.found.size + ' / ' + rg.solutions.size + ' คำ · คะแนนรวม ' + rg.score +
        (rg.blanks ? ' · 🁢 มี Blank ' + rg.blanks + ' ตัว' : '') + '</div>' +
      '<div class="session-card">' +
        '<div class="session-prompt-label">หาคำศัพท์ทั้งหมดที่ประกอบจากตัวอักษรใน Rack นี้' + (rg.blanks ? ' (★ = Blank แทนตัวอักษรใดก็ได้)' : '') + '</div>' +
        rgTileRowWithBlanks(rg.rack, 'big') +
        (rg.revealed ? '' :
          '<form class="session-answer-form" id="rgForm">' +
            '<input type="text" id="rgInput" autocomplete="off" placeholder="พิมพ์คำแล้วกด Enter" autofocus>' +
            '<button class="btn btn-primary" type="submit">ส่งคำตอบ</button>' +
          '</form>') +
        '<div class="session-controls">' +
          (rg.revealed ? '' : '<button class="btn btn-outline" id="rgRevealBtn">👁 ดูคำตอบทั้งหมด</button>') +
          '<button class="btn btn-teal" id="rgNewRoundBtn">🔁 รอบใหม่</button>' +
        '</div>' +
      '</div>' +
      '<div class="anagram-partners" id="rgFoundList" style="margin-top:1rem">' + foundChips + '</div>' +
      (rg.revealed ? '<div id="rgAllSolutions" style="margin-top:1rem"></div>' : '');

    document.getElementById('rgNewRoundBtn').addEventListener('click', rgStart);

    if (!rg.revealed) {
      document.getElementById('rgRevealBtn').addEventListener('click', function () {
        rg.revealed = true;
        rgRenderPlay();
      });
      const form = document.getElementById('rgForm');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('rgInput');
        const guess = input.value.trim().toUpperCase();
        input.value = '';
        input.focus();
        if (!guess) return;
        if (rg.found.has(guess)) { showToast('เจอคำนี้ไปแล้ว'); return; }
        if (rg.solutions.has(guess)) {
          rg.found.add(guess);
          rg.score += wordScore(guess);
          logWordEncounter(guess, 'racks');
          showToast('✓ ถูกต้อง! +' + wordScore(guess) + ' คะแนน');
          if (window.Achievements) window.Achievements.record('racks_correct');
          rgRenderPlay();
          const freshInput = document.getElementById('rgInput');
          if (freshInput) freshInput.focus();
        } else {
          showToast('✗ ไม่ใช่คำที่ประกอบจาก Rack นี้');
        }
      });
    } else {
      const byLen = {};
      rg.solutions.forEach(function (w) { (byLen[w.length] = byLen[w.length] || []).push(w); });
      const lens = Object.keys(byLen).map(Number).sort(function (a, b) { return b - a; });
      let html = '';
      lens.forEach(function (L) {
        html += '<div class="key-row"><span class="key-label">' + L + ' ตัวอักษร</span></div><div class="anagram-partners">';
        html += byLen[L].sort().map(function (w) {
          return '<span class="anagram-chip' + (rg.found.has(w) ? '' : ' missed') + '">' + w + '</span>';
        }).join('');
        html += '</div>';
      });
      document.getElementById('rgAllSolutions').innerHTML = html;
    }
  }

  // ---------- Word Builder tab ----------
  // Given a rack string like "TISANE?" (with optional '?' as blanks), find
  // every dictionary word (any length from builderMinLen up to rack length)
  // that can be built using each rack letter at most as many times as it
  // appears, with blanks covering any shortfall.

  const builderState = { results: [], selected: new Set() };

  function builderRunSearch() {
    const rawInput = document.getElementById('builderRackInput').value.trim().toUpperCase();
    const rackLetters = rawInput.replace(/[^A-Z?]/g, '');
    let minLen = parseInt(document.getElementById('builderMinLen').value, 10) || 2;
    minLen = Math.max(CSW24_MIN_LEN, Math.min(minLen, CSW24_MAX_LEN));

    const panel = document.getElementById('builderResultsPanel');
    const countLabel = document.getElementById('builderResultCount');

    if (!rackLetters) {
      panel.style.display = 'none';
      countLabel.textContent = '';
      return;
    }

    const blankCount = (rackLetters.match(/\?/g) || []).length;
    const rackCounts = letterCounts(rackLetters.replace(/\?/g, ''));
    const rackSize = rackLetters.length;
    const maxLen = Math.min(rackSize, CSW24_MAX_LEN);

    const results = [];
    for (let L = minLen; L <= maxLen; L++) {
      const pool = lengthPool(L);
      for (let i = 0; i < pool.length; i++) {
        if (isSubsetOfCountsWithBlanks(pool[i], rackCounts, blankCount)) results.push(pool[i]);
      }
    }

    builderState.results = results;
    builderState.selected = new Set();
    builderApplySort();
    panel.style.display = '';
    countLabel.textContent = 'พบ ' + results.length + ' คำ ที่ประกอบได้จาก "' + rackLetters + '"' +
      (blankCount ? ' (รวม Blank ' + blankCount + ' ตัว)' : '');
  }

  function builderApplySort() {
    const sortVal = document.getElementById('builderSortSelect').value;
    const list = builderState.results.slice();
    if (sortVal === 'alpha') list.sort();
    else if (sortVal === 'len-desc') list.sort(function (a, b) { return b.length - a.length || a.localeCompare(b); });
    else if (sortVal === 'len-asc') list.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
    else if (sortVal === 'score-desc') list.sort(function (a, b) { return wordScore(b) - wordScore(a) || a.localeCompare(b); });
    else if (sortVal === 'prob-desc') list.sort(function (a, b) { return wordProbabilityNormalizedPct(b) - wordProbabilityNormalizedPct(a) || a.localeCompare(b); });
    else if (sortVal === 'prob-asc') list.sort(function (a, b) { return wordProbabilityNormalizedPct(a) - wordProbabilityNormalizedPct(b) || a.localeCompare(b); });
    else if (sortVal === 'play-desc') list.sort(function (a, b) { return wordPlayability(b) - wordPlayability(a) || a.localeCompare(b); });
    else if (sortVal === 'play-asc') list.sort(function (a, b) { return wordPlayability(a) - wordPlayability(b) || a.localeCompare(b); });
    builderState.results = list;
    builderRenderResults();
  }

  function builderRenderResults() {
    const wrap = document.getElementById('builderResults');
    wrap.innerHTML = builderState.results.map(function (word) {
      return wordRowHTML(word, true, builderState.selected, 'builder-check');
    }).join('');
    bindAnagramToggles(wrap);
    builderUpdateSelectedCount();
  }

  function builderUpdateSelectedCount() {
    document.getElementById('builderSelectedCount').textContent = 'เลือกแล้ว ' + builderState.selected.size + ' คำ';
    document.getElementById('builderSelectAll').checked =
      builderState.results.length > 0 && builderState.selected.size === builderState.results.length;
  }

  function initWordBuilder() {
    document.getElementById('builderSearchBtn').addEventListener('click', builderRunSearch);
    document.getElementById('builderRackInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') builderRunSearch();
    });
    document.getElementById('builderSortSelect').addEventListener('change', builderApplySort);

    document.getElementById('builderSelectAll').addEventListener('change', function (e) {
      const checked = e.target.checked;
      if (checked) builderState.results.forEach(function (w) { builderState.selected.add(w); });
      else builderState.selected.clear();
      document.querySelectorAll('#builderResults .builder-check').forEach(function (cb) { cb.checked = checked; });
      builderUpdateSelectedCount();
    });

    document.getElementById('builderResults').addEventListener('change', function (e) {
      if (!e.target.classList.contains('builder-check')) return;
      const word = e.target.dataset.word;
      if (e.target.checked) builderState.selected.add(word);
      else builderState.selected.delete(word);
      builderUpdateSelectedCount();
    });

    document.getElementById('builderSaveBtn').addEventListener('click', function () {
      if (!builderState.selected.size) { showToast('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำ'); return; }
      const added = addWordsToCardbox(Array.from(builderState.selected));
      showToast('บันทึกลง Cardbox แล้ว ' + added + ' คำ');
      if (window.Achievements) window.Achievements.record('cardbox_add');
    });
  }

  // ---------- Minigame: Alphagram Blitz ----------

  const alpha = {
    len: 7, items: [], index: 0, found: [], score: 0,
    timeAttack: false, minutes: 5, deadline: 0, timerHandle: null,
    showAnagram: false, finished: false, startTime: 0
  };

  // Groups every word of a given length by its sorted-letter alphagram key,
  // so each "clue" may have one or several valid solutions (like the reference screenshot).
  function alphaBuildGroups(L, count) {
    const pool = lengthPool(L);
    const byKey = {};
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      const key = sortLetters(w);
      (byKey[key] = byKey[key] || []).push(w);
    }
    const keys = shuffle(Object.keys(byKey));
    const chosen = keys.slice(0, Math.min(count, keys.length));
    return chosen.map(function (key) {
      return { key: key, solutions: byKey[key].slice().sort(), found: new Set() };
    });
  }

  function alphaStart() {
    const count = Math.max(5, Math.min(parseInt(document.getElementById('alphaCount').value, 10) || 20, 200));
    alpha.len = alpha.len || 7;
    alpha.items = alphaBuildGroups(alpha.len, count);
    if (!alpha.items.length) { showToast('ไม่พบคำศัพท์ความยาวนี้'); return; }
    alpha.index = 0;
    alpha.found = [];
    alpha.score = 0;
    alpha.finished = false;
    alpha.showAnagram = document.getElementById('alphaShowAnagramToggle').checked;
    alpha.startTime = Date.now();

    if (alpha.timeAttack) {
      alpha.minutes = Math.max(1, Math.min(parseInt(document.getElementById('alphaMinutes').value, 10) || 5, 60));
      alpha.deadline = Date.now() + alpha.minutes * 60000;
      if (alpha.timerHandle) clearInterval(alpha.timerHandle);
      alpha.timerHandle = setInterval(alphaTickTimer, 250);
    } else if (alpha.timerHandle) {
      clearInterval(alpha.timerHandle);
      alpha.timerHandle = null;
    }

    document.getElementById('alphaPlay').style.display = '';
    alphaRenderPlay();
  }

  function alphaFormatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function alphaTickTimer() {
    const remaining = alpha.deadline - Date.now();
    const label = document.getElementById('alphaTimeLeft');
    if (label) label.textContent = alphaFormatTime(remaining);
    if (remaining <= 0 && !alpha.finished) {
      alphaFinish();
    }
  }

  function alphaCurrentItem() {
    return alpha.items[alpha.index];
  }

  function alphaRenderPlay() {
    const area = document.getElementById('alphaPlay');
    if (alpha.finished) { alphaRenderSummary(area); return; }

    const item = alphaCurrentItem();
    if (!item) { alphaFinish(); return; }

    const totalDone = alpha.index;
    const progressLabel = 'ชุดที่ ' + (alpha.index + 1) + ' / ' + alpha.items.length +
      ' · เจอแล้ว ' + item.found.size + ' / ' + item.solutions.length + ' คำในชุดนี้' +
      ' · คะแนนรวม ' + alpha.score +
      (alpha.timeAttack ? ' · ⏱️ <span id="alphaTimeLeft">' + alphaFormatTime(alpha.deadline - Date.now()) + '</span>' : '');

    area.innerHTML =
      '<div class="session-progress">' + progressLabel + '</div>' +
      '<div class="session-bar"><div class="session-bar-fill" id="alphaBarFill" style="width:' +
        Math.round((totalDone / alpha.items.length) * 100) + '%"></div></div>' +
      '<div class="session-card">' +
        '<div class="session-prompt-label">เรียงตัวอักษรใหม่ให้เป็นคำศัพท์' +
          (item.solutions.length > 1 ? ' (มีคำตอบได้ ' + item.solutions.length + ' คำ — หาให้ครบ)' : '') + '</div>' +
        tileRowHTML(item.key, 'big') +
        '<form class="session-answer-form" id="alphaForm">' +
          '<input type="text" id="alphaInput" autocomplete="off" placeholder="พิมพ์คำแล้วกด Enter" autofocus>' +
          '<button class="btn btn-primary" type="submit">ส่งคำตอบ</button>' +
        '</form>' +
        (item.found.size ? '<div class="anagram-partners">' + Array.from(item.found).sort().map(function (w) {
          return '<span class="anagram-chip">' + w + '</span>';
        }).join('') + '</div>' : '') +
        '<div class="session-controls">' +
          (alpha.showAnagram ? '<button class="btn btn-outline" id="alphaHintBtn">🔤 ดูคำใบ้</button>' : '') +
          '<button class="btn btn-outline" id="alphaSkipBtn">⏭ ข้ามชุดนี้</button>' +
          '<button class="btn btn-danger btn-sm" id="alphaEndBtn">⏹ จบเกม</button>' +
        '</div>' +
      '</div>';

    const form = document.getElementById('alphaForm');
    const input = document.getElementById('alphaInput');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const guess = input.value.trim().toUpperCase();
      input.value = '';
      input.focus();
      if (!guess) return;
      const cur = alphaCurrentItem();
      if (!cur) return;
      if (cur.found.has(guess)) { showToast('เจอคำนี้ไปแล้ว'); return; }
      if (cur.solutions.indexOf(guess) !== -1) {
        cur.found.add(guess);
        alpha.score += wordScore(guess);
        alpha.found.push(guess);
        logWordEncounter(guess, 'alpha');
        if (cur.found.size >= cur.solutions.length) {
          showToast('✓ ครบทุกคำในชุดนี้! +' + wordScore(guess) + ' คะแนน');
          alpha.index++;
          if (window.Achievements) window.Achievements.record('alpha_cleared');
        } else {
          showToast('✓ ถูกต้อง! +' + wordScore(guess) + ' คะแนน (ยังเหลืออีก ' + (cur.solutions.length - cur.found.size) + ' คำ)');
        }
        alphaRenderPlay();
      } else {
        showToast('✗ ไม่ใช่คำตอบของชุดนี้');
      }
    });

    const hintBtn = document.getElementById('alphaHintBtn');
    if (hintBtn) {
      hintBtn.addEventListener('click', function () {
        const cur = alphaCurrentItem();
        const remaining = cur.solutions.filter(function (w) { return !cur.found.has(w); });
        showToast('เหลือ ' + remaining.length + ' คำ · ตัวแรก: ' + remaining.map(function (w) { return w[0]; }).join(', '));
      });
    }

    document.getElementById('alphaSkipBtn').addEventListener('click', function () {
      alpha.index++;
      alphaRenderPlay();
    });

    document.getElementById('alphaEndBtn').addEventListener('click', alphaFinish);
  }

  function alphaFinish() {
    alpha.finished = true;
    if (alpha.timerHandle) { clearInterval(alpha.timerHandle); alpha.timerHandle = null; }
    alphaRenderPlay();
  }

  function alphaRenderSummary(area) {
    const totalSolutions = alpha.items.reduce(function (sum, it) { return sum + it.solutions.length; }, 0);
    const totalItemsCleared = alpha.items.filter(function (it) { return it.found.size >= it.solutions.length; }).length;
    const elapsedMs = Date.now() - alpha.startTime;
    const missed = [];
    alpha.items.forEach(function (it) {
      it.solutions.forEach(function (w) {
        if (!it.found.has(w)) missed.push(w);
      });
    });

    area.innerHTML =
      '<div class="session-summary">' +
        '<div class="big-stat">' + alpha.score + '</div>' +
        '<div class="field-hint" style="margin-bottom:1rem">คะแนนรวม · เจอ ' + alpha.found.length + ' / ' + totalSolutions +
          ' คำ · ผ่านครบ ' + totalItemsCleared + ' / ' + alpha.items.length + ' ชุด · ใช้เวลา ' + alphaFormatTime(elapsedMs) + '</div>' +
        (missed.length ? '<p class="panel-sub" style="margin-bottom:0.5rem">คำที่พลาด:</p><div class="anagram-partners">' +
          missed.sort().map(function (w) { return '<span class="anagram-chip missed">' + w + '</span>'; }).join('') + '</div>' : '') +
        '<div class="session-controls" style="margin-top:1.2rem">' +
          '<button class="btn btn-primary" id="alphaPlayAgainBtn">🔁 เล่นอีกรอบ</button>' +
          (alpha.found.length ? '<button class="btn btn-teal" id="alphaSaveFoundBtn">💾 Save คำที่เจอลง Cardbox</button>' : '') +
        '</div>' +
      '</div>';

    document.getElementById('alphaPlayAgainBtn').addEventListener('click', function () {
      document.getElementById('alphaSetup').style.display = '';
      document.getElementById('alphaPlay').style.display = 'none';
    });
    const saveBtn = document.getElementById('alphaSaveFoundBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        const uniqueWords = Array.from(new Set(alpha.found));
        const added = addWordsToCardbox(uniqueWords);
        showToast('เพิ่มลง Cardbox แล้ว ' + added + ' คำ');
        if (window.Achievements) window.Achievements.record('cardbox_add');
      });
    }
  }

  function initAlphaGame() {
    const lenWrap = document.getElementById('alphaLenChips');
    lenWrap.querySelectorAll('.mode-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        lenWrap.querySelectorAll('.mode-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        alpha.len = parseInt(btn.dataset.len, 10);
      });
    });

    const untimedBtn = document.getElementById('alphaModeUntimedBtn');
    const timeAttackBtn = document.getElementById('alphaModeTimeAttackBtn');
    const timeAttackRow = document.getElementById('alphaTimeAttackRow');
    untimedBtn.addEventListener('click', function () {
      alpha.timeAttack = false;
      untimedBtn.classList.add('active'); timeAttackBtn.classList.remove('active');
      timeAttackRow.style.display = 'none';
    });
    timeAttackBtn.addEventListener('click', function () {
      alpha.timeAttack = true;
      timeAttackBtn.classList.add('active'); untimedBtn.classList.remove('active');
      timeAttackRow.style.display = '';
    });

    document.getElementById('alphaStartBtn').addEventListener('click', function () {
      document.getElementById('alphaSetup').style.display = 'none';
      alphaStart();
    });
  }

  // ---------- Minigame: Time Attack Marathon ----------
  // Continuous short rounds; each round randomly picks a puzzle type
  // (Anagram / Rack / Cardbox word) and gives a tight time budget to answer.

  const RACK_LETTER_BAG = 'AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ';

  const mar = {
    rounds: 20, roundSeconds: 12, minLen: 4, maxLen: 7,
    types: [], round: 0, correct: 0, incorrect: 0, skipped: 0,
    score: 0, streak: 0, bestStreak: 0,
    current: null, deadline: 0, timerHandle: null, finished: false, startTime: 0
  };

  function marEnabledTypes() {
    const types = [];
    if (document.getElementById('marTypeAnagram').checked) types.push('anagram');
    if (document.getElementById('marTypeRack').checked) types.push('rack');
    if (document.getElementById('marTypeCardbox').checked && loadCardbox().length) types.push('cardbox');
    if (!types.length) return ['anagram', 'rack']; // fallback if nothing usable is selected
    return types;
  }

  function marRandomLen() {
    const min = mar.minLen, max = mar.maxLen;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function marBuildAnagramRound() {
    const len = marRandomLen();
    const pool = lengthPool(len);
    if (!pool.length) return null;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const key = sortLetters(word);
    const accepted = new Set();
    for (let i = 0; i < pool.length; i++) {
      if (sortLetters(pool[i]) === key) accepted.add(pool[i]);
    }
    return { type: 'anagram', display: key, accepted: accepted, revealWord: word };
  }

  function marBuildRackRound() {
    const size = Math.max(4, Math.min(mar.maxLen, 7));
    const letters = [];
    for (let i = 0; i < size; i++) letters.push(RACK_LETTER_BAG[Math.floor(Math.random() * RACK_LETTER_BAG.length)]);
    const rackCounts = letterCounts(letters.join(''));
    const accepted = new Set();
    for (let L = 2; L <= size; L++) {
      const pool = lengthPool(L);
      for (let i = 0; i < pool.length; i++) {
        if (isSubsetOfCounts(pool[i], rackCounts)) accepted.add(pool[i]);
      }
    }
    if (!accepted.size) return null;
    return { type: 'rack', display: letters.join(''), accepted: accepted, revealWord: Array.from(accepted).sort()[0] };
  }

  function marBuildCardboxRound() {
    const box = loadCardbox();
    if (!box.length) return null;
    const card = box[Math.floor(Math.random() * box.length)];
    const word = card.word;
    return { type: 'cardbox', display: sortLetters(word), accepted: new Set([word]), revealWord: word };
  }

  function marBuildRound() {
    const available = mar.types.slice();
    let guard = 0;
    while (available.length && guard < 6) {
      guard++;
      const pick = available[Math.floor(Math.random() * available.length)];
      let round = null;
      if (pick === 'anagram') round = marBuildAnagramRound();
      else if (pick === 'rack') round = marBuildRackRound();
      else if (pick === 'cardbox') round = marBuildCardboxRound();
      if (round) return round;
      available.splice(available.indexOf(pick), 1);
    }
    return null;
  }

  function marStart() {
    mar.roundSeconds = Math.max(5, Math.min(parseInt(document.getElementById('marRoundSeconds').value, 10) || 12, 60));
    mar.rounds = Math.max(5, Math.min(parseInt(document.getElementById('marRounds').value, 10) || 20, 100));
    mar.minLen = Math.max(3, Math.min(parseInt(document.getElementById('marMinLen').value, 10) || 4, 10));
    mar.maxLen = Math.max(mar.minLen, Math.min(parseInt(document.getElementById('marMaxLen').value, 10) || 7, 10));
    mar.types = marEnabledTypes();
    mar.round = 0;
    mar.correct = 0;
    mar.incorrect = 0;
    mar.skipped = 0;
    mar.score = 0;
    mar.streak = 0;
    mar.bestStreak = 0;
    mar.finished = false;
    mar.startTime = Date.now();

    document.getElementById('marathonPlay').style.display = '';
    marNextRound();
  }

  function marFormatTime(ms) {
    if (ms < 0) ms = 0;
    return (ms / 1000).toFixed(1) + 's';
  }

  function marTickTimer() {
    const remaining = mar.deadline - Date.now();
    const label = document.getElementById('marTimeLeft');
    if (label) label.textContent = marFormatTime(remaining);
    const fill = document.getElementById('marRoundBarFill');
    if (fill) {
      const pct = Math.max(0, Math.min(100, (remaining / (mar.roundSeconds * 1000)) * 100));
      fill.style.width = pct + '%';
      fill.classList.toggle('marathon-bar-urgent', pct < 25);
    }
    if (remaining <= 0 && !mar.finished) {
      mar.skipped++;
      showToast('⏱ หมดเวลา! คำตอบ: ' + mar.current.revealWord);
      marNextRound();
    }
  }

  function marNextRound() {
    if (mar.timerHandle) { clearInterval(mar.timerHandle); mar.timerHandle = null; }
    if (mar.round >= mar.rounds) { marFinish(); return; }

    const round = marBuildRound();
    if (!round) {
      showToast('ไม่พบโจทย์ที่สร้างได้ — จบ Marathon ก่อนกำหนด');
      marFinish();
      return;
    }
    mar.round++;
    mar.current = round;
    mar.deadline = Date.now() + mar.roundSeconds * 1000;
    mar.timerHandle = setInterval(marTickTimer, 100);
    marRenderPlay();
  }

  function marTypeLabel(type) {
    if (type === 'anagram') return '🔀 Anagram';
    if (type === 'rack') return '🁢 Rack';
    return '🗂️ Cardbox';
  }

  function marRenderPlay() {
    const area = document.getElementById('marathonPlay');
    if (mar.finished) { marRenderSummary(area); return; }

    const item = mar.current;
    const progressLabel = 'รอบที่ ' + mar.round + ' / ' + mar.rounds +
      ' · คะแนนรวม ' + mar.score +
      ' · ถูกต่อเนื่อง ' + mar.streak +
      ' · ⏱️ <span id="marTimeLeft">' + marFormatTime(mar.deadline - Date.now()) + '</span>';

    area.innerHTML =
      '<div class="session-progress">' + progressLabel + '</div>' +
      '<div class="session-bar"><div class="session-bar-fill marathon-round-bar" id="marRoundBarFill" style="width:100%"></div></div>' +
      '<div class="session-card">' +
        '<div class="session-prompt-label">' + marTypeLabel(item.type) +
          (item.type === 'anagram' ? ' — เรียงตัวอักษรใหม่ให้เป็นคำศัพท์ใดก็ได้ที่ถูกต้อง' :
           item.type === 'rack' ? ' — หาคำศัพท์ใดก็ได้ที่ประกอบจากตัวอักษรใน Rack นี้' :
           ' — คำจาก Cardbox ของคุณ ลองพิมพ์ให้ถูกต้อง') +
        '</div>' +
        tileRowHTML(item.display, 'big') +
        '<form class="session-answer-form" id="marForm">' +
          '<input type="text" id="marInput" autocomplete="off" placeholder="พิมพ์คำแล้วกด Enter" autofocus>' +
          '<button class="btn btn-primary" type="submit">ส่งคำตอบ</button>' +
        '</form>' +
        '<div class="session-controls">' +
          '<button class="btn btn-outline" id="marSkipBtn">⏭ ข้ามรอบนี้</button>' +
          '<button class="btn btn-danger btn-sm" id="marEndBtn">⏹ จบ Marathon</button>' +
        '</div>' +
      '</div>';

    const form = document.getElementById('marForm');
    const input = document.getElementById('marInput');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const guess = input.value.trim().toUpperCase();
      if (!guess || !mar.current) return;
      if (mar.current.accepted.has(guess)) {
        const gained = wordScore(guess) + Math.floor(mar.streak / 3) * 2; // small streak bonus
        mar.score += gained;
        mar.correct++;
        mar.streak++;
        mar.bestStreak = Math.max(mar.bestStreak, mar.streak);
        logWordEncounter(guess, 'marathon');
        showToast('✓ ถูกต้อง! +' + gained + ' คะแนน');
        if (window.Achievements) window.Achievements.record('marathon_correct', { count: 1, streak: mar.streak });
        marNextRound();
      } else {
        mar.incorrect++;
        mar.streak = 0;
        showToast('✗ ไม่ถูกต้อง ลองอีกครั้ง');
        input.value = '';
        input.focus();
      }
    });

    document.getElementById('marSkipBtn').addEventListener('click', function () {
      mar.skipped++;
      mar.streak = 0;
      marNextRound();
    });

    document.getElementById('marEndBtn').addEventListener('click', marFinish);
  }

  function marFinish() {
    mar.finished = true;
    if (mar.timerHandle) { clearInterval(mar.timerHandle); mar.timerHandle = null; }
    if (mar.round >= mar.rounds && mar.round > 0) {
      if (window.Achievements) window.Achievements.record('marathon_complete', { rounds: mar.round, bestStreak: mar.bestStreak });
    }
    marRenderPlay();
  }

  function marRenderSummary(area) {
    const elapsedMs = Date.now() - mar.startTime;
    area.innerHTML =
      '<div class="session-summary">' +
        '<div class="big-stat">' + mar.score + '</div>' +
        '<div class="field-hint" style="margin-bottom:1rem">คะแนนรวม · ตอบถูก ' + mar.correct + ' / ' + mar.round +
          ' รอบ · Streak สูงสุด ' + mar.bestStreak + ' · พลาด ' + mar.incorrect + ' · ข้าม/หมดเวลา ' + mar.skipped +
          ' · ใช้เวลา ' + Math.round(elapsedMs / 1000) + ' วินาที</div>' +
        '<div class="session-controls" style="margin-top:1.2rem">' +
          '<button class="btn btn-primary" id="marPlayAgainBtn">🔁 เล่นอีกรอบ</button>' +
        '</div>' +
      '</div>';

    document.getElementById('marPlayAgainBtn').addEventListener('click', function () {
      document.getElementById('marathonSetup').style.display = '';
      document.getElementById('marathonPlay').style.display = 'none';
    });
  }

  function initMarathonGame() {
    document.getElementById('marStartBtn').addEventListener('click', function () {
      document.getElementById('marathonSetup').style.display = 'none';
      marStart();
    });
  }

  // ---------- Minigame: Marathon (real distance-style, by word length) ----------
  // Inspired by the Thai national team's "7L / 7 hours" training marathon.
  // Here "L" = word length, not distance. Player climbs from a starting
  // word length up to a finishing word length (5L-12L range), answering a
  // configurable number of words per length level, with an overall running
  // clock (no per-word time limit) and automatic 30s rest Checkpoints every
  // N levels — just like real marathon rest/water stations.

  const RM_CHECKPOINT_REST_MS = 30000;

  const rm = {
    startLen: 8, endLen: 12, wordsPerLevel: 5, checkpointEvery: 2,
    levels: [],        // [{len, isCheckpointAfter}]
    levelIndex: 0,      // which level we're currently on
    wordIndexInLevel: 0,
    current: null,      // {display, accepted, revealWord}
    correct: 0, incorrect: 0, totalWords: 0, wordsDone: 0,
    startTime: 0, elapsedBeforePause: 0, running: false,
    resting: false, restDeadline: 0, restTimerHandle: null,
    clockTimerHandle: null,
    finished: false
  };

  function rmBuildLevels() {
    const levels = [];
    for (let L = rm.startLen; L <= rm.endLen; L++) levels.push(L);
    return levels;
  }

  function rmIsCheckpointAfterLevel(levelPos) {
    // levelPos is 1-based position within the run (1 = first level)
    if (!rm.checkpointEvery) return false;
    const isLast = levelPos === rm.levels.length;
    if (isLast) return false; // no rest after the finish line
    return levelPos % rm.checkpointEvery === 0;
  }

  function rmBuildWordRound(len) {
    const pool = lengthPool(len);
    if (!pool.length) return null;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const key = sortLetters(word);
    const accepted = new Set();
    for (let i = 0; i < pool.length; i++) {
      if (sortLetters(pool[i]) === key) accepted.add(pool[i]);
    }
    return { display: key, accepted: accepted, revealWord: word };
  }

  function rmFormatClock(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function rmElapsedMs() {
    if (!rm.running) return rm.elapsedBeforePause;
    return rm.elapsedBeforePause + (Date.now() - rm.startTime);
  }

  function rmStart() {
    rm.startLen = parseInt(document.getElementById('rmStartLen').value, 10) || 8;
    rm.endLen = parseInt(document.getElementById('rmEndLen').value, 10) || 12;
    if (rm.endLen < rm.startLen) rm.endLen = rm.startLen;
    rm.wordsPerLevel = Math.max(1, Math.min(parseInt(document.getElementById('rmWordsPerLevel').value, 10) || 5, 50));
    rm.checkpointEvery = parseInt(document.getElementById('rmCheckpointEvery').value, 10) || 0;

    rm.levels = rmBuildLevels();
    rm.levelIndex = 0;
    rm.wordIndexInLevel = 0;
    rm.correct = 0;
    rm.incorrect = 0;
    rm.wordsDone = 0;
    rm.totalWords = rm.levels.length * rm.wordsPerLevel;
    rm.elapsedBeforePause = 0;
    rm.startTime = Date.now();
    rm.running = true;
    rm.resting = false;
    rm.finished = false;

    document.getElementById('realMarathonPlay').style.display = '';
    if (rm.clockTimerHandle) clearInterval(rm.clockTimerHandle);
    rm.clockTimerHandle = setInterval(rmTickClock, 250);
    rmNextWord();
  }

  function rmTickClock() {
    const label = document.getElementById('rmClockLabel');
    if (label) label.textContent = rmFormatClock(rmElapsedMs());
  }

  function rmTrackHTML() {
    let html = '<div class="rm-track">';
    rm.levels.forEach(function (len, i) {
      const cls = i < rm.levelIndex ? 'rm-done' : (i === rm.levelIndex ? 'rm-current' : '');
      const levelPos = i + 1;
      const isCp = rmIsCheckpointAfterLevel(levelPos);
      html += '<div class="rm-track-node ' + cls + (isCp ? ' rm-checkpoint' : '') + '">' + len + 'L</div>';
      if (i < rm.levels.length - 1) html += '<div class="rm-track-connector"></div>';
    });
    html += '</div>';
    return html;
  }

  function rmNextWord() {
    if (rm.wordIndexInLevel >= rm.wordsPerLevel) {
      const levelPos = rm.levelIndex + 1;
      rm.levelIndex++;
      rm.wordIndexInLevel = 0;
      if (rm.levelIndex >= rm.levels.length) { rmFinish(); return; }
      if (rmIsCheckpointAfterLevel(levelPos)) { rmStartCheckpoint(); return; }
    }
    const len = rm.levels[rm.levelIndex];
    let round = null;
    let guard = 0;
    while (!round && guard < 15) { round = rmBuildWordRound(len); guard++; }
    if (!round) {
      showToast('ไม่พบคำศัพท์ความยาว ' + len + ' ตัวอักษร — ข้ามไประดับถัดไป');
      rm.levelIndex++;
      rm.wordIndexInLevel = 0;
      if (rm.levelIndex >= rm.levels.length) { rmFinish(); return; }
      rmNextWord();
      return;
    }
    rm.current = round;
    rmRenderPlay();
  }

  function rmStartCheckpoint() {
    rm.resting = true;
    rm.running = false;
    rm.elapsedBeforePause = rmElapsedMs();
    rm.restDeadline = Date.now() + RM_CHECKPOINT_REST_MS;
    rmRenderCheckpoint();
    if (rm.restTimerHandle) clearInterval(rm.restTimerHandle);
    rm.restTimerHandle = setInterval(rmTickCheckpoint, 100);
  }

  function rmTickCheckpoint() {
    const remaining = rm.restDeadline - Date.now();
    const label = document.getElementById('rmRestTimeLeft');
    if (label) label.textContent = Math.max(0, Math.ceil(remaining / 1000)) + ' วิ';
    const fill = document.getElementById('rmRestBarFill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, (remaining / RM_CHECKPOINT_REST_MS) * 100)) + '%';
    if (remaining <= 0) rmEndCheckpoint();
  }

  function rmEndCheckpoint() {
    if (rm.restTimerHandle) { clearInterval(rm.restTimerHandle); rm.restTimerHandle = null; }
    rm.resting = false;
    rm.running = true;
    rm.startTime = Date.now();
    rmNextWord();
  }

  function rmRenderCheckpoint() {
    const area = document.getElementById('realMarathonPlay');
    const nextLen = rm.levels[rm.levelIndex];
    area.innerHTML =
      rmTrackHTML() +
      '<div class="session-card rm-checkpoint-card">' +
        '<div style="font-size:2rem">🚩💧</div>' +
        '<div class="big-stat">Checkpoint</div>' +
        '<div class="field-hint">พักดื่มน้ำสั้นๆ ก่อนไปต่อที่ระดับ ' + nextLen + 'L</div>' +
        '<div class="rm-rest-bar"><div class="rm-rest-bar-fill" id="rmRestBarFill" style="width:100%"></div></div>' +
        '<div class="rm-clock" id="rmRestTimeLeft">30 วิ</div>' +
        '<div class="session-controls" style="margin-top:1rem">' +
          '<button class="btn btn-outline btn-sm" id="rmSkipRestBtn">⏭ ข้ามพัก ออกวิ่งต่อเลย</button>' +
        '</div>' +
      '</div>';
    document.getElementById('rmSkipRestBtn').addEventListener('click', rmEndCheckpoint);
  }

  function rmRenderPlay() {
    const area = document.getElementById('realMarathonPlay');
    if (rm.finished) { rmRenderSummary(area); return; }

    const item = rm.current;
    const len = rm.levels[rm.levelIndex];
    const progressLabel = 'ระยะ ' + len + 'L · คำที่ ' + (rm.wordIndexInLevel + 1) + '/' + rm.wordsPerLevel +
      ' ในระดับนี้ · รวม ' + rm.wordsDone + '/' + rm.totalWords +
      ' คำ · <span class="rm-clock" id="rmClockLabel">' + rmFormatClock(rmElapsedMs()) + '</span>';

    area.innerHTML =
      rmTrackHTML() +
      '<div class="session-progress">' + progressLabel + '</div>' +
      '<div class="session-card">' +
        '<div class="session-prompt-label">🔀 เรียงตัวอักษรใหม่ให้เป็นคำศัพท์ความยาว ' + len + ' ตัวอักษร</div>' +
        tileRowHTML(item.display, 'big') +
        '<form class="session-answer-form" id="rmForm">' +
          '<input type="text" id="rmInput" autocomplete="off" placeholder="พิมพ์คำแล้วกด Enter" autofocus>' +
          '<button class="btn btn-primary" type="submit">ส่งคำตอบ</button>' +
        '</form>' +
        '<div class="session-controls">' +
          '<button class="btn btn-outline" id="rmSkipBtn">⏭ ข้ามคำนี้</button>' +
          '<button class="btn btn-danger btn-sm" id="rmEndBtn">⏹ จบ Marathon</button>' +
        '</div>' +
      '</div>';

    const form = document.getElementById('rmForm');
    const input = document.getElementById('rmInput');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const guess = input.value.trim().toUpperCase();
      if (!guess || !rm.current) return;
      if (rm.current.accepted.has(guess)) {
        rm.correct++;
        rm.wordsDone++;
        rm.wordIndexInLevel++;
        logWordEncounter(guess, 'marathon');
        if (window.Achievements) window.Achievements.record('marathon_correct', { count: 1, streak: rm.correct });
        showToast('✓ ถูกต้อง!');
        rmNextWord();
      } else {
        rm.incorrect++;
        showToast('✗ ไม่ถูกต้อง ลองอีกครั้ง');
        input.value = '';
        input.focus();
      }
    });

    document.getElementById('rmSkipBtn').addEventListener('click', function () {
      rm.wordsDone++;
      rm.wordIndexInLevel++;
      showToast('⏭ ข้าม — คำตอบ: ' + rm.current.revealWord);
      rmNextWord();
    });

    document.getElementById('rmEndBtn').addEventListener('click', rmFinish);
  }

  function rmFinish() {
    rm.finished = true;
    rm.running = false;
    if (rm.clockTimerHandle) { clearInterval(rm.clockTimerHandle); rm.clockTimerHandle = null; }
    if (rm.restTimerHandle) { clearInterval(rm.restTimerHandle); rm.restTimerHandle = null; }
    if (rm.levelIndex >= rm.levels.length && rm.levels.length > 0) {
      if (window.Achievements) window.Achievements.record('marathon_complete', { rounds: rm.wordsDone, bestStreak: rm.correct });
    }
    rmRenderPlay();
  }

  function rmRenderSummary(area) {
    const finishedFully = rm.levelIndex >= rm.levels.length;
    area.innerHTML =
      '<div class="session-summary">' +
        '<div style="font-size:2.4rem">' + (finishedFully ? '🏁' : '⏹') + '</div>' +
        '<div class="big-stat rm-clock">' + rmFormatClock(rmElapsedMs()) + '</div>' +
        '<div class="field-hint" style="margin-bottom:1rem">' + (finishedFully ? 'เข้าเส้นชัย! ' : 'จบก่อนกำหนด — ') +
          'ตอบถูก ' + rm.correct + ' คำ · พลาด/ข้าม ' + rm.incorrect + ' ครั้ง · ระยะ ' + rm.startLen + 'L–' + rm.endLen + 'L</div>' +
        '<div class="session-controls" style="margin-top:1.2rem">' +
          '<button class="btn btn-primary" id="rmPlayAgainBtn">🔁 วิ่งอีกรอบ</button>' +
        '</div>' +
      '</div>';

    document.getElementById('rmPlayAgainBtn').addEventListener('click', function () {
      document.getElementById('realMarathonSetup').style.display = '';
      document.getElementById('realMarathonPlay').style.display = 'none';
    });
  }

  function initRealMarathonGame() {
    document.getElementById('rmStartBtn').addEventListener('click', function () {
      document.getElementById('realMarathonSetup').style.display = 'none';
      rmStart();
    });
  }

  // ---------- Minigame sub-tab toggle ----------

  function initMinigameTabs() {
    const typingBtn = document.getElementById('gameTabTyping');
    const racksBtn = document.getElementById('gameTabRacks');
    const alphaBtn = document.getElementById('gameTabAlpha');
    const marathonBtn = document.getElementById('gameTabMarathon');
    const realMarathonBtn = document.getElementById('gameTabRealMarathon');
    const typingPanel = document.getElementById('typingGamePanel');
    const racksPanel = document.getElementById('racksGamePanel');
    const alphaPanel = document.getElementById('alphaGamePanel');
    const marathonPanel = document.getElementById('marathonGamePanel');
    const realMarathonPanel = document.getElementById('realMarathonGamePanel');
    const allBtns = [typingBtn, racksBtn, alphaBtn, marathonBtn, realMarathonBtn];
    const allPanels = [typingPanel, racksPanel, alphaPanel, marathonPanel, realMarathonPanel];

    function activate(activeBtn, activePanel) {
      allBtns.forEach(function (b) {
        if (b === activeBtn) { b.classList.add('btn-primary'); b.classList.remove('btn-outline'); }
        else { b.classList.add('btn-outline'); b.classList.remove('btn-primary'); }
      });
      allPanels.forEach(function (p) { p.style.display = (p === activePanel) ? '' : 'none'; });
    }

    typingBtn.addEventListener('click', function () { activate(typingBtn, typingPanel); });
    racksBtn.addEventListener('click', function () { activate(racksBtn, racksPanel); });
    alphaBtn.addEventListener('click', function () { activate(alphaBtn, alphaPanel); });
    marathonBtn.addEventListener('click', function () { activate(marathonBtn, marathonPanel); });
    realMarathonBtn.addEventListener('click', function () { activate(realMarathonBtn, realMarathonPanel); });
  }

  // ---------- global keyboard shortcuts ----------

  function initGlobalShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/') return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const browseTab = document.getElementById('tab-browse');
      if (browseTab && browseTab.classList.contains('active')) {
        e.preventDefault();
        document.getElementById('browseWordSearch').focus();
      }
    });
  }

  // ---------- init ----------

  document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    applyTheme();
    applyFontSettings();
    loadCustomWords();
    initTabs();
    applyI18n();
    initSettingsTab();
    initGenerator();
    initQuizTab();
    initCardboxTab();
    initAddWordsPanel();
    initCardboxList();
    initAnagramReview();
    initDueTimeControls();
    initImportExport();
    initCardboxImportExport();
    initCardboxGroups();
    initDueEditOverlay();
    initWordBuilder();
    initTypingGame();
    initTgTypedPanel();
    initRacksGame();
    initAlphaGame();
    initMarathonGame();
    initRealMarathonGame();
    initMinigameTabs();
    initDashSuggested();
    initDashActions();
    initLearnTab();
    initGlobalShortcuts();
    if (window.Achievements) {
      window.Achievements.init();
      window.Achievements.renderTab();
    }
    renderCardboxTab();
    renderCardboxGroups();
    renderDashboard();
  });
})();
