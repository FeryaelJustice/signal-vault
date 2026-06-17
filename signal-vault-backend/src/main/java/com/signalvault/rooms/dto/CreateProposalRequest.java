package com.signalvault.rooms.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateProposalRequest(
        @NotBlank String proposedPassword,
        @NotBlank String passwordVerifier
) {
}
