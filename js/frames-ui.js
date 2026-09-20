/* =========================================================
   CSW24 Word Lab — avatar frame engine + picker UI
   Depends on: frames.js (CSW24_FRAMES), achievement.js
   (window.Achievements.getStats/getUnlocked), badges.js
   (CSW24_BADGES, loaded before frames.js).

   Storage (all csw24_* — auto-covered by the app's existing
   cloud sync / export / guest-backup, which walk that prefix):
     csw24_frames_unlocked_v1   { [frameId]: unlockedAtMs }
     csw24_frames_equipped_v1   "frame_id_string"
     csw24_frames_custom_v1     { dataUrl: "data:image/..." } | null
     csw24_profile_name_v1      "Custom display name" | ""

   Public API (window.Frames):
     init()                re-evaluate unlocks, call once on load
     evaluate()             re-check all unlock conditions (call
                             after any Achievements.record())
     getEquippedFrame()     -> frame def object (never null)
     applyFrameTo(el)       paints the ring/glow/motion onto a
                             container element (the avatar wrapper)
     openPicker()            opens the frame-picker modal
   ========================================================= */

(function (global) {
  'use strict';

  const UNLOCKED_KEY = 'csw24_frames_unlocked_v1';
  const EQUIPPED_KEY = 'csw24_frames_equipped_v1';
  const CUSTOM_KEY = 'csw24_frames_custom_v1';
  const NAME_KEY = 'csw24_profile_name_v1';
  const MAX_CUSTOM_BYTES = 900 * 1024; // keep the data URL comfortably under typical row/localStorage limits

  let unlocked = null; // { [frameId]: ts }
  let equipped = 'frame_none';
  let customImage = null; // { dataUrl } | null

  // ---------- persistence ----------

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) { return fallback; }
  }

  function save() {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
    localStorage.setItem(EQUIPPED_KEY, equipped);
    localStorage.setItem(CUSTOM_KEY, customImage ? JSON.stringify(customImage) : '');
  }

  function currentLang() {
    try {
      const s = JSON.parse(localStorage.getItem('csw24_settings_v1') || '{}');
      return s.lang === 'en' ? 'en' : 'th';
    } catch (e) { return 'th'; }
  }

  // ---------- unlock evaluation ----------

  function frameList() { return global.CSW24_FRAMES || []; }
  function frameById(id) { return (global.CSW24_FRAMES_BY_ID || {})[id]; }

  function evaluate() {
    if (!unlocked) init();
    const stats = (global.Achievements && global.Achievements.getStats && global.Achievements.getStats()) || {};
    const unlockedBadges = (global.Achievements && global.Achievements.getUnlocked && global.Achievements.getUnlocked()) || {};
    const ctx = { unlockedBadges: unlockedBadges, now: new Date() };

    const newly = [];
    frameList().forEach(function (f) {
      if (unlocked[f.id]) return;
      let earned = false;
      try { earned = !!f.check(stats, ctx); } catch (e) { earned = false; }
      if (earned) {
        unlocked[f.id] = Date.now();
        newly.push(f);
      }
    });
    if (newly.length) {
      save();
      newly.forEach(showFrameToast);
    }
    return newly;
  }

  function isUnlocked(frameId) {
    if (frameId === 'frame_custom') return !!customImage;
    return frameId === 'frame_none' || !!(unlocked && unlocked[frameId]);
  }

  // ---------- equip / avatar painting ----------

  function getEquippedFrame() {
    const f = frameById(equipped);
    if (f && isUnlocked(equipped)) return f;
    return frameById('frame_none');
  }

  function equip(frameId) {
    if (!isUnlocked(frameId)) return false;
    equipped = frameId;
    save();
    refreshAllMounted();
    return true;
  }

  // Paints ring + glow + motion class onto a `.auth-avatar-frame`-style
  // container. Safe to call repeatedly (e.g. every render()).
  function applyFrameTo(el) {
    if (!el) return;
    const f = getEquippedFrame();
    el.classList.remove('frame-motion-spin', 'frame-motion-pulse');
    if (f.id === 'frame_custom' && customImage && customImage.dataUrl) {
      el.style.background = 'center/cover no-repeat url("' + customImage.dataUrl + '")';
      el.style.setProperty('--frame-ring-glow', 'none');
    } else {
      el.style.background = f.ring || 'transparent';
      el.style.setProperty('--frame-ring-glow', f.glow ? ('0 0 14px ' + f.glow) : 'none');
    }
    if (f.motion === 'frameSpin') el.classList.add('frame-motion-spin');
    if (f.motion === 'framePulse') el.classList.add('frame-motion-pulse');
    el.style.boxShadow = 'var(--frame-ring-glow), 0 0 0 1px rgba(255,255,255,.06), 0 2px 8px rgba(0,0,0,.35)';
  }

  function refreshAllMounted() {
    document.querySelectorAll('.auth-avatar-frame').forEach(applyFrameTo);
  }

  // ---------- custom name ----------

  function getCustomName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }

  function setCustomName(name) {
    const trimmed = (name || '').trim().slice(0, 40);
    localStorage.setItem(NAME_KEY, trimmed);
    if (typeof global.renderAuthWidget === 'function') global.renderAuthWidget();
  }

  // ---------- custom frame image ----------

  function setCustomImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('not_image')); return; }
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('read_failed')); };
      reader.onload = function () {
        const dataUrl = String(reader.result || '');
        if (dataUrl.length > MAX_CUSTOM_BYTES) { reject(new Error('too_large')); return; }
        customImage = { dataUrl: dataUrl };
        equipped = 'frame_custom';
        save();
        refreshAllMounted();
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  function clearCustomImage() {
    customImage = null;
    if (equipped === 'frame_custom') equipped = 'frame_none';
    save();
    refreshAllMounted();
  }

  // ---------- toast (mirrors achievement.js's badge toast pattern) ----------

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showFrameToast(frame) {
    const lang = currentLang();
    let el = document.getElementById('frameToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'frameToast';
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="frame-toast-ring" style="background:' + (frame.ring || 'transparent') + '"></div>' +
      '<div class="frame-toast-text">' +
        '<div class="frame-toast-kicker">' + (lang === 'th' ? 'ปลดล็อคกรอบใหม่!' : 'New frame unlocked!') + '</div>' +
        '<div class="frame-toast-name">' + escapeHtml(frame.name[lang]) + '</div>' +
      '</div>';
    el.classList.add('frame-toast-show');
    clearTimeout(showFrameToast._t);
    showFrameToast._t = setTimeout(function () { el.classList.remove('frame-toast-show'); }, 3200);
  }

  // ---------- picker modal ----------

  function methodLabel(method, lang) {
    const map = {
      default: { th: 'พื้นฐาน', en: 'Default' },
      stat: { th: 'ทำภารกิจ', en: 'Progress' },
      badge: { th: 'Badge', en: 'Badge' },
      tier: { th: 'ระดับความยาก', en: 'Tier' },
      date: { th: 'ตามฤดูกาล', en: 'Seasonal' },
      secret: { th: 'ความลับ', en: 'Secret' },
      custom: { th: 'กำหนดเอง', en: 'Custom' }
    };
    return (map[method] && map[method][lang]) || method;
  }

  function frameCardHTML(f, lang) {
    const unlockedNow = isUnlocked(f.id);
    const isEquipped = equipped === f.id && unlockedNow;
    const isSecret = f.method === 'secret' && !unlockedNow;
    const displayName = isSecret ? '???' : f.name[lang];
    const displayDesc = f.desc[lang];
    const ringStyle = f.id === 'frame_custom' && customImage
      ? 'background:center/cover no-repeat url("' + customImage.dataUrl + '")'
      : 'background:' + (f.ring || 'transparent');

    return (
      '<button type="button" class="frame-card' + (unlockedNow ? '' : ' frame-card-locked') + (isEquipped ? ' frame-card-equipped' : '') + '" data-frame-id="' + f.id + '">' +
        '<span class="frame-card-swatch' + (f.motion === 'frameSpin' ? ' frame-motion-spin' : (f.motion === 'framePulse' ? ' frame-motion-pulse' : '')) + '" style="' + ringStyle + '">' +
          (unlockedNow ? '' : '<span class="frame-card-lock">🔒</span>') +
        '</span>' +
        '<span class="frame-card-name">' + escapeHtml(displayName) + '</span>' +
        '<span class="frame-card-method">' + escapeHtml(methodLabel(f.method, lang)) + '</span>' +
        (unlockedNow ? '' : '<span class="frame-card-desc">' + escapeHtml(displayDesc) + '</span>') +
        (isEquipped ? '<span class="frame-card-badge">' + (lang === 'th' ? '✓ ใช้อยู่' : '✓ Equipped') + '</span>' : '') +
      '</button>'
    );
  }

  function renderPickerBody() {
    const lang = currentLang();
    const grid = document.getElementById('framePickerGrid');
    if (!grid) return;
    evaluate();
    const unlockedCount = frameList().filter(function (f) { return isUnlocked(f.id); }).length;
    const countEl = document.getElementById('framePickerCount');
    if (countEl) countEl.textContent = unlockedCount + ' / ' + frameList().length;

    grid.innerHTML = frameList().map(function (f) { return frameCardHTML(f, lang); }).join('');

    grid.querySelectorAll('.frame-card').forEach(function (card) {
      card.addEventListener('click', function () {
        const id = card.getAttribute('data-frame-id');
        if (id === 'frame_custom' && !customImage) {
          const input = document.getElementById('frameCustomFileInput');
          if (input) input.click();
          return;
        }
        if (!isUnlocked(id)) return;
        equip(id);
        renderPickerBody();
        renderNameSettingsAvatarPreview();
      });
    });
  }

  function ensurePickerDom() {
    if (document.getElementById('framePickerOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'framePickerOverlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="modal-box frame-picker-box">' +
        '<div class="frame-picker-head">' +
          '<h2 id="framePickerTitle"></h2>' +
          '<span class="frame-picker-count" id="framePickerCount"></span>' +
        '</div>' +
        '<div class="frame-picker-grid" id="framePickerGrid"></div>' +
        '<div class="frame-picker-custom-row">' +
          '<button type="button" class="btn btn-outline btn-sm" id="frameCustomUploadBtn"></button>' +
          '<button type="button" class="btn btn-outline btn-sm" id="frameCustomClearBtn" hidden></button>' +
          '<input type="file" id="frameCustomFileInput" accept="image/*" hidden>' +
        '</div>' +
        '<div class="modal-close-row" style="justify-content:flex-end">' +
          '<button type="button" class="btn btn-teal btn-sm" id="framePickerCloseBtn"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('framePickerCloseBtn').addEventListener('click', closePicker);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePicker(); });

    document.getElementById('frameCustomUploadBtn').addEventListener('click', function () {
      document.getElementById('frameCustomFileInput').click();
    });
    document.getElementById('frameCustomClearBtn').addEventListener('click', function () {
      clearCustomImage();
      renderPickerBody();
      syncCustomButtonsLabel();
      renderNameSettingsAvatarPreview();
    });
    document.getElementById('frameCustomFileInput').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      setCustomImageFromFile(file).then(function () {
        renderPickerBody();
        syncCustomButtonsLabel();
        renderNameSettingsAvatarPreview();
      }).catch(function (err) {
        const lang = currentLang();
        const msg = err && err.message === 'too_large'
          ? (lang === 'th' ? 'ไฟล์รูปใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง' : 'Image is too large, please choose a smaller file')
          : (lang === 'th' ? 'อัปโหลดรูปไม่สำเร็จ' : 'Failed to upload image');
        if (typeof global.showToast === 'function') global.showToast(msg);
        else alert(msg);
      });
    });
  }

  function syncCustomButtonsLabel() {
    const lang = currentLang();
    const uploadBtn = document.getElementById('frameCustomUploadBtn');
    const clearBtn = document.getElementById('frameCustomClearBtn');
    if (uploadBtn) uploadBtn.textContent = customImage
      ? (lang === 'th' ? '🖼️ เปลี่ยนรูปกรอบกำหนดเอง' : '🖼️ Change custom frame image')
      : (lang === 'th' ? '🖼️ อัปโหลดรูปกรอบกำหนดเอง' : '🖼️ Upload custom frame image');
    if (clearBtn) { clearBtn.hidden = !customImage; clearBtn.textContent = lang === 'th' ? '🗑️ ลบรูปกำหนดเอง' : '🗑️ Remove custom image'; }
  }

  function openPicker() {
    ensurePickerDom();
    const lang = currentLang();
    document.getElementById('framePickerTitle').textContent = lang === 'th' ? '🖼️ กรอบรูปโปรไฟล์' : '🖼️ Avatar Frames';
    document.getElementById('framePickerCloseBtn').textContent = lang === 'th' ? 'ปิด' : 'Close';
    syncCustomButtonsLabel();
    renderPickerBody();
    const overlay = document.getElementById('framePickerOverlay');
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('modal-overlay-show'); });
  }

  function closePicker() {
    const overlay = document.getElementById('framePickerOverlay');
    if (!overlay) return;
    overlay.classList.remove('modal-overlay-show');
    setTimeout(function () { overlay.hidden = true; }, 200);
  }

  // ---------- Settings-tab "Profile" section (name + frame entry point) ----------

  function renderNameSettingsAvatarPreview() {
    const preview = document.getElementById('profileNamePreviewFrame');
    if (preview) applyFrameTo(preview);
  }

  function mountSettingsSection() {
    const host = document.getElementById('profileSettingsSection');
    if (!host) return;
    const lang = currentLang();
    const prevName = document.getElementById('profileNameInput');
    const pendingValue = prevName ? prevName.value : getCustomName();

    host.innerHTML =
      '<div class="section-heading">' + (lang === 'th' ? 'โปรไฟล์' : 'Profile') + '</div>' +
      '<div class="field" style="margin-bottom:1rem">' +
        '<label>' + (lang === 'th' ? 'ชื่อที่แสดง (Custom)' : 'Display name (Custom)') + '</label>' +
        '<div class="control-row" style="align-items:center">' +
          '<span class="auth-avatar-frame" id="profileNamePreviewFrame" style="width:2.6rem;height:2.6rem"></span>' +
          '<input type="text" id="profileNameInput" maxlength="40" placeholder="' + (lang === 'th' ? 'พิมพ์ชื่อที่ต้องการแสดง...' : 'Type a display name...') + '" style="flex:1;min-width:0">' +
          '<button type="button" class="btn btn-outline btn-sm" id="profileNameSaveBtn">' + (lang === 'th' ? '💾 บันทึก' : '💾 Save') + '</button>' +
        '</div>' +
        '<p class="field-hint">' + (lang === 'th' ? 'เว้นว่างไว้เพื่อใช้ชื่อจากบัญชี Google ตามปกติ' : 'Leave blank to use your Google account name as usual') + '</p>' +
      '</div>' +
      '<div class="field">' +
        '<label>' + (lang === 'th' ? 'กรอบรูปโปรไฟล์' : 'Avatar frame') + '</label>' +
        '<button type="button" class="btn btn-teal btn-sm" id="profileOpenFramePickerBtn">' + (lang === 'th' ? '🖼️ เลือกกรอบรูปโปรไฟล์' : '🖼️ Choose avatar frame') + '</button>' +
      '</div>';

    const nameInput = document.getElementById('profileNameInput');
    if (nameInput) nameInput.value = pendingValue;
    renderNameSettingsAvatarPreview();

    const saveBtn = document.getElementById('profileNameSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      setCustomName(nameInput ? nameInput.value : '');
      if (typeof global.showToast === 'function') {
        global.showToast(lang === 'th' ? 'บันทึกชื่อแล้ว' : 'Name saved');
      }
    });

    const openBtn = document.getElementById('profileOpenFramePickerBtn');
    if (openBtn) openBtn.addEventListener('click', openPicker);
  }

  // ---------- init ----------

  function init() {
    unlocked = loadJSON(UNLOCKED_KEY, {});
    equipped = localStorage.getItem(EQUIPPED_KEY) || 'frame_none';
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      customImage = raw ? JSON.parse(raw) : null;
    } catch (e) { customImage = null; }
    evaluate();
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    mountSettingsSection();
    refreshAllMounted();
    // app.js owns the language chips and doesn't know about this module —
    // listen alongside it so the Profile section's th/en text stays in
    // sync when the user switches language, without touching app.js.
    ['langThBtn', 'langEnBtn'].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () { mountSettingsSection(); });
    });
  });

  // Re-evaluate + repaint after every Achievements.record() call — not just
  // when a badge happens to unlock in the same call, since several frame
  // thresholds (app-open count, combined score, etc.) don't mirror any
  // existing badge 1:1. Chains any pre-existing listener.
  const prevOnAchievementsRecorded = global.onAchievementsRecorded;
  global.onAchievementsRecorded = function (eventName, stats) {
    if (typeof prevOnAchievementsRecorded === 'function') {
      try { prevOnAchievementsRecorded(eventName, stats); } catch (e) { /* ignore */ }
    }
    evaluate();
    refreshAllMounted();
  };

  global.Frames = {
    init: init,
    evaluate: evaluate,
    getEquippedFrame: getEquippedFrame,
    applyFrameTo: applyFrameTo,
    equip: equip,
    isUnlocked: isUnlocked,
    openPicker: openPicker,
    getCustomName: getCustomName,
    setCustomName: setCustomName,
    mountSettingsSection: mountSettingsSection
  };
})(window);
