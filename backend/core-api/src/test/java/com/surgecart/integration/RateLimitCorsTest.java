package com.surgecart.integration;

import com.surgecart.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The login rate limit as a browser on another origin sees it. A 429 without
 * CORS headers is hidden from the page, which then shows "could not reach the
 * server" instead of "too many attempts".
 *
 * Each test uses its own X-Forwarded-For address, so it gets its own bucket
 * and never eats into the attempts other tests make from localhost.
 */
class RateLimitCorsTest extends AbstractIntegrationTest {

    private static final int AUTH_ATTEMPTS_PER_WINDOW = 5; // application.yml default

    @LocalServerPort private int port;
    @Value("${surgecart.cors.allowed-origin}") private String allowedOrigin;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void aRateLimitedLoginStillCarriesCorsHeaders() throws Exception {
        String ip = freshIp();
        for (int i = 0; i < AUTH_ATTEMPTS_PER_WINDOW; i++) {
            assertThat(login(ip).statusCode()).isNotEqualTo(429);
        }

        HttpResponse<String> limited = login(ip);

        assertThat(limited.statusCode()).isEqualTo(429);
        assertThat(limited.headers().firstValue("Access-Control-Allow-Origin")).hasValue(allowedOrigin);
        assertThat(limited.headers().firstValue("Retry-After")).isPresent();
        assertThat(limited.body()).contains("RATE_LIMITED");
    }

    @Test
    void preflightsDoNotUseUpLoginAttempts() throws Exception {
        String ip = freshIp();
        for (int i = 0; i < AUTH_ATTEMPTS_PER_WINDOW * 2; i++) {
            assertThat(preflight(ip).statusCode()).isEqualTo(200);
        }

        assertThat(login(ip).statusCode()).isNotEqualTo(429);
    }

    /** An empty body fails validation, so this counts as an attempt without needing an account. */
    private HttpResponse<String> login(String ip) throws Exception {
        return http.send(HttpRequest.newBuilder(uri())
                .header("Origin", allowedOrigin)
                .header("X-Forwarded-For", ip)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                .build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> preflight(String ip) throws Exception {
        return http.send(HttpRequest.newBuilder(uri())
                .header("Origin", allowedOrigin)
                .header("X-Forwarded-For", ip)
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri() {
        return URI.create("http://localhost:" + port + "/api/auth/login");
    }

    private static String freshIp() {
        return "203.0.113." + UUID.randomUUID().toString().substring(0, 8);
    }
}
