package com.signalvault.auth.dto;

/** Response for register/login: access token plus the user. */
public record AuthResponse(String accessToken, long expiresIn, UserResponse user) {
}
