package store

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"
)

// BenchmarkReserveConcurrent measures raw Lua-script throughput in-process
// (bypassing HTTP entirely) so the number reflects Redis + the script, not
// this sandbox's loopback HTTP stack. Run: go test -bench=. -run=^$ ./internal/store/...
func BenchmarkReserveConcurrent(b *testing.B) {
	url := "redis://localhost:6379"
	s, err := New(url)
	if err != nil {
		b.Fatalf("connecting to redis: %v", err)
	}
	defer s.Close()
	ctx := context.Background()

	saleID := uuid.NewString()
	if err := s.client.Set(ctx, "sale:"+saleID+":stock", b.N, 0).Err(); err != nil {
		b.Fatalf("seeding stock: %v", err)
	}

	var wg sync.WaitGroup
	b.ResetTimer()
	wg.Add(b.N)
	for i := 0; i < b.N; i++ {
		go func(i int) {
			defer wg.Done()
			_, _ = s.Reserve(ctx, saleID, fmt.Sprintf("u%d", i), 1, b.N+1, 30, uuid.NewString(), "{}")
		}(i)
	}
	wg.Wait()
}
