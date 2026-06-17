package com.signalvault.rooms.dto;

import jakarta.validation.constraints.NotBlank;

public record AcceptInviteRequest(
        @NotBlank String encryptedRoomKey
) {
}
