/* =========================================================
   CSW24 Word Lab — Google Login + cloud progress sync (Supabase)
   Pure logic module: no DOM writes, no UI strings here.
   UI lives in js/auth-ui.js and only talks to window.Auth.

   Storage model
   -------------
   Every piece of local progress the app already keeps (Cardbox,
   Achievements/stats, streak, settings, custom words, learn log,
   ...) lives in localStorage under keys prefixed "csw24_" — see
   app.js's collectCsw24Snapshot()/idbRestoreFromBackup(). This
   module reuses that exact convention as the sync unit: it mirrors
   every "csw24_*" localStorage key into a single row in a
   "progress" table (one row per user, jsonb column) on change, and
   restores that same snapshot into localStorage on sign-in. Nothing
   about Cardbox/Achievements/etc. needed to change for this to
   work — they just keep reading/writing localStorage exactly as
   before.

   Setup required before this module does anything
   -------------------------------------------------
   1. Fill in SUPABASE_URL and SUPABASE_ANON_KEY below (Supabase
      dashboard -> Project Settings -> API).
   2. Authentication -> Providers -> enable Google (needs a Google
      Cloud OAuth Client ID/Secret — see setup guide).
   3. Authentication -> URL Configuration -> add this site's URL
      to Redirect URLs (and Site URL), or Google sign-in will
      bounce back to the wrong place.
   4. Run the SQL at the bottom of this file once, in the Supabase
      SQL editor, to create the "profiles" and "progress" tables
      with row-level security.
   Until SUPABASE_URL/SUPABASE_ANON_KEY are filled in,
   Auth.isConfigured() returns false and the rest of the app
   behaves exactly as it did before (guest/localStorage-only), so
   shipping this file with blank values is always safe.
   ========================================================= */

(function (global) {
  'use strict';

  // ---------- 1. Fill this in with your Supabase project's API details --
  const SUPABASE_URL = 'https://rtxyztddzsiitafaaahy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0eHl6dGRkenNpaXRhZmFhYWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MzA3NzIsImV4cCI6MjEwNTQwNjc3Mn0.6IPq8_ZoMBv8u4aO2EM4kiLm4hh56mQcYqAIjeztzD0';
  // -------------------------------------------------------------------

  const CSW24_PREFIX = 'csw24_';
  const LAST_UID_KEY = 'csw24_auth_last_uid_v1';
  const OAUTH_FLAG_KEY = 'csw24_auth_oauth_pending_v1'; // survives the Google redirect round-trip
  const GUEST_BACKUP_KEY = 'csw24_auth_guest_backup_v1'; // permanent safety copy of pre-login guest progress

  let supabase = null;
  let sdkLoadPromise = null;

  let currentUser = null;       // supabase auth user object, or null
  let currentProfile = null;    // { name, email, photoURL }
  let listeners = [];           // onChange subscribers
  let pushTimer = null;
  let suppressNextPush = false; // true right after we just wrote a restore, to avoid re-echoing it straight back up
  let localWatcherInstalled = false;
  let authReady = false;        // true once the initial getSession()/onAuthStateChange has settled at least once

  function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  // ---------- snapshot helpers (mirrors app.js's own convention) ----------

  function collectSnapshot() {
    const snap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(CSW24_PREFIX) === 0 && key !== LAST_UID_KEY && key !== OAUTH_FLAG_KEY && key !== GUEST_BACKUP_KEY) {
        snap[key] = localStorage.getItem(key);
      }
    }
    return snap;
  }

  function hasAnyLocalProgress() {
    return Object.keys(collectSnapshot()).length > 0;
  }

  function applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') return 0;
    let n = 0;
    Object.keys(snap).forEach(function (key) {
      if (key.indexOf(CSW24_PREFIX) !== 0) return; // never let a bad row write outside our namespace
      localStorage.setItem(key, snap[key]);
      n++;
    });
    return n;
  }

  function clearLocalProgress() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(CSW24_PREFIX) === 0 && key !== LAST_UID_KEY && key !== OAUTH_FLAG_KEY && key !== GUEST_BACKUP_KEY) keys.push(key);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  }

  // ---------- lazy Supabase SDK load (UMD build via CDN — no bundler) -----

  function loadSdk() {
    if (sdkLoadPromise) return sdkLoadPromise;
    sdkLoadPromise = new Promise(function (resolve) {
      if (!isConfigured()) { resolve(false); return; }
      if (global.supabase && global.supabase.createClient) {
        supabase = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.async = true;
      script.onload = function () {
        try {
          supabase = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          resolve(true);
        } catch (err) {
          console.error('[Auth] Supabase client init failed', err);
          resolve(false);
        }
      };
      script.onerror = function () {
        console.error('[Auth] Supabase SDK failed to load from CDN');
        resolve(false);
      };
      document.head.appendChild(script);
    });
    return sdkLoadPromise;
  }

  // ---------- profile row + progress row (Supabase Postgres) ----------

  async function ensureUserProfile(user) {
    const meta = user.user_metadata || {};
    const base = {
      id: user.id,
      name: meta.full_name || meta.name || '',
      email: user.email || '',
      photo_url: meta.avatar_url || meta.picture || '',
      last_login_at: new Date().toISOString()
    };
    const { error } = await supabase.from('profiles').upsert(base);
    if (error) throw error;
    return { name: base.name, email: base.email, photoURL: base.photo_url };
  }

  async function fetchCloudSnapshot(uid) {
    const { data, error } = await supabase
      .from('progress')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }

  async function pushCloudSnapshot(uid) {
    if (!supabase || !uid) return;
    const { error } = await supabase
      .from('progress')
      .upsert({ user_id: uid, data: collectSnapshot(), updated_at: new Date().toISOString() });
    if (error) console.error('[Auth] cloud push failed', error);
  }

  function schedulePush() {
    if (!currentUser || !isConfigured()) return;
    if (suppressNextPush) { suppressNextPush = false; return; }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushCloudSnapshot(currentUser.id);
    }, 1500); // debounce so rapid local writes (typing, quizzes) don't spam the DB
  }

  // Watches localStorage writes made by the *current tab* (storage events
  // only fire cross-tab) by wrapping setItem/removeItem once. Cheap, and
  // every other module keeps calling the native-looking localStorage API
  // exactly as before — this is purely an additional side effect.
  function installLocalWatcher() {
    if (localWatcherInstalled) return;
    localWatcherInstalled = true;
    const rawSet = localStorage.setItem.bind(localStorage);
    const rawRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      rawSet(key, value);
      if (key && key.indexOf(CSW24_PREFIX) === 0 && key !== LAST_UID_KEY && key !== OAUTH_FLAG_KEY) schedulePush();
    };
    localStorage.removeItem = function (key) {
      rawRemove(key);
      if (key && key.indexOf(CSW24_PREFIX) === 0 && key !== LAST_UID_KEY && key !== OAUTH_FLAG_KEY) schedulePush();
    };
    window.addEventListener('beforeunload', function () {
      if (currentUser && pushTimer) pushCloudSnapshot(currentUser.id); // best-effort, may not finish
    });
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(getState()); } catch (e) { console.error('[Auth] listener error', e); }
    });
  }

  function getState() {
    return {
      configured: isConfigured(),
      ready: authReady,
      user: currentUser ? {
        uid: currentUser.id,
        name: (currentProfile && currentProfile.name) || '',
        email: (currentProfile && currentProfile.email) || currentUser.email || '',
        photoURL: (currentProfile && currentProfile.photoURL) || ''
      } : null
    };
  }

  // ---------- sign-in / merge-vs-import flow ----------
  //
  // On successful sign-in:
  //   - if the account already has a cloud snapshot -> restore it
  //     (this is "log back in, get old progress back")
  //   - else if this browser has guest progress sitting in localStorage
  //     -> leave it alone and flag pendingGuestImport so the UI can ask
  //        "import your guest progress into this account?"
  //   - else -> nothing to do, start clean

  let pendingGuestImportSnapshot = null;

  async function handleUser(user) {
    if (!user) {
      currentUser = null;
      currentProfile = null;
      authReady = true;
      notify();
      return;
    }
    currentUser = user;
    installLocalWatcher();
    try {
      currentProfile = await ensureUserProfile(user);
    } catch (err) {
      console.error('[Auth] profile sync failed', err);
    }

    try {
      // Always take a permanent backup of whatever is in this browser
      // *before* any cloud snapshot can overwrite it below. This used to
      // only be captured in memory (pendingGuestImportSnapshot) and only
      // when this looked like a brand-new account — so real guest data
      // (Cardbox, Achievements, streaks...) could be silently clobbered
      // by an existing/empty cloud snapshot with no way to get it back.
      // Now it's always written to a dedicated, never-synced localStorage
      // key first, so a "restore my pre-login data" action is always
      // possible later, no matter which branch below runs.
      if (hasAnyLocalProgress()) {
        localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(collectSnapshot()));
      }

      const cloudSnap = await fetchCloudSnapshot(user.id);
      const sameUserAsBefore = localStorage.getItem(LAST_UID_KEY) === user.id;
      if (cloudSnap) {
        suppressNextPush = true;
        applySnapshot(cloudSnap);
      } else if (!sameUserAsBefore && hasAnyLocalProgress()) {
        // Brand-new account (no cloud snapshot yet) but this browser has
        // guest data — don't silently adopt or silently discard it,
        // let the UI offer an explicit choice.
        pendingGuestImportSnapshot = collectSnapshot();
      }
      localStorage.setItem(LAST_UID_KEY, user.id);
    } catch (err) {
      console.error('[Auth] snapshot restore failed', err);
    }

    authReady = true;
    notify();
  }

  // ---------- public API ----------

  async function init() {
    if (!isConfigured()) { authReady = true; notify(); return getState(); }
    const ok = await loadSdk();
    if (!ok) { authReady = true; notify(); return getState(); }

    supabase.auth.onAuthStateChange(function (_event, session) {
      handleUser(session ? session.user : null);
    });

    const { data } = await supabase.auth.getSession();
    await handleUser(data && data.session ? data.session.user : null);
    return getState();
  }

  // Google sign-in on Supabase is redirect-based (the page navigates away
  // to Google and back), not a popup promise like Firebase — so this
  // kicks off the redirect and the *return trip* is picked up by init()'s
  // onAuthStateChange/getSession() above once the page reloads. The
  // OAUTH_FLAG_KEY lets the UI know a sign-in was in flight across that
  // reload (e.g. to keep showing a "signing in..." state briefly).
  async function signInWithGoogle() {
    if (!isConfigured()) throw new Error('not_configured');
    const ok = await loadSdk();
    if (!ok) throw new Error('load_failed');
    localStorage.setItem(OAUTH_FLAG_KEY, '1');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) { localStorage.removeItem(OAUTH_FLAG_KEY); throw error; }
    // Browser is navigating away now; nothing more happens on this page load.
  }

  function wasSigningIn() {
    const v = localStorage.getItem(OAUTH_FLAG_KEY) === '1';
    if (v) localStorage.removeItem(OAUTH_FLAG_KEY);
    return v;
  }

  async function signOutUser() {
    if (currentUser && pushTimer) {
      try { await pushCloudSnapshot(currentUser.id); } catch (e) { /* best effort */ }
    }
    clearTimeout(pushTimer);
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      currentUser = null;
      currentProfile = null;
      notify();
    }
  }

  function onChange(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  function getUser() {
    return getState().user;
  }

  function consumePendingGuestImport() {
    const snap = pendingGuestImportSnapshot;
    pendingGuestImportSnapshot = null;
    return snap;
  }

  // Explicit user choice: push the local (guest) snapshot up into the
  // cloud, overwriting whatever (nothing, in this flow) is there.
  async function importGuestProgress() {
    if (!currentUser) return false;
    await pushCloudSnapshot(currentUser.id);
    pendingGuestImportSnapshot = null;
    return true;
  }

  // Explicit user choice: discard the local guest snapshot and start this
  // account clean (used if they decline the import prompt).
  function discardGuestProgress() {
    clearLocalProgress();
    pendingGuestImportSnapshot = null;
    localStorage.removeItem(GUEST_BACKUP_KEY);
  }

  // ---------- permanent guest backup (recoverable any time, not just at
  // the moment of first sign-in) ----------

  function hasGuestBackup() {
    try {
      const raw = localStorage.getItem(GUEST_BACKUP_KEY);
      return !!(raw && Object.keys(JSON.parse(raw)).length > 0);
    } catch (e) {
      return false;
    }
  }

  // Restores the pre-login backup into the current account: writes it
  // into localStorage (so Cardbox/Achievements/etc. see it immediately)
  // and, if signed in, pushes it to the cloud so it isn't lost again on
  // the next sign-in elsewhere. Does NOT clear the backup afterward, so
  // the user can safely press it again if something looks off.
  async function restoreGuestBackup() {
    const raw = localStorage.getItem(GUEST_BACKUP_KEY);
    if (!raw) return false;
    let snap;
    try { snap = JSON.parse(raw); } catch (e) { return false; }
    suppressNextPush = true;
    applySnapshot(snap);
    if (currentUser) {
      await pushCloudSnapshot(currentUser.id);
    }
    return true;
  }

  global.Auth = {
    isConfigured: isConfigured,
    init: init,
    signInWithGoogle: signInWithGoogle,
    signOut: signOutUser,
    onChange: onChange,
    getUser: getUser,
    wasSigningIn: wasSigningIn,
    hasAnyLocalProgress: hasAnyLocalProgress,
    consumePendingGuestImport: consumePendingGuestImport,
    importGuestProgress: importGuestProgress,
    discardGuestProgress: discardGuestProgress,
    hasGuestBackup: hasGuestBackup,
    restoreGuestBackup: restoreGuestBackup,
    // exposed for a manual "sync now" affordance / debugging
    pushNow: function () { return currentUser ? pushCloudSnapshot(currentUser.id) : Promise.resolve(); }
  };
})(window);

/* =========================================================
   Run once in the Supabase SQL editor to set up storage + RLS:

   create table if not exists public.profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     name text,
     email text,
     photo_url text,
     last_login_at timestamptz,
     created_at timestamptz default now()
   );
   alter table public.profiles enable row level security;
   create policy "profiles: owner read/write"
     on public.profiles for all
     using (auth.uid() = id) with check (auth.uid() = id);

   create table if not exists public.progress (
     user_id uuid primary key references auth.users(id) on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz default now()
   );
   alter table public.progress enable row level security;
   create policy "progress: owner read/write"
     on public.progress for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ========================================================= */
