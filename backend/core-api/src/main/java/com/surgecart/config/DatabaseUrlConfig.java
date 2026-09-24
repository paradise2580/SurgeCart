package com.surgecart.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/**
 * Managed Postgres providers (Render, Heroku, Railway) hand out a
 * {@code postgres://user:pass@host:port/db} URL. The JDBC driver needs
 * {@code jdbc:postgresql://host:port/db} with credentials supplied separately.
 *
 * Rather than making whoever deploys this hand-translate the connection
 * string into three env vars, this post-processor detects the provider format
 * and splits it automatically. A plain {@code jdbc:} URL is passed through
 * untouched, so local Docker Compose is unaffected.
 */
public class DatabaseUrlConfig implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String dbUrl = environment.getProperty("DB_URL");

        if (dbUrl == null || !dbUrl.startsWith("postgres")) {
            return; // already JDBC form, or not set — nothing to do
        }
        if (dbUrl.startsWith("jdbc:")) {
            return;
        }

        try {
            URI uri = new URI(dbUrl);
            String userInfo = uri.getUserInfo();
            int port = uri.getPort() == -1 ? 5432 : uri.getPort();

            String jdbc = "jdbc:postgresql://%s:%d%s".formatted(uri.getHost(), port, uri.getPath());
            // Managed providers require TLS; the driver won't infer it.
            if (!jdbc.contains("sslmode=")) {
                jdbc += (jdbc.contains("?") ? "&" : "?") + "sslmode=require";
            }

            Map<String, Object> overrides = new HashMap<>();
            overrides.put("spring.datasource.url", jdbc);

            if (userInfo != null && userInfo.contains(":")) {
                String[] parts = userInfo.split(":", 2);
                overrides.put("spring.datasource.username", parts[0]);
                overrides.put("spring.datasource.password", parts[1]);
            }

            environment.getPropertySources()
                    .addFirst(new MapPropertySource("renderDatabaseUrl", overrides));

        } catch (Exception e) {
            throw new IllegalStateException(
                    "DB_URL looked like a provider connection string but could not be parsed: " + e.getMessage(), e);
        }
    }
}
