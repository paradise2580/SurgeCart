-- reserve.lua
-- Atomically checks stock, enforces the per-user limit, decrements stock,
-- and writes the reservation record plus its countdown timer — all as one
-- indivisible operation.
--
-- The hold is two keys on purpose. The timer expires when the hold does;
-- the record outlives it. If the record itself expired at the deadline,
-- Redis would delete it before anything could read it, and release.lua's
-- existence guard would then refuse to return the stock — the unit would be
-- lost from the sale for good. Keeping the record alive past the deadline
-- leaves something for the expiry triggers to release.
--
-- KEYS[1] = sale:{saleId}:stock          (integer, remaining units)
-- KEYS[2] = sale:{saleId}:user:{userId}  (integer, units already claimed by this user)
-- KEYS[3] = resv:{token}                 (string, JSON payload — the reservation record)
-- KEYS[4] = resv-timer:{token}           (marker whose expiry ends the hold)
--
-- ARGV[1] = quantity requested
-- ARGV[2] = per-user limit for this sale
-- ARGV[3] = hold length in seconds (TTL of KEYS[4])
-- ARGV[4] = JSON payload to store at KEYS[3]
-- ARGV[5] = TTL of KEYS[3] in seconds; must be longer than ARGV[3]
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
redis.call('SET', KEYS[3], ARGV[4], 'EX', tonumber(ARGV[5]))
redis.call('SET', KEYS[4], '1', 'EX', tonumber(ARGV[3]))

return {1, stock - qty}
