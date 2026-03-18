# Deployment

Pane uses `@sveltejs/adapter-node` and produces a standalone Node.js server.

## Building

```bash
pnpm build
```

This creates a `build/` directory with the production server.

## Running

```bash
node build
```

The server runs on port 3000 by default. Configure with the `PORT` environment variable:

```bash
PORT=8080 node build
```

## Data directories

The server creates two directories alongside the working directory:

- **`data/`** — SQLite database files (one `.db` per user plus `_auth.db` for authentication)
- **`storage/`** — Uploaded documents (one subdirectory per user, with per-space subdirectories within)

Both are created automatically on first run. Back these up to preserve your data.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ORIGIN` | — | Set if running behind a reverse proxy (e.g. `https://pane.example.com`) |
| `BODY_SIZE_LIMIT` | `512K` | Max request body size. Supports units: `K`, `M`, `G`. Set to `Infinity` to disable (required for file uploads) |
| `SINGLE_USER` | `false` | When `true`, no auth required — a synthetic user is injected automatically |
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | `Pane <SMTP_USER>` | From address for emails |
| `SMTP_SECURE` | `false` | Set to `true` for port 465 |

When SMTP is not configured, verification codes and sharing notifications are logged to the server console.

## Running behind a reverse proxy

If serving Pane behind nginx or similar, set the `ORIGIN` variable so SvelteKit generates correct URLs:

```bash
ORIGIN=https://pane.example.com BODY_SIZE_LIMIT=Infinity PORT=3000 node build
```

Example nginx config:

```nginx
server {
    listen 443 ssl;
    server_name pane.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 110m;
    }
}
```

Example Apache config (requires `mod_proxy` and `mod_proxy_http`):

```apache
<VirtualHost *:443>
    ServerName pane.example.com

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    RequestHeader set X-Forwarded-Proto "https"

    LimitRequestBody 115343360
    ProxyTimeout 300
    RequestReadTimeout header=20-40,MinRate=500 body=60,MinRate=500
</VirtualHost>
```

## Running with pm2

[pm2](https://pm2.keymetrics.io/) is a process manager for Node.js that keeps Pane running in the background and can auto-restart it on reboot.

### Quick start

```bash
npm install -g pm2
PORT=3000 HOST=127.0.0.1 pm2 start build/index.js --name pane
pm2 save
```

### Using the ecosystem file

An example config is included in the repository:

```bash
cp ecosystem.config.example.cjs ecosystem.config.cjs
```

Edit `ecosystem.config.cjs` to set your port, host, and origin, then start with:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### Auto-start on reboot

```bash
pm2 startup
```

Follow the printed instructions, then run `pm2 save` to persist the process list.

### Useful commands

| Command | Description |
|---------|-------------|
| `pm2 status` | Check process status |
| `pm2 logs pane` | Tail live logs |
| `pm2 restart pane` | Restart after a rebuild |
| `pm2 stop pane` | Stop the server |
| `pm2 delete pane` | Remove from pm2 |

## Docker

A `Dockerfile` and `docker-compose.yml` are included. Docker is the easiest way to run Pane without installing Node.js or native build tools.

### Pre-built image from GitHub Container Registry

Tagged releases are automatically published to `ghcr.io`. No cloning or building required:

```bash
docker run -d -p 3000:3000 -v ./data:/app/data -v ./storage:/app/storage ghcr.io/tomgem/pane:latest
```

You can pin to a specific version: `ghcr.io/tomgem/pane:1.6`

### Using Docker Compose (recommended)

```bash
docker compose up -d
```

Pane will be available at [http://localhost:3000](http://localhost:3000). Data is persisted to `./data/` and `./storage/` on the host via bind mounts.

To rebuild after code changes:

```bash
docker compose up -d --build
```

To stop:

```bash
docker compose down
```

### Using Docker directly

Build the image:

```bash
docker build -t pane .
```

Run the container:

```bash
docker run -d -p 3000:3000 -v ./data:/app/data -v ./storage:/app/storage pane
```

### Docker environment variables

Override environment variables in `docker-compose.yml` or via `docker run -e`:

```bash
docker run -d -p 8080:8080 \
  -e PORT=8080 \
  -e ORIGIN=https://pane.example.com \
  -e SINGLE_USER=true \
  -v ./data:/app/data \
  -v ./storage:/app/storage \
  pane
```

### Reverse proxy with Docker

When running behind a reverse proxy, uncomment and set the `ORIGIN` variable in `docker-compose.yml`:

```yaml
environment:
  - HOST=0.0.0.0
  - PORT=3000
  - ORIGIN=https://pane.example.com
```
