/* =========================================================
   Recent Updates — GitHub Commits feed (no database)
   -----------------------------------------------------------
   ตั้งค่า GITHUB_OWNER / GITHUB_REPO ด้านล่างให้ตรงกับ repo จริง
   ของเว็บ ระบบจะดึง commit ล่าสุดจาก GitHub REST API มาแสดงเป็น
   Timeline ในหน้า Setting โดยไม่ใช้ฐานข้อมูลใด ๆ ทั้งสิ้น —
   ข้อมูลทั้งหมดมาจาก fetch() สด ๆ ทุกครั้งที่เปิด modal
   ========================================================= */

(function () {
  'use strict';

  // ---------- 1) ตั้งค่า repo ที่นี่ ----------
  const GITHUB_OWNER = 'Pxxny';
  const GITHUB_REPO  = 'peonycsw24';
  // ทางเลือก: ระบุ branch เจาะจง (ปล่อยว่างไว้ = branch default ของ repo)
  const GITHUB_BRANCH = '';
  // จำนวน commit ต่อหน้า (GitHub API รองรับสูงสุด 100)
  const PER_PAGE = 15;

  const API_BASE = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/commits';
  const REPO_URL = 'https://github.com/' + GITHUB_OWNER + '/' + GITHUB_REPO;
  const LAST_SEEN_KEY = 'ru_last_seen_sha_v1';

  // ---------- 2) การจัดหมวดจาก commit message ----------
  // อ่านคำนำหน้าตาม Conventional Commits และ emoji ที่นิยมใช้กัน
  function classifyCommit(message) {
    const head = (message.split('\n')[0] || '').trim();
    const low = head.toLowerCase();

    const isFix = /^fix(\(|:|!)/.test(low) || /🐛|🚑|🩹/.test(head) || /\bfix(ed|es)?\b/.test(low);
    const isFeat = /^feat(\(|:|!)/.test(low) || /✨|🎉/.test(head) || /\bfeature\b/.test(low) || /\badd(ed)?\b/.test(low);
    const isUi = /^style(\(|:|!)/.test(low) || /🎨|💄/.test(head) || /\bui\b/.test(low) || /\bux\b/.test(low) || /\bdesign\b/.test(low);
    const isImprove = /^(refactor|perf|chore)(\(|:|!)/.test(low) || /🔧|⚡|♻️/.test(head) || /\bimprove(ment)?\b/.test(low) || /\boptimi[sz]e\b/.test(low);

    if (isFix) return 'fix';
    if (isUi) return 'ui';
    if (isImprove) return 'improve';
    if (isFeat) return 'feature';
    return 'feature'; // ค่าเริ่มต้น: ถือเป็น feature ทั่วไปถ้าไม่เข้าเงื่อนไขไหนเลย
  }

  const KIND_META = {
    feature: { label: 'Feature', emoji: '✨', badgeClass: 'ru-badge-feature' },
    fix:     { label: 'Fix',     emoji: '🐛', badgeClass: 'ru-badge-fix' },
    ui:      { label: 'UI',      emoji: '🎨', badgeClass: 'ru-badge-ui' },
    improve: { label: 'Improvement', emoji: '🔧', badgeClass: 'ru-badge-improve' }
  };

  // ---------- 3) state ----------
  let currentPage = 1;
  let currentFilter = 'all';
  let isLoading = false;
  let reachedEnd = false;
  let allLoadedCommits = []; // เก็บ commit ที่โหลดมาแล้วทั้งหมด (สะสมทีละหน้า)

  // ---------- 4) helpers ----------
  function formatDateTime(iso) {
    try {
      const d = new Date(iso);
      const datePart = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      return datePart + ' · ' + timePart;
    } catch (e) {
      return iso;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function firstLine(message) {
    return (message || '').split('\n')[0].trim();
  }

  // ---------- 5) DOM refs (resolved lazily, page uses app.js's own init pattern) ----------
  function els() {
    return {
      openBtn: document.getElementById('ruOpenBtn'),
      closeBtn: document.getElementById('ruCloseBtn'),
      overlay: document.getElementById('ruModalOverlay'),
      filterRow: document.getElementById('ruFilterRow'),
      scroll: document.getElementById('ruTimelineScroll'),
      timeline: document.getElementById('ruTimeline'),
      stateBox: document.getElementById('ruStateBox'),
      loadMoreRow: document.getElementById('ruLoadMoreRow'),
      loadMoreBtn: document.getElementById('ruLoadMoreBtn'),
      newDot: document.getElementById('ruNewDot')
    };
  }

  // ---------- 6) render states ----------
  function showState(html) {
    const e = els();
    e.stateBox.hidden = false;
    e.stateBox.innerHTML = html;
    e.timeline.hidden = true;
    e.loadMoreRow.hidden = true;
  }

  function showLoadingState() {
    showState('<div class="ru-spinner"></div><div>กำลังโหลดอัปเดต...</div>');
  }

  function showErrorState(message) {
    showState(
      '<span class="ru-emoji">⚠️</span>' +
      '<div>โหลดอัปเดตไม่สำเร็จ</div>' +
      '<div style="font-size:.75rem;margin-top:.3rem;opacity:.8">' + escapeHtml(message || '') + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm ru-retry-btn" id="ruRetryBtn">↻ ลองใหม่</button>'
    );
    const retryBtn = document.getElementById('ruRetryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        loadCommits(1, true);
      });
    }
  }

  function showEmptyState() {
    showState('<span class="ru-emoji">🗒️</span><div>ยังไม่มีอัปเดตในหมวดนี้</div>');
  }

  // ---------- 7) render timeline items ----------
  function renderTimeline() {
    const e = els();
    const filtered = currentFilter === 'all'
      ? allLoadedCommits
      : allLoadedCommits.filter(function (c) { return c.kind === currentFilter; });

    if (filtered.length === 0) {
      showEmptyState();
      // ยังต้องโชว์ Load More ถ้ายังไม่สุด และเป็นไปได้ว่าหน้าถัดไปจะมีของหมวดนี้
      if (!reachedEnd) {
        e.loadMoreRow.hidden = false;
      }
      return;
    }

    e.stateBox.hidden = true;
    e.timeline.hidden = false;
    e.timeline.innerHTML = filtered.map(renderItem).join('');

    // ผูก event คลิกเปิด GitHub
    e.timeline.querySelectorAll('.ru-item-card').forEach(function (card) {
      card.addEventListener('click', function () {
        const url = card.getAttribute('data-url');
        if (url) window.open(url, '_blank', 'noopener');
      });
    });

    e.loadMoreRow.hidden = reachedEnd;
  }

  function renderItem(commit) {
    const meta = KIND_META[commit.kind] || KIND_META.feature;
    return (
      '<li class="ru-item" data-kind="' + commit.kind + '">' +
        '<button type="button" class="ru-item-card" data-url="' + escapeHtml(commit.htmlUrl) + '">' +
          '<div class="ru-item-top">' +
            '<span class="ru-badge ' + meta.badgeClass + '">' + meta.emoji + ' ' + meta.label + '</span>' +
          '</div>' +
          '<div class="ru-item-msg">' + escapeHtml(firstLine(commit.message)) + '</div>' +
          '<div class="ru-item-meta">' +
            '<span>🕘 ' + escapeHtml(formatDateTime(commit.date)) + '</span>' +
            '<span>👤 ' + escapeHtml(commit.author) + '</span>' +
            '<span class="ru-sha">#' + escapeHtml(commit.shaShort) + '</span>' +
          '</div>' +
        '</button>' +
      '</li>'
    );
  }

  // ---------- 8) fetch from GitHub REST API ----------
  function buildApiUrl(page) {
    let url = API_BASE + '?per_page=' + PER_PAGE + '&page=' + page;
    if (GITHUB_BRANCH) url += '&sha=' + encodeURIComponent(GITHUB_BRANCH);
    return url;
  }

  function loadCommits(page, isRetryOrReset) {
    if (isLoading) return;
    isLoading = true;

    const e = els();

    if (page === 1 || isRetryOrReset) {
      allLoadedCommits = [];
      reachedEnd = false;
      currentPage = 1;
      showLoadingState();
    } else {
      e.loadMoreBtn.disabled = true;
      e.loadMoreBtn.textContent = 'กำลังโหลด...';
    }

    fetch(buildApiUrl(page), {
      headers: { 'Accept': 'application/vnd.github+json' }
    })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('ไม่พบ repository — ตรวจสอบค่า GITHUB_OWNER / GITHUB_REPO ในไฟล์ RecentUpdates.js');
          }
          if (res.status === 403) {
            throw new Error('เกิน rate limit ของ GitHub API กรุณาลองใหม่อีกครั้งภายหลัง');
          }
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || data.length === 0) {
          reachedEnd = true;
          if (page === 1) {
            showEmptyState();
          } else {
            renderTimeline();
          }
          return;
        }

        if (data.length < PER_PAGE) reachedEnd = true;

        const mapped = data.map(function (item) {
          const commit = item.commit || {};
          const author = commit.author || {};
          const sha = item.sha || '';
          const message = commit.message || '(no message)';
          return {
            sha: sha,
            shaShort: sha.slice(0, 7),
            message: message,
            date: author.date || (commit.committer && commit.committer.date) || '',
            author: (item.author && item.author.login) || author.name || 'unknown',
            htmlUrl: item.html_url || (REPO_URL + '/commit/' + sha),
            kind: classifyCommit(message)
          };
        });

        allLoadedCommits = allLoadedCommits.concat(mapped);
        currentPage = page;

        // แจ้งเตือนจุดสีบนปุ่ม ถ้ามี commit ใหม่กว่าที่เคยเห็นล่าสุด (เฉพาะตอนโหลดหน้าแรก)
        if (page === 1 && mapped.length > 0) {
          checkForNewUpdates(mapped[0].sha);
        }

        renderTimeline();
      })
      .catch(function (err) {
        if (page === 1) {
          showErrorState(err && err.message ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } else {
          // โหลดหน้าถัดไปไม่สำเร็จ: คงรายการเดิมไว้ แต่แจ้งเตือนสั้น ๆ ที่ปุ่ม
          e.loadMoreBtn.textContent = '↻ ลองโหลดเพิ่มอีกครั้ง';
        }
      })
      .finally(function () {
        isLoading = false;
        e.loadMoreBtn.disabled = false;
        if (!e.loadMoreBtn.disabled && e.loadMoreBtn.textContent === 'กำลังโหลด...') {
          e.loadMoreBtn.textContent = 'โหลดเพิ่ม';
        }
        if (e.loadMoreBtn.textContent === 'กำลังโหลด...') e.loadMoreBtn.textContent = 'โหลดเพิ่ม';
      });
  }

  // ---------- 9) "unread" indicator dot ----------
  function checkForNewUpdates(latestSha) {
    try {
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      const dot = document.getElementById('ruNewDot');
      if (dot) dot.hidden = !lastSeen || lastSeen === latestSha ? true : false;
    } catch (e) { /* localStorage unavailable — ignore silently */ }
  }

  function markAsSeen() {
    try {
      if (allLoadedCommits.length > 0) {
        localStorage.setItem(LAST_SEEN_KEY, allLoadedCommits[0].sha);
      }
      const dot = document.getElementById('ruNewDot');
      if (dot) dot.hidden = true;
    } catch (e) { /* ignore */ }
  }

  // ---------- 10) modal open/close ----------
  function openModal() {
    const e = els();
    e.overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (allLoadedCommits.length === 0) {
      loadCommits(1);
    }
    markAsSeen();
  }

  function closeModal() {
    const e = els();
    e.overlay.hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- 11) filter chips ----------
  function initFilters() {
    const e = els();
    e.filterRow.querySelectorAll('.ru-filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        e.filterRow.querySelectorAll('.ru-filter-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        currentFilter = chip.getAttribute('data-kind');
        renderTimeline();
      });
    });
  }

  // ---------- 12) wire up ----------
  function init() {
    const e = els();
    if (!e.openBtn || !e.overlay) return; // markup not present on this page

    e.openBtn.addEventListener('click', openModal);
    e.closeBtn.addEventListener('click', closeModal);
    e.overlay.addEventListener('click', function (ev) {
      if (ev.target === e.overlay) closeModal();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !e.overlay.hidden) closeModal();
    });
    e.loadMoreBtn.addEventListener('click', function () {
      if (!reachedEnd && !isLoading) loadCommits(currentPage + 1);
    });

    initFilters();

    // ตรวจสอบ badge แจ้งเตือนตั้งแต่โหลดหน้าเว็บ (ไม่ต้องรอเปิด modal)
    fetch(buildApiUrl(1), { headers: { 'Accept': 'application/vnd.github+json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (Array.isArray(data) && data.length > 0 && data[0].sha) {
          checkForNewUpdates(data[0].sha);
        }
      })
      .catch(function () { /* silent — badge check is best-effort */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
