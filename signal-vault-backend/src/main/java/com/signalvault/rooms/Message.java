package com.signalvault.rooms;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A room message. {@code encryptedBody} holds client-side ciphertext only;
 * the server never sees the plaintext.
 */
@Entity
@Table(name = "messages")
public class Message {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @Column(name = "encrypted_body", nullable = false, columnDefinition = "TEXT")
    private String encryptedBody;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Message() {
        // for JPA
    }

    public Message(UUID id, UUID roomId, UUID senderId, String encryptedBody, Instant createdAt) {
        this.id = id;
        this.roomId = roomId;
        this.senderId = senderId;
        this.encryptedBody = encryptedBody;
        this.createdAt = createdAt;
    }

    public static Message create(UUID roomId, UUID senderId, String encryptedBody) {
        return new Message(UUID.randomUUID(), roomId, senderId, encryptedBody, Instant.now());
    }

    public UUID getId() {
        return id;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public UUID getSenderId() {
        return senderId;
    }

    public String getEncryptedBody() {
        return encryptedBody;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
