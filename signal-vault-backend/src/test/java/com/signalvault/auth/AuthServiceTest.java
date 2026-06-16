package com.signalvault.auth;

import com.signalvault.common.ConflictException;
import com.signalvault.common.UnauthorizedException;
import com.signalvault.security.JwtProperties;
import com.signalvault.security.JwtService;
import com.signalvault.auth.dto.TokenPair;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String SECRET =
            "test-signalvault-super-secret-key-which-is-long-enough-0123456789";

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret(SECRET);
        props.setAccessTtl(900L);
        props.setRefreshTtl(604_800L);
        jwtService = new JwtService(props);
        authService = new AuthService(userRepository, refreshTokenRepository, passwordEncoder, jwtService, props);
    }

    @Test
    void registerCreatesUserAndIssuesTokens() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        TokenPair tokens = authService.register("Alice@Example.com", "password123");

        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(tokens.rawRefreshToken()).isNotBlank();
        assertThat(tokens.user().getEmail()).isEqualTo("alice@example.com"); // normalized lowercase
        assertThat(jwtService.isValid(tokens.accessToken())).isTrue();
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register("dup@example.com", "password123"))
                .isInstanceOf(ConflictException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void loginSucceedsWithValidPassword() {
        String hash = passwordEncoder.encode("password123");
        User user = new User(UUID.randomUUID(), "bob@example.com", hash, Instant.now());
        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        TokenPair tokens = authService.login("bob@example.com", "password123");

        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(jwtService.extractUserId(tokens.accessToken())).isEqualTo(user.getId());
    }

    @Test
    void loginFailsWithWrongPassword() {
        String hash = passwordEncoder.encode("password123");
        User user = new User(UUID.randomUUID(), "bob@example.com", hash, Instant.now());
        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login("bob@example.com", "wrong-password"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void loginFailsForUnknownUser() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login("ghost@example.com", "password123"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void refreshRotatesTokenAndRevokesOld() {
        // Issue an initial token pair via register to obtain a valid raw refresh token plus the
        // exact User and RefreshToken that the service created (register generates a random user id).
        lenient().when(userRepository.existsByEmail(anyString())).thenReturn(false);
        ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
        when(userRepository.save(savedUser.capture())).thenAnswer(inv -> inv.getArgument(0));
        ArgumentCaptor<RefreshToken> savedToken = ArgumentCaptor.forClass(RefreshToken.class);
        when(refreshTokenRepository.save(savedToken.capture())).thenAnswer(inv -> inv.getArgument(0));

        TokenPair initial = authService.register("carol@example.com", "pw");
        String rawRefresh = initial.rawRefreshToken();
        User createdUser = savedUser.getValue();
        RefreshToken stored = savedToken.getAllValues().get(0); // refresh token persisted on register

        // Now refresh: look up by hash returns the active stored token, and the user exists.
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
        when(userRepository.findById(createdUser.getId())).thenReturn(Optional.of(createdUser));

        AuthService.RotationResult result = authService.refresh(rawRefresh);

        assertThat(result.response().accessToken()).isNotBlank();
        assertThat(result.rawRefreshToken()).isNotBlank().isNotEqualTo(rawRefresh);
        assertThat(stored.isRevoked()).isTrue(); // old token revoked (rotation)
    }

    @Test
    void refreshRejectsMissingToken() {
        assertThatThrownBy(() -> authService.refresh(null))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void refreshRejectsUnknownToken() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh("some-random-token"))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void logoutRevokesTokenWhenPresent() {
        UUID userId = UUID.randomUUID();
        RefreshToken token = RefreshToken.create(userId, "hash", Instant.now().plusSeconds(60));
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        lenient().when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.logout("raw-token");

        assertThat(token.isRevoked()).isTrue();
    }
}
