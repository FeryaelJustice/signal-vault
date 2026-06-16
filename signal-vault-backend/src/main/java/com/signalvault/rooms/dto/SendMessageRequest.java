package com.signalvault.rooms.dto;

import jakarta.validation.constraints.NotBlank;

/** Inbound STOMP message payload sent to /app/rooms/{roomId}. */
public record SendMessageRequest(
        @NotBlank String encryptedBody
) {
}
