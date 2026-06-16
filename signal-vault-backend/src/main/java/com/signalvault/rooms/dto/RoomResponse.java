package com.signalvault.rooms.dto;

import com.signalvault.rooms.Room;

import java.time.Instant;
import java.util.UUID;

public record RoomResponse(UUID id, String name, UUID ownerId, Instant createdAt) {

    public static RoomResponse from(Room room) {
        return new RoomResponse(room.getId(), room.getName(), room.getOwnerId(), room.getCreatedAt());
    }
}
