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

- **`data/`** — SQLite database files (one `.db` per space)
- **`storage/`** — Uploaded documents (one subdirectory per space)

Both are created automatically on first run. Back these up to preserve your data.

## Environment

No environment variables are required. Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ORIGIN` | — | Set if running behind a reverse proxy (e.g. `https://pane.example.com`) |

## Running behind a reverse proxy

If serving Pane behind nginx or similar, set the `ORIGIN` variable so SvelteKit generates correct URLs:

```bash
ORIGIN=https://pane.example.com PORT=3000 node build
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
        client_max_body_size 50m;
    }
}
```

## Docker

A `Dockerfile` and `docker-compose.yml` are included. Docker is the easiest way to run Pane without installing Node.js or native build tools.

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
