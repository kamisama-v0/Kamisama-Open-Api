// WatchTracker detector + tracker.
// Bagian 1: wtDetect() — parser metadata (dipakai popup via executeScript, MAIN world).
// Bagian 2: tracker — push otomatis ke service worker (auto-listen TANPA klik Ambil).
//   Tracker berjalan di ISOLATED world: TIDAK bisa baca window.netflix.falcorCache,
//   jadi pakai DOM saja ([data-uia="video-title"], status h4, meta, regex).
//   Tanpa wake-controls (tidak mau mengganggu nonton); mengandalkan apa yang ter-render.
function wtDetect() {
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

  // 0a. videoId
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

  // 0b. WAKE controls. Selalu wake di sini: wtDetect() hanya dipanggil
  // on-demand (popup) atau manual via console. Tracker otomatis TIDAK pakai
  // fungsi ini — ia pakai collect() di bawah yang tanpa wake agar tidak
  // mengganggu nonton.
  const doWake = true;
  const readMeta = () => {
    // 1. [data-uia="video-title"] (ground-truth Netflix) — 2 varian:
    //    A: <h4>SHOW</h4><span>E1</span><span>EP_TITLE</span>
    //    B: teks langsung milik div (film / tanpa h4+span).
    try {
      const vt = q('[data-uia="video-title"]');
      if (vt) {
        // Varian B dulu (teks langsung), lalu Varian A menimpa bila ada (lebih spesifik).
        try {
          const parts = [];
          const nodes = vt.childNodes;
          for (const n of nodes) {
            if (n.nodeType === 3) {
              const t = ((n.textContent || '').trim().replace(/\s+/g, ' '));
              if (t) parts.push(t);
            }
          }
          if (parts.length > 0) title = parts.join(' ');
        } catch (e) {
          /* abaikan */
        }
        const h = vt.querySelector('h4');
        const t = txt(h);
        if (t) title = t;
        const spans = [...vt.querySelectorAll(':scope > span')].map(txt).filter(Boolean);
        if (spans.length > 0) {
          const ne = normEp(spans[0]);
          if (ne) {
            if (ne.season) season = ne.season;
            if (ne.episode) episode = ne.episode;
          }
        }
        if (spans.length > 1) episodeTitle = spans[1];
      }
    } catch (e) {
      /* abaikan */
    }

    // 2. falcorCache (hanya MAIN world; undefined di isolated = skip diam-diam)
    try {
      const nf = typeof window !== 'undefined' ? window.netflix || null : null;
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
      /* abaikan (isolated world) */
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
    let scopeText = '';
    if (!title || !episode) {
      try {
        const root = q('[data-uia="player"]') || document;
        const h4s = root.querySelectorAll('h4');
        for (const h of h4s) {
          const t = txt(h);
          if (!t || /^(netflix|skip|back|play|pause)$/i.test(t)) continue;
          const scope = h.parentElement ? txt(h.parentElement) : '';
          if (!title) {
            title = t;
            scopeText = scope;
          }
          if (title && /S\d|E\d+|Episode|Season/i.test(scope)) {
            scopeText = scope;
            break;
          }
        }
      } catch (e) {
        /* abaikan */
      }
    }
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
  };

  if (doWake) {
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
      // Coba-ulang maks 3x: kontrol kadang belum render saat baca pertama.
      // readMeta() tidak menimpa nilai yang sudah ketemu dengan yang kosong.
      for (let attempt = 0; attempt < 3; attempt++) {
        readMeta();
        if (title && episode) break;
        if (attempt < 2) await sleep(700);
      }
      return snapshot(v, toTs, title, season, episode, episodeTitle, type, videoId);
    })();
  }
  readMeta();
  return snapshot(v, toTs, title, season, episode, episodeTitle, type, videoId);
}

function snapshot(v, toTs, title, season, episode, episodeTitle, type, videoId) {
  return {
    timestamp: toTs(v.currentTime),
    duration: Math.floor(v.duration || 0),
    title: title,
    season: season,
    episode: episode,
    episodeTitle: episodeTitle,
    type: type,
    videoId: videoId,
    paused: !!v.paused,
    url: location.href
  };
}

// ---------------------------------------------------------------------------
// TRACKER: push otomatis ke service worker (tanpa klik Ambil).
// follow: pause/seeked/ended -> kirim langsung; timeupdate -> throttled 45 dtk;
// pagehide/visibilitychange -> flush terakhir. Judul/episode boleh kosong di
// awal (konten lazy) — worker skip round yang title-nya kosong.
// ---------------------------------------------------------------------------
(() => {
  try {
    const SEND_INTERVAL_MS = 45000;
    let video = null;
    let lastSentAt = 0;
    let lastKey = '';

    const sessionKey = (m) =>
      [m.videoId || m.url || '', m.title || '', m.episode || ''].join('|');

    function collect() {
      // Versi sinkron tanpa wake (jangan ganggu nonton).
      const v = document.querySelector('video');
      if (!v) return null;
      const q = (sel, root) => (root || document).querySelector(sel);
      const txt = (el) => ((el && el.textContent) || '').trim().replace(/\s+/g, ' ');
      let title = '';
      let episode = '';
      let season = '';
      try {
        const vt = q('[data-uia="video-title"]');
        if (vt) {
          // Varian B: teks langsung milik div (film / tanpa h4+span).
          try {
            const parts = [];
            const nodes = vt.childNodes;
            for (const n of nodes) {
              if (n.nodeType === 3) {
                const dt = ((n.textContent || '').trim().replace(/\s+/g, ' '));
                if (dt) parts.push(dt);
              }
            }
            if (parts.length > 0) title = parts.join(' ');
          } catch (e) {
            /* abaikan */
          }
          title = txt(vt.querySelector('h4')) || title;
          const spans = [...vt.querySelectorAll(':scope > span')].map(txt).filter(Boolean);
          if (spans.length > 0) {
            const m =
              spans[0].match(/S\s*(\d+)\s*:?\s*E\s*(\d+)/i) ||
              spans[0].match(/Episode\s*(\d+)/i) ||
              spans[0].match(/(?:^|[\s:(])E\s*(\d+)(?:\s|:|$)/i);
            if (m) {
              if (m[2] !== undefined) {
                season = 'S' + parseInt(m[1], 10);
                episode = 'E' + parseInt(m[2], 10);
              } else {
                episode = 'E' + parseInt(m[1], 10);
              }
            }
          }
        }
      } catch (e) {
        /* abaikan */
      }
      if (!title) {
        title = (document.title || '')
          .replace(/^\s*Watch\s+/i, '')
          .split(/\s*\|\s*/)[0]
          .split(/\s+-\s+/)[0]
          .trim();
        if (/^(netflix)$/i.test(title)) title = '';
      }
      let videoId = '';
      try {
        const player = q('[data-uia="player"]');
        videoId = (player && player.getAttribute('data-videoid')) || '';
        if (!videoId) {
          const m = (location.pathname || '').match(/\/watch\/(\d+)/);
          if (m) videoId = m[1];
        }
      } catch (e) {
        /* abaikan */
      }
      const s = Math.max(0, Math.floor(v.currentTime || 0));
      const pad = (n) => String(n).padStart(2, '0');
      return {
        timestamp:
          pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60),
        duration: Math.floor(v.duration || 0),
        title,
        season,
        episode,
        videoId,
        paused: !!v.paused,
        url: location.href
      };
    }

    const inflightTitles = {};
    async function send(force) {
      let m = collect();
      if (!m) return;
      // Judul kosong -> coba cache/fetch dulu (khusus videoId yang jelas).
      if (!m.title && m.videoId && window.WTTitles) {
        if (!inflightTitles[m.videoId]) {
          inflightTitles[m.videoId] = window.WTTitles.resolveTitle(m.videoId)
            .then((r) => {
              delete inflightTitles[m.videoId];
              return r;
            })
            .catch(() => {
              delete inflightTitles[m.videoId];
              return { title: '' };
            });
        }
        try {
          const r = await inflightTitles[m.videoId];
          if (r && r.title) m = { ...m, title: r.title };
        } catch (e) {
          /* abaikan */
        }
      }
      if (!m.title) return; // belum ada metadata — coba lagi heartbeat berikut
      const now = Date.now();
      const key = sessionKey(m);
      if (key !== lastKey) {
        lastKey = key; // video/episode baru -> selalu kirim (worker POST)
      } else if (!force && now - lastSentAt < SEND_INTERVAL_MS) {
        return; // throttle heartbeat
      }
      lastSentAt = now;
      try {
        chrome.runtime.sendMessage({ type: 'WT_PROGRESS', payload: m });
      } catch (e) {
        /* worker tidur / belum siap — heartbeat berikut mencoba lagi */
      }
    }

    function attach(v) {
      if (video === v) return;
      video = v;
      lastKey = '';
      v.addEventListener('play', () => send(true));
      v.addEventListener('pause', () => send(true));
      v.addEventListener('seeked', () => send(true));
      v.addEventListener('ended', () => send(true));
      let lastTick = 0;
      v.addEventListener('timeupdate', () => {
        if (v.paused) return;
        const now = Date.now();
        if (now - lastTick > 15000) {
          lastTick = now;
          send(false);
        }
      });
      send(true); // kirim langsung saat video ketemu
    }

    const mo = new MutationObserver(() => {
      const v = document.querySelector('video');
      if (v) attach(v);
      else video = null;
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') send(true);
    });
    window.addEventListener('pagehide', () => send(true));

    // ---- Badge "watched" di halaman /title/<id> ----
    // Subtle, fixed, tidak mengganggu UI. Dismiss per ID (persist).
    async function checkBadge() {
      try {
        if (!window.WTTitles) return;
        const m = (location.pathname || '').match(/\/(?:id-en\/)?title\/(\d+)/);
        if (!m) {
          const old = document.getElementById('wt-watched-badge');
          if (old) old.remove();
          return;
        }
        const id = m[1];
        if (await window.WTTitles.isDismissed(id)) {
          const old = document.getElementById('wt-watched-badge');
          if (old) old.remove();
          return;
        }
        const w = await window.WTTitles.isWatched(id);
        if (!w) {
          const old = document.getElementById('wt-watched-badge');
          if (old) old.remove();
          return;
        }
        if (document.getElementById('wt-watched-badge')) return;
        const pill = document.createElement('div');
        pill.id = 'wt-watched-badge';
        pill.setAttribute(
          'style',
          'position:fixed;top:12px;right:12px;z-index:2147483647;' +
            'background:rgba(20,20,20,.82);color:#e8e8e8;font:12px/1.4 system-ui,sans-serif;' +
            'padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);' +
            'pointer-events:none;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
        );
        const label = document.createElement('span');
        label.textContent = '\u2713 Watched' + (w.title ? ' \u00B7 ' + w.title : '');
        const x = document.createElement('button');
        x.textContent = '\u00D7';
        x.title = 'Sembunyikan untuk judul ini';
        x.setAttribute(
          'style',
          'pointer-events:auto;margin-left:8px;background:none;border:none;color:#999;' +
            'cursor:pointer;font-size:14px;line-height:1;padding:0 2px;'
        );
        x.addEventListener('click', (ev) => {
          ev.stopPropagation();
          window.WTTitles.dismiss(id).catch(() => {});
          pill.remove();
        });
        pill.appendChild(label);
        pill.appendChild(x);
        (document.body || document.documentElement).appendChild(pill);
      } catch (e) {
        /* abaikan */
      }
    }

    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = '';
        checkBadge();
      }
    }, 2000);

    // Popup (tombol Ambil) minta refresh judul paksa untuk video ini.
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === 'WT_REFRESH_TITLE' && msg.videoId && window.WTTitles) {
          window.WTTitles.clearTitle(msg.videoId)
            .then(() => window.WTTitles.resolveTitle(msg.videoId))
            .then((r) => {
              if (r && r.title) send(true);
            })
            .catch(() => {});
        }
      });
    } catch (e) {
      /* abaikan */
    }

    checkBadge();

    const v0 = document.querySelector('video');
    if (v0) {
      attach(v0);
    } else {
      console.log('[WatchTracker] tracker aktif, menunggu video…');
    }
    window.__wtDetect = wtDetect;
  } catch (e) {
    console.log('[WatchTracker] tracker init gagal:', e);
  }
})();

// Export untuk pengujian unit via node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wtDetect };
}
