# SignalVault — API Contract

This is the **single source of truth** for the HTTP + WebSocket contract that every
client (web, Android, iOS) consumes and that the backend implements. The backend also
publishes a live OpenAPI document at `/v3/api-docs` and Swagger UI at `/swagger-ui.html`;
the web client regenerates its typed client from there (`pnpm gen:api`).

- Base URL (local): `http://localhost:8080`
- Auth scheme: short-lived **access token** as `Authorization: Bearer <jwt>` (kept in
  client memory) + long-lived **refresh token** delivered as an **HttpOnly cookie**
  (`refreshToken`, `SameSite=Lax`, `Secure` in prod). All browser calls use
  `credentials: 'include'` so the refresh cookie travels.
- Errors: uniform body `{ timestamp, status, error, message, path }`.

## Zero-knowledge note

`encryptedContent` (notes) and `encryptedBody` (messages) are **ciphertext produced on
the client**. The server stores and relays them but never sees plaintext. See
[`security.md`](./security.md).

## REST endpoints

### Auth — `/api/auth`

| Method | Path                  | Auth        | Body                  | Success                                                              |
|--------|-----------------------|-------------|-----------------------|---------------------------------------------------------------------|
| POST   | `/api/auth/register`  | public      | `{email, password}`   | `201 {accessToken, expiresIn, user:{id,email,createdAt}}` + cookie   |
| POST   | `/api/auth/login`     | public      | `{email, password}`   | `200 {accessToken, expiresIn, user}` + sets `refreshToken` cookie    |
| POST   | `/api/auth/refresh`   | cookie      | —                     | `200 {accessToken, expiresIn}` + rotates `refreshToken` cookie       |
| POST   | `/api/auth/logout`    | cookie      | —                     | `204` + clears cookie                                               |
| GET    | `/api/me`             | Bearer      | —                     | `200 {id, email, createdAt}`                                        |

Refresh tokens are **rotating**: each `/refresh` invalidates the previous token.

### Notes (vault) — `/api/notes`

| Method | Path              | Auth   | Body                          | Success                  |
|--------|-------------------|--------|-------------------------------|--------------------------|
| GET    | `/api/notes`      | Bearer | —                             | `200 [SecureNote]`       |
| POST   | `/api/notes`      | Bearer | `{title, encryptedContent}`   | `201 SecureNote`         |
| PUT    | `/api/notes/{id}` | Bearer | `{title, encryptedContent}`   | `200 SecureNote` / `404` |
| DELETE | `/api/notes/{id}` | Bearer | —                             | `204`                    |

`SecureNote = {id, title, encryptedContent, createdAt, updatedAt}`. Notes are scoped to
the authenticated owner; cross-user access returns `404`.

### Rooms & messages — `/api/rooms`

| Method | Path                         | Auth   | Body       | Success            |
|--------|------------------------------|--------|------------|--------------------|
| GET    | `/api/rooms`                 | Bearer | —          | `200 [Room]`       |
| POST   | `/api/rooms`                 | Bearer | `{name}`   | `201 Room`         |
| GET    | `/api/rooms/{id}/messages`   | Bearer | —          | `200 [Message]`    |

`Room = {id, name, ownerId, createdAt}` · `Message = {id, roomId, senderId, encryptedBody, createdAt}`.

## WebSocket (STOMP over SockJS)

- Endpoint: `/ws` (SockJS enabled).
- **Auth on CONNECT**: STOMP header `Authorization: Bearer <accessToken>`, validated by a
  `ChannelInterceptor`. Invalid/missing token ⇒ connection rejected.
- Subscribe: `/topic/rooms/{roomId}`
- Send: `/app/rooms/{roomId}` with body `{ encryptedBody }`
- Broadcast event payload:

```json
{
  "type": "MESSAGE_CREATED",
  "roomId": "room-123",
  "messageId": "msg-456",
  "senderId": "user-789",
  "encryptedBody": "<base64 envelope>",
  "createdAt": "2026-06-16T12:00:00Z"
}
```

Clients surface connection state: `connecting | connected | reconnecting | disconnected`,
with automatic reconnection + backoff.
