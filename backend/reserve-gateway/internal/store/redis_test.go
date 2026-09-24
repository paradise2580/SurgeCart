package store

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/google/uuid"
)

// These tests run against a real local Redis (REDIS_URL, defaults to
// localhost:6379) rather than a mock. The whole point of the atomic Lua
// script is Redis's own single-threaded execution guarantee — a mock can't
// exercise that, so a real instance is what actually proves the claim.
func testStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379"
	}
	s, err := New(url)
	if err != nil {
		t.Fatalf("connecting to redis: %v", err)
	}
	if err := s.Ping(context.Background()); err != nil {
		t.Skipf("redis not reachable at %s, skipping: %v", url, err)
	}
	return s
}

func TestReserve_GrantsUntilStockExhausted(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	saleID := uuid.NewString()
	seedStock(t, s, saleID, 3)

	for i := 0; i < 3; i++ {
		result, err := s.Reserve(ctx, saleID, fmt.Sprintf("user-%d", i), 1, 10, 30, uuid.NewString(), "{}")
		if err != nil {
			t.Fatalf("reserve %d: %v", i, err)
		}
		if result.Code != 1 {
			t.Fatalf("reserve %d: expected code 1 (granted), got %d", i, result.Code)
		}
	}

	// Fourth request must be rejected — this is the whole test.
	result, err := s.Reserve(ctx, saleID, "user-overflow", 1, 10, 30, uuid.NewString(), "{}")
	if err != nil {
		t.Fatalf("reserve overflow: %v", err)
	}
	if result.Code != -1 {
		t.Fatalf("expected SOLD_OUT (-1) on the 4th claim against 3 units, got code %d", result.Code)
	}
}

func TestReserve_EnforcesPerUserLimit(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	saleID := uuid.NewString()
	seedStock(t, s, saleID, 100)

	userID := "repeat-buyer"
	first, err := s.Reserve(ctx, saleID, userID, 1, 1, 30, uuid.NewString(), "{}")
	if err != nil || first.Code != 1 {
		t.Fatalf("first reserve should succeed: code=%d err=%v", first.Code, err)
	}

	second, err := s.Reserve(ctx, saleID, userID, 1, 1, 30, uuid.NewString(), "{}")
	if err != nil {
		t.Fatalf("second reserve: %v", err)
	}
	if second.Code != -2 {
		t.Fatalf("expected USER_LIMIT_EXCEEDED (-2) on the 2nd claim by the same user with limit=1, got code %d", second.Code)
	}
}

func TestReserve_5000ConcurrentClaimsAgainst100Units_NeverOversells(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in -short mode")
	}
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	saleID := uuid.NewString()
	const stock = 100
	const concurrency = 5000
	seedStock(t, s, saleID, stock)

	var wg sync.WaitGroup
	var mu sync.Mutex
	granted := 0

	wg.Add(concurrency)
	for i := 0; i < concurrency; i++ {
		go func(i int) {
			defer wg.Done()
			result, err := s.Reserve(ctx, saleID, fmt.Sprintf("u%d", i), 1, 999999, 30, uuid.NewString(), "{}")
			if err == nil && result.Code == 1 {
				mu.Lock()
				granted++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()

	if granted != stock {
		t.Fatalf("expected exactly %d granted reservations, got %d — this would mean the gateway oversold", stock, granted)
	}
}

func TestRelease_DoubleReleaseIsANoOp(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	saleID := uuid.NewString()
	seedStock(t, s, saleID, 10)

	token := uuid.NewString()
	if _, err := s.Reserve(ctx, saleID, "u1", 1, 10, 30, token, "{}"); err != nil {
		t.Fatalf("reserve: %v", err)
	}

	first, err := s.Release(ctx, saleID, "u1", token, 1)
	if err != nil || !first {
		t.Fatalf("first release should succeed: released=%v err=%v", first, err)
	}

	second, err := s.Release(ctx, saleID, "u1", token, 1)
	if err != nil {
		t.Fatalf("second release: %v", err)
	}
	if second {
		t.Fatal("second release of the same token must be a no-op (existence guard), but it reported success")
	}
}

func seedStock(t *testing.T, s *Store, saleID string, stock int) {
	t.Helper()
	ctx := context.Background()
	if err := s.client.Set(ctx, "sale:"+saleID+":stock", stock, 0).Err(); err != nil {
		t.Fatalf("seeding stock: %v", err)
	}
}
