// Service worker (MV3) — saat ini pasif, disiapkan untuk:
// - context menu "Simpan progres ke WatchTracker"
// - alarm sinkronisasi berkala (opsional)
chrome.runtime.onInstalled.addListener(() => {
  console.log('[WatchTracker] installed');
});
