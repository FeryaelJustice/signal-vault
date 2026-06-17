package com.signalvault.rooms;

import com.signalvault.auth.User;
import com.signalvault.auth.UserRepository;
import com.signalvault.common.ConflictException;
import com.signalvault.common.NotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Rooms and messages. Access is based on room membership. Room keys are client-side secrets:
 * the server only stores each member's encrypted copy of the room key.
 */
@Service
public class RoomService {

    private static final int RECENT_MESSAGES_LIMIT = 50;
    private static final Duration ONLINE_WINDOW = Duration.ofSeconds(60);

    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomInviteRepository roomInviteRepository;
    private final UserRepository userRepository;
    private final RoomPasswordProposalRepository proposalRepository;
    private final RoomPasswordVoteRepository voteRepository;
    private final RoomPasswordHistoryRepository historyRepository;

    public RoomService(RoomRepository roomRepository,
                       MessageRepository messageRepository,
                       RoomMemberRepository roomMemberRepository,
                       RoomInviteRepository roomInviteRepository,
                       UserRepository userRepository,
                       RoomPasswordProposalRepository proposalRepository,
                       RoomPasswordVoteRepository voteRepository,
                       RoomPasswordHistoryRepository historyRepository) {
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.roomInviteRepository = roomInviteRepository;
        this.userRepository = userRepository;
        this.proposalRepository = proposalRepository;
        this.voteRepository = voteRepository;
        this.historyRepository = historyRepository;
    }

    @Transactional(readOnly = true)
    public List<Room> listForUser(UUID userId) {
        return roomRepository.findAccessibleRooms(userId);
    }

    @Transactional
    public Room create(UUID ownerId, String name, String encryptedRoomKey, boolean highSecurity) {
        Room room = roomRepository.save(Room.create(name, ownerId));
        room.setHighSecurity(highSecurity);
        roomRepository.save(room);
        roomMemberRepository.save(RoomMember.create(room.getId(), ownerId, RoomRole.OWNER, encryptedRoomKey));
        return room;
    }

    /** Returns the room if the user may access it, otherwise throws {@link NotFoundException}. */
    @Transactional(readOnly = true)
    public Room requireAccessibleRoom(UUID userId, UUID roomId) {
        if (!roomMemberRepository.existsByRoomIdAndUserId(roomId, userId)) {
            throw new NotFoundException("Room not found");
        }
        return roomRepository.findById(roomId).orElseThrow(() -> new NotFoundException("Room not found"));
    }

    /** True if the user may access (currently: owns) the given room. Used by the WS handler. */
    @Transactional(readOnly = true)
    public boolean hasAccess(UUID userId, UUID roomId) {
        return roomMemberRepository.existsByRoomIdAndUserId(roomId, userId);
    }

    /** Recent messages (newest first) for an accessible room. */
    @Transactional(readOnly = true)
    public List<Message> recentMessages(UUID userId, UUID roomId) {
        requireAccessibleRoom(userId, roomId);
        return messageRepository.findByRoomIdOrderByCreatedAtDesc(
                roomId, PageRequest.of(0, RECENT_MESSAGES_LIMIT));
    }

    /** Persists a new message in a room. Caller must have verified access. */
    @Transactional
    public Message persistMessage(UUID roomId, UUID senderId, String encryptedBody) {
        touchPresence(senderId, roomId);
        return messageRepository.save(Message.create(roomId, senderId, encryptedBody));
    }

    @Transactional(readOnly = true)
    public RoomMember requireMember(UUID userId, UUID roomId) {
        return roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> new NotFoundException("Room not found"));
    }

    @Transactional(readOnly = true)
    public long memberCount(UUID roomId) {
        return roomMemberRepository.countByRoomId(roomId);
    }

    @Transactional(readOnly = true)
    public long onlineCount(UUID roomId) {
        Instant cutoff = Instant.now().minus(ONLINE_WINDOW);
        return roomMemberRepository.findByRoomIdOrderByJoinedAtAsc(roomId).stream()
                .filter(member -> member.getLastSeenAt() != null && member.getLastSeenAt().isAfter(cutoff))
                .count();
    }

    @Transactional(readOnly = true)
    public List<RoomMember> members(UUID userId, UUID roomId) {
        requireAccessibleRoom(userId, roomId);
        return roomMemberRepository.findByRoomIdOrderByJoinedAtAsc(roomId);
    }

    @Transactional(readOnly = true)
    public User requireUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
    }

    public boolean isOnline(RoomMember member) {
        return member.getLastSeenAt() != null
                && member.getLastSeenAt().isAfter(Instant.now().minus(ONLINE_WINDOW));
    }

    @Transactional
    public RoomInvite createInvite(UUID inviterId, UUID roomId, String inviteeEmail) {
        RoomMember inviter = requireMember(inviterId, roomId);
        if (inviter.getRole() != RoomRole.OWNER) {
            throw new ConflictException("Only the room owner can invite members");
        }

        String normalisedEmail = inviteeEmail.toLowerCase();
        User invitee = userRepository.findByEmail(normalisedEmail)
                .orElseThrow(() -> new NotFoundException("Invitee user not found"));
        if (roomMemberRepository.existsByRoomIdAndUserId(roomId, invitee.getId())) {
            throw new ConflictException("User is already a room member");
        }

        return roomInviteRepository.save(RoomInvite.create(roomId, inviterId, normalisedEmail));
    }

    @Transactional(readOnly = true)
    public List<RoomInvite> pendingInvites(String email) {
        return roomInviteRepository.findByInviteeEmailAndStatusOrderByCreatedAtDesc(
                email.toLowerCase(), RoomInviteStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public List<RoomInvite> roomInvites(UUID userId, UUID roomId) {
        RoomMember member = requireMember(userId, roomId);
        if (member.getRole() != RoomRole.OWNER) {
            return List.of();
        }
        return roomInviteRepository.findByRoomIdOrderByCreatedAtDesc(roomId);
    }

    @Transactional
    public Room acceptInvite(UUID userId, String userEmail, UUID inviteId, String encryptedRoomKey) {
        RoomInvite invite = roomInviteRepository.findById(inviteId)
                .orElseThrow(() -> new NotFoundException("Invite not found"));
        if (invite.getStatus() != RoomInviteStatus.PENDING
                || !invite.getInviteeEmail().equalsIgnoreCase(userEmail)) {
            throw new NotFoundException("Invite not found");
        }
        if (roomMemberRepository.existsByRoomIdAndUserId(invite.getRoomId(), userId)) {
            invite.accept();
            return roomRepository.findById(invite.getRoomId())
                    .orElseThrow(() -> new NotFoundException("Room not found"));
        }
        roomMemberRepository.save(RoomMember.create(invite.getRoomId(), userId, RoomRole.MEMBER, encryptedRoomKey));
        invite.accept();
        return roomRepository.findById(invite.getRoomId())
                .orElseThrow(() -> new NotFoundException("Room not found"));
    }

    @Transactional
    public void leave(UUID userId, UUID roomId) {
        RoomMember member = requireMember(userId, roomId);
        if (member.getRole() == RoomRole.OWNER) {
            throw new ConflictException("Room owners cannot leave their own room");
        }
        roomMemberRepository.deleteByRoomIdAndUserId(roomId, userId);
    }

    @Transactional
    public void touchPresence(UUID userId, UUID roomId) {
        RoomMember member = requireMember(userId, roomId);
        member.markSeen(Instant.now());
    }

    // ── Room security ─────────────────────────────────────────────────────────

    @Transactional
    public Room updateHighSecurity(UUID ownerId, UUID roomId, boolean highSecurity) {
        RoomMember member = requireMember(ownerId, roomId);
        if (member.getRole() != RoomRole.OWNER) {
            throw new ConflictException("Only the room owner can change security settings");
        }
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new NotFoundException("Room not found"));
        if (highSecurity && room.getPasswordVerifier() == null) {
            throw new ConflictException("Create a room password proposal first before enabling high security");
        }
        room.setHighSecurity(highSecurity);
        return roomRepository.save(room);
    }

    // ── Password proposals ────────────────────────────────────────────────────

    @Transactional
    public RoomPasswordProposal createPasswordProposal(UUID userId, UUID roomId,
                                                        String proposedPassword, String passwordVerifier) {
        requireMember(userId, roomId);

        // Cancel any existing PENDING proposal (only one at a time per room).
        proposalRepository.findByRoomIdAndStatus(roomId, ProposalStatus.PENDING).ifPresent(existing -> {
            List<RoomPasswordVote> existingVotes = voteRepository.findByProposalId(existing.getId());
            existing.cancel();
            proposalRepository.save(existing);
            historyRepository.save(RoomPasswordHistory.create(
                    roomId, existing.getId(), existing.getProposedBy(),
                    existing.getProposedPassword(), ProposalStatus.CANCELLED));
        });

        RoomPasswordProposal proposal = proposalRepository.save(
                RoomPasswordProposal.create(roomId, userId, proposedPassword, passwordVerifier));

        // Proposer automatically votes ACCEPT.
        voteRepository.save(RoomPasswordVote.create(proposal.getId(), userId, VoteType.ACCEPT));

        // Resolve immediately if the proposer is the sole member.
        long totalMembers = memberCount(roomId);
        long acceptCount = voteRepository.countByProposalIdAndVote(proposal.getId(), VoteType.ACCEPT);
        if (acceptCount >= totalMembers) {
            resolveAccepted(proposal, roomId);
        }

        return proposal;
    }

    @Transactional
    public RoomPasswordProposal castVote(UUID userId, UUID roomId, UUID proposalId, VoteType voteType) {
        requireMember(userId, roomId);

        RoomPasswordProposal proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> new NotFoundException("Proposal not found"));

        if (!proposal.getRoomId().equals(roomId)) {
            throw new NotFoundException("Proposal not found");
        }
        if (proposal.getStatus() != ProposalStatus.PENDING) {
            throw new ConflictException("This proposal is no longer pending");
        }
        if (voteRepository.existsByProposalIdAndUserId(proposalId, userId)) {
            throw new ConflictException("You have already voted on this proposal");
        }

        voteRepository.save(RoomPasswordVote.create(proposalId, userId, voteType));

        if (voteType == VoteType.REJECT) {
            // One rejection is enough to fail the proposal immediately.
            proposal.reject();
            proposalRepository.save(proposal);
            historyRepository.save(RoomPasswordHistory.create(
                    roomId, proposalId, proposal.getProposedBy(),
                    proposal.getProposedPassword(), ProposalStatus.REJECTED));
            return proposal;
        }

        // ACCEPT: check if all members have now voted ACCEPT.
        long totalMembers = memberCount(roomId);
        long acceptCount = voteRepository.countByProposalIdAndVote(proposalId, VoteType.ACCEPT);
        if (acceptCount >= totalMembers) {
            resolveAccepted(proposal, roomId);
        }

        return proposal;
    }

    private void resolveAccepted(RoomPasswordProposal proposal, UUID roomId) {
        proposal.accept();
        proposalRepository.save(proposal);

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new NotFoundException("Room not found"));
        room.setPasswordVerifier(proposal.getPasswordVerifier());
        room.setHighSecurity(true);
        roomRepository.save(room);

        historyRepository.save(RoomPasswordHistory.create(
                roomId, proposal.getId(), proposal.getProposedBy(),
                proposal.getProposedPassword(), ProposalStatus.ACCEPTED));
    }

    @Transactional(readOnly = true)
    public Optional<RoomPasswordProposal> getPendingProposal(UUID userId, UUID roomId) {
        requireMember(userId, roomId);
        return proposalRepository.findByRoomIdAndStatus(roomId, ProposalStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public List<RoomPasswordVote> getVotesForProposal(UUID proposalId) {
        return voteRepository.findByProposalId(proposalId);
    }

    @Transactional(readOnly = true)
    public List<RoomPasswordHistory> getPasswordHistory(UUID userId, UUID roomId) {
        requireMember(userId, roomId);
        return historyRepository.findByRoomIdOrderByCompletedAtDesc(roomId);
    }
}
