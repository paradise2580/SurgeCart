-- release.lua
-- Reverses a reservation: returns stock and per-user count, but ONLY if the
-- reservation key still exists. This guard is what makes it safe to call this
-- script from three independent triggers (explicit cancel, TTL expiry job,
-- and Redis keyspace-notification listener) without ever double-crediting stock.
--
-- KEYS[1] = sale:{saleId}:stock
-- KEYS[2] = sale:{saleId}:user:{userId}
-- KEYS[3] = resv:{token}
--
-- ARGV[1] = quantity to return
--
-- Returns 1 if released, 0 if the key was already gone (no-op, not an error)

local exists = redis.call('EXISTS', KEYS[3])
if exists == 0 then
    return 0
end

redis.call('DEL', KEYS[3])
redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
redis.call('DECRBY', KEYS[2], tonumber(ARGV[1]))

return 1
