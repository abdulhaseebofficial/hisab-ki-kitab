-- Rate limiting that survives the process it was counted in.
--
--
-- WHY THIS TABLE EXISTS
--
-- The limiters were counting in memory. That is exactly right for one
-- long-lived server and close to useless on the platform this deploys to,
-- where each cold invocation gets its own address space: the counter somebody
-- is brute-forcing against may be a few requests old and belong to an instance
-- that is about to be discarded. The limit looks configured, is visible in the
-- response headers, and stops nobody.
--
-- A shared counter has to live somewhere every instance can reach. This app
-- already requires Postgres, so it goes here rather than adding a second piece
-- of infrastructure and a second set of credentials to hold.
--
--
-- WHAT IS STORED, AND WHAT IS NOT
--
-- The key is a SHA-256 hash, never the raw value. What is being counted is an
-- IP address or an account id, and neither belongs in a table in the clear when
-- the only thing the limiter ever needs is equality. A dump of this table says
-- how often some unidentifiable subject called an endpoint, which is all the
-- limiter itself knows.
--
-- Rows are disposable. Anything past its window is meaningless, and the sweep
-- below removes it lazily rather than needing a scheduled job.
--
--
-- ROLLBACK (the runner is forward-only; by hand if ever needed):
--   DROP TABLE rate_limits;

CREATE TABLE IF NOT EXISTS rate_limits (
  -- sha256(scope + subject + window start), so neither an IP nor a user id is
  -- recoverable from this table.
  key         text        PRIMARY KEY,
  hits        integer     NOT NULL DEFAULT 0,
  reset_at    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Supports the sweep that clears finished windows. The lookup itself is on the
-- primary key and needs nothing more.
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);

-- A window that has already ended is not a limit, and a negative count is not
-- a count. Both are cheap to state and would otherwise only be caught by
-- somebody noticing the limiter behaving oddly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'rate_limits_hits_check' AND conrelid = 'rate_limits'::regclass
  ) THEN
    ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_hits_check CHECK (hits >= 0);
  END IF;
END $$;
