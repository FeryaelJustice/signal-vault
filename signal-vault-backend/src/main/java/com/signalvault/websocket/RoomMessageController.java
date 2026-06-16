package com.signalvault.websocket;

import com.signalvault.rooms.Message;
import com.signalvault.rooms.RoomService;
import com.signalvault.rooms.dto.MessageEvent;
import com.signalvault.rooms.dto.SendMessageRequest;
import com.signalvault.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.UUID;

/**
 * Handles inbound STOMP SEND frames to /app/rooms/{roomId}.
 * Verifies the authenticated sender has access to the room, persists the message,
 * then broadcasts a MESSAGE_CREATED event to /topic/rooms/{roomId}.
 */
@Controller
public class RoomMessageController {

    private final RoomService roomService;
    private final SimpMessagingTemplate messagingTemplate;

    public RoomMessageController(RoomService roomService, SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/rooms/{roomId}")
    public void handleMessage(@DestinationVariable UUID roomId,
                              @Valid @Payload SendMessageRequest request,
                              Authentication authentication) {
        AuthenticatedUser sender = (AuthenticatedUser) authentication.getPrincipal();

        if (!roomService.hasAccess(sender.id(), roomId)) {
            throw new AccessDeniedException("No access to room " + roomId);
        }

        Message saved = roomService.persistMessage(roomId, sender.id(), request.encryptedBody());
        messagingTemplate.convertAndSend(
                "/topic/rooms/" + roomId, MessageEvent.created(saved));
    }
}
