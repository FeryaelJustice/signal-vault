package com.signalvault.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT configuration. TTLs are expressed in SECONDS (matching the docker-compose contract,
 * e.g. APP_JWT_ACCESS_TTL=900 for 15 minutes, APP_JWT_REFRESH_TTL=604800 for 7 days).
 */
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /** HMAC secret. Must be at least 256 bits (32 bytes) for HS256. */
    private String secret;

    /** Access token TTL in seconds. */
    private long accessTtl = 900L; // 15 minutes

    /** Refresh token TTL in seconds. */
    private long refreshTtl = 604_800L; // 7 days

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    /** Access token TTL in seconds. */
    public long getAccessTtl() {
        return accessTtl;
    }

    public void setAccessTtl(long accessTtl) {
        this.accessTtl = accessTtl;
    }

    /** Refresh token TTL in seconds. */
    public long getRefreshTtl() {
        return refreshTtl;
    }

    public void setRefreshTtl(long refreshTtl) {
        this.refreshTtl = refreshTtl;
    }

    /** Access token TTL in milliseconds (derived). */
    public long getAccessTtlMillis() {
        return accessTtl * 1000L;
    }

    /** Refresh token TTL in milliseconds (derived). */
    public long getRefreshTtlMillis() {
        return refreshTtl * 1000L;
    }
}
