package com.signalvault.auth;

import com.signalvault.auth.dto.AuthResponse;
import com.signalvault.auth.dto.LoginRequest;
import com.signalvault.auth.dto.RefreshResponse;
import com.signalvault.auth.dto.RegisterRequest;
import com.signalvault.auth.dto.TokenPair;
import com.signalvault.auth.dto.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Register, login, token refresh and logout")
public class AuthController {

    private final AuthService authService;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthController(AuthService authService, RefreshCookieFactory refreshCookieFactory) {
        this.authService = authService;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @Operation(summary = "Register a new account")
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        TokenPair tokens = authService.register(request.email(), request.password());
        return authResponse(tokens, HttpStatus.CREATED);
    }

    @Operation(summary = "Log in with email and password")
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        TokenPair tokens = authService.login(request.email(), request.password());
        return authResponse(tokens, HttpStatus.OK);
    }

    @Operation(summary = "Refresh the access token using the refresh cookie (rotates the cookie)")
    @PostMapping("/refresh")
    public ResponseEntity<RefreshResponse> refresh(HttpServletRequest request) {
        String rawRefresh = readRefreshCookie(request);
        AuthService.RotationResult result = authService.refresh(rawRefresh);
        ResponseCookie cookie = refreshCookieFactory.create(result.rawRefreshToken());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(result.response());
    }

    @Operation(summary = "Log out and clear the refresh cookie")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String rawRefresh = readRefreshCookie(request);
        authService.logout(rawRefresh);
        ResponseCookie cleared = refreshCookieFactory.clear();
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cleared.toString())
                .build();
    }

    private ResponseEntity<AuthResponse> authResponse(TokenPair tokens, HttpStatus status) {
        ResponseCookie cookie = refreshCookieFactory.create(tokens.rawRefreshToken());
        AuthResponse body = new AuthResponse(
                tokens.accessToken(),
                tokens.expiresIn(),
                UserResponse.from(tokens.user()));
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(body);
    }

    private String readRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (RefreshCookieFactory.COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
