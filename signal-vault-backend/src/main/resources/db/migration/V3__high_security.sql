-- High-security mode for notes and rooms.
-- Note high_security: content encrypted with a per-note password instead of the vault key.
-- Room high_security: all members must enter a shared room password in addition to vault unlock.
-- The server stores an encrypted verifier; it never sees plaintext passwords.

ALTER TABLE secure_notes ADD COLUMN high_security BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rooms ADD COLUMN high_security     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN password_verifier TEXT;

-- One pending proposal per room at a time (any member can propose a new room password).
CREATE TABLE room_password_proposals (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id           UUID    NOT NULL,
    proposed_by       UUID    NOT NULL,
    proposed_password TEXT    NOT NULL,           -- shown to members during the vote window
    password_verifier TEXT    NOT NULL,           -- created by proposer; stored on room when accepted
    status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMPTZ,
    CONSTRAINT fk_proposals_room     FOREIGN KEY (room_id)     REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_proposals_proposer FOREIGN KEY (proposed_by) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_proposals_room_status ON room_password_proposals (room_id, status);

-- Per-member votes; proposer auto-votes ACCEPT when creating the proposal.
CREATE TABLE room_password_votes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    vote        VARCHAR(16) NOT NULL,
    voted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_votes_proposal FOREIGN KEY (proposal_id) REFERENCES room_password_proposals (id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_voter    FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_votes_proposal_user UNIQUE (proposal_id, user_id)
);

CREATE INDEX idx_votes_proposal ON room_password_votes (proposal_id);

-- Immutable audit log of every resolved proposal.
CREATE TABLE room_password_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id           UUID        NOT NULL,
    proposal_id       UUID,
    initiated_by      UUID        NOT NULL,
    proposed_password TEXT        NOT NULL,
    outcome           VARCHAR(16) NOT NULL,
    completed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_history_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
);

CREATE INDEX idx_history_room ON room_password_history (room_id, completed_at DESC);
