const CHANNEL = 'UCNC_0PiZKPt8Nnd62q7qr5w';
const CURRENT = 'Hissi2La5kA';
const WATCH = `https://www.youtube.com/channel/${CHANNEL}/live`;

async function youtube(resource, params, key) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  url.search = new URLSearchParams({ ...params, key });
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('YouTube lookup unavailable');
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('Invalid YouTube response');
  return data.items;
}

export async function discover(key) {
  // The uploads playlist avoids the much more restrictive search quota.
  const uploads = await youtube('playlistItems', {
    part: 'contentDetails', playlistId: `UU${CHANNEL.slice(2)}`, maxResults: '50'
  }, key);
  const ids = [...new Set([CURRENT, ...uploads.map(item => item.contentDetails?.videoId)])]
    .filter(id => /^[a-zA-Z0-9_-]{11}$/.test(id)).slice(0, 50);
  const videos = await youtube('videos', {
    part: 'snippet,liveStreamingDetails,status', id: ids.join(',')
  }, key);
  const live = videos.filter(video =>
    video.snippet?.channelId === CHANNEL &&
    video.snippet?.liveBroadcastContent === 'live' &&
    video.liveStreamingDetails?.actualStartTime &&
    !video.liveStreamingDetails.actualEndTime && video.status?.embeddable === true
  ).sort((a, b) => Date.parse(b.liveStreamingDetails.actualStartTime) - Date.parse(a.liveStreamingDetails.actualStartTime));
  return { status: live.length ? 'live' : 'offline', videoId: live[0]?.id ?? null, watchUrl: WATCH };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/live') return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' };
    if (!env.YOUTUBE_API_KEY) {
      return Response.json({ status: 'unconfigured', videoId: null, watchUrl: WATCH }, { headers: { ...headers, 'Cache-Control': 'no-store' } });
    }
    // Canonical key prevents query strings from bypassing the edge cache.
    const cacheKey = new Request(`${url.origin}/api/live`);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
    try {
      const response = Response.json(await discover(env.YOUTUBE_API_KEY), { headers });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    } catch {
      // Never expose upstream URLs, credentials, or raw error messages.
      return Response.json({ status: 'unavailable', videoId: null, watchUrl: WATCH }, { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } });
    }
  }
};
