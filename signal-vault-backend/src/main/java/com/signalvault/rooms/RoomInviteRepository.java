package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RoomInviteRepository extends JpaRepository<RoomInvite, UUID> {

    List<RoomInvite> findByInviteeEmailAndStatusOrderByCreatedAtDesc(
            String inviteeEmail, RoomInviteStatus status);

    List<RoomInvite> findByRoomIdOrderByCreatedAtDesc(UUID roomId);
}
