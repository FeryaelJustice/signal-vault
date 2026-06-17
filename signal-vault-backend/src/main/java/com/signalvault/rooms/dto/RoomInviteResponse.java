package com.signalvault.rooms.dto;

import com.signalvault.rooms.Room;
import com.signalvault.rooms.RoomInvite;
import com.signalvault.rooms.RoomInviteStatus;

import java.time.Instant;
import java.util.UUID;

public record RoomInviteResponse(
        UUID id,
        UUID roomId,
        String roomName,
        UUID inviterId,
        String inviterEmail,
        String inviteeEmail,
        RoomInviteStatus status,
        Instant createdAt,
        Instant acceptedAt
) {
    public static RoomInviteResponse from(RoomInvite invite, Room room, String inviterEmail) {
        return new RoomInviteResponse(
                invite.getId(),
                invite.getRoomId(),
                room.getName(),
                invite.getInviterId(),
                inviterEmail,
                invite.getInviteeEmail(),
                invite.getStatus(),
                invite.getCreatedAt(),
                invite.getAcceptedAt());
    }
}
