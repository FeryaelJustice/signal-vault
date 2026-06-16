package com.signalvault.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET =
            "test-signalvault-super-secret-key-which-is-long-enough-0123456789";

    private JwtService newService(long accessTtlSeconds) {
        JwtProperties props = new JwtProperties();
        props.setSecret(SECRET);
        props.setAccessTtl(accessTtlSeconds);
        props.setRefreshTtl(604_800L);
        return new JwtService(props);
    }

    @Test
    void generatesAndValidatesTokenWithClaims() {
        JwtService service = newService(900L);
        UUID userId = UUID.randomUUID();
        String email = "alice@example.com";

        String token = service.generateAccessToken(userId, email);

        assertThat(service.isValid(token)).isTrue();
        assertThat(service.extractUserId(token)).isEqualTo(userId);
        assertThat(service.extractEmail(token)).isEqualTo(email);

        Jws<Claims> jws = service.parse(token);
        assertThat(jws.getPayload().getSubject()).isEqualTo(userId.toString());
    }

    @Test
    void rejectsExpiredToken() {
        // Negative TTL produces an already-expired token.
        JwtService service = newService(-1L);
        String token = service.generateAccessToken(UUID.randomUUID(), "bob@example.com");

        assertThat(service.isValid(token)).isFalse();
        assertThatThrownBy(() -> service.parse(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsTokenSignedWithDifferentKey() {
        JwtService service = newService(900L);

        SecretKey otherKey = Keys.hmacShaKeyFor(
                "another-completely-different-secret-key-0123456789ABCDEF".getBytes(StandardCharsets.UTF_8));
        String forged = Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .claim("email", "mallory@example.com")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(otherKey)
                .compact();

        assertThat(service.isValid(forged)).isFalse();
    }

    @Test
    void rejectsGarbageToken() {
        JwtService service = newService(900L);
        assertThat(service.isValid("not-a-jwt")).isFalse();
    }

    @Test
    void rejectsTooShortSecret() {
        JwtProperties props = new JwtProperties();
        props.setSecret("too-short");
        assertThatThrownBy(() -> new JwtService(props))
                .isInstanceOf(IllegalStateException.class);
    }
}
