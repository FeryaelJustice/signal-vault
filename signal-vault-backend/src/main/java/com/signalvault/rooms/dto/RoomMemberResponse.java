package com.signalvault.rooms.dto;

import com.signalvault.auth.User;
import com.signalvault.rooms.RoomMember;
import com.signalvault.rooms.RoomRole;

import java.time.Instant;
import java.util.UUID;

public record RoomMemberResponse(
        UUID userId,
        String email,
        RoomRole role,
        Instant joinedAt,
        Instant lastSeenAt,
        boolean online
) {
    public static RoomMemberResponse from(RoomMember member, User user, boolean online) {
        return new RoomMemberResponse(
                member.getUserId(),
                user.getEmail(),
                member.getRole(),
                member.getJoinedAt(),
                member.getLastSeenAt(),
                online);
    }
}
