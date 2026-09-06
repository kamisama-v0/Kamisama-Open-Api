// WTTitles — helper judul + badge, dipakai popup DAN content script.
// Plain script (tanpa modules): window.WTTitles. DECLARE di popup.html dan
// manifest content_scripts SEBELUM file pemakainya. Tidak ada dependensi.
// CATATAN fetch: hanya boleh dipanggil dari konteks netflix.com
// (content script / injected func) — JANGAN dari popup (cross-origin).
window.WTTitles = (() => {
  const CACHE_KEY = 'wtTitles';
  const WATCHED_KEY = 'wtWatched';
  const DISMISSED_KEY = 'wtDismissed';

  function cleanTitle(t) {
    return (t || '')
      .replace(/^\s*Watch\s+/i, '')
      .split(/\s*\|\s*/)[0]
      .split(/\s+-\s+/)[0]
      .trim();
  }

  function extractId(url) {
    const m = String(url || '').match(/\/(?:id-en\/)?(?:watch|title)\/(\d+)/);
    return m ? m[1] : '';
  }

  async function readMap(key) {
    try {
      const o = await chrome.storage.local.get([key]);
      return o[key] || {};
    } catch (e) {
      return {};
    }
  }

  async function getCachedTitle(id) {
    if (!id) return '';
    const m = await readMap(CACHE_KEY);
    return (m[id] && m[id].title) || '';
  }

  async function storeTitle(id, title) {
    if (!id || !title) return;
    const m = await readMap(CACHE_KEY);
    m[id] = { title, at: Date.now() };
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: m });
    } catch (e) {
      /* abaikan */
    }
  }

  async function clearTitle(id) {
    if (!id) return;
    const m = await readMap(CACHE_KEY);
    if (m[id]) {
      delete m[id];
      try {
        await chrome.storage.local.set({ [CACHE_KEY]: m });
      } catch (e) {
        /* abaikan */
      }
    }
  }

  // HANYA dari konteks netflix.com (content script / injected MAIN func).
  async function fetchTitle(id) {
    if (!id) return '';
    const url = 'https://www.netflix.com/id-en/title/' + encodeURIComponent(id);
    const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const t = doc.querySelector('title');
    return cleanTitle(t ? t.textContent : '');
  }

  // Resolve lengkap: cache -> fetch -> simpan. Throw bila gagal total.
  async function resolveTitle(id) {
    const cached = await getCachedTitle(id);
    if (cached) return { title: cached, fromCache: true };
    const title = await fetchTitle(id);
    if (title) await storeTitle(id, title);
    return { title, fromCache: false };
  }

  async function markWatched(id, title) {
    if (!id) return;
    const m = await readMap(WATCHED_KEY);
    m[id] = { title: title || '', at: Date.now() };
    try {
      await chrome.storage.local.set({ [WATCHED_KEY]: m });
    } catch (e) {
      /* abaikan */
    }
  }

  async function isWatched(id) {
    if (!id) return null;
    const m = await readMap(WATCHED_KEY);
    return m[id] || null;
  }

  async function isDismissed(id) {
    if (!id) return false;
    const m = await readMap(DISMISSED_KEY);
    return !!m[id];
  }

  async function dismiss(id) {
    if (!id) return;
    const m = await readMap(DISMISSED_KEY);
    m[id] = true;
    try {
      await chrome.storage.local.set({ [DISMISSED_KEY]: m });
    } catch (e) {
      /* abaikan */
    }
  }

  return {
    cleanTitle,
    extractId,
    getCachedTitle,
    storeTitle,
    clearTitle,
    fetchTitle,
    resolveTitle,
    markWatched,
    isWatched,
    isDismissed,
    dismiss,
    CACHE_KEY,
    WATCHED_KEY,
    DISMISSED_KEY
  };
})();
