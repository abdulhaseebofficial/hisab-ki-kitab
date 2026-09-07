-- Alerts belong to a set of books, and say which words to use rather than the words.
--
--
-- WHY notifications NEEDS finance_mode
--
-- Every alert is *raised* from mode-scoped data - the budget rules read the
-- active mode's budgets, the bill reminder reads the active mode's recurring
-- expenses - but the row it writes remembers none of that. So a householder
-- who switched back to student mode still found "Over budget: Bijli Ka Bill"
-- sitting in the tray, about a limit that does not exist in the life they are
-- currently looking at.
--
-- Existing rows default to 'student', which is not a guess: every notification
-- in the table was raised before finance modes existed, and the app was a
-- student app until then.
--
--
-- WHY THE WORDS ARE NOT THE THING TO STORE
--
-- title and message are written into the row fully rendered, in English. That
-- was fine when there was one language; it means a person who switches to
-- Roman Urdu now reads their new alerts in it and their old ones in English,
-- forever, because the text was frozen at the moment the rule fired.
--
-- The fix does not need a schema change: `meta` is already jsonb, so the
-- alerts now also record which translation key and which values produced the
-- text, and the API renders them per request in the reader's language. The
-- rendered columns stay exactly as they are - they are the fallback for every
-- row written before this, which have no key to render from and must still be
-- readable. Nothing is rewritten or deleted.
--
-- This migration therefore only adds the column and its index; the wording
-- change lives in the application layer above it.
--
--
-- ROLLBACK (the runner is forward-only; by hand if ever needed):
--   DROP INDEX notifications_user_mode_created_idx;
--   ALTER TABLE notifications DROP COLUMN finance_mode;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS finance_mode text NOT NULL DEFAULT 'student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notifications_finance_mode_check'
       AND conrelid = 'notifications'::regclass
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_finance_mode_check
      CHECK (finance_mode IN ('student', 'householder'));
  END IF;
END $$;

-- The tray is always "this person, this mode, newest first". Created before
-- anything starts relying on it, so the read never degrades to a filter
-- applied after the rows are found.
CREATE INDEX IF NOT EXISTS notifications_user_mode_created_idx
  ON notifications (user_id, finance_mode, created_at DESC);
