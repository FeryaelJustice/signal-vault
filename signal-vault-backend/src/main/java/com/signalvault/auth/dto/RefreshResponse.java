package com.signalvault.auth.dto;

/** Response for token refresh: a new access token. */
public record RefreshResponse(String accessToken, long expiresIn) {
}
