package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RoomPasswordHistoryRepository extends JpaRepository<RoomPasswordHistory, UUID> {

    List<RoomPasswordHistory> findByRoomIdOrderByCompletedAtDesc(UUID roomId);
}
