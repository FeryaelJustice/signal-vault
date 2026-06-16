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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AuthIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private HttpEntity<String> jsonBody(String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(json, headers);
    }

    @Test
    void registerReturnsAccessTokenAndRefreshCookie() {
        String email = uniqueEmail();
        ResponseEntity<JsonNode> response = rest.postForEntity(
                "/api/auth/register",
                jsonBody("{\"email\":\"" + email + "\",\"password\":\"password123\"}"),
                JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("accessToken").asText()).isNotBlank();
        assertThat(response.getBody().get("expiresIn").asLong()).isPositive();
        assertThat(response.getBody().get("user").get("email").asText()).isEqualTo(email);

        List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertThat(cookies).isNotNull();
        assertThat(cookies).anyMatch(c -> c.startsWith("refreshToken="));
        assertThat(cookies).anyMatch(c -> c.contains("HttpOnly"));
    }

    @Test
    void loginReturnsAccessAndRefresh() {
        String email = uniqueEmail();
        rest.postForEntity("/api/auth/register",
                jsonBody("{\"email\":\"" + email + "\",\"password\":\"password123\"}"),
                JsonNode.class);

        ResponseEntity<JsonNode> login = rest.postForEntity(
                "/api/auth/login",
                jsonBody("{\"email\":\"" + email + "\",\"password\":\"password123\"}"),
                JsonNode.class);

        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody().get("accessToken").asText()).isNotBlank();
        assertThat(login.getHeaders().get(HttpHeaders.SET_COOKIE))
                .anyMatch(c -> c.startsWith("refreshToken="));
    }

    @Test
    void meWithoutTokenReturns401() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/api/me", JsonNode.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void meWithTokenReturns200() {
        String email = uniqueEmail();
        ResponseEntity<JsonNode> register = rest.postForEntity(
                "/api/auth/register",
                jsonBody("{\"email\":\"" + email + "\",\"password\":\"password123\"}"),
                JsonNode.class);
        String token = register.getBody().get("accessToken").asText();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        ResponseEntity<JsonNode> me = rest.exchange(
                "/api/me", HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);

        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody().get("email").asText()).isEqualTo(email);
        assertThat(me.getBody().get("id").asText()).isNotBlank();
    }

    @Test
    void refreshRotatesCookieAndReturnsNewAccessToken() {
        String email = uniqueEmail();
        ResponseEntity<JsonNode> register = rest.postForEntity(
                "/api/auth/register",
                jsonBody("{\"email\":\"" + email + "\",\"password\":\"password123\"}"),
                JsonNode.class);
        String refreshCookie = extractRefreshCookie(register.getHeaders().get(HttpHeaders.SET_COOKIE));

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, refreshCookie);
        ResponseEntity<JsonNode> refresh = rest.exchange(
                "/api/auth/refresh", HttpMethod.POST, new HttpEntity<>(headers), JsonNode.class);

        assertThat(refresh.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(refresh.getBody().get("accessToken").asText()).isNotBlank();
        assertThat(refresh.getHeaders().get(HttpHeaders.SET_COOKIE))
                .anyMatch(c -> c.startsWith("refreshToken="));

        // Old refresh token is now revoked: reusing it must fail.
        ResponseEntity<JsonNode> reuse = rest.exchange(
                "/api/auth/refresh", HttpMethod.POST, new HttpEntity<>(headers), JsonNode.class);
        assertThat(reuse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private String extractRefreshCookie(List<String> setCookies) {
        assertThat(setCookies).isNotNull();
        return setCookies.stream()
                .filter(c -> c.startsWith("refreshToken="))
                .map(c -> c.split(";", 2)[0])
                .findFirst()
                .orElseThrow();
    }
}
