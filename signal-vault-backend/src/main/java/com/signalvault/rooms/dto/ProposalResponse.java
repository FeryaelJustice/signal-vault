package com.signalvault.rooms.dto;

import com.signalvault.rooms.ProposalStatus;
import com.signalvault.rooms.RoomPasswordProposal;
import com.signalvault.rooms.RoomPasswordVote;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ProposalResponse(
        UUID id,
        UUID roomId,
        UUID proposedByUserId,
        String proposedByEmail,
        String proposedPassword,
        ProposalStatus status,
        Instant createdAt,
        Instant resolvedAt,
        List<ProposalVoteResponse> votes,
        long totalMembers,
        String myVote
) {

    public static ProposalResponse from(RoomPasswordProposal proposal,
                                         List<RoomPasswordVote> votes,
                                         Map<UUID, String> userEmails,
                                         long totalMembers,
                                         UUID currentUserId) {
        String myVote = votes.stream()
                .filter(v -> v.getUserId().equals(currentUserId))
                .map(v -> v.getVote().name())
                .findFirst()
                .orElse(null);

        List<ProposalVoteResponse> voteResponses = votes.stream()
                .map(v -> ProposalVoteResponse.from(v, userEmails.getOrDefault(v.getUserId(), "unknown")))
                .toList();

        return new ProposalResponse(
                proposal.getId(),
                proposal.getRoomId(),
                proposal.getProposedBy(),
                userEmails.getOrDefault(proposal.getProposedBy(), "unknown"),
                proposal.getProposedPassword(),
                proposal.getStatus(),
                proposal.getCreatedAt(),
                proposal.getResolvedAt(),
                voteResponses,
                totalMembers,
                myVote);
    }
}
