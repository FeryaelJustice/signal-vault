-- Shared encrypted rooms.
--
-- The server still stores ciphertext only. A room has one random client-side room key,
-- stored once per member as encrypted_room_key. Each member encrypts that room key with
-- their own local vault key before sending it to the server.

CREATE TABLE room_members (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id            UUID NOT NULL,
    user_id            UUID NOT NULL,
    role               VARCHAR(32) NOT NULL,
    encrypted_room_key TEXT,
    joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at       TIMESTAMPTZ,
    CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_room_members_room_user UNIQUE (room_id, user_id)
);

CREATE INDEX idx_room_members_user ON room_members (user_id);
CREATE INDEX idx_room_members_room ON room_members (room_id);

INSERT INTO room_members (room_id, user_id, role, encrypted_room_key, joined_at)
SELECT id, owner_id, 'OWNER', NULL, created_at
FROM rooms
ON CONFLICT (room_id, user_id) DO NOTHING;

CREATE TABLE room_invites (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id       UUID NOT NULL,
    inviter_id    UUID NOT NULL,
    invitee_email VARCHAR(320) NOT NULL,
    status        VARCHAR(32) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at   TIMESTAMPTZ,
    CONSTRAINT fk_room_invites_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_room_invites_inviter FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_room_invites_invitee_status ON room_invites (invitee_email, status);
CREATE INDEX idx_room_invites_room ON room_invites (room_id);
