package com.signalvault.rooms.dto;

import jakarta.validation.constraints.NotBlank;

public record CastVoteRequest(@NotBlank String vote) {
}
