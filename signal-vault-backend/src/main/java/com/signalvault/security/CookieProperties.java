package com.signalvault.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.cookie")
public class CookieProperties {

    /**
     * Whether the refresh-token cookie carries the Secure flag.
     * Should be true in production (HTTPS) and may be false in local dev over http.
     */
    private boolean secure = false;

    public boolean isSecure() {
        return secure;
    }

    public void setSecure(boolean secure) {
        this.secure = secure;
    }
}
