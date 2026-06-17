package com.signalvault.rooms.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateInviteRequest(
        @NotBlank @Email @Size(max = 320) String email
) {
}
