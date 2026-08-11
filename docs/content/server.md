# Production Server

Bascik ships its own HTTP/2 production server. After building your site with `bascik --build`, start the server with `bascik --serve`. No separate web server software is required.

```sh
bascik --build   # transpile to dist/
bascik --serve   # start the HTTP/2 server against dist/
```

The server handles TLS automatically. If [mkcert](https://github.com/FiloSottile/mkcert) is installed it issues a CA-trusted certificate; otherwise it falls back to a self-signed certificate via `openssl`.

> **Production checklist.** Before going live: bind to `0.0.0.0` so the server is reachable from outside the machine, provide real TLS certificates from a public CA (Let's Encrypt, etc.), and run behind a reverse proxy (nginx, Caddy) if you need load balancing or advanced routing.

## What `--serve` does differently from `--build`

| Capability | `bascik --build` | `bascik --serve` |
|---|---|---|
| Transpile pages to `dist/` | ✅ | ❌ (reads existing `dist/`) |
| Watch source files for changes | ❌ | ❌ |
| Live-reload SSE | ❌ | ❌ |
| HTTP/2 server | ❌ | ✅ |
| Brotli compression | ❌ | ✅ |
| HTTP caching (ETags, 304) | ❌ | ✅ (default; see `cacheHttp`) |
| Rate limiting | ❌ | ✅ (per-IP) |
| Security response headers | ❌ | ✅ |
| Graceful shutdown | ❌ | ✅ (SIGTERM / SIGINT) |
| `data-bascik-server` scripts | ❌ (preserved) | ✅ (run per-request) |

## `serve` config block

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
  },
};
```

Bascik increments the port automatically if the preferred port is already in use.

`cacheHttp` defaults to `true` in `--serve` mode and `false` in the dev server. When `true`, pages receive `ETag` headers and the server returns `304 Not Modified` when a client's cached copy is still fresh. Static assets also get `Cache-Control: public, max-age=3600`. Set `cacheHttp: false` to disable all of this if you are behind a CDN that manages caching itself.

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

These are sent on HTML pages, static assets, and error responses in both dev and production. If you are terminating TLS at a proxy and want to add `Strict-Transport-Security`, add it there rather than in Bascik — the proxy already knows the scheme of the outer connection.

### Rate limiting

In `--serve` mode the server enforces a per-IP request limit of **500 requests per 10 seconds**. Clients that exceed the limit receive `429 Too Many Requests` with a `Retry-After` header. The limit resets automatically after the window expires. Rate limiting is not active in the dev server.

### Graceful shutdown

The server listens for `SIGTERM` and `SIGINT` in both dev and production. On either signal it stops accepting new connections and waits for in-flight requests to finish, then exits cleanly. If the drain takes longer than 10 seconds, the process force-exits. This means `systemd` stop, `docker stop`, and Kubernetes pod eviction all wait for requests to complete before the process ends.

### Path traversal protection

Static asset URLs (requests with a file extension) are validated so the resolved path always stays inside the `dist/` directory. Requests that would escape it — via `/../` sequences or similar — receive `400 Bad Request` before any file I/O occurs. This applies in both dev and production.

## Server scripts — `data-bascik-server`

Tag a `<script>` block with `data-bascik-server` to run it at **request time** on the server instead of at build time. The script's stdout is injected into the page in place of the script tag, on every request.

```html
<script data-bascik-server>
  const req = JSON.parse(process.env.BASCIK_REQUEST);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const name = esc(req.headers['x-display-name'] ?? 'Guest');
  console.log(`<p>Welcome, ${name}!</p>`);
</script>
```

This lets you personalize pages per visitor — reading session cookies, querying a database, or rendering content based on query parameters — without a full server framework.

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

  console.log(`<p>Page ${page} — session: ${sessionId ?? 'none'}</p>`);
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

### Rules and behavior

- Scripts run on **every request** and are **never cached** — the output is always fresh.
- `data-bascik-build` and `data-bascik-server` are independent: a page can use both on the same page and they compose freely.
- During `bascik --build`, server script tags are **preserved as-is** in `dist/` and are NOT executed. Execution only happens when the page is served.
- On error, Bascik logs a warning to stderr and replaces the script tag with an empty string rather than aborting the request. The rest of the page renders normally.
- The script tag (including all its attributes and the closing `</script>` tag) is completely replaced by stdout output. Empty stdout means the tag slot becomes an empty string.
- Anything written to stderr from within the script is forwarded to the server's stderr.

### Combining build and server scripts

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

## Practical examples

> **Escape user-controlled output.** Any value that originates from a request (cookies, query params, headers, database rows written by users) must be HTML-escaped before being written with `console.log`. A minimal helper: `` const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') ``.

### Identifying the current user

Read a session cookie, look up the session in a SQLite database, and render a user badge. Install `better-sqlite3` once for your project:

```sh
npm install better-sqlite3
```

```html
<script data-bascik-server>
  import Database from 'better-sqlite3';
  import { join } from 'node:path';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const { headers } = JSON.parse(process.env.BASCIK_REQUEST);
  const sessionId = headers['cookie']?.match(/session=([^;]+)/)?.[1];

  if (!sessionId) {
    console.log('<p class="notice">You are not signed in.</p>');
  } else {
    const db = new Database(join(process.cwd(), 'data/app.db'));
    const user = db
      .prepare('SELECT name, email FROM users WHERE session_id = ?')
      .get(sessionId);

    if (!user) {
      console.log('<p class="notice">Session expired. Please sign in again.</p>');
    } else {
      console.log(`
        <div class="user-badge">
          <p class="user-name">${esc(user.name)}</p>
          <p class="user-email">${esc(user.email)}</p>
        </div>
      `);
    }
  }
</script>
```

### Rendering user data from a database

Once you have the user's identity, query their records and render them directly into the page — no API round-trip from the browser needed.

```html
<script data-bascik-server>
  import Database from 'better-sqlite3';
  import { join } from 'node:path';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const { headers } = JSON.parse(process.env.BASCIK_REQUEST);
  const sessionId = headers['cookie']?.match(/session=([^;]+)/)?.[1];

  if (!sessionId) {
    console.log('<p>Please sign in to view your orders.</p>');
  } else {
    const db = new Database(join(process.cwd(), 'data/app.db'));
    const user = db
      .prepare('SELECT id FROM users WHERE session_id = ?')
      .get(sessionId);

    if (!user) {
      console.log('<p>Session expired.</p>');
    } else {
      const orders = db
        .prepare(`
          SELECT id, created_at, total_cents
          FROM orders
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 5
        `)
        .all(user.id);

      if (orders.length === 0) {
        console.log('<p>No orders yet.</p>');
      } else {
        const rows = orders.map(o => `
          <tr>
            <td>#${esc(o.id)}</td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
            <td>$${(o.total_cents / 100).toFixed(2)}</td>
          </tr>
        `).join('');

        console.log(`
          <table>
            <thead><tr><th>Order</th><th>Date</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `);
      }
    }
  }
</script>
```

### Using PostgreSQL

For a Postgres database, use the `pg` client. Top-level `await` makes async queries straightforward.

```sh
npm install pg
```

```html
<script data-bascik-server>
  import pg from 'pg';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const { headers } = JSON.parse(process.env.BASCIK_REQUEST);
  const sessionId = headers['cookie']?.match(/session=([^;]+)/)?.[1];

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: [user] } = await pool.query(
      'SELECT id, name FROM users WHERE session_id = $1',
      [sessionId ?? '']
    );

    if (!user) {
      console.log('<p>Not signed in.</p>');
    } else {
      const { rows: posts } = await pool.query(
        `SELECT title, published_at FROM posts
         WHERE author_id = $1
         ORDER BY published_at DESC
         LIMIT 10`,
        [user.id]
      );

      const items = posts.map(p =>
        `<li>${esc(p.title)} — ${new Date(p.published_at).toLocaleDateString()}</li>`
      ).join('');

      console.log(`<h2>Posts by ${esc(user.name)}</h2><ul>${items}</ul>`);
    }
  } finally {
    await pool.end();
  }
</script>
```

> **Connection pooling.** Each `data-bascik-server` block runs in a fresh Node.js child process that exits after producing its output, so in-process pools cannot be shared across requests. For production Postgres workloads, use an external connection pooler such as [PgBouncer](https://www.pgbouncer.org/) and open a single connection per script invocation (rather than a pool), or switch to a protocol that amortises connection cost per-query (e.g. a REST API backed by a pooled service).

### Paginating query results

Use `searchParams` to drive server-rendered pagination. No client-side JavaScript is required.

```html
<script data-bascik-server>
  import Database from 'better-sqlite3';
  import { join } from 'node:path';

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const { searchParams } = JSON.parse(process.env.BASCIK_REQUEST);
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const db = new Database(join(process.cwd(), 'data/app.db'));
  const articles = db
    .prepare(`
      SELECT slug, title, summary FROM articles
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(pageSize, offset);

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM articles').get();
  const totalPages = Math.ceil(total / pageSize);

  const cards = articles.map(a => `
    <article class="card">
      <h2><a href="/articles/${esc(a.slug)}">${esc(a.title)}</a></h2>
      <p>${esc(a.summary)}</p>
    </article>
  `).join('');

  const prev = page > 1 ? `<a href="?page=${page - 1}">← Previous</a>` : '';
  const next = page < totalPages ? `<a href="?page=${page + 1}">Next →</a>` : '';

  console.log(`
    <div class="article-list">${cards}</div>
    <nav class="pagination">${prev} ${next}</nav>
  `);
</script>
```

## TLS certificates

On first start, Bascik looks for `bascik-cert.pem` and `bascik-privkey.pem` in the project root. If either is missing, it generates both automatically:

1. **mkcert** — preferred. Produces a CA-trusted cert (no browser warning). Run `mkcert -install` once to install the root CA before running Bascik. Install mkcert with `brew install mkcert` on macOS.
2. **openssl** — fallback. Produces a self-signed cert that browsers will warn about.

To use your own certificates (e.g. from Let's Encrypt), set `keyFile` and `certFile` in the `serve` config block and Bascik will use them instead of generating new ones.

## Deployment

Bascik's server always uses TLS — there is no plaintext HTTP mode. Most cloud platforms terminate TLS at the edge and send cleartext to the container, which is incompatible with Bascik's HTTPS-only server. The examples below use platforms and approaches that either pass TLS through to the container or work with Bascik's built-in cert handling.

> **Security note.** Before going live: set `hostname: '0.0.0.0'` to bind all interfaces, supply a real CA-issued certificate via `keyFile`/`certFile`, and ensure only the required port is open in your firewall or security group.

### Docker

Build a two-stage image: the first stage transpiles the site, the second stage installs only what is needed to run the server.

```dockerfile
# Stage 1 — build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx bascik --build

# Stage 2 — serve
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

Cloud Run terminates TLS at the edge. Enable **end-to-end encryption** in the Cloud Run service settings so Google forwards HTTPS (not cleartext) to your container — Bascik needs HTTPS on the container port.

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

### Fly.io

Fly.io can proxy HTTPS directly to a container that speaks HTTPS — Bascik's cert does not need to be CA-trusted because Fly handles the public-facing TLS. In `fly.toml`:

```toml
[http_service]
  internal_port = 8443
  force_https = true

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/"
```

Deploy:

```sh
fly launch        # first time: generates fly.toml and provisions the app
fly deploy        # subsequent deploys
```

Fly automatically issues a certificate for your `*.fly.dev` subdomain and any custom domains you add with `fly certs add example.com`.

For the `bascik.config.js` inside the container:

```js
export const bascikConfig = {
  siteUrl: 'https://my-site.fly.dev',
  serve: { port: 8443, hostname: '0.0.0.0' },
};
```

### VPS or dedicated server

On a VPS (EC2, DigitalOcean Droplet, Hetzner, etc.) Bascik can own port 443 directly — no reverse proxy required.

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
