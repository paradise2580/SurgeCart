package com.surgecart.controller;

import com.surgecart.domain.Review;
import com.surgecart.domain.User;
import com.surgecart.dto.CreateReviewRequest;
import com.surgecart.dto.ReviewDto;
import com.surgecart.repository.ReviewRepository;
import com.surgecart.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews")
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<ReviewDto> latest() {
        return reviewRepository.findTop12ByOrderByCreatedAtDesc().stream().map(ReviewController::toDto).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewDto create(@Valid @RequestBody CreateReviewRequest request, Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElseThrow();
        Review review = reviewRepository.save(Review.builder()
                .userId(user.getId())
                .authorName(displayName(user.getEmail()))
                .rating(request.rating())
                .comment(request.comment().strip())
                .build());
        return toDto(review);
    }

    /** "priya.sharma42@x.com" -> "Priya S." — never publishes the full address. */
    static String displayName(String email) {
        String[] parts = email.substring(0, email.indexOf('@')).replaceAll("\\d", "").split("[._+-]+");
        if (parts.length == 0 || parts[0].isEmpty()) return "Shopper";
        String first = capitalize(parts[0].length() > 40 ? parts[0].substring(0, 40) : parts[0]);
        return parts.length > 1 && !parts[1].isEmpty()
                ? first + " " + Character.toUpperCase(parts[1].charAt(0)) + "."
                : first;
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }

    private static ReviewDto toDto(Review r) {
        return new ReviewDto(r.getId(), r.getAuthorName(), r.getRating(), r.getComment(), r.getCreatedAt());
    }
}
