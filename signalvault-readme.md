# SignalVault

Secure realtime notes and private messages built with Android, Jetpack Compose, and Spring Boot.

## Purpose

SignalVault is a portfolio project designed to prove Android security, realtime communication, and enterprise backend skills in one coherent product.

The app lets users protect sensitive notes locally and share private realtime messages through secure rooms. It is intentionally small, but every feature exists to demonstrate a skill that appears in strong Android job offers.

## What This Project Demonstrates

- Kotlin and Jetpack Compose for a modern native Android UI.
- MVVM and Clean Architecture with clear UI, domain, and data boundaries.
- WebSocket realtime communication with reconnection and connection states.
- Secure local access using Android Keystore, BiometricPrompt, and encrypted DataStore.
- JWT authentication with refresh token handling.
- Spring Boot backend with PostgreSQL and OpenAPI documentation.
- Docker Compose for local backend infrastructure.
- Unit, integration, and UI tests.
- GitHub Actions CI for Android and backend.

## Product Summary

Users can:

- Create an account and log in.
- Unlock the vault with biometrics.
- Create encrypted local notes.
- Join a private realtime room.
- Send and receive secure messages.
- Keep the app resilient when the WebSocket disconnects.

## Target Users

- Users who store sensitive short notes.
- Small teams sharing confidential snippets.
- Interviewers evaluating Android security and realtime architecture.

## Scope

### MVP

- Email/password login.
- JWT protected backend.
- Biometric vault unlock.
- Local encrypted notes.
- One realtime room per user.
- WebSocket connection state: connecting, connected, reconnecting, disconnected.
- Backend Docker Compose with PostgreSQL.
- Android and backend CI.

### Out Of Scope For MVP

- End-to-end cryptography between users.
- File attachments.
- Push notifications.
- Payment plans.
- Multi-device conflict resolution.

## Software Development Life Cycle

### 1. Discovery

Define the problem:

> Users need a small secure place to store private notes and exchange sensitive messages without exposing data casually on the device.

Example user story:

> As a user, I want to unlock my private vault with biometrics so that my notes stay protected if someone else has my phone.

Success criteria:

- A recruiter can understand the project in less than one minute.
- The README clearly shows Android security, realtime, backend, tests, and CI.
- The app can be demoed with a backend running locally.

### 2. Requirements

Functional requirements:

- Register and log in.
- Store JWT securely.
- Require biometrics before showing vault content.
- Create, update, and delete secure notes.
- Connect to a WebSocket room.
- Reconnect automatically after network loss.

Technical requirements:

- Android: Kotlin, Compose, MVVM, Clean Architecture.
- Security: Keystore, BiometricPrompt, encrypted DataStore.
- Backend: Java, Spring Boot, Spring Security, JWT, PostgreSQL.
- API docs: OpenAPI/Swagger.
- Infrastructure: Docker Compose.
- CI: GitHub Actions.

Quality requirements:

- Unit tests for use cases and ViewModels.
- Backend tests for auth and protected endpoints.
- Clear error states for auth, biometrics, network, and WebSocket.

### 3. Design

Android modules or packages:

```text
app/
  core/security
  core/network
  core/realtime
  feature/auth
  feature/vault
  feature/room
  data
  domain
```

Backend packages:

```text
com.signalvault.auth
com.signalvault.notes
com.signalvault.rooms
com.signalvault.security
com.signalvault.websocket
```

Core data model:

```text
User(id, email, passwordHash, createdAt)
SecureNote(id, ownerId, title, encryptedContent, createdAt, updatedAt)
Room(id, name, ownerId, createdAt)
Message(id, roomId, senderId, encryptedBody, createdAt)
```

API examples:

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
GET /api/notes
POST /api/notes
DELETE /api/notes/{id}
GET /api/rooms
WS /ws/rooms/{roomId}
```

Example WebSocket event:

```json
{
  "type": "MESSAGE_CREATED",
  "roomId": "room-123",
  "messageId": "msg-456",
  "createdAt": "2026-06-16T12:00:00Z"
}
```

### 4. Planning

Milestone 1: Backend auth and Android login.

- Spring Security JWT.
- Android login screen.
- Secure token storage.
- Protected endpoint smoke test.

Milestone 2: Secure vault.

- BiometricPrompt.
- Keystore-backed secret.
- Encrypted DataStore.
- Notes list and note editor.

Milestone 3: Realtime room.

- Spring WebSocket endpoint.
- Android WebSocket client.
- Connection state UI.
- Reconnection strategy.

Milestone 4: Tests and CI.

- Android unit tests.
- Backend integration tests.
- GitHub Actions workflows.

Milestone 5: Portfolio polish.

- Screenshots.
- Architecture diagram.
- Demo video.
- README and roadmap.

### 5. Implementation Strategy

Start with a vertical slice:

1. User logs in from Android.
2. Backend returns JWT.
3. Android stores token securely.
4. Android calls `/api/me`.
5. UI shows authenticated state.

Do not start with all screens. A small end-to-end flow proves the architecture early.

### 6. Testing Strategy

Android examples:

- `LoginViewModelTest`: successful login updates state.
- `UnlockVaultUseCaseTest`: locked vault does not expose content.
- `RealtimeConnectionManagerTest`: reconnects after disconnect.

Backend examples:

- Login returns access and refresh tokens.
- Protected endpoint rejects missing token.
- WebSocket room rejects unauthenticated connection.
- Notes cannot be read by another user.

### 7. CI/CD

Android workflow:

- Build debug APK.
- Run unit tests.
- Run lint.
- Optional detekt/ktlint.

Backend workflow:

- Run unit and integration tests.
- Start PostgreSQL through Testcontainers or service container.
- Build Docker image.
- Publish test report.

### 8. Deployment

Local:

```text
docker compose up -d
```

Services:

- `signalvault-api`
- `postgres`
- optional `nginx`

Production-like options:

- VPS Debian with Docker Compose.
- Railway/Fly.io/Render for quick demo.

### 9. Documentation

README should include:

- What the app does.
- Why it exists.
- Architecture diagram.
- Android screenshots.
- Backend setup.
- API docs URL.
- Security section.
- Testing section.
- CI badges.
- Roadmap.

### 10. Maintenance

Future issues:

- Add token rotation.
- Add certificate pinning.
- Add offline message queue.
- Add release build signing docs.
- Add Crashlytics.

## Portfolio Pitch

SignalVault is a secure realtime Android application built with Jetpack Compose and backed by a Spring Boot API. It demonstrates Android security, WebSocket resiliency, JWT auth, PostgreSQL persistence, Dockerized backend infrastructure, and automated testing through CI.

