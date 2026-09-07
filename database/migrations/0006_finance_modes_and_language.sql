-- Two modes for one app, and two languages for one person.
--
-- Every existing account and every existing row belongs to a student. That is
-- not an assumption - it is what the app has been until now - so `student` is
-- the default on every new column and no backfill is needed. An existing
-- student who never touches the new settings sees exactly what they saw
-- yesterday.
--
--
-- WHY finance_mode SITS ON THE ROWS, NOT JUST ON THE USER
--
-- It would be smaller to record the mode once on the user and filter by that.
-- It would also be wrong. A householder who switches back to student mode must
-- find their student records where they left them, and the household bills must
-- not appear in a student dashboard. That only works if each row remembers
-- which life it belongs to. The user's finance_mode says which one is being
-- looked at now; the row's says which one it is part of.
--
-- Goals are deliberately NOT given a mode. A savings goal is a thing a person
-- is saving for, not a thing a household or a hostel room is saving for, and
-- splitting the existing goals in two would change what they already mean to
-- the people who set them. They stay shared across both modes.
--
--
-- WHY language IS ON THE USER AND NOWHERE ELSE
--
-- Language is a preference about presentation. Nothing stored anywhere in this
-- database changes when it flips - not a category, not a status, not an amount.
-- Anything that did would be a translated value used as an identifier, which is
-- how duplicate categories and untranslatable history get created.
--
--
-- UDHAAR, WITHOUT RENAMING WHAT IS ALREADY THERE
--
-- `kind` stays BORROWED / LENT and `status` keeps PENDING. Renaming them to
-- payable / receivable / active would read better in the schema and would break
-- every client already sending the current values, for no behavioural gain: the
-- wording a person actually reads - "I Have to Pay", "Mujhe Paise Dene Hain" -
-- is a label, and labels belong in the presentation layer where they can be
-- translated. What is genuinely missing is added: a purpose, a purpose
-- category, and a CANCELLED status for a debt that is written off rather than
-- paid.
--
--
-- ROLLOUT AND ROLLBACK
--
-- Additive throughout. Every new column has a default, so existing rows satisfy
-- it the moment it appears and no row is rewritten. The one destructive-looking
-- step is replacing the budgets unique index, which is done by creating the new
-- one before dropping the old: at no point is the table unprotected.
--
-- Rollback (the runner is forward-only; by hand if ever needed):
--   DROP INDEX budgets_unique_mode_idx;
--   CREATE UNIQUE INDEX budgets_unique_idx ON budgets (user_id, year, month, category);
--   ALTER TABLE expenses DROP COLUMN finance_mode;   -- and income, budgets, debts
--   ALTER TABLE users DROP COLUMN finance_mode, DROP COLUMN language;
--   ALTER TABLE debts DROP COLUMN purpose, DROP COLUMN purpose_category;
--   -- the CANCELLED status cannot be dropped while any row uses it

/* ------------------------- the user's two settings ------------------------ */

ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_mode text NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language    text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'users_finance_mode_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_finance_mode_check
      CHECK (finance_mode IN ('student', 'householder'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'users_language_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_language_check
      CHECK (language IN ('en', 'roman_ur'));
  END IF;
END $$;

/* --------------------- which life each record belongs to ------------------ */

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS finance_mode text NOT NULL DEFAULT 'student';
ALTER TABLE income   ADD COLUMN IF NOT EXISTS finance_mode text NOT NULL DEFAULT 'student';
ALTER TABLE budgets  ADD COLUMN IF NOT EXISTS finance_mode text NOT NULL DEFAULT 'student';
ALTER TABLE debts    ADD COLUMN IF NOT EXISTS finance_mode text NOT NULL DEFAULT 'student';

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['expenses', 'income', 'budgets', 'debts'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = target || '_finance_mode_check'
         AND conrelid = target::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (finance_mode IN (%L, %L))',
        target, target || '_finance_mode_check', 'student', 'householder'
      );
    END IF;
  END LOOP;
END $$;

/* ----------------------------- reading them back -------------------------- */
-- Every list in the app is "this user, this mode, newest first". Without the
-- mode in the index that becomes a filter applied after the rows are found.

CREATE INDEX IF NOT EXISTS expenses_user_mode_date_idx ON expenses (user_id, finance_mode, date DESC);
CREATE INDEX IF NOT EXISTS income_user_mode_date_idx   ON income   (user_id, finance_mode, date DESC);
CREATE INDEX IF NOT EXISTS debts_user_mode_created_idx ON debts    (user_id, finance_mode, created_at DESC);

-- One limit per category per month per user - and now per mode, so a student
-- budget for "Food" and a household budget for the same month do not collide.
-- Created before the old one is dropped, so uniqueness is never unenforced.
CREATE UNIQUE INDEX IF NOT EXISTS budgets_unique_mode_idx
  ON budgets (user_id, finance_mode, year, month, category);
DROP INDEX IF EXISTS budgets_unique_idx;

/* --------------------------------- udhaar --------------------------------- */

-- Why the money changed hands. The existing `category` column answers "which
-- budget does this belong to"; purpose answers "what was it for", in the
-- lender's own words, which is the thing a person actually needs months later.
ALTER TABLE debts ADD COLUMN IF NOT EXISTS purpose          text NOT NULL DEFAULT '';
ALTER TABLE debts ADD COLUMN IF NOT EXISTS purpose_category text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'debts_purpose_check' AND conrelid = 'debts'::regclass) THEN
    ALTER TABLE debts ADD CONSTRAINT debts_purpose_check CHECK (length(purpose) <= 300);
  END IF;
END $$;

-- A debt can end without being paid: written off, forgiven, or entered by
-- mistake. That is not the same as SETTLED, and recording it as SETTLED would
-- claim money changed hands when it did not.
DO $$
BEGIN
  ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_status_check;
  ALTER TABLE debts ADD CONSTRAINT debts_status_check
    CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'SETTLED', 'CANCELLED'));
END $$;

-- 0003 tied status to the balance. CANCELLED has to be allowed through that
-- rule as well: a cancelled debt keeps whatever was paid before it was written
-- off, so the balance says nothing about the status any more.
DO $$
BEGIN
  ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_status_matches_balance;
  ALTER TABLE debts ADD CONSTRAINT debts_status_matches_balance CHECK (
    status = 'CANCELLED' OR
    (status = 'PENDING'        AND paid_amount = 0) OR
    (status = 'PARTIALLY_PAID' AND paid_amount > 0 AND paid_amount < original_amount) OR
    (status = 'SETTLED'        AND paid_amount = original_amount)
  );

  ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_settled_at_matches_status;
  ALTER TABLE debts ADD CONSTRAINT debts_settled_at_matches_status
    CHECK ((status = 'SETTLED') = (settled_at IS NOT NULL));
END $$;
