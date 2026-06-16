# SignalVault Backend — Agent Notes

Spring Boot REST + WebSocket API for SignalVault. This file orients an agent working in
`signal-vault-backend/`. Only touch this module; the rest of the monorepo is read-only.

## Core security invariant

**The server stores ciphertext, never plaintext.** `SecureNote.encryptedContent` and
`Message.encryptedBody` are client-encrypted blobs. Never add server-side decryption, logging of
those fields, or any feature that assumes the server can read note/message content.

## Stack

- Java 21 (Gradle toolchain), Spring Boot 3.5.x
- Spring Security (stateless `SessionCreationPolicy.STATELESS`), JWT via jjwt 0.12.x, BCrypt
- Spring Data JPA + PostgreSQL 16, Flyway migrations (`db/ddl-auto=validate`)
- Spring WebSocket: STOMP + SockJS, CONNECT-frame JWT auth via `ChannelInterceptor`
- springdoc-openapi (Swagger UI at `/swagger-ui.html`)
- Tests: JUnit 5 + Mockito (unit), Testcontainers PostgreSQL (integration)

## Build / test (host has only JDK 26 — build via Docker)

Gradle does not run reliably on the host JDK (26) and there is no system Gradle. Build in Docker.

```bash
# Build the image (compiles + packages the fat jar, tests skipped in image build):
docker build -t sv-api ./signal-vault-backend
# Or via the root compose:
docker compose build signalvault-api
docker compose up -d --build        # postgres + api

# Run tests in a Gradle+JDK21 container (Testcontainers needs the docker socket):
docker run --rm -v "$PWD/signal-vault-backend":/app -w /app \
  -v /var/run/docker.sock:/var/run/docker.sock gradle:8.14-jdk21 gradle test
```

The Gradle wrapper is committed for convenience/CI but is **not** required on the host.

## Package structure

```
com.signalvault
├── auth        # User, RefreshToken (+ repos), AuthService (register/login/refresh/logout),
│               #   AuthController, MeController, RefreshCookieFactory, dto/
├── notes       # SecureNote (+ repo), NoteService, NoteController, dto/
├── rooms       # Room, Message (+ repos), RoomService, RoomController, dto/
│               #   (messages live inside rooms)
├── security    # JwtService, JwtProperties, JwtAuthenticationFilter, SecurityConfig,
│               #   AuthenticatedUser (principal), @CurrentUser, CORS/Cookie properties,
│               #   RestAuthenticationEntryPoint, AccessDeniedHandlerImpl
├── websocket   # WebSocketConfig, StompAuthChannelInterceptor, RoomMessageController
└── common      # ApiError, GlobalExceptionHandler (@RestControllerAdvice), exceptions, OpenApiConfig
```

## Conventions

- **Entities** use assigned UUID ids (generated in factory methods like `User.create(...)`), not DB
  sequences. `ddl-auto=validate` — the schema is owned by Flyway (`V1__init.sql`). New schema =
  new `V2__...sql`, never edit `V1`.
- **DTOs** are Java records with a static `from(entity)` mapper. Requests use `jakarta.validation`.
- **Controllers** get the caller via `@CurrentUser AuthenticatedUser` (= `@AuthenticationPrincipal`).
  Always scope queries by `user.id()`; ownership violations return **404** (not 403) to avoid leaking
  existence — see `*Repository.findByIdAndOwnerId`.
- **Errors** flow through `GlobalExceptionHandler` → uniform `ApiError`
  `{timestamp,status,error,message,path[,fieldErrors]}`. Unauthenticated requests get JSON 401 from
  `RestAuthenticationEntryPoint`.
- **JWT**: claims `sub=userId`, `email`. Access tokens are JWTs; refresh tokens are opaque random
  strings, stored only as SHA-256 hashes, rotated on every refresh.
- **TTL config is in SECONDS** (`APP_JWT_ACCESS_TTL`, `APP_JWT_REFRESH_TTL`) to match the root
  `docker-compose.yml`. `JwtProperties` exposes `*Millis()` helpers internally.

## API contract (must stay stable — clients depend on it)

- `POST /api/auth/register` → 201 `{accessToken, expiresIn, user:{id,email,createdAt}}` + `Set-Cookie refreshToken`
- `POST /api/auth/login` → 200 (same shape)
- `POST /api/auth/refresh` (refresh cookie) → 200 `{accessToken, expiresIn}` + rotated cookie
- `POST /api/auth/logout` → 204 (clears cookie)
- `GET /api/me` (Bearer) → 200 `{id,email,createdAt}`
- `GET|POST /api/notes`, `PUT|DELETE /api/notes/{id}` (Bearer) — owner-scoped
- `GET|POST /api/rooms`, `GET /api/rooms/{id}/messages` (Bearer)
- WS `/ws` (SockJS): CONNECT needs `Authorization: Bearer <token>`; subscribe `/topic/rooms/{id}`,
  send `/app/rooms/{id}` `{encryptedBody}`; broadcast `{type:"MESSAGE_CREATED", roomId, messageId, senderId, encryptedBody, createdAt}`.

Public endpoints (no auth): `/api/auth/register|login|refresh|logout`, `/swagger-ui/**`,
`/v3/api-docs/**`, `/actuator/health`, `/ws/**`. Everything else requires a Bearer token.
```
