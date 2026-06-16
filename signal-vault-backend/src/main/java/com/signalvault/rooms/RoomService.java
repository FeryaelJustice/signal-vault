package com.signalvault.rooms;

import com.signalvault.common.NotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Rooms and messages. Access model for the MVP: a user has access to a room only if they own it.
 * (One realtime room per user, per the product scope.) Access checks are centralised here so the
 * REST controller and the WebSocket handler enforce the same rule.
 */
@Service
public class RoomService {

    private static final int RECENT_MESSAGES_LIMIT = 50;

    private final RoomRepository roomRepository;
    private final MessageRepository messageRepository;

    public RoomService(RoomRepository roomRepository, MessageRepository messageRepository) {
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
    }

    @Transactional(readOnly = true)
    public List<Room> listForUser(UUID userId) {
        return roomRepository.findByOwnerIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public Room create(UUID ownerId, String name) {
        return roomRepository.save(Room.create(name, ownerId));
    }

    /** Returns the room if the user may access it, otherwise throws {@link NotFoundException}. */
    @Transactional(readOnly = true)
    public Room requireAccessibleRoom(UUID userId, UUID roomId) {
        return roomRepository.findByIdAndOwnerId(roomId, userId)
                .orElseThrow(() -> new NotFoundException("Room not found"));
    }

    /** True if the user may access (currently: owns) the given room. Used by the WS handler. */
    @Transactional(readOnly = true)
    public boolean hasAccess(UUID userId, UUID roomId) {
        return roomRepository.findByIdAndOwnerId(roomId, userId).isPresent();
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
        return messageRepository.save(Message.create(roomId, senderId, encryptedBody));
    }
}
