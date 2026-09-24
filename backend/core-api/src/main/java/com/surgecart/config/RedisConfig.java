package com.surgecart.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.util.List;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    /**
     * The atomic claim operation. See resources/lua/reserve.lua for the
     * full commentary — this is the bean that Implementation C (the
     * production path) runs instead of taking any JPA lock at all.
     */
    @Bean
    @SuppressWarnings({"unchecked", "rawtypes"})
    public DefaultRedisScript<List<Long>> reserveScript() {
        DefaultRedisScript<List<Long>> script = new DefaultRedisScript<>();
        script.setLocation(new ClassPathResource("lua/reserve.lua"));
        script.setResultType((Class) List.class);
        return script;
    }

    @Bean
    public DefaultRedisScript<Long> releaseScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setLocation(new ClassPathResource("lua/release.lua"));
        script.setResultType(Long.class);
        return script;
    }

    /**
     * Backs the keyspace-notification fast path in ReservationExpiryService.
     * Requires `notify-keyspace-events Ex` on the Redis server — set in
     * docker-compose.yml for local dev. Managed Redis providers (Upstash,
     * Railway Redis) may restrict CONFIG SET; the scheduled sweep in
     * ReservationExpiryService is the correctness guarantee regardless, so
     * this listener degrading to a no-op there costs latency, not correctness.
     */
    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(RedisConnectionFactory factory) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        return container;
    }

    @Slf4j
    @Configuration
    @RequiredArgsConstructor
    static class KeyspaceNotificationInitializer {

        private final RedisConnectionFactory connectionFactory;

        @PostConstruct
        public void enableExpiryNotifications() {
            try {
                connectionFactory.getConnection().serverCommands()
                        .setConfig("notify-keyspace-events", "Ex");
            } catch (Exception e) {
                log.warn("Could not set notify-keyspace-events (managed Redis may restrict CONFIG SET); "
                        + "relying on the scheduled sweep for expiry. Cause: {}", e.getMessage());
            }
        }
    }
}
