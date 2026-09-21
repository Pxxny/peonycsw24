/* =========================================================
   CSW24 Word Lab — XP + Level engine
   Depends on: achievement.js (loaded before this, for
   dayStreak/bestDayStreak/totalDaysActive stats). Lifetime
   word accuracy is derived locally from Cardbox.

   XP awards (per the spec):
     new_word     +10 XP  — a word answered correctly for the
                            very first time (status new -> learning)
     correct      +5 XP   — correct answer on a word already
                            "learning" (not yet mastered)
     review       +3 XP   — correct answer on an already
                            "mastered" word
     typed_word   +1 XP   — each word typed correctly in the
                            Typing minigame (Random or Alphagram Drill)

   Storage: csw24_xp_v1  { totalXp: number }
   (auto-covered by the app's existing cloud sync / export /
   guest-backup, which walk every csw24_* key)

   Public API (window.XP):
     award(kind)             add XP for one of the kinds above
     getTotalXp()             -> number
     getLevelInfo()           -> { level, title, xpIntoLevel,
                                    xpForNextLevel, totalXp }
     getTitleForLevel(level)  -> string
     mountProfilePanel()      render the "Your Word Journey" +
                              XP/Level card into #profileSettingsSection
                              (same host frames-ui.js mounts into)
   ========================================================= */

(function (global) {
  'use strict';

  const XP_KEY = 'csw24_xp_v1';
  const AWARD_XP = { new_word: 10, correct: 5, review: 3, typed_word: 1 };

  let totalXp = 0;

  // ---------- persistence ----------

  function load() {
    try {
      const raw = localStorage.getItem(XP_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      totalXp = (parsed && typeof parsed.totalXp === 'number' && parsed.totalXp >= 0) ? parsed.totalXp : 0;
    } catch (e) { totalXp = 0; }
  }

  function save() {
    localStorage.setItem(XP_KEY, JSON.stringify({ totalXp: totalXp }));
  }

  function currentLang() {
    try {
      const s = JSON.parse(localStorage.getItem('csw24_settings_v1') || '{}');
      return s.lang === 'en' ? 'en' : 'th';
    } catch (e) { return 'th'; }
  }

  // ---------- level curve ----------
  // xpForLevel(n) = total XP required to REACH level n from level 1.
  // Smooth RPG-style ramp: each level costs a bit more than the last.
  function xpForLevel(level) {
    if (level <= 1) return 0;
    let total = 0;
    for (let i = 2; i <= level; i++) total += Math.round(50 * Math.pow(i - 1, 1.5));
    return total;
  }

  // Cache level thresholds lazily up to a generous cap — levels are cheap
  // to compute and this keeps getLevelInfo() a simple forward scan.
  const LEVEL_CAP = 200;
  let thresholds = null;
  function getThresholds() {
    if (thresholds) return thresholds;
    thresholds = [0];
    for (let lvl = 2; lvl <= LEVEL_CAP; lvl++) thresholds.push(xpForLevel(lvl));
    return thresholds;
  }

  function levelForXp(xp) {
    const t = getThresholds();
    let lvl = 1;
    for (let i = 1; i < t.length; i++) {
      if (xp >= t[i]) lvl = i + 1;
      else break;
    }
    return lvl;
  }

  // ---------- titles ----------
  // 20 titles spread across the level range — later titles need
  // proportionally more levels, so they stay meaningful rarities.
  const TITLES = [
    { level: 1, th: 'ผู้เริ่มต้น', en: 'Newcomer' },
    { level: 3, th: 'นักท่องคำ', en: 'Word Wanderer' },
    { level: 5, th: 'นักสะสมคำ', en: 'Word Collector' },
    { level: 8, th: 'นักล่าคำศัพท์', en: 'Word Hunter' },
    { level: 12, th: 'นักล่าคำศัพท์ผู้ช่ำชอง', en: 'Veteran Word Hunter' },
    { level: 16, th: 'จอมทัพนักพิมพ์', en: 'Typing Vanguard' },
    { level: 20, th: 'นักปราชญ์คำศัพท์', en: 'Word Sage' },
    { level: 25, th: 'ผู้เชี่ยวชาญ Anagram', en: 'Anagram Expert' },
    { level: 30, th: 'นักรบคลังศัพท์', en: 'Lexicon Warrior' },
    { level: 36, th: 'ปรมาจารย์การทบทวน', en: 'Review Master' },
    { level: 42, th: 'ผู้พิทักษ์คำศัพท์', en: 'Word Guardian' },
    { level: 48, th: 'นักบวชแห่งพจนานุกรม', en: 'Dictionary Sage' },
    { level: 55, th: 'อัศวินคำศัพท์', en: 'Word Knight' },
    { level: 62, th: 'จอมเวทย์แห่งตัวอักษร', en: 'Letter Mage' },
    { level: 70, th: 'ปรมาจารย์ Scrabble', en: 'Scrabble Master' },
    { level: 80, th: 'เจ้าแห่งคลังศัพท์', en: 'Lexicon Lord' },
    { level: 90, th: 'ผู้เหนือกาลเวลาแห่งคำศัพท์', en: 'Timeless Wordsmith' },
    { level: 100, th: 'ตำนานนักพิมพ์', en: 'Typing Legend' },
    { level: 130, th: 'เทพแห่งคำศัพท์', en: 'Word Deity' },
    { level: 160, th: 'จอมราชันแห่ง CSW24', en: 'CSW24 Grandmaster' }
  ];

  function getTitleForLevel(level) {
    let best = TITLES[0];
    for (let i = 0; i < TITLES.length; i++) {
      if (TITLES[i].level <= level) best = TITLES[i];
      else break;
    }
    const lang = currentLang();
    return best[lang];
  }

  // ---------- level info ----------

  function getLevelInfo(xp) {
    const x = typeof xp === 'number' ? xp : totalXp;
    const level = levelForXp(x);
    const t = getThresholds();
    const xpAtLevelStart = t[level - 1] || 0;
    const xpAtNextLevel = level < LEVEL_CAP ? t[level] : null;
    return {
      level: level,
      title: getTitleForLevel(level),
      totalXp: x,
      xpIntoLevel: x - xpAtLevelStart,
      xpForNextLevel: xpAtNextLevel === null ? null : (xpAtNextLevel - xpAtLevelStart)
    };
  }

  // ---------- award + level-up detection ----------

  function award(kind) {
    const amount = AWARD_XP[kind];
    if (!amount) return;
    const before = levelForXp(totalXp);
    totalXp += amount;
    save();
    const after = levelForXp(totalXp);
    refreshMounted();
    if (after > before) showLevelUpToast(after);
  }

  // ---------- toast (mirrors achievement.js / frames-ui.js pattern) ----------

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showLevelUpToast(newLevel) {
    const lang = currentLang();
    let el = document.getElementById('xpLevelToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'xpLevelToast';
      document.body.appendChild(el);
    }
    const title = getTitleForLevel(newLevel);
    el.innerHTML =
      '<div class="xp-toast-badge">🏆</div>' +
      '<div class="xp-toast-text">' +
        '<div class="xp-toast-kicker">' + (lang === 'th' ? 'เลเวลอัพ!' : 'Level up!') + '</div>' +
        '<div class="xp-toast-name">Level ' + newLevel + ' — ' + escapeHtml(title) + '</div>' +
      '</div>';
    el.classList.add('xp-toast-show');
    clearTimeout(showLevelUpToast._t);
    showLevelUpToast._t = setTimeout(function () { el.classList.remove('xp-toast-show'); }, 3200);
  }

  // ---------- lifetime accuracy / word counts (derived from Cardbox) ----------

  function getWordStats() {
    let total = 0, mastered = 0, weak = 0, correctSum = 0, incorrectSum = 0;
    try {
      const raw = localStorage.getItem('csw24_cardbox_v1');
      const box = raw ? JSON.parse(raw) : [];
      total = box.length;
      box.forEach(function (c) {
        if (c.status === 'mastered') mastered++;
        // "Weak" = leeching, or currently below mastered with more misses
        // than hits — the same word-level signal the Leech badge and the
        // Retention Heatmap already use, summarized here as a count.
        if (c.leech || (c.status !== 'mastered' && (c.incorrect || 0) > (c.correct || 0))) weak++;
        correctSum += c.correct || 0;
        incorrectSum += c.incorrect || 0;
      });
    } catch (e) { /* keep zeros */ }
    const attempts = correctSum + incorrectSum;
    const accuracy = attempts > 0 ? Math.round((correctSum / attempts) * 100) : 0;
    return { total: total, mastered: mastered, weak: weak, accuracy: accuracy };
  }

  // ---------- "Your Word Journey" profile panel ----------

  function refreshMounted() {
    document.querySelectorAll('.xp-level-badge').forEach(paintLevelBadge);
    if (document.getElementById('xpJourneyCard')) mountProfilePanel();
  }

  function paintLevelBadge(el) {
    const info = getLevelInfo();
    el.textContent = 'Lv.' + info.level;
    el.title = info.title;
  }

  function mountProfilePanel() {
    const host = document.getElementById('profileSettingsSection');
    if (!host) return;
    let card = document.getElementById('xpJourneyCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'xpJourneyCard';
      // Appended after whatever frames-ui.js already put in this same
      // host, so Profile reads: name -> frame -> journey.
      host.appendChild(card);
    }

    const lang = currentLang();
    const info = getLevelInfo();
    const ws = getWordStats();
    const stats = (global.Achievements && global.Achievements.getStats && global.Achievements.getStats()) || {};
    const unlockedBadges = (global.Achievements && global.Achievements.getUnlocked && global.Achievements.getUnlocked()) || {};
    const achievementCount = Object.keys(unlockedBadges).length;
    const pct = info.xpForNextLevel ? Math.min(100, Math.round((info.xpIntoLevel / info.xpForNextLevel) * 100)) : 100;
    const toNextXp = Math.max(0, (info.xpForNextLevel || 0) - info.xpIntoLevel);

    const L = lang === 'th'
      ? {
        heading: 'Your Word Journey', wordsLearned: 'คำที่เรียนแล้ว', accuracy: 'ความแม่นยำ',
        streak: 'วันติดต่อกัน', achievements: 'Achievement', toNext: 'อีก ' + toNextXp + ' XP ถึง Level ' + (info.level + 1),
        maxLevel: 'เลเวลสูงสุดแล้ว!', mastered: 'ศัพท์ที่จำได้', weakWords: 'ศัพท์ที่ยังอ่อน',
        daysLearned: 'จำนวนวันที่เรียน', bestStreak: 'Streak สูงสุด', totalXpLabel: 'XP ทั้งหมด'
      }
      : {
        heading: 'Your Word Journey', wordsLearned: 'words learned', accuracy: 'accuracy',
        streak: 'day streak', achievements: 'achievements', toNext: toNextXp + ' XP to Level ' + (info.level + 1),
        maxLevel: 'Max level reached!', mastered: 'Words mastered', weakWords: 'Words still weak',
        daysLearned: 'Days studied', bestStreak: 'Best streak', totalXpLabel: 'Total XP'
      };

    card.innerHTML =
      '<div class="section-heading">' + escapeHtml(L.heading) + '</div>' +
      '<div class="xp-journey-card">' +
        '<div class="xp-journey-top">' +
          '<div class="xp-level-ring"><span class="xp-level-ring-num">' + info.level + '</span><span class="xp-level-ring-label">LV</span></div>' +
          '<div class="xp-journey-title-wrap">' +
            '<div class="xp-journey-title">' + escapeHtml(info.title) + '</div>' +
            '<div class="xp-journey-bar-track"><div class="xp-journey-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="xp-journey-bar-label">' + (info.xpForNextLevel ? escapeHtml(L.toNext) : escapeHtml(L.maxLevel)) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="xp-journey-stats-grid">' +
          '<div class="xp-stat"><b>' + ws.total.toLocaleString() + '</b><span>' + escapeHtml(L.wordsLearned) + '</span></div>' +
          '<div class="xp-stat"><b>' + ws.accuracy + '%</b><span>' + escapeHtml(L.accuracy) + '</span></div>' +
          '<div class="xp-stat"><b>🔥 ' + (stats.dayStreak || 0) + '</b><span>' + escapeHtml(L.streak) + '</span></div>' +
          '<div class="xp-stat"><b>🏆 ' + achievementCount + '</b><span>' + escapeHtml(L.achievements) + '</span></div>' +
        '</div>' +
        '<div class="xp-journey-extra">' +
          '<div class="xp-extra-row"><span>' + escapeHtml(L.mastered) + '</span><b>' + ws.mastered.toLocaleString() + '</b></div>' +
          '<div class="xp-extra-row"><span>' + escapeHtml(L.weakWords) + '</span><b>' + ws.weak.toLocaleString() + '</b></div>' +
          '<div class="xp-extra-row"><span>' + escapeHtml(L.daysLearned) + '</span><b>' + (stats.totalDaysActive || 0) + '</b></div>' +
          '<div class="xp-extra-row"><span>' + escapeHtml(L.bestStreak) + '</span><b>🔥 ' + (stats.bestDayStreak || 0) + '</b></div>' +
          '<div class="xp-extra-row"><span>' + escapeHtml(L.totalXpLabel) + '</span><b>⭐ ' + info.totalXp.toLocaleString() + '</b></div>' +
        '</div>' +
      '</div>';
  }

  // ---------- styles ----------

  function injectStyles() {
    if (document.getElementById('xpStyles')) return;
    const style = document.createElement('style');
    style.id = 'xpStyles';
    style.textContent = [
      '.xp-journey-card { background: var(--board-2); border: 1px solid var(--rail); border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1rem; }',
      '.xp-journey-top { display: flex; align-items: center; gap: 0.9rem; margin-bottom: 0.9rem; }',
      '.xp-level-ring { flex: 0 0 auto; width: 3.4rem; height: 3.4rem; border-radius: 50%;',
      '  background: conic-gradient(from 220deg, var(--brass), var(--teal), var(--brass));',
      '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
      '  box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 4px 14px rgba(124,158,255,.25); }',
      '.xp-level-ring-num { font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: #0D1020; line-height: 1; }',
      '.xp-level-ring-label { font-size: 0.55rem; font-weight: 700; color: rgba(13,16,32,.7); letter-spacing: .05em; }',
      '.xp-journey-title-wrap { flex: 1; min-width: 0; }',
      '.xp-journey-title { font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; color: var(--cream); margin-bottom: 0.3rem; }',
      '.xp-journey-bar-track { height: 8px; border-radius: 5px; background: var(--rail); overflow: hidden; }',
      '.xp-journey-bar-fill { height: 100%; background: linear-gradient(90deg, var(--brass), var(--teal)); border-radius: 5px; transition: width .4s ease; }',
      '.xp-journey-bar-label { font-size: 0.7rem; color: #8890A8; margin-top: 0.3rem; }',
      '.xp-journey-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.8rem; }',
      '.xp-stat { background: var(--board-1); border-radius: 10px; padding: 0.55rem 0.4rem; text-align: center; }',
      '.xp-stat b { display: block; font-family: var(--font-display); font-size: 1.05rem; color: var(--cream); }',
      '.xp-stat span { display: block; font-size: 0.62rem; color: #8890A8; margin-top: 0.15rem; }',
      '.xp-journey-extra { border-top: 1px solid var(--rail); padding-top: 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; }',
      '.xp-extra-row { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--cream); }',
      '.xp-extra-row span { color: #8890A8; }',
      '.xp-level-badge { display: inline-flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 700;',
      '  padding: 0.05rem 0.35rem; border-radius: 6px; background: var(--brass); color: #0D1020; margin-left: 0.3rem; }',
      '@media (max-width: 480px) { .xp-journey-stats-grid { grid-template-columns: repeat(2, 1fr); } }',

      '#xpLevelToast { position: fixed; top: 1.1rem; left: 50%; transform: translateX(-50%) translateY(-140%) scale(0.9); opacity: 0;',
      '  display: flex; align-items: center; gap: 0.7rem; background: linear-gradient(135deg, var(--board-2), var(--board-1));',
      '  border: 1px solid var(--brass); color: var(--cream); padding: 0.6rem 1.1rem 0.6rem 0.6rem; border-radius: 12px;',
      '  box-shadow: 0 10px 30px rgba(0,0,0,.5), 0 0 0 1px rgba(234,179,8,0.15); z-index: 202; max-width: 92vw;',
      '  transition: transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s ease; pointer-events: none; }',
      '#xpLevelToast.xp-toast-show { transform: translateX(-50%) translateY(120px) scale(1); opacity: 1; }',
      '.xp-toast-badge { font-size: 1.6rem; flex: 0 0 auto; }',
      '.xp-toast-kicker { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brass); font-weight: 700; }',
      '.xp-toast-name { font-family: var(--font-display); font-size: 0.96rem; margin-top: 0.1rem; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ---------- init ----------

  function init() {
    load();
    injectStyles();
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    mountProfilePanel();
    // Keep the journey card in sync with the name/frame section above it,
    // which re-renders on language switch (frames-ui.js listens for the
    // same buttons) — reusing that hook keeps both panels consistent.
    ['langThBtn', 'langEnBtn'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () { mountProfilePanel(); });
    });
  });

  // Re-render the journey card whenever Achievements records something
  // (streak/day-count/badge-count can all change without an XP award).
  const prevOnAchievementsRecorded = global.onAchievementsRecorded;
  global.onAchievementsRecorded = function (eventName, stats) {
    if (typeof prevOnAchievementsRecorded === 'function') {
      try { prevOnAchievementsRecorded(eventName, stats); } catch (e) { /* ignore */ }
    }
    if (document.getElementById('xpJourneyCard')) mountProfilePanel();
  };

  global.XP = {
    init: init,
    award: award,
    getTotalXp: function () { return totalXp; },
    getLevelInfo: getLevelInfo,
    getTitleForLevel: getTitleForLevel,
    mountProfilePanel: mountProfilePanel,
    paintBadges: function () { document.querySelectorAll('.xp-level-badge').forEach(paintLevelBadge); }
  };
})(window);
