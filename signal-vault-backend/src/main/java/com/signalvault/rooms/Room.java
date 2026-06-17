package com.signalvault.rooms;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rooms")
public class Room {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "high_security", nullable = false)
    private boolean highSecurity;

    @Column(name = "password_verifier", columnDefinition = "TEXT")
    private String passwordVerifier;

    protected Room() {
        // for JPA
    }

    public Room(UUID id, String name, UUID ownerId, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.highSecurity = false;
    }

    public static Room create(String name, UUID ownerId) {
        return new Room(UUID.randomUUID(), name, ownerId, Instant.now());
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isHighSecurity() {
        return highSecurity;
    }

    public void setHighSecurity(boolean highSecurity) {
        this.highSecurity = highSecurity;
    }

    public String getPasswordVerifier() {
        return passwordVerifier;
    }

    public void setPasswordVerifier(String passwordVerifier) {
        this.passwordVerifier = passwordVerifier;
    }
}
