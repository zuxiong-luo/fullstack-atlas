// All keys are server-generated and share the same activity hash tag.
// Validate types/arguments before writing. Runtime errors still do not roll back.
export const admitLua = `
local stockKey, usersKey, streamKey = KEYS[1], KEYS[2], KEYS[3]
local user, reservation, capacity = ARGV[1], ARGV[2], tonumber(ARGV[3])
if not capacity or capacity < 1 or capacity % 1 ~= 0 then
  return redis.error_reply('BAD_CAPACITY')
end
if redis.call('TYPE', stockKey).ok ~= 'string' then
  return redis.error_reply('STOCK_NOT_INITIALIZED')
end
local usersType = redis.call('TYPE', usersKey).ok
local streamType = redis.call('TYPE', streamKey).ok
if (usersType ~= 'none' and usersType ~= 'hash') or
   (streamType ~= 'none' and streamType ~= 'stream') then
  return redis.error_reply('BAD_KEY_TYPE')
end
local stock = tonumber(redis.call('GET', stockKey))
if not stock or stock < 0 or stock % 1 ~= 0 then
  return redis.error_reply('BAD_STOCK')
end
local existing = redis.call('HGET', usersKey, user)
if existing then return {'EXISTING', existing} end
if stock == 0 then return {'SOLD_OUT', ''} end
if redis.call('XLEN', streamKey) >= capacity then return {'BUSY', ''} end
redis.call('DECR', stockKey)
redis.call('HSET', usersKey, user, reservation)
redis.call('XADD', streamKey, '*', 'user', user, 'reservation', reservation)
return {'RESERVED', reservation}
`;

export const releaseLua = `
if redis.call('TYPE', KEYS[1]).ok ~= 'string' then
  return redis.error_reply('STOCK_NOT_INITIALIZED')
end
local appliedType = redis.call('TYPE', KEYS[2]).ok
if appliedType ~= 'none' and appliedType ~= 'hash' then
  return redis.error_reply('BAD_KEY_TYPE')
end
local stock = tonumber(redis.call('GET', KEYS[1]))
if not stock or stock < 0 or stock % 1 ~= 0 then
  return redis.error_reply('BAD_STOCK')
end
if redis.call('HEXISTS', KEYS[2], ARGV[1]) == 1 then return 0 end
redis.call('INCR', KEYS[1])
redis.call('HSET', KEYS[2], ARGV[1], 'applied')
return 1
`;
