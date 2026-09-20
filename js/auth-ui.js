/* =========================================================
   CSW24 Word Lab — Google Login UI
   Talks only to window.Auth (js/auth.js). No Firebase calls here,
   no localStorage keys read/written here beyond what Auth exposes —
   keeps auth *logic* and auth *UI* independent so either can change
   without touching the other.
   ========================================================= */

(function () {
  'use strict';

  const STR = {
    th: {
      signIn: 'เข้าสู่ระบบด้วย Google',
      signingIn: 'กำลังเข้าสู่ระบบ...',
      signOut: 'ออกจากระบบ',
      guest: 'ผู้เยี่ยมชม (Guest)',
      guestSub: 'ความคืบหน้าจะถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น',
      notConfigured: 'ยังไม่ได้ตั้งค่า Google Login สำหรับเว็บนี้',
      signInFailed: 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง',
      signedInAs: 'เข้าสู่ระบบแล้ว',
      menuProfile: 'โปรไฟล์',
      menuStats: 'สถิติ',
      menuSettings: 'ตั้งค่า',
      importTitle: '📥 นำเข้าความคืบหน้าแบบ Guest',
      importBody: 'เจอความคืบหน้าที่เล่นแบบ Guest อยู่ในเบราว์เซอร์นี้ ต้องการนำเข้าเข้าบัญชีนี้ไหม? (Cardbox, XP, Streak, Achievement และอื่นๆ)',
      importConfirm: '📥 นำเข้าเลย',
      importSkip: 'เริ่มใหม่ (ไม่นำเข้า)',
      syncedNote: 'ความคืบหน้าซิงก์กับบัญชี Google แล้ว',
      imported: 'นำเข้าความคืบหน้า Guest แล้ว',
      skippedImport: 'เริ่มบัญชีนี้แบบใหม่แล้ว'
    },
    en: {
      signIn: 'Continue with Google',
      signingIn: 'Signing in...',
      signOut: 'Sign out',
      guest: 'Guest',
      guestSub: 'Progress is stored in this browser only.',
      notConfigured: 'Google Login is not configured for this site yet.',
      signInFailed: 'Sign-in failed, please try again.',
      signedInAs: 'Signed in as',
      menuProfile: 'Profile',
      menuStats: 'Stats',
      menuSettings: 'Settings',
      importTitle: '📥 Import guest progress',
      importBody: 'Found progress saved as a guest in this browser. Import it into this account? (Cardbox, XP, Streak, Achievements, and more)',
      importConfirm: '📥 Import',
      importSkip: 'Start fresh (skip)',
      syncedNote: 'Progress is synced to your Google account.',
      imported: 'Guest progress imported.',
      skippedImport: 'Starting this account fresh.'
    }
  };

  function lang() {
    try {
      const raw = localStorage.getItem('csw24_settings_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.lang === 'th' || parsed.lang === 'en')) return parsed.lang;
      }
    } catch (e) { /* ignore */ }
    return 'th';
  }

  function tr(key) {
    const dict = STR[lang()] || STR.th;
    return dict[key] || STR.th[key] || key;
  }

  function toast(msg) {
    // Reuse the app's own toast element/animation if present, otherwise no-op.
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function initials(name, email) {
    const src = (name || email || '?').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- mount points ----------

  function ensureMountPoints() {
    // Sits inside the sidebar header, next to the app title — visible on
    // desktop (sidebar) and on mobile (static header) without any extra
    // layout work, since .app-header is already responsive.
    const header = document.querySelector('.app-header');
    if (header && !document.getElementById('authWidget')) {
      const widget = document.createElement('div');
      widget.id = 'authWidget';
      widget.className = 'auth-widget';
      header.appendChild(widget);
    }

    if (!document.getElementById('authImportOverlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'authImportOverlay';
      overlay.hidden = true;
      overlay.innerHTML =
        '<div class="modal-box">' +
          '<h2 id="authImportTitle"></h2>' +
          '<p class="field-hint" id="authImportBody"></p>' +
          '<div class="modal-close-row" style="justify-content:space-between;gap:.6rem">' +
            '<button type="button" class="btn btn-outline btn-sm" id="authImportSkipBtn"></button>' +
            '<button type="button" class="btn btn-teal btn-sm" id="authImportConfirmBtn"></button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
    }
  }

  function injectStyles() {
    if (document.getElementById('authWidgetStyles')) return;
    const style = document.createElement('style');
    style.id = 'authWidgetStyles';
    style.textContent = [
      '.auth-widget { margin-top: 0.9rem; }',
      '.auth-signin-btn { display:flex; align-items:center; justify-content:center; gap:.55rem;',
      '  width:100%; padding:.5rem .7rem; border-radius:9px; border:1px solid var(--rail);',
      '  background: var(--tile); color: var(--ink); font-family: var(--font-body); font-weight:600;',
      '  font-size:.82rem; cursor:pointer; transition: transform .12s ease, box-shadow .15s ease; }',
      '.auth-signin-btn:hover { box-shadow: 0 2px 10px rgba(124,158,255,.25); }',
      '.auth-signin-btn:disabled { opacity:.6; cursor:default; }',
      '.auth-google-g { width:1rem; height:1rem; flex:0 0 auto; }',
      '.auth-profile { display:flex; align-items:center; gap:.55rem; padding:.4rem .5rem; border-radius:10px;',
      '  background: var(--board-2); border:1px solid var(--rail); cursor:pointer; width:100%; text-align:left; }',
      '.auth-avatar { width:2rem; height:2rem; border-radius:50%; flex:0 0 auto; object-fit:cover;',
      '  background: linear-gradient(160deg, var(--brass), var(--teal)); color:#0D1020; font-weight:700;',
      '  font-size:.78rem; display:flex; align-items:center; justify-content:center; font-family: var(--font-mono); }',
      '.auth-profile-meta { min-width:0; flex:1; }',
      '.auth-profile-name { font-size:.82rem; font-weight:600; color: var(--cream); white-space:nowrap;',
      '  overflow:hidden; text-overflow:ellipsis; }',
      '.auth-profile-sub { font-size:.72rem; color:#8890A8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.auth-menu { position:relative; }',
      '.auth-menu-panel { position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:60;',
      '  background: var(--board-1); border:1px solid var(--rail); border-radius:10px; padding:.4rem;',
      '  box-shadow: 0 14px 40px rgba(0,0,0,.45); }',
      '.auth-menu-panel[hidden] { display:none; }',
      '.auth-menu-item { display:block; width:100%; text-align:left; padding:.5rem .6rem; border-radius:7px;',
      '  background:transparent; border:none; color: var(--cream); font-size:.8rem; cursor:pointer; }',
      '.auth-menu-item:hover { background: var(--board-2); }',
      '.auth-menu-sep { height:1px; margin:.35rem .2rem; background: var(--rail); }',
      '.auth-menu-item-danger { color:#f87171; }',
      '.auth-menu-item-danger:hover { background: rgba(248,113,113,.12); }',
      '@media (max-width: 860px) { .auth-widget { margin-top:.7rem; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function googleGSvg() {
    return '<svg class="auth-google-g" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>' +
      '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.2-17.1 10.3z"/>' +
      '<path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.3 0-9.6-3.1-11.3-7.6l-6.6 5.1C9.9 39.7 16.4 44 24 44z"/>' +
      '<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C41.1 36 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"/>' +
      '</svg>';
  }

  // ---------- rendering ----------

  let menuOpen = false;

  function render(state) {
    const widget = document.getElementById('authWidget');
    if (!widget) return;

    if (!state.configured) {
      // Silently absent when Google Login hasn't been configured yet —
      // rather than showing a broken button, the app just behaves as
      // guest-only (exactly as it did before this feature existed).
      widget.innerHTML = '';
      return;
    }

    if (!state.user) {
      widget.innerHTML =
        '<button type="button" class="auth-signin-btn" id="authSignInBtn">' +
          googleGSvg() + '<span>' + escapeHtml(tr('signIn')) + '</span>' +
        '</button>';
      const btn = document.getElementById('authSignInBtn');
      if (btn) btn.addEventListener('click', handleSignInClick);
      return;
    }

    const u = state.user;
    const av = u.photoURL
      ? '<img class="auth-avatar" src="' + escapeHtml(u.photoURL) + '" alt="" referrerpolicy="no-referrer">'
      : '<span class="auth-avatar">' + escapeHtml(initials(u.name, u.email)) + '</span>';

    widget.innerHTML =
      '<div class="auth-menu">' +
        '<button type="button" class="auth-profile" id="authProfileBtn">' +
          av +
          '<span class="auth-profile-meta">' +
            '<span class="auth-profile-name">' + escapeHtml(u.name || u.email) + '</span>' +
            '<span class="auth-profile-sub">' + escapeHtml(u.email) + '</span>' +
          '</span>' +
        '</button>' +
        '<div class="auth-menu-panel" id="authMenuPanel" hidden>' +
          '<button type="button" class="auth-menu-item" data-tab="dashboard" id="authMenuProfile">👤 ' + escapeHtml(tr('menuProfile')) + '</button>' +
          '<button type="button" class="auth-menu-item" data-tab="stats" id="authMenuStats">📈 ' + escapeHtml(tr('menuStats')) + '</button>' +
          '<button type="button" class="auth-menu-item" data-tab="settings" id="authMenuSettings">⚙️ ' + escapeHtml(tr('menuSettings')) + '</button>' +
          '<div class="auth-menu-sep"></div>' +
          '<button type="button" class="auth-menu-item auth-menu-item-danger" id="authMenuSignOut">🚪 ' + escapeHtml(tr('signOut')) + '</button>' +
        '</div>' +
      '</div>';

    const profileBtn = document.getElementById('authProfileBtn');
    const panel = document.getElementById('authMenuPanel');
    const signOutBtn = document.getElementById('authMenuSignOut');

    if (profileBtn) profileBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menuOpen = !menuOpen;
      panel.hidden = !menuOpen;
    });
    document.addEventListener('click', function () {
      if (menuOpen) { menuOpen = false; if (panel) panel.hidden = true; }
    });
    if (signOutBtn) signOutBtn.addEventListener('click', function () {
      menuOpen = false;
      panel.hidden = true;
      window.Auth.signOut();
    });

    // Profile / Stats / Settings all just switch to an existing tab —
    // wired generically off data-tab so this stays in sync if tab ids change.
    panel.querySelectorAll('.auth-menu-item[data-tab]').forEach(function (item) {
      item.addEventListener('click', function () {
        const tabBtn = document.querySelector('.tab-btn[data-tab="' + item.getAttribute('data-tab') + '"]');
        if (tabBtn) tabBtn.click();
        menuOpen = false;
        panel.hidden = true;
      });
    });
  }

  async function handleSignInClick() {
    // Google sign-in via Supabase redirects the whole page to Google and
    // back — there is no "resolve on this page load" moment to await.
    // This click just kicks the redirect off; the return trip is handled
    // by boot() below (via Auth.init()'s onAuthStateChange) on the next
    // page load.
    const btn = document.getElementById('authSignInBtn');
    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = tr('signingIn'); }
    try {
      await window.Auth.signInWithGoogle();
      // If we get here without navigating away, something's off (e.g.
      // popup blocked redirect) — leave the disabled/"signing in" state
      // as-is briefly, the page is about to unload.
    } catch (err) {
      console.error('[AuthUI] sign-in failed', err);
      toast(err && err.message === 'not_configured' ? tr('notConfigured') : tr('signInFailed'));
      if (btn) { btn.disabled = false; btn.querySelector('span').textContent = tr('signIn'); }
    }
  }

  function handleSignedInLanding() {
    // Runs once, right after Auth.init() resolves with a signed-in user
    // for the first time this page load — covers both a fresh sign-in
    // that just redirected back, and a returning user whose session was
    // already persisted (Supabase keeps the session in localStorage).
    toast(tr('syncedNote'));
    maybeOfferGuestImport();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    const dashBtn = document.querySelector('.tab-btn[data-tab="dashboard"]');
    if (dashBtn) dashBtn.click();
  }

  function maybeOfferGuestImport() {
    const snap = window.Auth.consumePendingGuestImport ? window.Auth.consumePendingGuestImport() : null;
    if (!snap) return;
    const overlay = document.getElementById('authImportOverlay');
    if (!overlay) return;
    document.getElementById('authImportTitle').textContent = tr('importTitle');
    document.getElementById('authImportBody').textContent = tr('importBody');
    const skipBtn = document.getElementById('authImportSkipBtn');
    const confirmBtn = document.getElementById('authImportConfirmBtn');
    skipBtn.textContent = tr('importSkip');
    confirmBtn.textContent = tr('importConfirm');
    overlay.hidden = false;

    function close() { overlay.hidden = true; }

    confirmBtn.onclick = async function () {
      confirmBtn.disabled = true;
      try {
        await window.Auth.importGuestProgress();
        toast(tr('imported'));
      } finally {
        close();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
      }
    };
    skipBtn.onclick = function () {
      window.Auth.discardGuestProgress();
      toast(tr('skippedImport'));
      close();
      window.location.reload(); // fresh account, load its own snapshot (none yet) cleanly
    };
  }

  // ---------- boot ----------

  function boot() {
    ensureMountPoints();
    injectStyles();
    if (!window.Auth) return;
    const returningFromGoogleRedirect = window.Auth.wasSigningIn ? window.Auth.wasSigningIn() : false;
    window.Auth.onChange(render);
    window.Auth.init().then(function (state) {
      render(state);
      if (state.user && returningFromGoogleRedirect) handleSignedInLanding();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
