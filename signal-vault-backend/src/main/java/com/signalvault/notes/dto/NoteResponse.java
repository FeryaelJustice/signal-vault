package com.signalvault.notes.dto;

import com.signalvault.notes.SecureNote;

import java.time.Instant;
import java.util.UUID;

public record NoteResponse(
        UUID id,
        UUID ownerId,
        String title,
        String encryptedContent,
        Instant createdAt,
        Instant updatedAt
) {
    public static NoteResponse from(SecureNote note) {
        return new NoteResponse(
                note.getId(),
                note.getOwnerId(),
                note.getTitle(),
                note.getEncryptedContent(),
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
