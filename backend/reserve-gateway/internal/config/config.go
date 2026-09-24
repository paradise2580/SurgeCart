package config

import (
	"os"
	"strconv"
)

// Config is environment-driven, no framework — matches DESIGN.md's stated
// choice to keep this gateway a small, dependency-light service.
type Config struct {
	Port           string
	RedisURL       string
	ReservationTTL int // seconds
}

func Load() Config {
	return Config{
		Port:           getEnv("PORT", "8081"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379"),
		ReservationTTL: getEnvInt("RESERVATION_TTL_SECONDS", 90),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
