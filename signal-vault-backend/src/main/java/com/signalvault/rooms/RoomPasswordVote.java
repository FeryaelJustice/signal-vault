package com.signalvault.rooms;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "room_password_votes")
public class RoomPasswordVote {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "proposal_id", nullable = false, updatable = false)
    private UUID proposalId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "vote", nullable = false, length = 16, updatable = false)
    private VoteType vote;

    @Column(name = "voted_at", nullable = false, updatable = false)
    private Instant votedAt;

    protected RoomPasswordVote() {}

    public static RoomPasswordVote create(UUID proposalId, UUID userId, VoteType vote) {
        var v = new RoomPasswordVote();
        v.id = UUID.randomUUID();
        v.proposalId = proposalId;
        v.userId = userId;
        v.vote = vote;
        v.votedAt = Instant.now();
        return v;
    }

    public UUID getId()         { return id; }
    public UUID getProposalId() { return proposalId; }
    public UUID getUserId()     { return userId; }
    public VoteType getVote()   { return vote; }
    public Instant getVotedAt() { return votedAt; }
}
