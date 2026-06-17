package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    List<Room> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    Optional<Room> findByIdAndOwnerId(UUID id, UUID ownerId);

    @Query("""
            select r from Room r
            join RoomMember m on m.roomId = r.id
            where m.userId = :userId
            order by r.createdAt desc
            """)
    List<Room> findAccessibleRooms(@Param("userId") UUID userId);
}
