package com.surgecart.support;

import com.redis.testcontainers.RedisContainer;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Shared base for every integration and concurrency test. Real PostgreSQL
 * and real Redis, not H2 and not an embedded fake — deliberately, because
 * H2 does not implement SELECT ... FOR UPDATE semantics or PostgreSQL's
 * actual isolation behaviour faithfully. A pessimistic-locking test built
 * on H2 would be validating the wrong database and could pass for the
 * wrong reasons.
 *
 * The containers are started once and shared by every test class (the
 * singleton-container pattern). Spring caches the application context across
 * classes, so per-class containers would leave the second class talking to a
 * stopped database. Testcontainers' Ryuk sidecar removes them at JVM exit.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@SuppressWarnings("resource") // Ryuk removes the containers at JVM exit
public abstract class AbstractIntegrationTest {

    /**
     * Connections the test pool may open.
     *
     * Production runs on ten (see application.yml). The concurrency suite
     * deliberately pushes far more claimants than that at the database, so the
     * pool here is sized to the test's worker count instead — otherwise the
     * suite measures how long threads queue for a connection rather than
     * whether the locking strategy is correct.
     */
    public static final int TEST_POOL_SIZE = 64;

    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("surgecart_test")
            .withUsername("test")
            .withPassword("test")
            // Default max_connections is 100, and a rejected connection surfaces
            // as a socket-level failure that looks nothing like "pool too small".
            // Leave headroom above TEST_POOL_SIZE so the cause is never ambiguous.
            .withCommand("postgres", "-c", "max_connections=200");

    static final RedisContainer redis = new RedisContainer(DockerImageName.parse("redis:7-alpine"));

    static {
        postgres.start();
        redis.start();
    }

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.url", () ->
                "redis://" + redis.getHost() + ":" + redis.getFirstMappedPort());

        registry.add("spring.datasource.hikari.maximum-pool-size", () -> TEST_POOL_SIZE);
        // A CI runner starting a cold container is slower than a laptop; the
        // 30-second default expires while Postgres is still accepting its first
        // connections, and every test then reports a transaction failure.
        registry.add("spring.datasource.hikari.connection-timeout", () -> 60_000);
        registry.add("spring.datasource.hikari.validation-timeout", () -> 10_000);
    }
}
