package com.signalvault.rooms.dto;

import com.signalvault.rooms.Room;
import com.signalvault.rooms.RoomMember;
import com.signalvault.rooms.RoomRole;

import java.time.Instant;
import java.util.UUID;

public record RoomResponse(
        UUID id,
        String name,
        UUID ownerId,
        Instant createdAt,
        String encryptedRoomKey,
        RoomRole role,
        long memberCount,
        long onlineCount,
        boolean highSecurity,
        String passwordVerifier
) {

    public static RoomResponse from(Room room, RoomMember member, long memberCount, long onlineCount) {
        return new RoomResponse(
                room.getId(),
                room.getName(),
                room.getOwnerId(),
                room.getCreatedAt(),
                member.getEncryptedRoomKey(),
                member.getRole(),
                memberCount,
                onlineCount,
                room.isHighSecurity(),
                room.getPasswordVerifier());
    }
}
