package com.signalvault.notes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Create/update payload. {@code encryptedContent} is client-side ciphertext. */
public record NoteRequest(
        @NotBlank @Size(max = 512) String title,
        @NotBlank String encryptedContent
) {
}
