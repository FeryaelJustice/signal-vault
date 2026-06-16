package com.signalvault.websocket;

import com.signalvault.security.AuthenticatedUser;
import com.signalvault.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Authenticates the STOMP CONNECT frame using the {@code Authorization: Bearer <token>} header.
 * Rejects the connection (by throwing) if the token is missing or invalid, and binds the
 * {@link AuthenticatedUser} as the session principal so subsequent SEND frames are attributable.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    public StompAuthChannelInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
                throw new MessagingException("Missing or malformed Authorization header on CONNECT");
            }
            String token = authHeader.substring(BEARER_PREFIX.length());
            try {
                Jws<Claims> jws = jwtService.parse(token);
                Claims claims = jws.getPayload();
                UUID userId = UUID.fromString(claims.getSubject());
                String email = claims.get("email", String.class);

                AuthenticatedUser principal = new AuthenticatedUser(userId, email);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                principal, null, AuthorityUtils.createAuthorityList("ROLE_USER"));
                accessor.setUser(authentication);
            } catch (JwtException | IllegalArgumentException ex) {
                throw new MessagingException("Invalid JWT on CONNECT", ex);
            }
        }

        return message;
    }
}
