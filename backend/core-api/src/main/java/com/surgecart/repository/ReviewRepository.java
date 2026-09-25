package com.surgecart.repository;

import com.surgecart.domain.Review;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findTop12ByOrderByCreatedAtDesc();
}
