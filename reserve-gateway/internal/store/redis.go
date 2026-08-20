package store

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/redis/go-redis/v9"
)

//go:embed lua_reserve.lua
var reserveScriptSource string

//go:embed lua_release.lua
var releaseScriptSource string

// Store wraps the Redis client and the two cached Lua scripts. Both scripts
// are byte-for-byte the same ones the Spring Boot core-api runs (see
// ../../lua and core-api/src/main/resources/lua) — this gateway and the
// Java service share the same Redis instance and the same atomic operation,
// so a stock claim through either one is indistinguishable to the other.
type Store struct {
	client         *redis.Client
	reserveScript  *redis.Script
	releaseScript  *redis.Script
}

func New(redisURL string) (*Store, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parsing redis url: %w", err)
	}
	client := redis.NewClient(opt)

	return &Store{
		client:        client,
		reserveScript: redis.NewScript(reserveScriptSource),
		releaseScript: redis.NewScript(releaseScriptSource),
	}, nil
}

func (s *Store) Ping(ctx context.Context) error {
	return s.client.Ping(ctx).Err()
}

func (s *Store) Close() error {
	return s.client.Close()
}

// ReserveResult mirrors the {code, stockRemaining} tuple reserve.lua returns.
type ReserveResult struct {
	Code           int64
	StockRemaining int64
}

func (s *Store) Reserve(ctx context.Context, saleID, userID string, qty, perUserLimit, ttlSeconds int, token, payload string) (ReserveResult, error) {
	stockKey := "sale:" + saleID + ":stock"
	userKey := "sale:" + saleID + ":user:" + userID
	resvKey := "resv:" + token

	raw, err := s.reserveScript.Run(ctx, s.client,
		[]string{stockKey, userKey, resvKey},
		qty, perUserLimit, ttlSeconds, payload,
	).Result()
	if err != nil {
		return ReserveResult{}, err
	}

	arr, ok := raw.([]interface{})
	if !ok || len(arr) != 2 {
		return ReserveResult{}, fmt.Errorf("unexpected reserve.lua result shape: %v", raw)
	}

	return ReserveResult{
		Code:           toInt64(arr[0]),
		StockRemaining: toInt64(arr[1]),
	}, nil
}

func (s *Store) Release(ctx context.Context, saleID, userID, token string, qty int) (bool, error) {
	stockKey := "sale:" + saleID + ":stock"
	userKey := "sale:" + saleID + ":user:" + userID
	resvKey := "resv:" + token

	raw, err := s.releaseScript.Run(ctx, s.client,
		[]string{stockKey, userKey, resvKey}, qty,
	).Result()
	if err != nil {
		return false, err
	}

	return toInt64(raw) == 1, nil
}

func toInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int64:
		return n
	default:
		return 0
	}
}
