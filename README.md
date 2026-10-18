# Sift Embeddable Widget

The actual thing a merchant drops into their storefront theme. One
`<script>` tag, no build step, no dependencies. Talks directly to the
catalog engine's `/chat` endpoint (CORS-enabled there specifically for this).

## Try it locally

1. Have the catalog engine running (`sift-catalog-engine`, `npm run server`)
   with at least one merchant registered and synced.
2. Edit the `<script>` tag at the bottom of `demo.html` — set
   `data-merchant-id` to a real merchant id you've synced, and
   `data-engine-url` to wherever the engine is running.
3. Open `demo.html` directly in a browser (or serve it with any static
   server — `npx serve .` works fine).

`demo.html` deliberately styles buttons/inputs in clashing colors to prove
the widget's Shadow DOM isolation actually works — the widget should look
like itself (dark panel, violet accent) regardless of the host page's CSS,
and the host page's buttons/inputs should be unaffected by the widget's styles.

## How a merchant actually embeds it

Once `widget.js` is hosted somewhere stable (see below), a merchant adds
one line to their theme:

```html
<script
  src="https://your-domain.com/widget.js"
  data-merchant-id="their-merchant-id"
  data-engine-url="https://api.your-domain.com"
  defer
></script>
```

**Shopify**: goes in a Theme App Extension's app block, or directly in
`theme.liquid` for a quick manual install before the extension is built.

**WordPress/WooCommerce**: a plugin enqueues this same script tag via
`wp_enqueue_script()` — no widget-specific WordPress code needed beyond
that, since the script is plain JS with no framework dependency.

## Configuration (all via `data-*` attributes on the script tag)

| Attribute | Required | Default | Purpose |
|---|---|---|---|
| `data-merchant-id` | yes | — | Which merchant's catalog to search |
| `data-engine-url` | yes | — | Base URL of the catalog engine |
| `data-color` | no | `#9333EA` | Accent color (buttons, user bubbles, prices) |
| `data-position` | no | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-assistant-name` | no | `Sift` | Shown in the widget header |
| `data-greeting` | no | generic | First message shown when the widget opens |

## Where to host `widget.js` for real

A copy already lives in `sift-admin-dashboard/public/widget.js` — Next.js
serves anything in `public/` automatically, so once that project is
deployed, the script is live at `https://your-dashboard-domain.com/widget.js`
with zero extra setup. A CDN in front of it (Vercel's default CDN already
does this) keeps it fast on merchant storefronts worldwide.

## What's intentionally not here yet

- **Suggestion chips / starter prompts** — the marketing landing page's demo
  widget had these; this real embed keeps things minimal and universal
  since we don't know each merchant's product categories in advance. Could
  add a `data-suggestions="hiking gear,gifts under $50"` attribute later.
- **Streaming responses** — waits for the full reply, same as the engine's
  current non-streaming `/chat` endpoint.
- **Persisted conversation history across page reloads** — `sessionId` is
  stable per browser tab session (via `sessionStorage`), but the visible
  message list resets on page reload. The backend still has the full
  history in `chat_logs` if you want to rehydrate it later.
- **Origin validation** — the engine's CORS is currently open to any origin
  on `/chat` (flagged in the engine's own code/README) — fine for now,
  worth tightening before real merchant traffic.
