# Local sharing

This project can be run locally or shared from a development machine in a few ways.

## Option 0: local development only

Use this when only you need to use the app on your own machine.

Terminal 1, from the monorepo root:

```powershell
docker compose up -d --build
```

This starts:

- API: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger-ui.html`
- Health: `http://localhost:8080/actuator/health`
- PostgreSQL: `localhost:5432`

Terminal 2:

```powershell
cd signal-vault-web
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

Stop everything:

```powershell
# Stop the web dev server with Ctrl+C in Terminal 2.
docker compose down
```

To wipe the local database volume too:

```powershell
docker compose down -v
```

## Option A: one public URL through the web production server

Use this for demos. The browser talks to one origin only, and Next.js proxies backend
traffic:

- `/api/*` -> `http://localhost:8080/api/*`
- `/ws/*` -> `http://localhost:8080/ws/*`

Configuration lives in `signal-vault-web/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_WS_URL=/ws
```

Do not change these env values for local development or for the one-URL ngrok flow.
The empty API base URL makes browser requests use the same origin, and `next.config.ts`
proxies `/api` and `/ws` to the local backend.

Start everything:

```powershell
docker compose up -d --build
cd signal-vault-web
pnpm install
pnpm build
pnpm start
ngrok http 3000
```

Share the `https://...ngrok-free.app` URL that ngrok prints.

Do not expose `pnpm dev` through ngrok for demos. Next dev uses HMR over
`/_next/webpack-hmr`; that can fail behind ngrok and leave the app stuck or constantly
trying to reconnect. Use `pnpm build` + `pnpm start` for shared demo URLs.

## Option B: two public URLs

Use this when you want the frontend to call a separately exposed backend.
This is the only flow here that requires changing frontend env vars.

Terminal 1:

```powershell
docker compose up -d --build
ngrok http 8080
```

Terminal 2:

```powershell
cd signal-vault-web
$env:NEXT_PUBLIC_API_BASE_URL="https://BACKEND.ngrok-free.app"
$env:NEXT_PUBLIC_WS_URL="https://BACKEND.ngrok-free.app/ws"
pnpm build
pnpm start
ngrok http 3000
```

Share the frontend ngrok URL. The backend accepts localhost and
`https://*.ngrok-free.app` origins through `APP_CORS_ALLOWED_ORIGINS` in
`docker-compose.yml`.
