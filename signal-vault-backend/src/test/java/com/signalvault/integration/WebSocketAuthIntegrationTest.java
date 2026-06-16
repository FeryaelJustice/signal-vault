package com.signalvault.integration;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the STOMP CONNECT frame is authenticated: a missing or invalid Bearer token
 * causes the connection to be rejected, while a valid token connects successfully.
 *
 * Uses a raw WebSocket (no SockJS) against the /ws endpoint, which Spring serves for both.
 */
class WebSocketAuthIntegrationTest extends AbstractIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate rest;

    private WebSocketStompClient newStompClient() {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        return client;
    }

    private String wsUrl() {
        return "ws://localhost:" + port + "/ws/websocket";
    }

    private String registerAndGetToken() {
        String email = "ws-" + UUID.randomUUID() + "@example.com";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> response = rest.postForEntity(
                "/api/auth/register",
                new HttpEntity<>("{\"email\":\"" + email + "\",\"password\":\"password123\"}", headers),
                JsonNode.class);
        return response.getBody().get("accessToken").asText();
    }

    @Test
    void connectWithoutTokenIsRejected() {
        WebSocketStompClient client = newStompClient();
        StompHeaders connectHeaders = new StompHeaders(); // no Authorization

        assertThatThrownBy(() ->
                client.connectAsync(wsUrl(), new WebSocketHttpHeadersNoop(), connectHeaders,
                                new StompSessionHandlerAdapter() {})
                        .get(5, TimeUnit.SECONDS))
                .isInstanceOfAny(ExecutionException.class, TimeoutException.class);
    }

    @Test
    void connectWithInvalidTokenIsRejected() {
        WebSocketStompClient client = newStompClient();
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer not-a-valid-jwt");

        assertThatThrownBy(() ->
                client.connectAsync(wsUrl(), new WebSocketHttpHeadersNoop(), connectHeaders,
                                new StompSessionHandlerAdapter() {})
                        .get(5, TimeUnit.SECONDS))
                .isInstanceOfAny(ExecutionException.class, TimeoutException.class);
    }

    @Test
    void connectWithValidTokenSucceeds() throws Exception {
        String token = registerAndGetToken();
        WebSocketStompClient client = newStompClient();
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);

        StompSession session = client.connectAsync(wsUrl(), new WebSocketHttpHeadersNoop(), connectHeaders,
                        new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);

        assertThat(session.isConnected()).isTrue();
        session.disconnect();
    }

    /** Minimal empty WebSocketHttpHeaders subclass to satisfy the connect signature. */
    private static class WebSocketHttpHeadersNoop extends org.springframework.web.socket.WebSocketHttpHeaders {
    }
}
