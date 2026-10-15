import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { discover } from '../worker.mjs';

test('finds an active broadcast missing from uploads using live search', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => Response.json({ items: ++calls < 3 ? [] : [{
    id: 'newlive1234', snippet: { channelId: 'UCNC_0PiZKPt8Nnd62q7qr5w', liveBroadcastContent: 'live' },
    status: { embeddable: true }, liveStreamingDetails: { actualStartTime: '2026-10-15T18:00:00Z' }
  }] });
  try {
    const result = await discover('test-key', async () => [{ id: { videoId: 'newlive1234' } }]);
    assert.equal(result.status, 'live');
    assert.equal(result.videoId, 'newlive1234');
  } finally { globalThis.fetch = original; }
});

test('discovery selects live embeddable channel broadcasts and excludes ended or foreign videos', async () => {
  const original = globalThis.fetch;
  const video = (id, extra = {}) => ({ id, snippet: { channelId: 'UCNC_0PiZKPt8Nnd62q7qr5w', liveBroadcastContent: 'live' }, status: { embeddable: true }, liveStreamingDetails: { actualStartTime: '2026-10-15T12:00:00Z' }, ...extra });
  globalThis.fetch = async url => Response.json({ items: url.pathname.endsWith('playlistItems') ? [{ contentDetails: { videoId: 'newlive1234' } }] : [
    video('ended123456', { liveStreamingDetails: { actualStartTime: '2026-10-15T13:00:00Z', actualEndTime: '2026-10-15T14:00:00Z' } }),
    video('foreign1234', { snippet: { channelId: 'another', liveBroadcastContent: 'live' } }),
    video('private1234', { status: { embeddable: false } }), video('newlive1234')
  ] });
  try { assert.equal((await discover('test-key')).videoId, 'newlive1234'); }
  finally { globalThis.fetch = original; }
});

test('no active broadcast returns an explicit offline result', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ items: [] });
  try { assert.equal((await discover('test-key')).status, 'offline'); }
  finally { globalThis.fetch = original; }
});

test('missing credentials preserves fallback and non-API paths use assets', async () => {
  const env = { ASSETS: { fetch: async () => new Response('website') } };
  assert.equal((await (await worker.fetch(new Request('https://farm.test/api/live'), env, {})).json()).status, 'unconfigured');
  assert.equal(await (await worker.fetch(new Request('https://farm.test/gallery'), env, {})).text(), 'website');
});

test('upstream failure does not leak API key', async () => {
  const original = globalThis.fetch;
  const originalCaches = globalThis.caches;
  globalThis.caches = { default: { match: async () => null } };
  globalThis.fetch = async () => { throw new Error('secret-key'); };
  try {
    const response = await worker.fetch(new Request('https://farm.test/api/live'), { YOUTUBE_API_KEY: 'secret-key' }, {});
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes('secret-key'), false);
  } finally { globalThis.fetch = original; globalThis.caches = originalCaches; }
});
