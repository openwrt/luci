'use strict';
'require baseclass';

/**
 * Hostname resolve cache helpers (LRU + failure TTL).
 * Pure Map helpers — safe to unit-test on host without LuCI.
 */
return baseclass.extend({
	CACHE_MAX: 1000,
	FAIL_TTL_MS: 60000,
	FAIL_MAX: 1000,

	/* Touch-on-write LRU: re-insert moves key to newest; evict oldest when over max. */
	lruSet: function(map, key, value, max) {
		const cap = max || this.CACHE_MAX;
		if (map.has(key))
			map.delete(key);
		map.set(key, value);
		while (map.size > cap) {
			const oldest = map.keys().next().value;
			map.delete(oldest);
		}
		return map;
	},

	lruGet: function(map, key) {
		if (!map.has(key))
			return undefined;
		const value = map.get(key);
		map.delete(key);
		map.set(key, value);
		return value;
	},

	failIsHot: function(failedMap, ip, nowMs, ttlMs) {
		if (!failedMap || !failedMap.has(ip))
			return false;
		const at = failedMap.get(ip);
		const ttl = ttlMs == null ? this.FAIL_TTL_MS : ttlMs;
		const now = nowMs == null ? Date.now() : nowMs;
		if ((now - at) >= ttl) {
			failedMap.delete(ip);
			return false;
		}
		return true;
	},

	failMark: function(failedMap, ip, nowMs, max) {
		const cap = max || this.FAIL_MAX;
		const now = nowMs == null ? Date.now() : nowMs;
		if (failedMap.has(ip))
			failedMap.delete(ip);
		failedMap.set(ip, now);
		while (failedMap.size > cap) {
			const oldest = failedMap.keys().next().value;
			failedMap.delete(oldest);
		}
		return failedMap;
	}
});
