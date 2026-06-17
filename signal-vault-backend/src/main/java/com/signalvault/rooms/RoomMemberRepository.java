package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomMemberRepository extends JpaRepository<RoomMember, UUID> {

    List<RoomMember> findByUserIdOrderByJoinedAtDesc(UUID userId);

    List<RoomMember> findByRoomIdOrderByJoinedAtAsc(UUID roomId);

    Optional<RoomMember> findByRoomIdAndUserId(UUID roomId, UUID userId);

    boolean existsByRoomIdAndUserId(UUID roomId, UUID userId);

    long countByRoomId(UUID roomId);

    void deleteByRoomIdAndUserId(UUID roomId, UUID userId);
}
