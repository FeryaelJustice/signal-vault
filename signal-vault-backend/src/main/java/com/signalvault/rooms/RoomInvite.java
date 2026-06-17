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
@Table(name = "room_invites")
public class RoomInvite {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "inviter_id", nullable = false)
    private UUID inviterId;

    @Column(name = "invitee_email", nullable = false, length = 320)
    private String inviteeEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private RoomInviteStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    protected RoomInvite() {
        // for JPA
    }

    public RoomInvite(UUID id, UUID roomId, UUID inviterId, String inviteeEmail,
                      RoomInviteStatus status, Instant createdAt, Instant acceptedAt) {
        this.id = id;
        this.roomId = roomId;
        this.inviterId = inviterId;
        this.inviteeEmail = inviteeEmail;
        this.status = status;
        this.createdAt = createdAt;
        this.acceptedAt = acceptedAt;
    }

    public static RoomInvite create(UUID roomId, UUID inviterId, String inviteeEmail) {
        return new RoomInvite(UUID.randomUUID(), roomId, inviterId, inviteeEmail.toLowerCase(),
                RoomInviteStatus.PENDING, Instant.now(), null);
    }

    public UUID getId() {
        return id;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public UUID getInviterId() {
        return inviterId;
    }

    public String getInviteeEmail() {
        return inviteeEmail;
    }

    public RoomInviteStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void accept() {
        this.status = RoomInviteStatus.ACCEPTED;
        this.acceptedAt = Instant.now();
    }
}
