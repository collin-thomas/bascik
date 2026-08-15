# Production Server

Bascik generates static output, HTML, CSS, and JS that a CDN or any file server can deliver. You only need `bascik --serve` when you want **per-request dynamic content**: personalized dashboards, user-specific data, server-rendered pagination, or anything that must be different for each visitor.

The mechanism is `data-bascik-server`: a script tag that runs on the server on every request and injects its stdout into the page. Everything else, layout, navigation, styles, components, is still compiled at build time. You get the performance of static assets with the flexibility of server-rendered sections exactly where you need them.

```sh
bascik --build   # compile to dist/ (static assets)
bascik --serve   # start the HTTP/2 server; runs data-bascik-server scripts per request
```

If your site has no `data-bascik-server` scripts, you do not need `bascik --serve`: any static host will do.

## Server scripts: `data-bascik-server`

Tag a `<script>` block with `data-bascik-server` to run it at **request time** on the server instead of at build time. The script's stdout is injected into the page in place of the script tag, on every request.

```html
<script data-bascik-server>
  const req = JSON.parse(process.env.BASCIK_REQUEST);
  const name = bascikEsc(req.headers['x-display-name'] ?? 'Guest');
  console.log(`<p>Welcome, ${name}!</p>`);
</script>
```

This lets you personalize pages per visitor, reading session cookies, querying a database, or rendering content based on query parameters, without a full server framework.

### Request context

Every server script receives `process.env.BASCIK_REQUEST`, a JSON string with four fields:

| Field | Type | Description |
|---|---|---|
| `path` | `string` | URL path without the query string, e.g. `"/about"` |
| `method` | `string` | HTTP method in uppercase, e.g. `"GET"` |
| `headers` | `object` | Request headers as string-to-string. HTTP/2 pseudo-headers (`:path`, `:method`, etc.) are excluded. |
| `searchParams` | `object` | Query parameters as string-to-string, e.g. `{ "page": "2" }` |

```html
<script data-bascik-server>
  const { path, method, headers, searchParams } = JSON.parse(process.env.BASCIK_REQUEST);

  const page = parseInt(searchParams.page ?? '1', 10);
  const sessionId = headers['cookie']?.match(/session=([^;]+)/)?.[1];

  console.log(`<p>Page ${page} - session: ${sessionId ?? 'none'}</p>`);
</script>
```

### Using top-level `await` and `import`

Server scripts are run as Node.js ESM modules. Both top-level `await` and top-level `import` work:

```html
<script data-bascik-server>
  import { readFile } from 'node:fs/promises';

  const { path } = JSON.parse(process.env.BASCIK_REQUEST);
  const slug = path.split('/').pop();
  const content = await readFile(`./data/${slug}.json`, 'utf8');
  const { title, body } = JSON.parse(content);

  console.log(`<h1>${title}</h1><p>${body}</p>`);
</script>
```

The script's working directory is your project root (`process.cwd()`), so relative file paths work as expected.

### Combining build and server scripts

`data-bascik-build` and `data-bascik-server` are independent and compose freely on the same page:

```html
<!-- runs once at build time: injects a static nav from a data file -->
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  const links = JSON.parse(await readFile('./data/nav.json', 'utf8'));
  console.log(links.map(l => `<a href="${l.href}">${l.label}</a>`).join(''));
</script>

<!-- runs on every request: greets the signed-in user -->
<script data-bascik-server>
  const { headers } = JSON.parse(process.env.BASCIK_REQUEST);
  const user = headers['x-display-name'] ?? 'Guest';
  console.log(`<p class="greeting">Hello, ${user}</p>`);
</script>
```

### Rules and behavior

- Scripts run on **every request** and are **never cached:** the output is always fresh.
- During `bascik --build`, server script tags are **preserved as-is** in `dist/` and are NOT executed. Execution only happens when the page is served.
- On error, Bascik logs a warning to stderr and replaces the script tag with an empty string rather than aborting the request. The rest of the page renders normally.
- The script tag (including all its attributes and the closing `</script>` tag) is completely replaced by stdout output. Empty stdout means the tag slot becomes an empty string.
- Anything written to stderr from within the script is forwarded to the server's stderr.

### bascikEsc

Bascik injects a `bascikEsc(value)` helper into every server script automatically. Use it to HTML-escape any user-controlled value before writing it to stdout. The server script output is injected as raw HTML, so values from headers, cookies, query params, or database rows must be escaped to prevent XSS.

```html
<script data-bascik-server>
  const { headers, searchParams } = JSON.parse(process.env.BASCIK_REQUEST);
  const name = bascikEsc(headers['x-display-name'] ?? 'Guest');
  const tab = bascikEsc(searchParams.tab ?? 'overview');
  console.log(`<p>Hello ${name} &mdash; tab: ${tab}</p>`);
</script>
```

`bascikEsc` escapes `&`, `<`, `>`, and `"`. It is available without any import and is always defined, even when the script starts with `import` statements.

## Practical examples

> **Escape user-controlled output.** Any value from a request (cookies, query params, headers, database rows) must be HTML-escaped before writing with `console.log`. Bascik injects a `bascikEsc(value)` helper into every server script automatically — use it instead of defining your own.

### Reading request context

```html
<script data-bascik-server>
  const { headers, searchParams } = JSON.parse(process.env.BASCIK_REQUEST);
  const user = bascikEsc(headers['x-display-name'] ?? 'Guest');
  const tab = bascikEsc(searchParams.tab ?? 'overview');
  console.log(`<p>Hello ${user} - tab: ${tab}</p>`);
</script>
```

### Querying a database

Read a session cookie, look up the user in SQLite, and render a greeting.

```html
<script data-bascik-server>
  import Database from 'better-sqlite3';
  const { headers } = JSON.parse(process.env.BASCIK_REQUEST);
  const sessionId = headers['cookie']?.match(/session=([^;]+)/)?.[1];
  const db = new Database('./data/app.db');
  const user = sessionId && db.prepare('SELECT name FROM users WHERE session_id = ?').get(sessionId);
  console.log(user ? `<p>Hello, ${bascikEsc(user.name)}</p>` : '<p>Not signed in.</p>');
</script>
```

### Paginating results

Use `searchParams` to drive server-rendered pagination with no client-side JavaScript needed.

```html
<script data-bascik-server>
  import Database from 'better-sqlite3';
  const { searchParams } = JSON.parse(process.env.BASCIK_REQUEST);
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const db = new Database('./data/app.db');
  const items = db.prepare('SELECT title FROM articles ORDER BY created_at DESC LIMIT 20 OFFSET ?').all((page - 1) * 20);
  console.log(`<ul>${items.map(a => `<li>${bascikEsc(a.title)}</li>`).join('')}</ul>`);
</script>
```

### Using PostgreSQL

For a Postgres database, use the `pg` client. Top-level `await` makes async queries straightforward. Postgres uses numbered parameters (`$1`, `$2`, etc.) in query strings.

```sh
npm install pg
```

```html
<script data-bascik-server>
  import pg from 'pg';
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await db.query('SELECT title FROM articles ORDER BY created_at DESC LIMIT 10');
  await db.end();
  console.log(`<ul>${rows.map(r => `<li>${bascikEsc(r.title)}</li>`).join('')}</ul>`);
</script>
```

> **Connection pooling.** Each `data-bascik-server` block runs in a fresh Node.js child process, so in-process pools cannot be shared across requests. For production Postgres use an external pooler such as [PgBouncer](https://www.pgbouncer.org/).

## Server configuration

Configure the production server in `bascik.config.js` under the `serve` key.

```js
// bascik.config.js
export const bascikConfig = {
  cacheHttp: true,     // default in --serve; false in dev
  serve: {
    port: 8443,         // default
    hostname: 'localhost',  // default; use '0.0.0.0' to bind all interfaces
    keyFile: 'bascik-privkey.pem',  // default; path to your TLS private key
    certFile: 'bascik-cert.pem',    // default; path to your TLS certificate
    logging: {
      level: 'info',   // silent | error | warn | info | debug
      requests: true,  // log each request line
    },
  },
};
```

The `serve.logging.level` setting controls the request log threshold, and `requests: false` disables the per-request `GET / ...` lines without suppressing warnings or errors.

Bascik increments the port automatically if the preferred port is already in use.

`cacheHttp` defaults to `true` in `--serve` mode and `false` in the dev server. When `true`, pages receive `ETag` headers and the server returns `304 Not Modified` when a client's cached copy is still fresh. Static assets also get `Cache-Control: public, max-age=3600`. Set `cacheHttp: false` to disable all of this if you are behind a CDN that manages caching itself.

## What `--serve` does differently from `--build`

| Capability | `bascik --build` | `bascik --serve` |
|---|---|---|
| Transpile pages to `dist/` | ✓ | ✕ (reads existing `dist/`) |
| Watch source files for changes | ✕ | ✕ |
| Live-reload SSE | ✕ | ✕ |
| HTTP/2 server | ✕ | ✓ |
| Brotli compression | ✕ | ✓ |
| HTTP caching (ETags, 304) | ✕ | ✓ (default; see `cacheHttp`) |
| Rate limiting | ✕ | ✓ (per-IP) |
| Security response headers | ✕ | ✓ |
| Graceful shutdown | ✕ | ✓ (SIGTERM / SIGINT) |
| `data-bascik-server` scripts | ✕ (preserved) | ✓ (run per-request) |

## Production hardening

The Bascik HTTP server applies several hardening measures. Most of these are active in both the dev server (`bascik`) and the production server (`bascik --serve`); rate limiting is the only protection that is production-only.

### Security response headers

Every response includes these headers:

| Header | Value |
|---|---|
| `x-content-type-options` | `nosniff` |
| `x-frame-options` | `SAMEORIGIN` |
| `referrer-policy` | `strict-origin-when-cross-origin` |
| `permissions-policy` | `interest-cohort=()` |

These are sent on HTML pages, static assets, and error responses in both dev and production. If you are terminating TLS at a proxy and want to add `Strict-Transport-Security`, add it there rather than in Bascik, the proxy already knows the scheme of the outer connection.

### Rate limiting

In `--serve` mode the server enforces a per-IP request limit of **500 requests per 10 seconds**. Clients that exceed the limit receive `429 Too Many Requests` with a `Retry-After` header. The limit resets automatically after the window expires. Rate limiting is not active in the dev server.

### Graceful shutdown

The server listens for `SIGTERM` and `SIGINT` in both dev and production. On either signal it stops accepting new connections, destroys all open HTTP/2 sessions (including any live-reload SSE connections in dev), and exits once in-flight requests finish. If draining takes longer than 10 seconds, the process force-exits. This means `systemd` stop, `docker stop`, and Kubernetes pod eviction all wait for requests to complete before the process ends.

### Path traversal protection

Static asset URLs (requests with a file extension) are validated so the resolved path always stays inside the `dist/` directory. Requests that would escape it, via `/../` sequences or similar, receive `400 Bad Request` before any file I/O occurs. This applies in both dev and production.

## TLS certificates

On first start, Bascik looks for `bascik-cert.pem` and `bascik-privkey.pem` in the project root. If either is missing, it generates both automatically:

1. **mkcert:** preferred. Produces a CA-trusted cert (no browser warning). Run `mkcert -install` once to install the root CA before running Bascik. Install mkcert with `brew install mkcert` on macOS.
2. **openssl:** fallback. Produces a self-signed cert that browsers will warn about.

To use your own certificates (e.g. from Let's Encrypt), set `keyFile` and `certFile` in the `serve` config block and Bascik will use them instead of generating new ones.

## Deployment

Bascik's server always uses TLS, there is no plaintext HTTP mode. Most cloud platforms terminate TLS at the edge and send cleartext to the container, which is incompatible with Bascik's HTTPS-only server. The examples below use platforms and approaches that either pass TLS through to the container or work with Bascik's built-in cert handling.

> **Security note.** Before going live: set `hostname: '0.0.0.0'` to bind all interfaces, supply a real CA-issued certificate via `keyFile`/`certFile`, and ensure only the required port is open in your firewall or security group.

### Docker

Build a two-stage image: the first stage transpiles the site, the second stage installs only what is needed to run the server.

```dockerfile
# Stage 1 - build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx bascik --build

# Stage 2 - serve
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --from=build /app/dist ./dist
COPY bascik.config.js .
EXPOSE 8443
CMD ["npx", "bascik", "--serve"]
```

Run it locally:

```sh
docker build -t my-site .
docker run -p 8443:8443 my-site
```

Bascik generates a self-signed certificate inside the container on first start. To supply a real certificate, mount it at runtime:

```sh
docker run -p 8443:8443 \
  -v /etc/letsencrypt/live/example.com/privkey.pem:/app/bascik-privkey.pem:ro \
  -v /etc/letsencrypt/live/example.com/fullchain.pem:/app/bascik-cert.pem:ro \
  my-site
```

### Google Cloud Run

Cloud Run terminates TLS at the edge. Enable **end-to-end encryption** in the Cloud Run service settings so Google forwards HTTPS (not cleartext) to your container, Bascik needs HTTPS on the container port.

```sh
# Build and push the image to Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/my-site

# Deploy to Cloud Run
gcloud run deploy my-site \
  --image gcr.io/PROJECT_ID/my-site \
  --port 8443 \
  --allow-unauthenticated \
  --region us-central1
```

After deploying, go to the Cloud Run service in the console → **Edit & Deploy New Revision** → under **Container, Networking, Security** → **Encryption** → choose **End-to-end encryption (HTTP/2)**. Cloud Run will not verify Bascik's self-signed container cert.

To make the `*.run.app` URL or a custom domain the canonical origin, set `siteUrl` in your `bascik.config.js` before building:

```js
export const bascikConfig = {
  siteUrl: 'https://my-site-abc123-uc.a.run.app',
  serve: { port: 8443, hostname: '0.0.0.0' },
};
```

### VPS or dedicated server

On a VPS (EC2, DigitalOcean Droplet, Hetzner, etc.) Bascik can own port 443 directly with no reverse proxy required.

Get a certificate from Let's Encrypt:

```sh
certbot certonly --standalone -d example.com
```

Point Bascik at it in `bascik.config.js`:

```js
export const bascikConfig = {
  siteUrl: 'https://example.com',
  serve: {
    port: 443,
    hostname: '0.0.0.0',
    keyFile: '/etc/letsencrypt/live/example.com/privkey.pem',
    certFile: '/etc/letsencrypt/live/example.com/fullchain.pem',
  },
};
```

Create a `systemd` unit to keep the server running across reboots:

```ini
# /etc/systemd/system/my-site.service
[Unit]
Description=My Bascik Site
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/srv/my-site
ExecStartPre=/usr/bin/npx bascik --build
ExecStart=/usr/bin/npx bascik --serve
Restart=on-failure
RestartSec=5s
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```sh
systemctl daemon-reload
systemctl enable --now my-site
journalctl -u my-site -f     # follow logs
```

> **cert renewal.** Add a `certbot renew` cron job and a `systemctl restart my-site` hook so the server picks up the new cert after each renewal.

### Behind nginx or Caddy

If you already run a reverse proxy on the host, proxy HTTPS traffic to Bascik. Bascik's certificate does not need to be CA-trusted for the proxy-to-backend leg.

**nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    location / {
        proxy_pass https://localhost:8443;
        proxy_ssl_verify off;      # Bascik's self-signed cert is fine here
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Caddy** (automatic HTTPS, zero config for certs):

```
example.com {
    reverse_proxy https://localhost:8443 {
        transport http {
            tls_insecure_skip_verify
        }
    }
}
```

> **Passing headers to server scripts.** When proxying, forward the original client IP and authentication headers so `data-bascik-server` scripts can access them: nginx adds `proxy_set_header X-Real-IP $remote_addr;`, Caddy adds `header_up X-Real-IP {remote_host}` automatically.

> **Rate limiting behind a proxy.** The built-in rate limiter reads the TCP remote address, which will be the proxy's IP when running behind nginx or Caddy. Set the per-client limit in the proxy itself (e.g. nginx `limit_req_zone`) and set `cacheHttp: false` if the proxy handles caching too.
