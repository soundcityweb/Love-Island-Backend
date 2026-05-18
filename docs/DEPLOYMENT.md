# Love Island Nigeria - Deployment Documentation

## Overview

Production deployment runs on a Contabo VPS using Docker Compose with three services: API (NestJS), Web (Next.js), and Redis. Nginx (managed by aaPanel) reverse-proxies traffic from `https://projects.sdtcdigital.com` to the containers.

## Server Access

| | Value |
|---|---|
| Host | 173.212.247.135 |
| Project dir | `/www/wwwroot/projects.sdtcdigital.com/love-island/` |
| Deploy user | `loveisland` (in `docker` group, owns project dir) |
| Domain | https://projects.sdtcdigital.com |

## Services & Ports

| Service | Internal Port | Exposed At | Purpose |
|---------|--------------|------------|---------|
| api     | 3000         | 127.0.0.1:4000 | NestJS API |
| web     | 3000         | 127.0.0.1:4001 | Next.js frontend |
| redis   | 6379         | internal only | Cache |

## Nginx Routing

The nginx vhost (`/www/server/panel/vhost/nginx/projects.sdtcdigital.com.conf`) routes:

| Path | Proxied To |
|------|-----------|
| `/api/admin/*` | `127.0.0.1:4001` (Next.js -- adds admin key, proxies internally) |
| `/api/*` | `127.0.0.1:4000` (NestJS direct) |
| `/uploads/*` | `127.0.0.1:4000` (NestJS static files) |
| `/` (everything else) | `127.0.0.1:4001` (Next.js) |

The `/api/admin/` rule MUST sit above the generic `/api/` rule -- nginx uses prefix-priority match (`^~`).

## Environment Variables

### API (`.env` in project root)
```
NODE_ENV=production
PORT=3000
API_PREFIX=api
CORS_ORIGIN=https://projects.sdtcdigital.com
FRONTEND_URL=https://projects.sdtcdigital.com
ADMIN_API_KEY=<secret>
DATABASE_URL=<supabase-postgres-url>
REDIS_URL=redis://redis:6379
SMTP_*=<mail credentials>
```

### Web (`web/.env`)
```
NEXT_PUBLIC_API_URL=https://projects.sdtcdigital.com
NEXT_PUBLIC_UPLOAD_DIR=https://projects.sdtcdigital.com/uploads/
NODE_ENV=production
```

NEXT_PUBLIC_* values are **baked at build time**. After changing them, rebuild: `docker compose build --no-cache web`.

## Deployment Steps

```bash
# SSH in
ssh loveisland@173.212.247.135
cd /www/wwwroot/projects.sdtcdigital.com/love-island/

# Pull latest in both repos
cd api && git pull && cd ..
cd web && git pull && cd ..

# Rebuild changed services
docker compose build --no-cache api  # if api changed
docker compose build --no-cache web  # if web changed

# Restart
docker compose up -d

# Verify
docker compose ps
docker compose logs -f api  # check for errors
docker compose logs -f web
```

## Known Issues & Fixes

### Issue: "Invalid or missing admin key" on admin dashboard
**Symptom**: 401 on `/api/admin/dashboard` only on production. Works locally.

**Root cause**: Two parts.
1. Web's server-side routes used `NEXT_PUBLIC_API_URL` (public URL through nginx). Nginx strips custom `X-Admin-Key` headers when proxying.
2. Nginx `location ^~ /api/` was catching ALL `/api/*` and routing directly to NestJS, bypassing the Next.js route handler that adds the admin key.

**Fix**:
1. Web routes use `SERVER_API_URL` (internal Docker network: `http://api:3000`) before falling back to public URL. Bypasses nginx entirely for server-side calls.
2. Nginx config gets a `location ^~ /api/admin/` block above `/api/` that proxies to Next.js (port 4001).

### Issue: `ERR_PNPM_OUTDATED_LOCKFILE` during web build
**Symptom**: `pnpm install --frozen-lockfile` fails because new deps in `package.json` aren't in `pnpm-lock.yaml`.

**Fix**: Run `pnpm install --lockfile-only` locally to regenerate lockfile, commit, push, then redeploy.

### Issue: "Something went wrong" / 404s for Next.js JS chunks
**Symptom**: Page loads but 404s on `/_next/static/chunks/<hash>.js`. Browser shows "Something went wrong!".

**Root cause**: Cloudflare cached old HTML referencing chunk hashes from a previous build. New build has different hashes. Cloudflare serves stale HTML -> chunks don't exist.

**Fix**: Add `CDN-Cache-Control` headers in `next.config.ts` to disable Cloudflare caching for HTML pages but keep aggressive caching for `/_next/static/*` (which has hashed filenames):
```ts
async headers() {
  return [
    {
      source: "/((?!_next/static|_next/image|uploads|favicon).*)",
      headers: [{ key: "CDN-Cache-Control", value: "no-store" }],
    },
    {
      source: "/_next/static/(.*)",
      headers: [{ key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ];
}
```

**Workaround**: Purge Cloudflare cache after each deployment.

### Issue: API container in restart loop -- `Cannot find module '/app/dist/main'`
**Symptom**: `docker compose ps` shows api as `Restarting`. Logs show `MODULE_NOT_FOUND` for `/app/dist/main`.

**Root cause**: NestJS build output goes to `/app/dist/src/main.js` (not `/app/dist/main.js`). The `start:prod` script uses `node dist/main` which fails.

**Fix**: Update the `start:prod` script in `api/package.json` to point to the correct path, OR update `nest-cli.json` to flatten the build output.

Investigating now -- see "Active Issues" below.

### Issue: API crash on boot -- `Configuration key "JWT_SECRET" does not exist`
**Symptom**: API container in restart loop. Logs show `TypeError: Configuration key "JWT_SECRET" does not exist` from `JwtStrategy`.

**Root cause**: The auth module added in May 2026 requires JWT env vars that aren't in the production `.env`.

**Fix**: Add to `.env`:
```
JWT_SECRET=<64-char hex string>
JWT_REFRESH_SECRET=<different 64-char hex string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```
Generate strong secrets with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

After updating `.env`, **fully recreate** the container so env vars are reloaded:
```bash
docker compose down && docker compose up -d
```
A simple `docker compose restart api` does NOT reload `.env` -- it only sends SIGHUP to the existing process.

### Issue: BT Panel-managed nginx config gets reset
The nginx config can be overwritten by aaPanel/BT Panel UI changes. After any BT Panel reconfiguration of the site, re-add the `/api/admin/` location block above `/api/`.

### Issue: Subdirectories owned by root (e.g. jf_backend, venv)
**Symptom**: Even after adding user to `www` group and chmod g+w on parent dir, can't write to subdirs.

**Root cause**: chmod doesn't bypass ownership. Subdirs created by another process with root ownership.

**Fix**: `chown -R www:www <dir>` then `chmod -R g+w <dir>`. The `.user.ini` file is BT Panel-immutable and can be skipped.

## User Management

Three deploy users created on the VPS:

| User | Access |
|------|--------|
| `loveisland` | Full access to `/love-island/` project, in `docker` group |
| `aritra` | Restricted to `/aritra-bhattacharya-innofied/` directory only |
| `sohomkar` | In `www` group, can write to all `myjobfeeder.com` directories. Has passwordless sudo for `systemctl restart django-app` only |

### Adding a passwordless sudo command
```bash
echo "<user> ALL=(root) NOPASSWD: /bin/systemctl restart <service>" | sudo tee /etc/sudoers.d/<user>-<service>
sudo chmod 440 /etc/sudoers.d/<user>-<service>
```

## Active Issues (deployment session 2026-05-01)

### 1. API restart loop -- dist/main not found [FIXED]
- **Cause**: When `prisma/seed.ts` was added, TypeScript expanded the build root to project root, putting output at `dist/src/main.js` instead of `dist/main.js`. The `start:prod` script (`node dist/main`) couldn't find it.
- **Fix**: Added `"rootDir": "./src"` to `tsconfig.json` and excluded `prisma` in both `tsconfig.json` and `tsconfig.build.json`. Now `dist/main.js` is generated correctly.

### 2. API can't connect to Supabase [BLOCKED]
- **Symptom**: `error: (ENOTFOUND) tenant/user postgres.tfxqgchitqrqjovwejzw not found`
- **Cause**: The Supabase project `tfxqgchitqrqjovwejzw` referenced in `DATABASE_URL` no longer exists. Likely deleted, paused, or migrated.
- **Action needed**: Get fresh `DATABASE_URL` from team and update `.env` on server.

### 3. Web builds and serves correctly [OK]
- Public site responds 200 OK at https://projects.sdtcdigital.com
- All Next.js JS chunks load
- Lockfile sync was needed (5 new deps: `@tinymce/tinymce-react`, `tinymce`, `sanitize-html`, `@types/sanitize-html`, `jose`)

### 4. Missing JWT_SECRET after auth module added [FIXED 2026-05-03]
- **Cause**: New auth module requires `JWT_SECRET` and `JWT_REFRESH_SECRET` env vars; production `.env` only had the older keys.
- **Fix**: Added the four `JWT_*` vars to `.env` and ran `docker compose down && up -d` (full recreate, not just restart, so env reloads). API now boots cleanly and serves requests.
