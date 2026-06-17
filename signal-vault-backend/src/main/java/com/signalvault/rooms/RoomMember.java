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
@Table(name = "room_members")
public class RoomMember {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private RoomRole role;

    @Column(name = "encrypted_room_key", columnDefinition = "TEXT")
    private String encryptedRoomKey;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    protected RoomMember() {
        // for JPA
    }

    public RoomMember(UUID id, UUID roomId, UUID userId, RoomRole role,
                      String encryptedRoomKey, Instant joinedAt, Instant lastSeenAt) {
        this.id = id;
        this.roomId = roomId;
        this.userId = userId;
        this.role = role;
        this.encryptedRoomKey = encryptedRoomKey;
        this.joinedAt = joinedAt;
        this.lastSeenAt = lastSeenAt;
    }

    public static RoomMember create(UUID roomId, UUID userId, RoomRole role, String encryptedRoomKey) {
        return new RoomMember(UUID.randomUUID(), roomId, userId, role, encryptedRoomKey, Instant.now(), Instant.now());
    }

    public UUID getId() {
        return id;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public UUID getUserId() {
        return userId;
    }

    public RoomRole getRole() {
        return role;
    }

    public String getEncryptedRoomKey() {
        return encryptedRoomKey;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public void setEncryptedRoomKey(String encryptedRoomKey) {
        this.encryptedRoomKey = encryptedRoomKey;
    }

    public void markSeen(Instant at) {
        this.lastSeenAt = at;
    }
}
