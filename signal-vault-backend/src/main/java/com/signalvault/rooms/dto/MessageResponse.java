package com.signalvault.rooms.dto;

import com.signalvault.rooms.Message;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        UUID roomId,
        UUID senderId,
        String encryptedBody,
        Instant createdAt
) {
    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getRoomId(),
                message.getSenderId(),
                message.getEncryptedBody(),
                message.getCreatedAt());
    }
}
