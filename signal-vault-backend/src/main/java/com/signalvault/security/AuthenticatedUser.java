package com.signalvault.security;

import java.security.Principal;
import java.util.UUID;

/**
 * The authenticated principal stored in the SecurityContext.
 * Implements {@link Principal} so it is also usable as the STOMP message principal name.
 */
public record AuthenticatedUser(UUID id, String email) implements Principal {

    @Override
    public String getName() {
        return id.toString();
    }
}
