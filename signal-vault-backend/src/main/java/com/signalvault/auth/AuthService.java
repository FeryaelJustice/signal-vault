package com.signalvault.auth;

import com.signalvault.auth.dto.RefreshResponse;
import com.signalvault.auth.dto.TokenPair;
import com.signalvault.common.ConflictException;
import com.signalvault.common.UnauthorizedException;
import com.signalvault.security.JwtProperties;
import com.signalvault.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Authentication service: registration, login, rotating refresh tokens and logout.
 *
 * <p>Refresh tokens are opaque random strings. Only a SHA-256 hash of each token is persisted;
 * the raw value lives exclusively in the client's HttpOnly cookie. On refresh, the presented
 * token is verified by hash, the matching row is revoked, and a new token is issued (rotation).
 */
@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final long refreshTtlMillis;

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       JwtProperties jwtProperties) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTtlMillis = jwtProperties.getRefreshTtlMillis();
    }

    @Transactional
    public TokenPair register(String email, String rawPassword) {
        String normalizedEmail = normalizeEmail(email);
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email already registered");
        }
        User user = User.create(normalizedEmail, passwordEncoder.encode(rawPassword));
        userRepository.save(user);
        return issueTokens(user);
    }

    @Transactional
    public TokenPair login(String email, String rawPassword) {
        String normalizedEmail = normalizeEmail(email);
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }
        return issueTokens(user);
    }

    /**
     * Validates the presented refresh token, rotates it, and returns a fresh access token
     * plus a new raw refresh token (for the rotated cookie).
     */
    @Transactional
    public RotationResult refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("Missing refresh token");
        }
        String tokenHash = sha256(rawRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (!stored.isActive()) {
            // Token reuse or expiry: revoke all the user's tokens defensively.
            refreshTokenRepository.revokeAllForUser(stored.getUserId());
            throw new UnauthorizedException("Refresh token expired or revoked");
        }

        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new UnauthorizedException("User no longer exists"));

        // Rotate: revoke the old token, issue a new one.
        stored.revoke();
        refreshTokenRepository.save(stored);

        String newRawRefresh = generateRawRefreshToken();
        persistRefreshToken(user, newRawRefresh);

        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail());
        RefreshResponse response = new RefreshResponse(accessToken, jwtService.getAccessTtlSeconds());
        return new RotationResult(response, newRawRefresh);
    }

    /** Revokes the presented refresh token (logout). Idempotent. */
    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(sha256(rawRefreshToken)).ifPresent(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
    }

    private TokenPair issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail());
        String rawRefresh = generateRawRefreshToken();
        persistRefreshToken(user, rawRefresh);
        return new TokenPair(accessToken, jwtService.getAccessTtlSeconds(), rawRefresh, user);
    }

    private void persistRefreshToken(User user, String rawRefresh) {
        Instant expiresAt = Instant.now().plusMillis(refreshTtlMillis);
        RefreshToken token = RefreshToken.create(user.getId(), sha256(rawRefresh), expiresAt);
        refreshTokenRepository.save(token);
    }

    private static String generateRawRefreshToken() {
        byte[] bytes = new byte[48];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    /** Carries the refresh response plus the rotated raw refresh token for the cookie. */
    public record RotationResult(RefreshResponse response, String rawRefreshToken) {
    }
}
