package com.signalvault.auth;

import com.signalvault.security.CookieProperties;
import com.signalvault.security.JwtProperties;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Builds the {@code refreshToken} cookie: HttpOnly, SameSite=Lax, Path=/.
 * Secure is controlled by {@code app.cookie.secure} (false in local http dev, true behind HTTPS).
 */
@Component
public class RefreshCookieFactory {

    public static final String COOKIE_NAME = "refreshToken";

    private final boolean secure;
    private final long maxAgeSeconds;

    public RefreshCookieFactory(CookieProperties cookieProperties, JwtProperties jwtProperties) {
        this.secure = cookieProperties.isSecure();
        this.maxAgeSeconds = jwtProperties.getRefreshTtl();
    }

    public ResponseCookie create(String rawRefreshToken) {
        return ResponseCookie.from(COOKIE_NAME, rawRefreshToken)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .build();
    }

    /** A cookie that immediately clears the refresh token (used on logout). */
    public ResponseCookie clear() {
        return ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ZERO)
                .build();
    }
}
