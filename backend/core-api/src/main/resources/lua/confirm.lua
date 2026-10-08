-- confirm.lua
-- Turns a live hold into a sale at checkout. Succeeds only while the hold's
-- timer is still running, and deletes the reservation record so that no
-- expiry trigger can return the stock afterwards. This and release.lua both
-- act on resv:{token}, and Redis runs scripts one at a time, so for any hold
-- exactly one of "paid" or "returned to stock" ever happens.
--
-- KEYS[1] = resv:{token}
-- KEYS[2] = resv-timer:{token}
--
-- Returns 1 if confirmed, 0 if the hold has expired or was already released or confirmed

if redis.call('EXISTS', KEYS[1]) == 0 or redis.call('EXISTS', KEYS[2]) == 0 then
    return 0
end

redis.call('DEL', KEYS[1], KEYS[2])

return 1
