package com.signalvault.rooms;

import com.signalvault.rooms.dto.CreateRoomRequest;
import com.signalvault.rooms.dto.MessageResponse;
import com.signalvault.rooms.dto.RoomResponse;
import com.signalvault.security.AuthenticatedUser;
import com.signalvault.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
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
                .map(RoomResponse::from)
                .toList();
    }

    @Operation(summary = "Create a room")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse create(@CurrentUser AuthenticatedUser user,
                               @Valid @RequestBody CreateRoomRequest request) {
        return RoomResponse.from(roomService.create(user.id(), request.name()));
    }

    @Operation(summary = "Recent messages for an accessible room (newest first)")
    @GetMapping("/{id}/messages")
    public List<MessageResponse> messages(@CurrentUser AuthenticatedUser user,
                                          @PathVariable UUID id) {
        return roomService.recentMessages(user.id(), id).stream()
                .map(MessageResponse::from)
                .toList();
    }
}
