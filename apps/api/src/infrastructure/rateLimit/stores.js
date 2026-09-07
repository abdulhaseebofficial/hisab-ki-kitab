/**
 * Where rate-limit counters live.
 *
 * One small interface, two implementations, chosen by configuration:
 *
 *   hit(key, windowMs)  -> { count, resetAt }   record a request, get the total
 *   reset(key)          -> void                 forget a subject (tests)
 *
 * The memory store is correct for one long-lived process and useless across
 * several: on a platform that spins up an instance per cold request, each one
 * starts counting from zero, so the limit is visible in the response headers
 * and stops nobody. The Postgres store is the shared counter every instance
 * can reach - and this app already requires Postgres, so it costs no new
 * infrastructure and no new credential to hold.
 *
 * Neither store ever sees a raw IP or account id. The caller hashes the subject
 * first; see keyFor() in the middleware.
 */

const { queryOne, query } = require('../database/pool');

/* ------------------------------- in memory -------------------------------- */

/**
 * Counters in a Map, swept as they are touched.
 *
 * Deliberately has no eviction thread. The sweep happens on the next hit for a
 * key, which is enough for a dev server and for tests, and avoids a timer that
 * would keep a process alive after the suite finished.
 */
const createMemoryStore = () => {
  const windows = new Map();

  return {
    name: 'memory',

    async hit(key, windowMs) {
      const now = Date.now();
      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs };
        windows.set(key, fresh);
        return { count: 1, resetAt: new Date(fresh.resetAt) };
      }

      existing.count += 1;
      return { count: existing.count, resetAt: new Date(existing.resetAt) };
    },

    async reset(key) {
      windows.delete(key);
    },

    /** Only for tests: how many keys are being tracked. */
    size() {
      return windows.size;
    },
  };
};

/* -------------------------------- postgres -------------------------------- */

/**
 * Counters in the rate_limits table, shared by every instance.
 *
 * The increment is one statement. Read-then-write would let two requests
 * arriving together both read the same total and both write it back, which is
 * precisely the burst a limiter exists to catch.
 *
 * A window that has already ended is restarted in the same statement rather
 * than deleted first, so an expired row never needs a separate round trip.
 */
const createPostgresStore = () => ({
  name: 'postgres',

  async hit(key, windowMs) {
    const row = await queryOne(
      `INSERT INTO rate_limits (key, hits, reset_at)
       VALUES ($1, 1, now() + ($2::bigint * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE
         SET hits = CASE
                      WHEN rate_limits.reset_at <= now() THEN 1
                      ELSE rate_limits.hits + 1
                    END,
             reset_at = CASE
                          WHEN rate_limits.reset_at <= now()
                            THEN now() + ($2::bigint * interval '1 millisecond')
                          ELSE rate_limits.reset_at
                        END
       RETURNING hits, reset_at`,
      [key, Math.max(1, Math.round(windowMs))]
    );

    return { count: Number(row.hits), resetAt: new Date(row.reset_at) };
  },

  async reset(key) {
    await query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
  },

  /** Clears finished windows. Cheap, and called opportunistically. */
  async sweep() {
    await query(`DELETE FROM rate_limits WHERE reset_at <= now() - interval '1 hour'`);
  },
});

module.exports = { createMemoryStore, createPostgresStore };
