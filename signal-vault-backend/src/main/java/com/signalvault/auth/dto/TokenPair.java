package com.signalvault.auth.dto;

import com.signalvault.auth.User;

/**
 * Internal carrier returned by the auth service: the signed access token, its TTL,
 * the raw (opaque) refresh token to be placed in the cookie, and the user.
 */
public record TokenPair(String accessToken, long expiresIn, String rawRefreshToken, User user) {
}
