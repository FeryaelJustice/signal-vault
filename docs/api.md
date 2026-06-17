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

## Zero-knowledge data

`encryptedContent` (notes) and `encryptedBody` (messages) are **ciphertext produced on
the client**. The server stores and relays them but never sees plaintext. See
[`security.md`](./security.md).

Shared rooms use a random client-generated room key. The backend stores one
`encryptedRoomKey` per member; each value is the same room key encrypted by that member's
own vault key. Invite links carry the raw room key in the URL fragment (`#roomKey=...`),
which browsers do not send to the server.

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

| Method | Path              | Auth   | Body                                          | Success                  |
|--------|-------------------|--------|-----------------------------------------------|--------------------------|
| GET    | `/api/notes`      | Bearer | —                                             | `200 [SecureNote]`       |
| POST   | `/api/notes`      | Bearer | `{title, encryptedContent, highSecurity}`     | `201 SecureNote`         |
| PUT    | `/api/notes/{id}` | Bearer | `{title, encryptedContent, highSecurity}`     | `200 SecureNote` / `404` |
| DELETE | `/api/notes/{id}` | Bearer | —                                             | `204`                    |

`SecureNote = {id, title, encryptedContent, highSecurity, createdAt, updatedAt}`.

`highSecurity: boolean` — when `true` the client encrypted `encryptedContent` with a
per-note password via PBKDF2+AES-GCM instead of the vault key. The backend stores the flag
as-is and does not interpret the ciphertext differently.

Notes are scoped to the authenticated owner; cross-user access returns `404`.

### Rooms & messages — `/api/rooms`

#### Core room endpoints

| Method | Path                                  | Auth   | Body                                    | Success              |
|--------|---------------------------------------|--------|-----------------------------------------|----------------------|
| GET    | `/api/rooms`                          | Bearer | —                                       | `200 [Room]`         |
| POST   | `/api/rooms`                          | Bearer | `{name, encryptedRoomKey, highSecurity}`| `201 Room`           |
| GET    | `/api/rooms/invites`                  | Bearer | —                                       | `200 [RoomInvite]`   |
| POST   | `/api/rooms/invites/{id}/accept`      | Bearer | `{encryptedRoomKey}`                    | `200 Room`           |
| GET    | `/api/rooms/{id}/members`             | Bearer | —                                       | `200 [RoomMember]`   |
| GET    | `/api/rooms/{id}/invites`             | Bearer | —                                       | `200 [RoomInvite]`   |
| POST   | `/api/rooms/{id}/invites`             | Bearer | `{email}`                               | `201 RoomInvite`     |
| POST   | `/api/rooms/{id}/presence`            | Bearer | —                                       | `204`                |
| DELETE | `/api/rooms/{id}/membership`          | Bearer | —                                       | `204`                |
| GET    | `/api/rooms/{id}/messages`            | Bearer | —                                       | `200 [Message]`      |

`Room = {id, name, ownerId, createdAt, encryptedRoomKey, role, memberCount, onlineCount, highSecurity, passwordVerifier}`.

- `highSecurity: boolean` — when `true` the room requires password verification by all members before they can read or send messages.
- `passwordVerifier: string | null` — an encrypted sentinel value stored server-side. The client verifies the room password by decrypting it and checking `"signalvault:room-password:v1"`. The backend never sees the actual room password.

`RoomMember = {userId, email, role, joinedAt, lastSeenAt, online}`.
`RoomInvite = {id, roomId, roomName, inviterId, inviterEmail, inviteeEmail, status, createdAt, acceptedAt}`.
`Message = {id, roomId, senderId, encryptedBody, createdAt}`.

Permissions:

- Members can read room history, connect to the room topic, and send encrypted messages.
- Owners can invite users by email, toggle `highSecurity`, and view password history.
- Any member can create or vote on a password proposal.
- Invited users can accept only invites addressed to their email.
- Members can leave rooms; owners cannot leave their own room in the MVP.

#### Room security endpoints

| Method | Path                                                    | Auth        | Body                                       | Success                                       |
|--------|---------------------------------------------------------|-------------|--------------------------------------------|-----------------------------------------------|
| PATCH  | `/api/rooms/{id}/security`                              | Bearer/Owner| `{highSecurity}`                           | `200 Room`                                    |
| POST   | `/api/rooms/{id}/password-proposals`                    | Bearer/Mbr  | `{proposedPassword, passwordVerifier}`     | `201 PasswordProposal`                        |
| GET    | `/api/rooms/{id}/password-proposals/pending`            | Bearer/Mbr  | —                                          | `200 PasswordProposal` or `204 No Content`    |
| POST   | `/api/rooms/{id}/password-proposals/{pid}/vote`         | Bearer/Mbr  | `{vote: "ACCEPT"\|"REJECT"}`               | `200 PasswordProposal`                        |
| GET    | `/api/rooms/{id}/password-history`                      | Bearer/Mbr  | —                                          | `200 [PasswordHistoryEntry]`                  |

**`PasswordProposal`**:
```jsonc
{
  "id": "uuid",
  "roomId": "uuid",
  "proposedByUserId": "uuid",
  "proposedByEmail": "string",
  "proposedPassword": "string",         // plaintext — shown to all members for voting
  "passwordVerifier": "string",         // encrypted sentinel — applied on acceptance
  "status": "PENDING|ACCEPTED|REJECTED|CANCELLED",
  "createdAt": "ISO-8601",
  "resolvedAt": "ISO-8601 | null",
  "votes": [{ "userId", "email", "vote": "ACCEPT|REJECT", "votedAt" }],
  "totalMembers": 3,
  "myVote": "ACCEPT|REJECT|null"
}
```

**`PasswordHistoryEntry`**:
```jsonc
{
  "id": "uuid",
  "roomId": "uuid",
  "proposalId": "uuid | null",
  "initiatedByUserId": "uuid",
  "initiatedByEmail": "string",
  "proposedPassword": "string",
  "outcome": "ACCEPTED|REJECTED|CANCELLED",
  "completedAt": "ISO-8601",
  "acceptedBy": [{ "userId", "email", "votedAt" }],
  "rejectedBy":  [{ "userId", "email", "votedAt" }]
}
```

**Proposal lifecycle rules:**

- Creating a new proposal when one is already PENDING cancels the existing one first.
- The proposer is automatically counted as having voted ACCEPT.
- One REJECT → proposal immediately moves to REJECTED; `passwordVerifier` unchanged.
- All members ACCEPT → proposal moves to ACCEPTED; `room.passwordVerifier` is updated and `room.highSecurity` is set to `true`.
- `PATCH /{id}/security { highSecurity: false }` can disable the gate without a proposal (owner only). The verifier stays in the DB so re-enabling is instant.

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
