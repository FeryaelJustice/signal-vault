package com.signalvault.rooms;

import com.signalvault.rooms.dto.AcceptInviteRequest;
import com.signalvault.rooms.dto.CastVoteRequest;
import com.signalvault.rooms.dto.CreateInviteRequest;
import com.signalvault.rooms.dto.CreateProposalRequest;
import com.signalvault.rooms.dto.CreateRoomRequest;
import com.signalvault.rooms.dto.MessageResponse;
import com.signalvault.rooms.dto.PasswordHistoryResponse;
import com.signalvault.rooms.dto.ProposalResponse;
import com.signalvault.rooms.dto.RoomInviteResponse;
import com.signalvault.rooms.dto.RoomMemberResponse;
import com.signalvault.rooms.dto.RoomResponse;
import com.signalvault.rooms.dto.UpdateRoomSecurityRequest;
import com.signalvault.security.AuthenticatedUser;
import com.signalvault.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@Tag(name = "Rooms", description = "Realtime rooms and their messages")
@SecurityRequirement(name = "bearerAuth")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @Operation(summary = "List the current user's rooms")
    @GetMapping
    public List<RoomResponse> list(@CurrentUser AuthenticatedUser user) {
        return roomService.listForUser(user.id()).stream()
                .map(room -> RoomResponse.from(
                        room,
                        roomService.requireMember(user.id(), room.getId()),
                        roomService.memberCount(room.getId()),
                        roomService.onlineCount(room.getId())))
                .toList();
    }

    @Operation(summary = "List pending room invites for the current user")
    @GetMapping("/invites")
    public List<RoomInviteResponse> pendingInvites(@CurrentUser AuthenticatedUser user) {
        return roomService.pendingInvites(user.email()).stream()
                .map(invite -> RoomInviteResponse.from(
                        invite,
                        roomService.requireAccessibleRoom(invite.getInviterId(), invite.getRoomId()),
                        roomService.requireUser(invite.getInviterId()).getEmail()))
                .toList();
    }

    @Operation(summary = "Accept a room invite")
    @PostMapping("/invites/{inviteId}/accept")
    public RoomResponse acceptInvite(@CurrentUser AuthenticatedUser user,
                                     @PathVariable UUID inviteId,
                                     @Valid @RequestBody AcceptInviteRequest request) {
        var room = roomService.acceptInvite(user.id(), user.email(), inviteId, request.encryptedRoomKey());
        return RoomResponse.from(
                room,
                roomService.requireMember(user.id(), room.getId()),
                roomService.memberCount(room.getId()),
                roomService.onlineCount(room.getId()));
    }

    @Operation(summary = "Reject a room invite")
    @PostMapping("/invites/{inviteId}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rejectInvite(@CurrentUser AuthenticatedUser user,
                              @PathVariable UUID inviteId) {
        roomService.rejectInvite(user.id(), user.email(), inviteId);
    }

    @Operation(summary = "Create a room")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse create(@CurrentUser AuthenticatedUser user,
                               @Valid @RequestBody CreateRoomRequest request) {
        var room = roomService.create(user.id(), request.name(), request.encryptedRoomKey(), request.highSecurity());
        return RoomResponse.from(
                room,
                roomService.requireMember(user.id(), room.getId()),
                roomService.memberCount(room.getId()),
                roomService.onlineCount(room.getId()));
    }

    @Operation(summary = "Recent messages for an accessible room (newest first)")
    @GetMapping("/{id}/messages")
    public List<MessageResponse> messages(@CurrentUser AuthenticatedUser user,
                                          @PathVariable UUID id) {
        return roomService.recentMessages(user.id(), id).stream()
                .map(MessageResponse::from)
                .toList();
    }

    @Operation(summary = "List room members")
    @GetMapping("/{id}/members")
    public List<RoomMemberResponse> members(@CurrentUser AuthenticatedUser user,
                                            @PathVariable UUID id) {
        return roomService.members(user.id(), id).stream()
                .map(member -> RoomMemberResponse.from(
                        member,
                        roomService.requireUser(member.getUserId()),
                        roomService.isOnline(member)))
                .toList();
    }

    @Operation(summary = "List room invites")
    @GetMapping("/{id}/invites")
    public List<RoomInviteResponse> roomInvites(@CurrentUser AuthenticatedUser user,
                                                @PathVariable UUID id) {
        return roomService.roomInvites(user.id(), id).stream()
                .map(invite -> RoomInviteResponse.from(
                        invite,
                        roomService.requireAccessibleRoom(user.id(), id),
                        roomService.requireUser(invite.getInviterId()).getEmail()))
                .toList();
    }

    @Operation(summary = "Invite a user by email")
    @PostMapping("/{id}/invites")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomInviteResponse invite(@CurrentUser AuthenticatedUser user,
                                     @PathVariable UUID id,
                                     @Valid @RequestBody CreateInviteRequest request) {
        var invite = roomService.createInvite(user.id(), id, request.email());
        return RoomInviteResponse.from(
                invite,
                roomService.requireAccessibleRoom(user.id(), id),
                user.email());
    }

    @Operation(summary = "Mark current user as present in a room")
    @PostMapping("/{id}/presence")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void presence(@CurrentUser AuthenticatedUser user, @PathVariable UUID id) {
        roomService.touchPresence(user.id(), id);
    }

    @Operation(summary = "Leave a room")
    @DeleteMapping("/{id}/membership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@CurrentUser AuthenticatedUser user, @PathVariable UUID id) {
        roomService.leave(user.id(), id);
    }

    // ── Room security ─────────────────────────────────────────────────────────

    @Operation(summary = "Toggle high-security mode (owner only)")
    @PatchMapping("/{id}/security")
    public RoomResponse updateSecurity(@CurrentUser AuthenticatedUser user,
                                       @PathVariable UUID id,
                                       @Valid @RequestBody UpdateRoomSecurityRequest request) {
        var room = roomService.updateHighSecurity(user.id(), id, request.highSecurity());
        return RoomResponse.from(
                room,
                roomService.requireMember(user.id(), room.getId()),
                roomService.memberCount(room.getId()),
                roomService.onlineCount(room.getId()));
    }

    // ── Password proposals ────────────────────────────────────────────────────

    @Operation(summary = "Create a room password change proposal (any member)")
    @PostMapping("/{id}/password-proposals")
    @ResponseStatus(HttpStatus.CREATED)
    public ProposalResponse createProposal(@CurrentUser AuthenticatedUser user,
                                            @PathVariable UUID id,
                                            @Valid @RequestBody CreateProposalRequest request) {
        var proposal = roomService.createPasswordProposal(user.id(), id,
                request.proposedPassword(), request.passwordVerifier());
        return buildProposalResponse(proposal, user.id(), id);
    }

    @Operation(summary = "Get the pending password proposal for a room, if any")
    @GetMapping("/{id}/password-proposals/pending")
    public ResponseEntity<ProposalResponse> getPendingProposal(@CurrentUser AuthenticatedUser user,
                                                                @PathVariable UUID id) {
        return roomService.getPendingProposal(user.id(), id)
                .map(proposal -> ResponseEntity.ok(buildProposalResponse(proposal, user.id(), id)))
                .orElse(ResponseEntity.noContent().build());
    }

    @Operation(summary = "Vote on a password proposal (ACCEPT or REJECT)")
    @PostMapping("/{id}/password-proposals/{proposalId}/vote")
    public ProposalResponse castVote(@CurrentUser AuthenticatedUser user,
                                      @PathVariable UUID id,
                                      @PathVariable UUID proposalId,
                                      @Valid @RequestBody CastVoteRequest request) {
        VoteType voteType;
        try {
            voteType = VoteType.valueOf(request.vote().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new com.signalvault.common.ConflictException("Invalid vote value: must be ACCEPT or REJECT");
        }
        var proposal = roomService.castVote(user.id(), id, proposalId, voteType);
        return buildProposalResponse(proposal, user.id(), id);
    }

    @Operation(summary = "Room password change history")
    @GetMapping("/{id}/password-history")
    public List<PasswordHistoryResponse> getPasswordHistory(@CurrentUser AuthenticatedUser user,
                                                             @PathVariable UUID id) {
        return roomService.getPasswordHistory(user.id(), id).stream()
                .map(history -> {
                    List<RoomPasswordVote> votes = history.getProposalId() != null
                            ? roomService.getVotesForProposal(history.getProposalId())
                            : List.of();
                    Set<UUID> ids = new HashSet<>();
                    ids.add(history.getInitiatedBy());
                    votes.forEach(v -> ids.add(v.getUserId()));
                    return PasswordHistoryResponse.from(history, votes, buildEmailMap(ids));
                })
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ProposalResponse buildProposalResponse(RoomPasswordProposal proposal,
                                                    UUID currentUserId, UUID roomId) {
        List<RoomPasswordVote> votes = roomService.getVotesForProposal(proposal.getId());
        Set<UUID> ids = new HashSet<>();
        ids.add(proposal.getProposedBy());
        votes.forEach(v -> ids.add(v.getUserId()));
        return ProposalResponse.from(proposal, votes, buildEmailMap(ids),
                roomService.memberCount(roomId), currentUserId);
    }

    private Map<UUID, String> buildEmailMap(Collection<UUID> userIds) {
        Map<UUID, String> map = new HashMap<>();
        for (UUID uid : userIds) {
            try {
                map.put(uid, roomService.requireUser(uid).getEmail());
            } catch (Exception e) {
                map.put(uid, "unknown");
            }
        }
        return map;
    }
}
