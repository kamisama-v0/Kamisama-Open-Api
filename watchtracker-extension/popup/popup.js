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
  } catch (e) {
    box.innerHTML = `<div class="loading">${esc(e.message)}</div>`;
  }
}

// --- Tab aktif + posisi video ---
async function detectCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  $('urlDisplay').textContent = tab.url;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const v = document.querySelector('video');
        if (!v) return null;
        const s = Math.floor(v.currentTime || 0);
        const hh = String(Math.floor(s / 3600)).padStart(2, '0');
        const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return { timestamp: `${hh}:${mm}:${ss}`, title: document.title, duration: Math.floor(v.duration || 0) };
      }
    });
    if (result) {
      $('videoInfo').textContent = `⏱ ${result.timestamp} — ${result.title}`;
      $('timestampInput').value = result.timestamp;
      chrome.storage.local.set({ currentWatch: { url: tab.url, title: result.title, duration: result.duration } });
    }
  } catch {
    $('videoInfo').textContent = 'Tidak ada video terdeteksi di tab ini';
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
    await api('/watch/history', {
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
    const { user } = await chrome.storage.local.get(['user']);
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
  $('grabTimeBtn').addEventListener('click', detectCurrentTab);
  $('groupSelect').addEventListener('change', (e) => {
    currentGroup = e.target.value;
    loadHistory();
  });
  await boot();
});
