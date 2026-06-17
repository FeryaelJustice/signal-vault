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
@Table(name = "room_password_history")
public class RoomPasswordHistory {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "room_id", nullable = false, updatable = false)
    private UUID roomId;

    @Column(name = "proposal_id", updatable = false)
    private UUID proposalId;

    @Column(name = "initiated_by", nullable = false, updatable = false)
    private UUID initiatedBy;

    @Column(name = "proposed_password", nullable = false, columnDefinition = "TEXT", updatable = false)
    private String proposedPassword;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 16, updatable = false)
    private ProposalStatus outcome;

    @Column(name = "completed_at", nullable = false, updatable = false)
    private Instant completedAt;

    protected RoomPasswordHistory() {}

    public static RoomPasswordHistory create(UUID roomId, UUID proposalId, UUID initiatedBy,
                                              String proposedPassword, ProposalStatus outcome) {
        var h = new RoomPasswordHistory();
        h.id = UUID.randomUUID();
        h.roomId = roomId;
        h.proposalId = proposalId;
        h.initiatedBy = initiatedBy;
        h.proposedPassword = proposedPassword;
        h.outcome = outcome;
        h.completedAt = Instant.now();
        return h;
    }

    public UUID getId()              { return id; }
    public UUID getRoomId()          { return roomId; }
    public UUID getProposalId()      { return proposalId; }
    public UUID getInitiatedBy()     { return initiatedBy; }
    public String getProposedPassword() { return proposedPassword; }
    public ProposalStatus getOutcome()  { return outcome; }
    public Instant getCompletedAt()  { return completedAt; }
}
