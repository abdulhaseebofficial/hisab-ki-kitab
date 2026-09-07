-- A rotated refresh token is remembered for a moment instead of vanishing.
--
--
-- THE BUG THIS FIXES
--
-- Refresh rotation is strict here, and correctly so: presenting a token the
-- server no longer holds means someone replayed an old one, and the response
-- is to drop every session on the account.
--
-- The trouble is that two browser tabs share one cookie. Both wake, both find
-- the access token expired, and both POST /auth/refresh with the same refresh
-- token. The first is consumed and rotated. The second arrives a few
-- milliseconds later carrying a token that no longer exists - indistinguishable,
-- to the old code, from a stolen cookie being replayed. So a person with two
-- tabs open was logged out of everything, and the server logged a security
-- warning about them.
--
-- Measured before this change: tab A -> 200, tab B -> 401, session -> 401.
--
--
-- WHAT REPLACES IT
--
-- Rotation now marks the row instead of deleting it:
--
--   rotated_at    when it was exchanged (NULL while it is the live token)
--   replaced_by   the hash of the token handed out in its place
--
-- A token presented after rotation is judged by two questions. Was it rotated
-- within the grace window? And does its replacement still exist? Both yes means
-- a second tab caught the same moment, and it is served. Either no means the
-- token is genuinely stale - an old copy surfacing long after, or one whose
-- chain has already been revoked - and every session still drops.
--
-- The window is deliberately short (the application layer holds it at one
-- minute). It is long enough for tabs racing each other and far too short to be
-- a useful foothold for a stolen cookie, which would in any case have to arrive
-- inside the same minute as a legitimate refresh.
--
-- Rows are cleaned up by the existing expiry sweep in addRefreshToken; a
-- rotated row keeps its original expires_at and is pruned with the rest.
--
--
-- SAFE FOR EXISTING SESSIONS
--
-- Both columns are nullable with no default, so every row already in the table
-- reads as "live, never rotated" - which is exactly what it is. Nobody is
-- signed out by this migration.
--
--
-- ROLLBACK (the runner is forward-only; by hand if ever needed):
--   DROP INDEX refresh_tokens_rotated_idx;
--   ALTER TABLE refresh_tokens DROP COLUMN rotated_at, DROP COLUMN replaced_by;

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS rotated_at  timestamptz;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by text;

-- A rotated row must say what replaced it, so the chain can be followed. A live
-- row must not, because there is nothing yet to point at.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'refresh_tokens_rotation_pair_check'
       AND conrelid = 'refresh_tokens'::regclass
  ) THEN
    ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_rotation_pair_check
      CHECK ((rotated_at IS NULL) = (replaced_by IS NULL));
  END IF;
END $$;

-- The lookup on every refresh is "this user, this hash", already covered by the
-- unique index on token_hash. This one supports the sweep that clears rotated
-- rows and the queries that count a user's live sessions.
CREATE INDEX IF NOT EXISTS refresh_tokens_rotated_idx
  ON refresh_tokens (user_id, rotated_at);
