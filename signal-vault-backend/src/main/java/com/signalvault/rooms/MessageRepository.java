package com.signalvault.rooms;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByRoomIdOrderByCreatedAtDesc(UUID roomId, Pageable pageable);
}
