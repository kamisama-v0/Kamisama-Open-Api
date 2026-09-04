// Content script pasif — deteksi video dilakukan on-demand via
// chrome.scripting.executeScript dari popup (tidak perlu listener aktif).
// File ini disiapkan untuk auto-detect agresif di masa depan
// (mis. kirim posisi video berkala ke service worker).
(() => {
  const hasVideo = !!document.querySelector('video');
  if (hasVideo) {
    console.log('[WatchTracker] video element detected');
  }
})();
