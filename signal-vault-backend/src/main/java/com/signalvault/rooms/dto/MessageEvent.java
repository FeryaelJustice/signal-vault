package com.signalvault.rooms.dto;

import com.signalvault.rooms.Message;

import java.time.Instant;
import java.util.UUID;

/**
 * Broadcast event published to /topic/rooms/{roomId} after a message is persisted.
 * type is always "MESSAGE_CREATED".
 */
public record MessageEvent(
        String type,
        UUID roomId,
        UUID messageId,
        UUID senderId,
        String encryptedBody,
        Instant createdAt
) {
    public static MessageEvent created(Message message) {
        return new MessageEvent(
                "MESSAGE_CREATED",
                message.getRoomId(),
                message.getId(),
                message.getSenderId(),
                message.getEncryptedBody(),
                message.getCreatedAt());
    }
}
