package com.signalvault.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and validates JWT access tokens using jjwt 0.12.x.
 * Claims: sub = userId, email = user email.
 * Refresh tokens are opaque random strings handled by {@code AuthService}, not JWTs.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTtlMillis;
    private final long accessTtlSeconds;

    public JwtService(JwtProperties properties) {
        byte[] secretBytes = properties.getSecret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret must be at least 256 bits (32 bytes) for HS256");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
        this.accessTtlMillis = properties.getAccessTtlMillis();
        this.accessTtlSeconds = properties.getAccessTtl();
    }

    /** Generates a signed access token for the given user. */
    public String generateAccessToken(UUID userId, String email) {
        Instant now = Instant.now();
        Instant expiry = now.plusMillis(accessTtlMillis);
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(key)
                .compact();
    }

    /** Access token TTL in seconds (for the {@code expiresIn} response field). */
    public long getAccessTtlSeconds() {
        return accessTtlSeconds;
    }

    /**
     * Parses and validates a token. Throws {@link JwtException} if invalid or expired.
     */
    public Jws<Claims> parse(String token) throws JwtException {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token);
    }

    /** Extracts the user id (subject) from a validated token. */
    public UUID extractUserId(String token) {
        return UUID.fromString(parse(token).getPayload().getSubject());
    }

    /** Extracts the email claim from a validated token. */
    public String extractEmail(String token) {
        return parse(token).getPayload().get("email", String.class);
    }

    /** Returns true if the token is valid (well-formed, correctly signed, not expired). */
    public boolean isValid(String token) {
        try {
            parse(token);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }
}
