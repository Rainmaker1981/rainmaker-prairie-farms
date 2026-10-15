# Rainmaker Prairie Farms

Static website for Rainmaker Prairie Farms in Buffalo County, Nebraska.

## Local preview

Run a simple local web server from this directory:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Cloudflare Pages

- Framework preset: **None**
- Build command: leave blank
- Build output directory: `/`
- Production branch: `main`

The repository includes Cloudflare-compatible `_headers`, `404.html`, `robots.txt`, and `sitemap.xml` files.

## Automatic coop livestream

Production uses Cloudflare Workers Static Assets (not Pages). `wrangler.jsonc`
adds `/api/live`; all website assets keep their normal static routing.
Set `YOUTUBE_API_KEY` as a runtime **Secret** in the Worker settings, with
YouTube Data API v3 enabled and the key restricted to that API. Never commit it.

The endpoint checks the channel's most recent uploads plus the current known
broadcast, verifies channel ownership, active status, and embedding permission,
and caches successful results at the edge for 60 seconds. It checks up to 50
video IDs. A very long-running broadcast outside that window (other than the
known current broadcast) may require expanding discovery. Public broadcasts
only; private broadcasts require a different authenticated integration.

Both home and gallery poll once a minute. Offline results show a fallback;
API outages or missing credentials preserve the existing player. The Watch Live
link always points to the channel. No OBS settings are modified.

Verification: `node --test tests/live.test.mjs`.
