package com.signalvault.notes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A secure note. {@code encryptedContent} holds client-side ciphertext only;
 * the server never sees the plaintext.
 */
@Entity
@Table(name = "secure_notes")
public class SecureNote {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "title", nullable = false, length = 512)
    private String title;

    @Column(name = "encrypted_content", nullable = false, columnDefinition = "TEXT")
    private String encryptedContent;

    @Column(name = "high_security", nullable = false)
    private boolean highSecurity;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected SecureNote() {
        // for JPA
    }

    public SecureNote(UUID id, UUID ownerId, String title, String encryptedContent,
                      boolean highSecurity, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.ownerId = ownerId;
        this.title = title;
        this.encryptedContent = encryptedContent;
        this.highSecurity = highSecurity;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static SecureNote create(UUID ownerId, String title, String encryptedContent, boolean highSecurity) {
        Instant now = Instant.now();
        return new SecureNote(UUID.randomUUID(), ownerId, title, encryptedContent, highSecurity, now, now);
    }

    public void update(String title, String encryptedContent, boolean highSecurity) {
        this.title = title;
        this.encryptedContent = encryptedContent;
        this.highSecurity = highSecurity;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public String getEncryptedContent() {
        return encryptedContent;
    }

    public boolean isHighSecurity() {
        return highSecurity;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
