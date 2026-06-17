package com.signalvault.rooms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomPasswordVoteRepository extends JpaRepository<RoomPasswordVote, UUID> {

    List<RoomPasswordVote> findByProposalId(UUID proposalId);

    Optional<RoomPasswordVote> findByProposalIdAndUserId(UUID proposalId, UUID userId);

    boolean existsByProposalIdAndUserId(UUID proposalId, UUID userId);

    long countByProposalIdAndVote(UUID proposalId, VoteType vote);
}
