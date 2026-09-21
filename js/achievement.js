/* =========================================================
   CSW24 Word Lab — achievement engine
   Depends on badges.js (CSW24_BADGES, CSW24_BADGES_BY_ID)
   being loaded first.

   Public API (window.Achievements):
     init()                      call once on DOMContentLoaded
     record(eventName, payload)  call from app.js at key actions
     renderTab()                 render the Achievements tab grid
   ========================================================= */

(function (global) {
  'use strict';

  const STATS_KEY = 'csw24_achievement_stats_v1';
  const UNLOCKED_KEY = 'csw24_achievement_unlocked_v1';
  const DAY_MS = 86400000;

  const DEFAULT_STATS = {
    cardboxTotal: 0,
    sessionsCompleted: 0,
    masteredCount: 0,
    hasPerfectSession: false,
    perfectSessionCount: 0,
    leechCount: 0,
    anagramViews: 0,
    typingWins: 0,
    racksCorrectTotal: 0,
    alphaCleared: 0,
    marathonCompleted: 0,
    marathonBestStreak: 0,
    lastActiveDay: null,   // 'YYYY-MM-DD'
    dayStreak: 0,
    bestDayStreak: 0,      // longest streak ever reached
    totalDaysActive: 0,    // count of distinct days the app was used at all
    hasNightOwlPlay: false,   // played/studied 02:00–04:59 local time
    hasEarlyBirdPlay: false,  // played/studied 05:00–05:59 local time
    hasQNoU: false,           // Cardbox contains a word with Q but no U
    hasPangramWord: false,    // Cardbox contains a 7+ letter word with 7+ distinct letters
    typingMistakesTotal: 0,   // lifetime mistakes across Typing minigame rounds
    bestTypingWordsPerSec: 0, // best (words / second) rate in a finished Typing round, 3+ words

    // --- extended tracking for the 100-badge set ---
    oddsAnswered: 0,          // total Odds Trainer questions graded
    oddsCorrect: 0,           // total Odds Trainer questions passed
    oddsCorrectStreak: 0,     // current consecutive-correct streak, Odds Trainer
    oddsBestStreak: 0,        // best consecutive-correct streak, Odds Trainer
    vowelDumpChecked: 0,      // total Vowel Dump Practice checks submitted
    vowelDumpBalanced: 0,     // total checks that landed in the "balanced" band
    rackBalanceViews: 0,      // total Rack Balance Analyzer racks drawn
    rackBalanceHardLetterViews: 0, // racks drawn containing a J/Q/X/Z
    endgameRevealed: 0,       // total Endgame Trainer answers revealed
    parallelViews: 0,         // total Parallel Play Finder scenarios viewed
    botGamesPlayed: 0,        // completed games vs the bot in Play Game
    botGamesWon: 0,           // games vs the bot that the learner won
    botHighestScoringMove: 0, // highest single-move score achieved vs the bot
    tabsVisited: {},          // map of tab name -> true, every tab ever opened
    cardboxDeleted: 0,        // words removed from Cardbox
    settingsChanged: 0,       // number of times app settings were changed
    marathonAbandonedZero: 0, // marathon sessions ended with 0 correct
    sessionsAtExactly1: 0,    // review sessions completed with exactly 1 card
    typingRoundsCompleted: 0, // total finished Typing minigame rounds
    typingCleanRounds: 0,     // Typing rounds finished with 0 mistakes
    greetingsViewed: {},      // map of greeting id/text -> true, every greeting ever shown
    exportCount: 0,           // number of times Cardbox/progress was exported
    importCount: 0,           // number of times data was imported
    appOpenCount: 0,          // total number of times the app was opened/loaded
    anagramLongestWord: 0,    // longest word length ever viewed in Anagram
    cardboxEditCount: 0,      // number of manual edits to a Cardbox entry
    hasUsedAllPracticeModes: false // computed flag: every practice mode opened at least once
  };

  let stats = null;
  let unlocked = null; // { [badgeId]: unlockedAtMs }

  // ---------- persistence ----------

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function saveUnlocked() {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
  }

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------- lang helper (mirrors app.js settings, read-only) ----------

  function currentLang() {
    try {
      const raw = localStorage.getItem('csw24_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.lang === 'th' || parsed.lang === 'en')) return parsed.lang;
      }
    } catch (e) { /* ignore */ }
    return 'th';
  }

  // ---------- streak handling ----------

  function touchDayStreak() {
    const today = dayKey();
    if (stats.lastActiveDay === today) return;
    if (stats.lastActiveDay) {
      const prev = new Date(stats.lastActiveDay + 'T00:00:00');
      const diffDays = Math.round((new Date(today + 'T00:00:00') - prev) / DAY_MS);
      stats.dayStreak = diffDays === 1 ? stats.dayStreak + 1 : 1;
    } else {
      stats.dayStreak = 1;
    }
    stats.lastActiveDay = today;
    stats.bestDayStreak = Math.max(stats.bestDayStreak || 0, stats.dayStreak);
    stats.totalDaysActive = (stats.totalDaysActive || 0) + 1;
  }

  // ---------- core: recompute cardbox-derived stats from source of truth ----------

  function refreshFromCardbox() {
    try {
      const raw = localStorage.getItem('csw24_cardbox_v1');
      const box = raw ? JSON.parse(raw) : [];
      stats.cardboxTotal = box.length;
      stats.masteredCount = box.filter(function (c) { return c.status === 'mastered'; }).length;
      stats.leechCount = box.filter(function (c) { return !!c.leech; }).length;

      let qNoUCount = 0;
      let pangramCount = 0;
      for (let i = 0; i < box.length; i++) {
        const w = (box[i].word || '').toUpperCase();
        if (w.indexOf('Q') !== -1 && w.indexOf('U') === -1) qNoUCount++;
        if (w.length >= 7 && new Set(w.split('')).size === w.length) pangramCount++;
      }
      stats._qNoUCount = qNoUCount;
      stats._pangramCount = pangramCount;
      if (qNoUCount >= 1) stats.hasQNoU = true;
      if (pangramCount >= 1) stats.hasPangramWord = true;
    } catch (e) { /* ignore, keep previous values */ }
  }

  // ---------- unlock evaluation ----------

  function evaluateAndUnlock() {
    const newlyUnlocked = [];
    const allBadges = global.CSW24_BADGES || [];
    // "Completionist" needs to know how many *other* badges are unlocked so
    // far, computed fresh each pass rather than stored as a regular stat.
    stats.otherBadgesUnlockedCount = allBadges.filter(function (b) {
      return b.id !== 'the_completionist' && !!unlocked[b.id];
    }).length;
    stats.otherBadgesTotalCount = allBadges.filter(function (b) { return b.id !== 'the_completionist'; }).length;

    // Tier-completion flags, recomputed fresh each pass (mirrors the
    // completionist pattern above) so "secret" badges can react to whole
    // tiers being cleared without storing brittle counters.
    function tierComplete(tierName) {
      const tierBadges = allBadges.filter(function (b) { return b.tier === tierName; });
      return tierBadges.length > 0 && tierBadges.every(function (b) { return !!unlocked[b.id]; });
    }
    stats._hardTierComplete = tierComplete('hard');
    stats._nearImpossibleComplete = tierComplete('near_impossible');

    // "Every other badge unlocked" for the final secret badge.
    const secretHundredId = 'secret_hundred_percent';
    stats._allOtherUnlocked = allBadges.filter(function (b) { return b.id !== secretHundredId; })
      .every(function (b) { return !!unlocked[b.id]; });

    allBadges.forEach(function (badge) {
      if (unlocked[badge.id]) return;
      let earned = false;
      try { earned = !!badge.check(stats); } catch (e) { earned = false; }
      if (earned) {
        unlocked[badge.id] = Date.now();
        newlyUnlocked.push(badge);
      }
    });
    if (newlyUnlocked.length) {
      saveUnlocked();
      newlyUnlocked.forEach(showBadgeToast);
      if (typeof global.onAchievementsChanged === 'function') {
        try { global.onAchievementsChanged(newlyUnlocked); } catch (e) { /* ignore */ }
      }
    }
    return newlyUnlocked;
  }

  // ---------- event recording (called from app.js) ----------

  function touchOddHourPlay() {
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 5) stats.hasNightOwlPlay = true;
    else if (hour === 5) stats.hasEarlyBirdPlay = true;
  }

  function record(eventName, payload) {
    if (!stats) init();
    touchDayStreak();
    touchOddHourPlay();

    switch (eventName) {
      case 'cardbox_add':
        refreshFromCardbox();
        break;
      case 'session_complete':
        stats.sessionsCompleted++;
        refreshFromCardbox();
        if (payload && payload.total >= 5 && payload.incorrect === 0) {
          stats.hasPerfectSession = true;
          stats.perfectSessionCount++;
        }
        if (payload && payload.total === 1) {
          stats.sessionsAtExactly1++;
        }
        break;
      case 'card_reviewed':
        refreshFromCardbox();
        break;
      case 'anagram_view':
        stats.anagramViews++;
        break;
      case 'typing_win':
        stats.typingWins++;
        if (payload) {
          if (typeof payload.mistakes === 'number') stats.typingMistakesTotal += payload.mistakes;
          if (payload.words >= 3 && payload.elapsedMs > 0) {
            const wps = payload.words / (payload.elapsedMs / 1000);
            stats.bestTypingWordsPerSec = Math.max(stats.bestTypingWordsPerSec, wps);
          }
        }
        break;
      case 'racks_correct':
        stats.racksCorrectTotal += (payload && payload.count) || 1;
        break;
      case 'alpha_cleared':
        stats.alphaCleared++;
        break;
      case 'marathon_correct':
        if (payload && typeof payload.streak === 'number') {
          stats.marathonBestStreak = Math.max(stats.marathonBestStreak, payload.streak);
        }
        break;
      case 'marathon_complete':
        stats.marathonCompleted++;
        if (payload && typeof payload.bestStreak === 'number') {
          stats.marathonBestStreak = Math.max(stats.marathonBestStreak, payload.bestStreak);
        }
        if (payload && payload.rounds === 0) stats.marathonAbandonedZero++;
        break;
      case 'odds_answered':
        stats.oddsAnswered++;
        if (payload && payload.pass) {
          stats.oddsCorrect++;
          stats.oddsCorrectStreak++;
          stats.oddsBestStreak = Math.max(stats.oddsBestStreak, stats.oddsCorrectStreak);
        } else {
          stats.oddsCorrectStreak = 0;
        }
        break;
      case 'vowel_dump_checked':
        stats.vowelDumpChecked++;
        if (payload && payload.band === 'balanced') stats.vowelDumpBalanced++;
        break;
      case 'rack_balance_viewed':
        stats.rackBalanceViews++;
        if (payload && payload.hasHardLetter) stats.rackBalanceHardLetterViews++;
        break;
      case 'endgame_revealed':
        stats.endgameRevealed++;
        break;
      case 'parallel_viewed':
        stats.parallelViews++;
        break;
      case 'bot_game_complete':
        stats.botGamesPlayed++;
        if (payload && payload.won) stats.botGamesWon++;
        if (payload && typeof payload.bestMoveScore === 'number') {
          stats.botHighestScoringMove = Math.max(stats.botHighestScoringMove, payload.bestMoveScore);
        }
        break;
      case 'tab_visited':
        if (payload && payload.tab) stats.tabsVisited[payload.tab] = true;
        break;
      case 'cardbox_delete':
        stats.cardboxDeleted++;
        refreshFromCardbox();
        break;
      case 'cardbox_edit':
        stats.cardboxEditCount++;
        break;
      case 'settings_changed':
        stats.settingsChanged++;
        break;
      case 'typing_round_complete':
        stats.typingRoundsCompleted++;
        if (payload && payload.mistakes === 0) stats.typingCleanRounds++;
        break;
      case 'greeting_viewed':
        if (payload && payload.id) stats.greetingsViewed[payload.id] = true;
        break;
      case 'data_exported':
        stats.exportCount++;
        break;
      case 'data_imported':
        stats.importCount++;
        break;
      case 'app_opened':
        stats.appOpenCount++;
        break;
      case 'anagram_word_length':
        if (payload && typeof payload.length === 'number') {
          stats.anagramLongestWord = Math.max(stats.anagramLongestWord, payload.length);
        }
        break;
      case 'session_duration':
        break;
      default:
        break;
    }

    // "all practice modes opened" — recomputed fresh each time tabsVisited changes
    const ALL_PRACTICE_MODES = ['odds', 'voweldump', 'rackbalance', 'endgame', 'parallel'];
    stats.hasUsedAllPracticeModes = ALL_PRACTICE_MODES.every(function (m) { return !!stats.tabsVisited[m]; });

    saveStats();
    const newlyUnlocked = evaluateAndUnlock();
    if (typeof global.onAchievementsRecorded === 'function') {
      try { global.onAchievementsRecorded(eventName, stats); } catch (e) { /* ignore */ }
    }
    return newlyUnlocked;
  }

  // ---------- toast (animated) ----------

  let toastQueue = [];
  let toastShowing = false;

  function showBadgeToast(badge) {
    toastQueue.push(badge);
    if (!toastShowing) drainToastQueue();
  }

  function drainToastQueue() {
    const badge = toastQueue.shift();
    if (!badge) { toastShowing = false; return; }
    toastShowing = true;

    const lang = currentLang();
    let el = document.getElementById('achievementToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'achievementToast';
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="ach-toast-icon">' + badge.icon + '</div>' +
      '<div class="ach-toast-body">' +
        '<div class="ach-toast-kicker">' + (lang === 'th' ? 'ปลดล็อกความสำเร็จ!' : 'Achievement unlocked!') + '</div>' +
        '<div class="ach-toast-name">' + badge.name[lang] + '</div>' +
      '</div>';

    if (global.Motion) {
      // Motion One re-runs cleanly on every call, so consecutive badge
      // unlocks no longer need the old force-reflow trick to restart a
      // CSS animation class.
      global.Motion.animate(
        el,
        { transform: ['translateX(-50%) translateY(-140%) scale(0.9)', 'translateX(-50%) translateY(0%) scale(1)'], opacity: [0, 1] },
        { duration: 0.4, easing: [0.34, 1.56, 0.64, 1] }
      );
      const icon = el.querySelector('.ach-toast-icon');
      if (icon) {
        global.Motion.animate(icon, { transform: ['scale(0)', 'scale(1.3)', 'scale(1)'] }, { duration: 0.5, delay: 0.1 });
      }
      setTimeout(function () {
        global.Motion.animate(
          el,
          { opacity: [1, 0], transform: ['translateX(-50%) translateY(0%) scale(1)', 'translateX(-50%) translateY(-40%) scale(0.95)'] },
          { duration: 0.25 }
        ).finished.then(function () { setTimeout(drainToastQueue, 320); });
      }, 2800);
      return;
    }

    el.classList.remove('ach-toast-show');
    // force reflow so the animation restarts for consecutive toasts
    void el.offsetWidth;
    el.classList.add('ach-toast-show');

    setTimeout(function () {
      el.classList.remove('ach-toast-show');
      setTimeout(drainToastQueue, 320);
    }, 2800);
  }

  // ---------- Achievements tab rendering ----------

  const TIER_ORDER = ['legacy', 'hard', 'near_impossible', 'impossible', 'secret'];
  const TIER_LABEL = {
    legacy: { th: '🏅 เหรียญทั่วไป', en: '🏅 Badges' },
    hard: { th: '💪 ระดับยาก', en: '💪 Hard' },
    near_impossible: { th: '🔥 ระดับโคตรยาก', en: '🔥 Near-Impossible' },
    impossible: { th: '🚫 ระดับเป็นไปไม่ได้', en: '🚫 Impossible' },
    secret: { th: '🕵️ เหรียญลับ', en: '🕵️ Secret' }
  };
  // Sections start collapsed except the everyday "legacy" tier, so the tab
  // opens on something manageable instead of 100 cards at once.
  const tierOpenState = { legacy: true };

  function badgeCardHTML(b, lang) {
    const isUnlocked = !!unlocked[b.id];
    const cls = 'badge-card' + (isUnlocked ? ' badge-unlocked' : ' badge-locked');
    const dateStr = isUnlocked
      ? new Date(unlocked[b.id]).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')
      : '';
    const pointsStr = typeof b.points === 'number'
      ? '<div class="badge-points">' + (lang === 'th' ? b.points + ' แต้ม' : b.points + ' pts') + '</div>'
      : '';
    return (
      '<div class="' + cls + '">' +
        '<div class="badge-icon">' + (isUnlocked ? b.icon : '🔒') + '</div>' +
        '<div class="badge-name">' + b.name[lang] + '</div>' +
        '<div class="badge-desc">' + b.desc[lang] + '</div>' +
        pointsStr +
        (isUnlocked ? '<div class="badge-date">' + dateStr + '</div>' : '') +
      '</div>'
    );
  }

  function tierSectionHTML(tierName, tierBadges, lang) {
    const label = TIER_LABEL[tierName] ? TIER_LABEL[tierName][lang] : tierName;
    const unlockedInTier = tierBadges.filter(function (b) { return !!unlocked[b.id]; }).length;
    const isOpen = !!tierOpenState[tierName];
    const isSecretTier = tierName === 'secret';

    const headerHTML =
      '<button type="button" class="badge-tier-header' + (isOpen ? ' badge-tier-open' : '') + '" data-tier="' + tierName + '">' +
        '<span class="badge-tier-caret">' + (isOpen ? '▾' : '▸') + '</span>' +
        '<span class="badge-tier-label">' + label + '</span>' +
        '<span class="badge-tier-count">' + unlockedInTier + ' / ' + tierBadges.length + '</span>' +
      '</button>' +
      '<div class="badge-tier-bar"><div class="badge-tier-bar-fill" style="width:' +
        (tierBadges.length ? Math.round((unlockedInTier / tierBadges.length) * 100) : 0) + '%"></div></div>';

    if (!isOpen) {
      return '<div class="badge-tier-section">' + headerHTML + '</div>';
    }

    // Inside "secret", unlocked ones get real cards (they're earned, show
    // them off); everything still locked collapses into one small note
    // instead of dozens of identical "???" placeholder cards.
    let bodyHTML;
    if (isSecretTier) {
      const unlockedSecrets = tierBadges.filter(function (b) { return !!unlocked[b.id]; });
      const lockedCount = tierBadges.length - unlockedSecrets.length;
      const lockedNoteHTML = lockedCount > 0
        ? '<div class="badge-secret-remaining">' +
            (lang === 'th'
              ? '🔒 ยังมีเหรียญลับอีก ' + lockedCount + ' อันรอให้ค้นพบ — เล่นต่อไปเรื่อย ๆ แล้วจะเจอเอง'
              : '🔒 ' + lockedCount + ' more secret badges waiting to be discovered — keep playing to find them') +
          '</div>'
        : '';
      bodyHTML =
        (unlockedSecrets.length
          ? '<div class="badge-grid badge-grid-tier">' + unlockedSecrets.map(function (b) { return badgeCardHTML(b, lang); }).join('') + '</div>'
          : '') +
        lockedNoteHTML;
    } else {
      bodyHTML = '<div class="badge-grid badge-grid-tier">' + tierBadges.map(function (b) { return badgeCardHTML(b, lang); }).join('') + '</div>';
    }

    return '<div class="badge-tier-section">' + headerHTML + bodyHTML + '</div>';
  }

  function renderTab() {
    const grid = document.getElementById('achievementGrid');
    if (!grid) return;
    const lang = currentLang();
    const badges = global.CSW24_BADGES || [];
    const unlockedCount = badges.filter(function (b) { return !!unlocked[b.id]; }).length;

    const pointBadges = badges.filter(function (b) { return typeof b.points === 'number'; });
    const totalPoints = pointBadges.reduce(function (sum, b) { return sum + b.points; }, 0);
    const earnedPoints = pointBadges.reduce(function (sum, b) { return sum + (unlocked[b.id] ? b.points : 0); }, 0);

    const summaryEl = document.getElementById('achievementSummary');
    if (summaryEl) {
      const pct = badges.length ? Math.round((unlockedCount / badges.length) * 100) : 0;
      let text = lang === 'th'
        ? 'ปลดล็อกแล้ว ' + unlockedCount + ' / ' + badges.length + ' เหรียญ (' + pct + '%)'
        : 'Unlocked ' + unlockedCount + ' / ' + badges.length + ' badges (' + pct + '%)';
      if (totalPoints > 0) {
        text += lang === 'th'
          ? ' · เหรียญพิเศษ ' + earnedPoints + ' / ' + totalPoints + ' แต้ม'
          : ' · Special badge points ' + earnedPoints + ' / ' + totalPoints;
      }
      summaryEl.innerHTML =
        '<span>' + text + '</span>' +
        '<div class="badge-overall-bar"><div class="badge-overall-bar-fill" style="width:' + pct + '%"></div></div>';
    }

    const byTier = {};
    badges.forEach(function (b) {
      const t = b.tier || 'legacy';
      if (!byTier[t]) byTier[t] = [];
      byTier[t].push(b);
    });

    grid.innerHTML = TIER_ORDER
      .filter(function (t) { return byTier[t] && byTier[t].length; })
      .map(function (t) { return tierSectionHTML(t, byTier[t], lang); })
      .join('');

    // Wire up collapse/expand toggles (re-bound every render, since
    // innerHTML was just replaced).
    grid.querySelectorAll('.badge-tier-header').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tierName = btn.getAttribute('data-tier');
        tierOpenState[tierName] = !tierOpenState[tierName];
        renderTab();
      });
    });
  }

  // ---------- init ----------

  function freshDefault(key) {
    const v = DEFAULT_STATS[key];
    if (v && typeof v === 'object') return {};
    return v;
  }

  function init() {
    const loaded = loadJSON(STATS_KEY, null);
    if (loaded) {
      stats = loaded;
      // patch any keys missing from an older save (fresh objects, not shared refs)
      Object.keys(DEFAULT_STATS).forEach(function (k) {
        if (!(k in stats)) stats[k] = freshDefault(k);
      });
    } else {
      stats = {};
      Object.keys(DEFAULT_STATS).forEach(function (k) { stats[k] = freshDefault(k); });
    }
    unlocked = loadJSON(UNLOCKED_KEY, {});
    refreshFromCardbox();
    // bestDayStreak/totalDaysActive were added after dayStreak already
    // existed — for a returning user whose save predates them, seed
    // bestDayStreak from their current streak so it doesn't show 0 while
    // dayStreak already shows their real, larger streak.
    stats.bestDayStreak = Math.max(stats.bestDayStreak || 0, stats.dayStreak || 0);
    // Same reasoning for totalDaysActive: it can't be less than the
    // current streak (a streak of N days necessarily means N active
    // days), so seed it to at least that for pre-existing saves.
    stats.totalDaysActive = Math.max(stats.totalDaysActive || 0, stats.dayStreak || 0);
    const ALL_PRACTICE_MODES = ['odds', 'voweldump', 'rackbalance', 'endgame', 'parallel'];
    stats.hasUsedAllPracticeModes = ALL_PRACTICE_MODES.every(function (m) { return !!stats.tabsVisited[m]; });
    saveStats();
  }

  global.Achievements = {
    init: init,
    record: record,
    renderTab: renderTab,
    getStats: function () { return stats; },
    getUnlocked: function () { return unlocked; }
  };
})(window);
