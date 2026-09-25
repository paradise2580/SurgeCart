package com.surgecart.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.function.Supplier;

@Component
@Order(1)
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final ProxyManager<byte[]> proxyManager;

    /**
     * Auth attempts allowed per 15 min per IP. Deliberately configurable:
     * 5 is the right production value against credential stuffing, but it
     * makes local development and demos painful, so set
     * SURGECART_AUTH_RATE_LIMIT=1000 (as docker-compose does for dev) to
     * effectively disable it.
     */
    @Value("${surgecart.rate-limit.auth-per-15min:5}")
    private int authCapacity;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String clientIp = clientIp(request);

        RuleMatch rule = resolveRule(path, clientIp);
        Bucket bucket = proxyManager.builder().build(rule.key().getBytes(StandardCharsets.UTF_8), rule.configSupplier());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"status\":429,\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Please slow down.\"}");
        }
    }

    private record RuleMatch(String key, Supplier<BucketConfiguration> configSupplier) {}

    private RuleMatch resolveRule(String path, String clientIp) {
        // Only the endpoints that accept a password are credential-stuffing
        // targets. /auth/refresh needs the httpOnly refresh cookie, and the
        // frontend calls it on every page load to restore the session, so it
        // falls through to the general limit instead.
        if (path.equals("/api/auth/login") || path.equals("/api/auth/register")) {
            return new RuleMatch("rl:auth:" + clientIp,
                    () -> BucketConfiguration.builder()
                            .addLimit(Bandwidth.builder()
                                    .capacity(authCapacity)
                                    .refillIntervally(authCapacity, Duration.ofMinutes(15))
                                    .build())
                            .build());
        }

        if (path.matches("^/api/sales/\\d+/reserve$")) {
            String userKey = currentUserEmail().orElse(clientIp);
            return new RuleMatch("rl:reserve:" + userKey,
                    () -> BucketConfiguration.builder()
                            .addLimit(Bandwidth.builder().capacity(3).refillIntervally(3, Duration.ofSeconds(10)).build())
                            .build());
        }

        return new RuleMatch("rl:general:" + clientIp,
                () -> BucketConfiguration.builder()
                        .addLimit(Bandwidth.builder().capacity(100).refillIntervally(100, Duration.ofMinutes(1)).build())
                        .build());
    }

    private java.util.Optional<String> currentUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.isAuthenticated() ? java.util.Optional.of(auth.getName()) : java.util.Optional.empty();
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded != null ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
    }
}
