// WatchTracker service worker — auto-save progres tanpa klik tombol.
// Menerima WT_PROGRESS dari content script, menulis ke API:
//   - video/episode/grup BARU  -> POST /watch/history (simpan entryId)
//   - sama seperti terakhir     -> PATCH /watch/history/:id {timestamp} (hemat rows)
//   - PATCH 404 (entry dihapus) -> POST ulang sekali
// Tanpa token/grup -> badge "!" (user harus login + pilih grup di popup).
// Tanpa judul/episode -> skip round ini (tunggu heartbeat berikut).

const API_BASE = 'https://elysia.kamisama-v0.my.id';

async function api(path, token, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function setBadge(on) {
  try {
    chrome.action.setBadgeText({ text: on ? '!' : '' });
    if (on) chrome.action.setBadgeBackgroundColor({ color: '#f85149' });
  } catch (e) {
    /* abaikan */
  }
}

async function handleProgress(p) {
  const { token, currentGroup, lastTrack } = await chrome.storage.local.get([
    'token',
    'currentGroup',
    'lastTrack'
  ]);
  if (!token || !currentGroup) {
    setBadge(true);
    return;
  }
  if (!p || !p.title) return; // metadata belum lengkap — heartbeat berikut

  const episode = [p.season, p.episode].filter(Boolean).join(' ') || 'Full';
  const key = [currentGroup, p.videoId || p.url || '', episode, p.title].join('|');

  // Kasus A: lanjutan yang sama -> PATCH ringan
  if (lastTrack && lastTrack.key === key && lastTrack.entryId) {
    try {
      await api(`/watch/history/${lastTrack.entryId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ timestamp: p.timestamp, duration: p.duration || 0 })
      });
      setBadge(false);
      return;
    } catch (e) {
      if (e.status !== 404) {
        if (e.status === 401) setBadge(true);
        return; // error lain (validasi/network) — coba lagi heartbeat berikut
      }
      // 404: entry hilang -> jatuh ke POST di bawah
    }
  }

  // Kasus B: video/episode/grup baru (atau PATCH 404) -> POST
  try {
    const res = await api('/watch/history', token, {
      method: 'POST',
      body: JSON.stringify({
        groupId: currentGroup,
        title: p.title.slice(0, 200),
        episode: episode.slice(0, 100),
        timestamp: p.timestamp,
        url: (p.url || '').slice(0, 2000),
        duration: p.duration || 0
      })
    });
    const entryId = res && res.data && res.data.id;
    if (entryId) {
      await chrome.storage.local.set({ lastTrack: { key, entryId } });
    }
    await noteWatched(p.url, p.title);
    setBadge(false);
  } catch (e) {
    if (e.status === 401) setBadge(true);
  }
}

async function noteWatched(url, title) {
  try {
    const m = String(url || '').match(/\/(?:id-en\/)?(?:watch|title)\/(\d+)/);
    if (!m) return;
    const cur = await chrome.storage.local.get(['wtWatched']);
    const map = (cur && cur.wtWatched) || {};
    map[m[1]] = { title: title || '', at: Date.now() };
    await chrome.storage.local.set({ wtWatched: map });
  } catch (e) {
    /* abaikan */
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'WT_PROGRESS') {
    handleProgress(msg.payload).catch(() => {});
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[WatchTracker] installed (auto-save aktif)');
});
