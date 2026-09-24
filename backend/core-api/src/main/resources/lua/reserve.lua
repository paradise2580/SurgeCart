-- reserve.lua
-- Atomically checks stock, enforces the per-user limit, decrements stock,
-- and writes a TTL-bound reservation record — all as one indivisible operation.
--
-- KEYS[1] = sale:{saleId}:stock          (integer, remaining units)
-- KEYS[2] = sale:{saleId}:user:{userId}  (integer, units already claimed by this user)
-- KEYS[3] = resv:{token}                 (string, JSON payload, TTL-bound)
--
-- ARGV[1] = quantity requested
-- ARGV[2] = per-user limit for this sale
-- ARGV[3] = reservation TTL in seconds
-- ARGV[4] = JSON payload to store at KEYS[3]
--
-- Returns {code, stockRemaining}
--   1  = granted
--  -1  = sold out
--  -2  = per-user limit exceeded
--  -3  = sale not live (stock key not seeded / already ended)

local stockRaw = redis.call('GET', KEYS[1])
if stockRaw == false then
    return {-3, 0}
end

local stock = tonumber(stockRaw)
local qty = tonumber(ARGV[1])

if stock < qty then
    return {-1, stock}
end

local used = tonumber(redis.call('GET', KEYS[2]) or "0")
local limit = tonumber(ARGV[2])

if used + qty > limit then
    return {-2, stock}
end

redis.call('DECRBY', KEYS[1], qty)
redis.call('INCRBY', KEYS[2], qty)
redis.call('SET', KEYS[3], ARGV[4], 'EX', tonumber(ARGV[3]))

return {1, stock - qty}
