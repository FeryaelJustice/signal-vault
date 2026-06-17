package com.signalvault.rooms.dto;

import com.signalvault.rooms.ProposalStatus;
import com.signalvault.rooms.RoomPasswordHistory;
import com.signalvault.rooms.RoomPasswordVote;
import com.signalvault.rooms.VoteType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PasswordHistoryResponse(
        UUID id,
        UUID roomId,
        UUID proposalId,
        UUID initiatedByUserId,
        String initiatedByEmail,
        String proposedPassword,
        ProposalStatus outcome,
        Instant completedAt,
        List<VoterInfo> acceptedBy,
        List<VoterInfo> rejectedBy
) {

    public record VoterInfo(UUID userId, String email, Instant votedAt) {}

    public static PasswordHistoryResponse from(RoomPasswordHistory history,
                                                List<RoomPasswordVote> votes,
                                                Map<UUID, String> userEmails) {
        List<VoterInfo> acceptedBy = votes.stream()
                .filter(v -> v.getVote() == VoteType.ACCEPT)
                .map(v -> new VoterInfo(v.getUserId(),
                        userEmails.getOrDefault(v.getUserId(), "unknown"),
                        v.getVotedAt()))
                .toList();

        List<VoterInfo> rejectedBy = votes.stream()
                .filter(v -> v.getVote() == VoteType.REJECT)
                .map(v -> new VoterInfo(v.getUserId(),
                        userEmails.getOrDefault(v.getUserId(), "unknown"),
                        v.getVotedAt()))
                .toList();

        return new PasswordHistoryResponse(
                history.getId(),
                history.getRoomId(),
                history.getProposalId(),
                history.getInitiatedBy(),
                userEmails.getOrDefault(history.getInitiatedBy(), "unknown"),
                history.getProposedPassword(),
                history.getOutcome(),
                history.getCompletedAt(),
                acceptedBy,
                rejectedBy);
    }
}
