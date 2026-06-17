package com.signalvault.rooms.dto;

import com.signalvault.rooms.RoomPasswordVote;
import com.signalvault.rooms.VoteType;

import java.time.Instant;
import java.util.UUID;

public record ProposalVoteResponse(UUID userId, String email, VoteType vote, Instant votedAt) {

    public static ProposalVoteResponse from(RoomPasswordVote v, String email) {
        return new ProposalVoteResponse(v.getUserId(), email, v.getVote(), v.getVotedAt());
    }
}
