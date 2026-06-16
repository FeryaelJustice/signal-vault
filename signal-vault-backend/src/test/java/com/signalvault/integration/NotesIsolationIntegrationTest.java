package com.signalvault.integration;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies note ownership isolation: a user cannot read, update or delete another user's notes.
 */
class NotesIsolationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String registerAndGetToken() {
        String email = "user-" + UUID.randomUUID() + "@example.com";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> response = rest.postForEntity(
                "/api/auth/register",
                new HttpEntity<>("{\"email\":\"" + email + "\",\"password\":\"password123\"}", headers),
                JsonNode.class);
        return response.getBody().get("accessToken").asText();
    }

    private HttpHeaders bearerJson(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        return headers;
    }

    @Test
    void userCannotReadUpdateOrDeleteAnotherUsersNote() {
        String tokenA = registerAndGetToken();
        String tokenB = registerAndGetToken();

        // User A creates a note.
        ResponseEntity<JsonNode> created = rest.exchange(
                "/api/notes",
                HttpMethod.POST,
                new HttpEntity<>("{\"title\":\"secret\",\"encryptedContent\":\"CIPHERTEXT-A\"}", bearerJson(tokenA)),
                JsonNode.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String noteId = created.getBody().get("id").asText();

        // User B lists notes -> must not see A's note.
        ResponseEntity<JsonNode> listB = rest.exchange(
                "/api/notes", HttpMethod.GET, new HttpEntity<>(bearerJson(tokenB)), JsonNode.class);
        assertThat(listB.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listB.getBody().isArray()).isTrue();
        assertThat(listB.getBody()).isEmpty();

        // User B tries to update A's note -> 404 (ownership hidden).
        ResponseEntity<JsonNode> updateB = rest.exchange(
                "/api/notes/" + noteId,
                HttpMethod.PUT,
                new HttpEntity<>("{\"title\":\"hijack\",\"encryptedContent\":\"CIPHERTEXT-B\"}", bearerJson(tokenB)),
                JsonNode.class);
        assertThat(updateB.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        // User B tries to delete A's note -> 404.
        ResponseEntity<JsonNode> deleteB = rest.exchange(
                "/api/notes/" + noteId,
                HttpMethod.DELETE,
                new HttpEntity<>(bearerJson(tokenB)),
                JsonNode.class);
        assertThat(deleteB.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        // User A can still read their own note.
        ResponseEntity<JsonNode> listA = rest.exchange(
                "/api/notes", HttpMethod.GET, new HttpEntity<>(bearerJson(tokenA)), JsonNode.class);
        assertThat(listA.getBody()).hasSize(1);
        assertThat(listA.getBody().get(0).get("encryptedContent").asText()).isEqualTo("CIPHERTEXT-A");
    }

    @Test
    void ownerCanUpdateAndDeleteOwnNote() {
        String token = registerAndGetToken();

        ResponseEntity<JsonNode> created = rest.exchange(
                "/api/notes",
                HttpMethod.POST,
                new HttpEntity<>("{\"title\":\"t\",\"encryptedContent\":\"C1\"}", bearerJson(token)),
                JsonNode.class);
        String noteId = created.getBody().get("id").asText();

        ResponseEntity<JsonNode> updated = rest.exchange(
                "/api/notes/" + noteId,
                HttpMethod.PUT,
                new HttpEntity<>("{\"title\":\"t2\",\"encryptedContent\":\"C2\"}", bearerJson(token)),
                JsonNode.class);
        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody().get("encryptedContent").asText()).isEqualTo("C2");

        ResponseEntity<Void> deleted = rest.exchange(
                "/api/notes/" + noteId,
                HttpMethod.DELETE,
                new HttpEntity<>(bearerJson(token)),
                Void.class);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
