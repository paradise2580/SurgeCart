package com.surgecart.integration;

import com.surgecart.dto.AuthResponse;
import com.surgecart.dto.ReviewDto;
import com.surgecart.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ReviewApiTest extends AbstractIntegrationTest {

    @Autowired private TestRestTemplate rest;

    @Test
    void anyoneCanReadReviews() {
        ResponseEntity<ReviewDto[]> res = rest.getForEntity("/api/reviews", ReviewDto[].class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotEmpty(); // the V3 migration seeds sample reviews
    }

    @Test
    void postingRequiresLogin() {
        ResponseEntity<String> res = rest.postForEntity("/api/reviews",
                Map.of("rating", 5, "comment", "Anonymous praise is not accepted."), String.class);

        assertThat(res.getStatusCode().value()).isIn(401, 403);
    }

    @Test
    void loggedInBuyerCanPostAndOnlyAMaskedNameIsPublished() {
        String email = "priya.sharma" + UUID.randomUUID().toString().substring(0, 6).replaceAll("\\D", "") + "@test.dev";
        AuthResponse auth = rest.postForObject("/api/auth/register",
                Map.of("email", email, "password", "password123"), AuthResponse.class);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(auth.accessToken());
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<ReviewDto> created = rest.exchange("/api/reviews", HttpMethod.POST,
                new HttpEntity<>(Map.of("rating", 4, "comment", "  Lovely earrings, arrived in two days.  "), headers),
                ReviewDto.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody().authorName()).isEqualTo("Priya S.");
        assertThat(created.getBody().comment()).isEqualTo("Lovely earrings, arrived in two days.");

        ResponseEntity<String> invalid = rest.exchange("/api/reviews", HttpMethod.POST,
                new HttpEntity<>(Map.of("rating", 9, "comment", "short"), headers), String.class);
        assertThat(invalid.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
