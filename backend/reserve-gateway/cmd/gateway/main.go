package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/surgecart/reserve-gateway/internal/config"
	"github.com/surgecart/reserve-gateway/internal/handler"
	"github.com/surgecart/reserve-gateway/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg := config.Load()

	redisStore, err := store.New(cfg.RedisURL)
	if err != nil {
		logger.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	defer redisStore.Close()

	h := handler.New(redisStore, cfg.ReservationTTL, logger)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(5 * time.Second))
	// One goroutine per request is cheap in Go, but an unbounded flood of
	// them still means unbounded outstanding Redis round trips. This caps
	// in-flight requests rather than letting the process fall over under a
	// burst — the gateway's own form of backpressure.
	r.Use(boundedConcurrency(2000))

	r.Get("/health", h.Health)
	r.Post("/reserve", h.Reserve)
	r.Post("/release", h.Release)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("reserve-gateway listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	logger.Info("shutting down")
	_ = srv.Shutdown(ctx)
}

// boundedConcurrency bounds in-flight requests with a buffered-channel
// semaphore. A full semaphore returns 503 immediately rather than queuing
// requests indefinitely behind an already-overloaded Redis connection pool.
func boundedConcurrency(max int) func(http.Handler) http.Handler {
	sem := make(chan struct{}, max)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
				next.ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte(`{"code":"OVERLOADED","message":"gateway at capacity, retry shortly"}`))
			}
		})
	}
}
