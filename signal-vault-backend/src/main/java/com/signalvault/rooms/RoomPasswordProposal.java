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
@Table(name = "room_password_proposals")
public class RoomPasswordProposal {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "room_id", nullable = false, updatable = false)
    private UUID roomId;

    @Column(name = "proposed_by", nullable = false, updatable = false)
    private UUID proposedBy;

    @Column(name = "proposed_password", nullable = false, columnDefinition = "TEXT", updatable = false)
    private String proposedPassword;

    @Column(name = "password_verifier", nullable = false, columnDefinition = "TEXT", updatable = false)
    private String passwordVerifier;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ProposalStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected RoomPasswordProposal() {}

    public static RoomPasswordProposal create(UUID roomId, UUID proposedBy,
                                               String proposedPassword, String passwordVerifier) {
        var p = new RoomPasswordProposal();
        p.id = UUID.randomUUID();
        p.roomId = roomId;
        p.proposedBy = proposedBy;
        p.proposedPassword = proposedPassword;
        p.passwordVerifier = passwordVerifier;
        p.status = ProposalStatus.PENDING;
        p.createdAt = Instant.now();
        return p;
    }

    public void accept()   { this.status = ProposalStatus.ACCEPTED;  this.resolvedAt = Instant.now(); }
    public void reject()   { this.status = ProposalStatus.REJECTED;  this.resolvedAt = Instant.now(); }
    public void cancel()   { this.status = ProposalStatus.CANCELLED; this.resolvedAt = Instant.now(); }

    public UUID getId()              { return id; }
    public UUID getRoomId()          { return roomId; }
    public UUID getProposedBy()      { return proposedBy; }
    public String getProposedPassword() { return proposedPassword; }
    public String getPasswordVerifier() { return passwordVerifier; }
    public ProposalStatus getStatus()   { return status; }
    public Instant getCreatedAt()    { return createdAt; }
    public Instant getResolvedAt()   { return resolvedAt; }
}
