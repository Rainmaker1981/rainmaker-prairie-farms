(() => {
  const section = document.querySelector('#live-coop');
  if (!section) return;
  const frame = section.querySelector('iframe');
  const note = section.querySelector('[data-live-status]');
  const fallback = frame.parentElement.querySelector('[data-live-fallback]');
  let current = frame.getAttribute('src');
  async function refresh() {
    if (document.hidden) { window.setTimeout(refresh, 60000); return; }
    try {
      const response = await fetch('/api/live', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Lookup unavailable');
      const data = await response.json();
      if (data.status === 'live' && /^[a-zA-Z0-9_-]{11}$/.test(data.videoId)) {
        const src = `https://www.youtube-nocookie.com/embed/${data.videoId}`;
        if (current !== src) { frame.src = src; current = src; }
        frame.hidden = false;
        fallback.hidden = true;
        note.textContent = 'The coop camera is live. If playback is interrupted, try Watch Live on YouTube.';
      } else if (data.status === 'offline') {
        frame.hidden = true;
        frame.removeAttribute('src');
        current = null;
        fallback.hidden = false;
        note.textContent = 'The coop camera is offline. This page checks automatically for its return.';
      }
      // Missing credentials or an API failure leaves the existing player intact.
    } catch { /* Preserve the player and channel link during lookup outages. */ }
    finally { window.setTimeout(refresh, 60000); }
  }
  refresh();
})();
