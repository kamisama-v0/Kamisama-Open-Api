// WatchTracker popup — vanilla JS (MV3, tanpa bundler).
// PROD default. Untuk dev lokal, ganti sementara ke 'http://localhost:3000'.
const API_BASE = 'https://elysia.kamisama-v0.my.id';

let authToken = null;
let currentGroup = '';

const $ = (id) => document.getElementById(id);

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${authToken}`, ...extra };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// --- Auth (Better-Auth email+password) ---
async function login() {
  const email = $('emailInput').value.trim();
  const password = $('passwordInput').value;
  $('loginError').textContent = '';
  try {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Login gagal');
    // better-auth bearer plugin mengembalikan token sesi
    const token = data.token || data.session?.token;
    if (!token) throw new Error('Token tidak ditemukan di respons login');
    authToken = token;
    await chrome.storage.local.set({ token, user: data.user });
    await boot();
  } catch (e) {
    $('loginError').textContent = e.message;
  }
}

async function logout() {
  await chrome.storage.local.remove(['token', 'user']);
  authToken = null;
  currentGroup = '';
  renderAuth();
}

// --- Groups ---
async function loadGroups() {
  const { data } = await api('/watch/groups');
  const sel = $('groupSelect');
  sel.innerHTML = '<option value="">Select Group...</option>';
  data.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.provider} - ${g.name}`;
    sel.appendChild(opt);
  });
  if (currentGroup) sel.value = currentGroup;
}

async function addGroup() {
  const name = window.prompt('Nama grup? (mis. Netflix - Personal)');
  if (!name) return;
  const provider = window.prompt('Provider? (mis. netflix, youtube, viu)') || 'custom';
  await api('/watch/groups', { method: 'POST', body: JSON.stringify({ name, provider }) });
  await loadGroups();
}

// --- History ---
async function loadHistory() {
  const box = $('historyItems');
  if (!currentGroup) {
    box.innerHTML = '<div class="loading">Pilih grup untuk melihat riwayat</div>';
    return;
  }
  box.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const { data } = await api(`/watch/history?groupId=${encodeURIComponent(currentGroup)}&limit=20`);
    if (data.length === 0) {
      box.innerHTML = '<div class="loading">Belum ada riwayat</div>';
      return;
    }
    box.innerHTML = data.map((item) => `
      <div class="history-item">
        <div class="title">${esc(item.title)}</div>
        <div class="meta">
          <span class="episode">${esc(item.episode)}</span>
          <span>⏱ ${esc(item.timestamp)}</span>
          <span class="provider">${esc(item.provider)}</span>
        </div>
        ${item.previousLog ? `<div class="previous">⬅ Sebelumnya: ${esc(item.previousLog.episode)} di ${esc(item.previousLog.timestamp)}</div>` : ''}
      </div>`).join('');
    // Bangun map watched (videoId -> judul) untuk badge di halaman /title.
    try {
      if (window.WTTitles) {
        const map = {};
        for (const item of data) {
          const mm = String(item.url || '').match(/\/(?:id-en\/)?(?:watch|title)\/(\d+)/);
          if (mm) map[mm[1]] = { title: item.title || '', at: Date.now() };
        }
        const cur = await chrome.storage.local.get(['wtWatched']);
        await chrome.storage.local.set({
          wtWatched: { ...((cur && cur.wtWatched) || {}), ...map }
        });
      }
    } catch (e) {
      /* abaikan */
    }
  } catch (e) {
    box.innerHTML = `<div class="loading">${esc(e.message)}</div>`;
  }
}

// --- Deteksi tab aktif + metadata video (v2: falcor-first) ---
// wtDetectFn HARUS self-contained (tanpa referensi luar) karena diserialisasi
// oleh chrome.scripting.executeScript dengan world: 'MAIN' (butuh akses
// window.netflix.falcorCache yang tak terlihat dari isolated world).
// JAGA SELARAS dengan wtDetect() di content/watch-detector.js (duplikat sadar).
function wtDetectFn() {
  const pad = (n) => String(n).padStart(2, '0');
  const toTs = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  };
  const txt = (el) => ((el && el.textContent) || '').trim().replace(/\s+/g, ' ');
  const q = (sel, root) => (root || document).querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const v = document.querySelector('video');
  if (!v) return null;

  let title = '';
  let season = '';
  let episode = '';
  let episodeTitle = '';
  let type = '';
  let videoId = '';

  const cleanTitle = (t) =>
    (t || '')
      .replace(/^\s*Watch\s+/i, '')
      .split(/\s*\|\s*/)[0]
      .split(/\s+-\s+/)[0]
      .trim();

  const normEp = (raw) => {
    if (!raw) return null;
    let m = String(raw).match(/S\s*(\d+)\s*:?\s*E\s*(\d+)/i);
    if (m) return { season: 'S' + parseInt(m[1], 10), episode: 'E' + parseInt(m[2], 10) };
    m = String(raw).match(/Season\s*(\d+)\s*Episode\s*(\d+)/i);
    if (m) return { season: 'S' + parseInt(m[1], 10), episode: 'E' + parseInt(m[2], 10) };
    m = String(raw).match(/Episode\s*(\d+)/i);
    if (m) return { season: '', episode: 'E' + parseInt(m[1], 10) };
    m = String(raw).match(/(?:^|[\s:(])E\s*(\d+)(?:\s|:|$)/i);
    if (m) return { season: '', episode: 'E' + parseInt(m[1], 10) };
    return null;
  };

  // 0a. videoId — sync, sebelum wake
  try {
    const player0 = q('[data-uia="player"]');
    videoId = (player0 && player0.getAttribute('data-videoid')) || '';
    if (!videoId) {
      const m0 = (location.pathname || '').match(/\/watch\/(\d+)/);
      if (m0) videoId = m0[1];
    }
  } catch (e) {
    videoId = '';
  }

  // 0b. WAKE + baca — dibungkus promise karena perlu sleep.
  // Robustness: baca DOM diulang maks 3x (jeda 700ms) karena kontrol player
  // kadang belum render saat baca pertama. Nilai yang sudah ketemu TIDAK
  // ditimpa yang kosong. Tidak pernah throw: gagal semua = string kosong.
  const readOnce = () => {
    const got = { title: '', season: '', episode: '', episodeTitle: '', scopeText: '' };
    // 1. [data-uia="video-title"] (ground-truth) — 2 varian:
    //    A: <h4>SHOW</h4><span>E1</span><span>EP_TITLE</span>
    //    B: teks langsung milik div (film / tanpa h4+span).
    try {
      const vt = q('[data-uia="video-title"]');
      if (vt) {
        try {
          const parts = [];
          const nodes = vt.childNodes;
          for (const n of nodes) {
            if (n.nodeType === 3) {
              const dt = ((n.textContent || '').trim().replace(/\s+/g, ' '));
              if (dt) parts.push(dt);
            }
          }
          if (parts.length > 0) got.title = parts.join(' ');
        } catch (e) {
          /* abaikan */
        }
        const h = vt.querySelector('h4');
        const t = txt(h);
        if (t) got.title = t;
        const spans = [...vt.querySelectorAll(':scope > span')].map(txt).filter(Boolean);
        if (spans.length > 0) {
          const ne = normEp(spans[0]);
          if (ne) {
            if (ne.season) got.season = ne.season;
            if (ne.episode) got.episode = ne.episode;
          }
        }
        if (spans.length > 1) got.episodeTitle = spans[1];
      }
    } catch (e) {
      /* abaikan */
    }
    // 3. status bar generik
    if (!got.title || !got.episode) {
      try {
        const root = q('[data-uia="player"]') || document;
        const h4s = root.querySelectorAll('h4');
        for (const h of h4s) {
          const t = txt(h);
          if (!t || /^(netflix|skip|back|play|pause)$/i.test(t)) continue;
          const scope = h.parentElement ? txt(h.parentElement) : '';
          if (!got.title) {
            got.title = t;
            got.scopeText = scope;
          }
          if (got.title && /S\d|E\d+|Episode|Season/i.test(scope)) {
            got.scopeText = scope;
            break;
          }
        }
      } catch (e) {
        /* abaikan */
      }
    }
    return got;
  };

  return (async () => {
    try {
      const player = q('[data-uia="player"]');
      if (player) {
        player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true }));
        await sleep(650);
      }
    } catch (e) {
      /* abaikan */
    }

    let got = { title: '', season: '', episode: '', episodeTitle: '', scopeText: '' };
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = readOnce();
      if (r.title && !got.title) {
        got.title = r.title;
        got.scopeText = r.scopeText;
      }
      if (r.season && !got.season) got.season = r.season;
      if (r.episode && !got.episode) {
        got.episode = r.episode;
        got.scopeText = r.scopeText || got.scopeText;
      }
      if (r.episodeTitle && !got.episodeTitle) got.episodeTitle = r.episodeTitle;
      if (got.title && got.episode) break;
      if (attempt < 2) await sleep(700);
    }
    title = got.title;
    season = got.season;
    episode = got.episode;
    episodeTitle = got.episodeTitle;
    let scopeText = got.scopeText;

    // 2. falcorCache (best-effort, MAIN world only)
    try {
      const nf = window.netflix || null;
      const fc = nf && (nf.falcorCache || nf);
      const videos = fc && fc.videos;
      const entry = videoId && videos ? videos[videoId] : null;
      const val =
        entry && entry.summary && typeof entry.summary.value === 'object'
          ? entry.summary.value
          : null;
      if (val) {
        if (val.type) type = String(val.type);
        if (!season && val.season !== undefined && val.season !== null && val.season !== '') {
          const n = parseInt(val.season, 10);
          if (!isNaN(n)) season = 'S' + n;
        }
        if (!episode && val.episode !== undefined && val.episode !== null && val.episode !== '') {
          const n = parseInt(val.episode, 10);
          if (!isNaN(n)) episode = 'E' + n;
        }
      }
    } catch (e) {
      /* abaikan */
    }

    // 3. status bar generik + meta tags
    if (!title) {
      try {
        const meta = q('meta[property="og:title"]') || q('meta[name="twitter:title"]');
        const mc = meta && meta.getAttribute('content');
        if (mc) title = cleanTitle(mc);
      } catch (e) {
        /* abaikan */
      }
    }
    // (status bar generik sudah dicover readOnce di atas — tidak diduplikasi)
    if (!title) title = cleanTitle(document.title);

    // 4. regex fallback
    try {
      const hay = [scopeText, episodeTitle, document.title].join(' | ');
      if (!season || !episode) {
        const m = hay.match(/S\s*(\d+)\s*:?\s*E\s*(\d+)/i);
        if (m) {
          if (!season) season = 'S' + parseInt(m[1], 10);
          if (!episode) episode = 'E' + parseInt(m[2], 10);
        }
      }
      if (!season) {
        const m = hay.match(/Season\s*(\d+)/i);
        if (m) season = 'S' + parseInt(m[1], 10);
      }
      if (!episode) {
        const ne = normEp(hay);
        if (ne && ne.episode) episode = ne.episode;
      }
    } catch (e) {
      /* abaikan */
    }

    return {
      timestamp: toTs(v.currentTime),
      duration: Math.floor(v.duration || 0),
      title: title,
      season: season,
      episode: episode,
      episodeTitle: episodeTitle,
      type: type,
      videoId: videoId,
      paused: !!v.paused
    };
  })();
}

async function detectCurrentTab() {
  let tab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs && tabs[0];
  } catch (e) {
    tab = null;
  }
  const url = (tab && (tab.url || tab.pendingUrl)) || '';
  $('urlDisplay').textContent = url || 'Tidak ada tab aktif';
  if (!tab || !tab.id) {
    $('videoInfo').textContent = 'Tidak ada tab aktif';
    return;
  }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: wtDetectFn
    });
    const result = injection && injection.result;
    if (result) {
      const ep = [result.season, result.episode].filter(Boolean).join(' ');
      const epTitle = result.episodeTitle ? ` "${result.episodeTitle}"` : '';
      const label = (result.title || result.videoId || '(tanpa judul)') + epTitle;
      $('videoInfo').textContent = `\u23F1 ${result.timestamp} \u2014 ${label}`;
      $('timestampInput').value = result.timestamp;
      if (ep) $('episodeInput').value = ep;
      chrome.storage.local.set({
        currentWatch: {
          url,
          title: result.title,
          duration: result.duration,
          videoId: result.videoId || ''
        }
      });
    } else {
      $('videoInfo').textContent = 'Tidak ada video terdeteksi di tab ini';
    }
  } catch (e) {
    $('videoInfo').textContent = 'Tidak bisa akses tab ini (' + (e.message || e) + ')';
  }
}

async function saveProgress() {
  if (!currentGroup) {
    alert('Pilih grup dulu');
    return;
  }
  const { currentWatch } = await chrome.storage.local.get(['currentWatch']);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const episode = $('episodeInput').value.trim();
  const timestamp = $('timestampInput').value.trim();
  if (!episode || !timestamp) {
    alert('Isi episode dan timestamp');
    return;
  }
  try {
    const res = await api('/watch/history', {
      method: 'POST',
      body: JSON.stringify({
        groupId: currentGroup,
        title: (currentWatch?.title || tab?.title || 'Unknown').slice(0, 200),
        episode,
        timestamp,
        url: currentWatch?.url || tab?.url || '',
        duration: currentWatch?.duration || 0
      })
    });
    // Sinkron ke auto-tracker agar tidak dobel POST (format key sama dgn worker).
    if (res && res.data && res.data.id) {
      const key = [
        currentGroup,
        (currentWatch && currentWatch.videoId) || currentWatch?.url || tab?.url || '',
        episode,
        currentWatch?.title || tab?.title || 'Unknown'
      ].join('|');
      chrome.storage.local.set({ lastTrack: { key, entryId: res.data.id } });
    }
    $('episodeInput').value = '';
    await loadHistory();
  } catch (e) {
    alert(`Gagal menyimpan: ${e.message}`);
  }
}

// --- Boot ---
function renderAuth() {
  const loggedIn = !!authToken;
  $('loginSection').hidden = loggedIn;
  $('mainSection').hidden = !loggedIn;
}

async function boot() {
  renderAuth();
  if (!authToken) return;
  try {
    const { user, currentGroup: savedGroup } = await chrome.storage.local.get(['user', 'currentGroup']);
    if (savedGroup) currentGroup = savedGroup;
    $('userName').textContent = user?.name || user?.email || 'User';
    await loadGroups();
    await loadHistory();
    await detectCurrentTab();
  } catch (e) {
    if (String(e.message).includes('401') || String(e.message).toLowerCase().includes('unauthorized')) {
      await logout();
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const { token } = await chrome.storage.local.get(['token']);
  if (token) authToken = token;
  $('loginBtn').addEventListener('click', login);
  $('logoutBtn').addEventListener('click', logout);
  $('addGroupBtn').addEventListener('click', addGroup);
  $('saveBtn').addEventListener('click', saveProgress);
  // Ambil = force refresh judul: hapus cache ID ini, detect ulang, minta
  // content script fetch ulang + kirim progres terbaru.
  $('grabTimeBtn').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = (tab && (tab.url || '')) || '';
      const m = url.match(/\/(?:id-en\/)?(?:watch|title)\/(\d+)/);
      if (m && window.WTTitles) {
        await window.WTTitles.clearTitle(m[1]);
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'WT_REFRESH_TITLE', videoId: m[1] }).catch(() => {});
        }
      }
    } catch (e) {
      /* abaikan */
    }
    await detectCurrentTab();
  });
  $('groupSelect').addEventListener('change', (e) => {
    currentGroup = e.target.value;
    chrome.storage.local.set({ currentGroup });
    loadHistory();
  });
  await boot();
});
