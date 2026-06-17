# SignalVault Backend

Secure notes and realtime private messages API for **SignalVault**.

The server is **zero-knowledge for user content**: note bodies (`encryptedContent`), room
keys (`encryptedRoomKey`) and message bodies (`encryptedBody`) are **client-side
ciphertext**. The backend stores and relays them but never sees plaintext.

## Stack

- **Java 21** (Gradle toolchain), **Spring Boot 3.5.x**
- **Spring Security** (stateless, JWT) + **BCrypt** password hashing
- **JWT** via [jjwt](https://github.com/jwtk/jjwt) `0.12.x` — short-lived access tokens + rotating refresh tokens
- **Spring Data JPA** + **PostgreSQL 16**
- **Flyway** migrations
- **Spring WebSocket** (STOMP + SockJS) for realtime messaging
- **springdoc-openapi** (Swagger UI)
- **Tests**: JUnit 5, Mockito, Testcontainers (PostgreSQL)
- **Docker** multi-stage build (Gradle+JDK21 → Temurin JRE 21, non-root)

## Run with Docker Compose

The compose file lives at the **monorepo root** (`../docker-compose.yml`) and builds this module.

```bash
# from the monorepo root (signal-vault/)
docker compose up -d --build          # builds the API image + starts postgres
docker compose logs -f signalvault-api
docker compose down -v                # stop and wipe the DB volume
```

Services:

- `postgres` — PostgreSQL 16 on `localhost:5432` (db/user/pass = `signalvault`)
- `signalvault-api` — this API on `http://localhost:8080` (waits for postgres healthy)
- `adminer` (optional) — `docker compose --profile tools up adminer` → `http://localhost:8081`

### Build just the image

```bash
docker build -t sv-api ./signal-vault-backend
# or
docker compose build signalvault-api
```

> **Note on the host JDK:** this machine ships only JDK 26, on which Gradle does not run reliably,
> and there is no system Gradle. The project therefore builds **inside Docker** (Gradle image with
> JDK 21). The Gradle wrapper is included for convenience but you do not need to run `./gradlew` on
> the host. CI (Linux) runs the full test suite including Testcontainers.

## API

Base URL: `http://localhost:8080`

### Auth

| Method | Path                  | Auth          | Body / Notes |
|--------|-----------------------|---------------|--------------|
| POST   | `/api/auth/register`  | public        | `{email,password}` → `201 {accessToken, expiresIn, user:{id,email,createdAt}}` + `Set-Cookie refreshToken` |
| POST   | `/api/auth/login`     | public        | `{email,password}` → `200` same shape as register |
| POST   | `/api/auth/refresh`   | refresh cookie| reads `refreshToken` cookie → `200 {accessToken, expiresIn}`, **rotates** the cookie |
| POST   | `/api/auth/logout`    | public        | `204`, clears the cookie |
| GET    | `/api/me`             | Bearer        | `200 {id,email,createdAt}` |

The `refreshToken` cookie is **HttpOnly**, **SameSite=Lax**, **Path=/**. `Secure` is controlled by
`APP_COOKIE_SECURE` (false for local http dev, true behind HTTPS). Refresh tokens are **rotating**:
each refresh revokes the presented token and issues a new one. Only a SHA-256 hash of each refresh
token is stored server-side; the raw value lives only in the cookie. Reusing a revoked token revokes
the whole token family for that user.

### Notes (Bearer)

| Method | Path              | Body / Notes |
|--------|-------------------|--------------|
| GET    | `/api/notes`      | `200 [Note...]` — only the caller's notes |
| POST   | `/api/notes`      | `{title,encryptedContent}` → `201 Note` |
| PUT    | `/api/notes/{id}` | `{title,encryptedContent}` → `200 Note` (ownership enforced; `404` if not yours) |
| DELETE | `/api/notes/{id}` | `204` (ownership enforced; `404` if not yours) |

### Rooms & messages (Bearer)

| Method | Path | Body / Notes |
|--------|------|--------------|
| GET    | `/api/rooms` | `200 [Room...]` — rooms where the caller is a member |
| POST   | `/api/rooms` | `{name, encryptedRoomKey}` → `201 Room` |
| GET    | `/api/rooms/invites` | pending invites addressed to the caller's email |
| POST   | `/api/rooms/invites/{id}/accept` | `{encryptedRoomKey}` → caller joins the room |
| GET    | `/api/rooms/{id}/members` | members, roles and online state |
| GET    | `/api/rooms/{id}/invites` | owner-visible invite list |
| POST   | `/api/rooms/{id}/invites` | owner invites an existing user by email |
| POST   | `/api/rooms/{id}/presence` | mark caller online in the room |
| DELETE | `/api/rooms/{id}/membership` | non-owner member leaves |
| GET    | `/api/rooms/{id}/messages` | `200 [Message...]` recent (newest first); membership enforced |

Room messages are encrypted with a client-generated room key. The backend stores one
encrypted copy of that room key per member.

### WebSocket (STOMP + SockJS)

- Endpoint: `/ws` (SockJS enabled).
- **Auth**: send `Authorization: Bearer <accessToken>` as a **native header on the STOMP CONNECT
  frame**. A `ChannelInterceptor` validates it and rejects the connection if missing/invalid.
- Subscribe: `/topic/rooms/{roomId}`
- Send: `/app/rooms/{roomId}` with body `{ "encryptedBody": "<ciphertext>" }`
- The server persists the message and broadcasts to `/topic/rooms/{roomId}`:

```json
{
  "type": "MESSAGE_CREATED",
  "roomId": "…",
  "messageId": "…",
  "senderId": "…",
  "encryptedBody": "…",
  "createdAt": "2026-06-16T12:00:00Z"
}
```

### Errors

Uniform error body for every failure:

```json
{ "timestamp": "…", "status": 404, "error": "Not Found", "message": "Note not found", "path": "/api/notes/…" }
```

Validation failures additionally include a `fieldErrors` array.

## Swagger / OpenAPI

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

Use the **Authorize** button (bearerAuth) and paste an access token to call protected endpoints.

## Environment variables

| Variable                     | Default                                              | Meaning |
|------------------------------|------------------------------------------------------|---------|
| `SERVER_PORT`                | `8080`                                               | HTTP port |
| `SPRING_DATASOURCE_URL`      | `jdbc:postgresql://localhost:5432/signalvault`       | JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `signalvault`                                        | DB user |
| `SPRING_DATASOURCE_PASSWORD` | `signalvault`                                        | DB password |
| `APP_JWT_SECRET`             | dev-only long string                                 | HMAC secret (≥ 32 bytes). **Override in prod.** |
| `APP_JWT_ACCESS_TTL`         | `900`                                                | Access token TTL, **seconds** |
| `APP_JWT_REFRESH_TTL`        | `604800`                                             | Refresh token TTL, **seconds** |
| `APP_CORS_ALLOWED_ORIGINS`   | `http://localhost:3000`                              | Comma-separated allowed origins (credentials enabled) |
| `APP_COOKIE_SECURE`          | `false`                                              | Set `true` behind HTTPS so the refresh cookie is Secure |

## Tests

```bash
# Run inside a Gradle+JDK21 container (Testcontainers needs the host Docker socket):
docker run --rm -v "$PWD/signal-vault-backend":/app -w /app \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gradle:8.14-jdk21 gradle test
```

- **Unit**: `JwtServiceTest` (generate/validate/expire/forged), `AuthServiceTest` (register/login/refresh rotation/logout).
- **Integration** (`@SpringBootTest` + Testcontainers PostgreSQL):
  - `AuthIntegrationTest` — register/login return access + refresh cookie; `/api/me` 401 without token, 200 with token; refresh rotation invalidates the old token.
  - `NotesIsolationIntegrationTest` — a user cannot read/update/delete another user's notes.
  - `WebSocketAuthIntegrationTest` — STOMP CONNECT is rejected without/with an invalid token and accepted with a valid one.

> Testcontainers requires Docker and runs reliably in CI (GitHub Actions Linux). On a host with only
> JDK 26 and no Gradle, run them in the container above or rely on CI.

## Package structure

```
com.signalvault
├── auth        # User, RefreshToken, AuthService, AuthController, MeController, dto/
├── notes       # SecureNote, NoteService, NoteController, dto/
├── rooms       # Room, RoomMember, RoomInvite, Message, RoomService, RoomController, dto/
├── security    # JwtService, JwtAuthenticationFilter, SecurityConfig, properties, principal
├── websocket   # WebSocketConfig, StompAuthChannelInterceptor, RoomMessageController
└── common      # ApiError, GlobalExceptionHandler, exceptions, OpenApiConfig
```
