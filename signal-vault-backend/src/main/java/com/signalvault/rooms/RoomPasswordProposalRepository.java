package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoomPasswordProposalRepository extends JpaRepository<RoomPasswordProposal, UUID> {

    Optional<RoomPasswordProposal> findByRoomIdAndStatus(UUID roomId, ProposalStatus status);
}
