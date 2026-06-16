package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    List<Room> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    Optional<Room> findByIdAndOwnerId(UUID id, UUID ownerId);
}
