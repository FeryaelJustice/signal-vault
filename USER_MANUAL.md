# SignalVault User Manual

SignalVault is a private notes and encrypted room messaging app. Use it when you want a
small vault for sensitive notes and private conversations where the server should not be
able to read the content.

## 1. Create an account

1. Open the app.
2. Select **Create account**.
3. Enter your email and account password.
4. After registration, the app opens the vault screen.

Your account password logs you in. It is not the same thing as your vault passphrase.

## 2. Set up your vault

The first time you unlock the vault on a browser/origin, you must create a vault
passphrase. This passphrase protects notes, room keys, and decrypted content in the
browser.

The vault passphrase must include:

- At least 12 characters
- One uppercase letter
- One lowercase letter
- One number
- One symbol

Example shape:

```text
Long-Private-Key-42!
```

Do not lose this passphrase. SignalVault cannot recover encrypted notes or room messages
without it.

## 3. Unlock the vault

1. Sign in.
2. Enter your vault passphrase.
3. The app derives the vault key in the browser.
4. Notes and room keys are decrypted only in memory.

If the passphrase is wrong, the vault stays locked.

## 4. Use private notes

Notes are for private information that belongs to you.

To create a note:

1. Open **Vault**.
2. Unlock the vault.
3. Select **New note**.
4. Add a title and content.
5. Save.

The note content is encrypted before leaving your browser. The server stores only
ciphertext.

## 4a. Maximum security notes

A maximum security note is protected by a separate per-note password that only you know.
The vault passphrase does **not** unlock it — only its own password does.

### Enable maximum security on a note

1. Open the note editor (**New note** or edit an existing note).
2. Scroll to the bottom of the dialog and toggle **Maximum security** on.
3. Enter a note password (minimum 8 characters) and confirm it.
4. Save.

**Write down the note password.** If you lose it, the note is permanently unrecoverable.
SignalVault cannot reset or recover it under any circumstances.

### Open a maximum security note

In the notes list, high-security notes show a **Protected** badge. Clicking one prompts
you for the note password before the editor opens.

Enter the correct password to decrypt and edit the note. If you enter the wrong password,
the note stays locked.

### Disable maximum security on a note

1. Open the note (enter the note password when prompted).
2. Toggle **Maximum security** off in the editor.
3. Save.

The note is re-encrypted with your vault key.

## 5. Use rooms

Rooms are private shared conversations.

Use a room when you want to discuss a sensitive topic with another registered user, for
example:

- Legal notes with a client
- Finance discussions with a partner
- Project secrets with a teammate
- Temporary exchange of sensitive details

Each room has its own room key. Messages are encrypted with that room key. Each member
stores their own encrypted copy of the room key.

## 6. Create a room

1. Open **Rooms**.
2. Unlock the vault.
3. Select **New room**.
4. Enter a room name.
5. (Optional) Enable **Maximum security** (see section 6a).
6. Create the room.

The app creates a new room key in your browser and stores it encrypted with your vault
key.

## 6a. Maximum security rooms

A maximum security room requires every member to enter a shared room password before they
can read or send messages. The server stores a password verifier; it never sees the actual
password.

### Enable maximum security when creating a room

1. Toggle **Maximum security** on in the creation dialog.
2. Enter a room password (minimum 8 characters) and confirm it.
3. Create the room.

Because you are the only member at creation time, the password is applied immediately
(unanimous approval requires 1/1 members: you).

High-security rooms are marked with a shield icon in the room list.

### Enter a high-security room

When you open a high-security room you see a password prompt instead of the message feed.
Enter the room password to gain access. Access is held in memory for the duration of the
browser session; closing the tab or refreshing requires you to enter it again.

### Change the room password (proposal mechanism)

The room password is changed through a **unanimous consent proposal**. Any member can
propose a new password:

1. In the room sidebar, press **Propose room password** (or **Propose password change** if
   you are not the owner).
2. Enter and confirm the proposed new password.
3. Submit the proposal.

All members — including the proposer (who auto-accepts) — must accept before the password
changes.

**What happens when a proposal is active:**

- Every member who opens the room while a proposal is pending sees a yellow notification
  banner. Click **Review** to open the vote dialog.
- The vote dialog shows: who proposed, what the proposed password is, and the current
  vote tally.
- Each member can **Accept** or **Reject** exactly once.
- **One rejection immediately cancels the proposal** — the password does not change.
- If all members accept, the proposal is resolved and the new password takes effect
  immediately.
- While some members have not yet voted, the proposal stays active and the current
  password remains unchanged.

**Warnings:**

- Write down the new password before submitting. There is no recovery mechanism.
- Members who forget the password after acceptance cannot enter the room until the
  password is changed again via a new proposal.

### Enable or disable high security (owners only)

The room owner can toggle high security on and off from the **Security** section in the
room sidebar. Disabling high security removes the password gate; the verifier remains in
the database so re-enabling is instant without a new proposal.

Enabling high security without a password set requires creating a proposal first.

### Password history (owners only)

Owners can view the full audit log by clicking **Password history** in the sidebar. Each
entry records:

- Who proposed the change
- The proposed password
- The outcome (Accepted / Rejected / Cancelled)
- The date and time
- Who voted to accept and who voted to reject

## 7. Invite another user

1. Open the room.
2. In the side panel, enter the registered user's email.
3. Select **Invite**.
4. The app copies an invite link.
5. Send that link to the other user through a trusted channel.

The invite link contains the room key in the URL fragment after `#roomKey=...`. Browsers
do not send that fragment to the backend, but anyone with the full link can join if the
invite matches their account. Treat invite links as sensitive.

## 8. Accept an invite

1. Sign in with the invited account.
2. Open the invite link.
3. Unlock the vault.
4. Select **Accept invite**.

The app encrypts the room key with the invited user's vault key and joins the room.

## 9. Read and send room messages

1. Open a room.
2. Unlock the vault.
3. Wait for the connection badge to show connected.
4. Send messages normally.

Room history is stored encrypted on the server. When you reopen the room, the app
downloads the encrypted history and decrypts it in your browser.

## 10. Members, online state, and leaving

The room side panel shows:

- Members, roles (owner / member), and online/offline state
- Pending invites (owners only)
- Security settings (owners only)
- Propose password change (all members)

Members can leave a room. Owners cannot leave their own room.

## 11. Common issues

### "Invalid vault passphrase"

The passphrase does not match the local vault verifier for this browser/origin.

### "Could not decrypt"

The note or message was encrypted with another key, passphrase, or origin. This can happen
if you used another browser, another ngrok URL, cleared local storage, or changed vault
setup.

### Invite link missing room key

The link was copied without the `#roomKey=...` part. Ask the room owner to generate and
send the invite link again.

### Messages appear after refresh but not after navigation

This should be fixed: rooms refetch message history when opened. If it returns, reload the
page and report the flow that caused it.

## 12. Security notes

- The backend never needs your vault passphrase.
- The backend never receives plaintext notes, messages, or room keys.
- The backend stores encrypted room keys per member, not raw room keys.
- The room password is never stored in plaintext on the server. The server stores only an
  encrypted verifier; the client verifies locally by decrypting it.
- During a password proposal, the proposed password is visible to all members so they can
  make an informed vote. It is retained in the history log for accountability.
- A single rejection is enough to block any password change — no majority voting.
- SQL injection is mitigated server-side by using validated request bodies and
  parameterized Spring Data JPA access, not string-built SQL.
- Shared invite links are sensitive; send them only through trusted channels.
- Losing a note password or room password means permanent loss of access to that
  content. There is no recovery mechanism by design.
