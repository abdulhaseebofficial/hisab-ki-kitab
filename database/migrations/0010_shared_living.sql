-- Additive ledger: personal records and their two-mode constraints are unchanged.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_finance_mode_check;
ALTER TABLE users ADD CONSTRAINT users_finance_mode_check CHECK (finance_mode IN ('student','householder','shared_living'));

CREATE TABLE IF NOT EXISTS sl_spaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 finance_mode text NOT NULL DEFAULT 'shared_living' CHECK (finance_mode = 'shared_living'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100), currency text NOT NULL CHECK (currency IN ('PKR','USD','EUR','GBP','INR','AED','SAR')),
 residents integer NOT NULL CHECK (residents BETWEEN 1 AND 500), description text NOT NULL DEFAULT '' CHECK (length(description)<=1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sl_spaces_owner_idx ON sl_spaces(owner_id);
CREATE TABLE IF NOT EXISTS sl_memberships (
 space_id uuid NOT NULL REFERENCES sl_spaces(id), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('admin','viewer')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(space_id,user_id)
);
CREATE INDEX IF NOT EXISTS sl_memberships_user_idx ON sl_memberships(user_id);
CREATE TABLE IF NOT EXISTS sl_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id),
 code_hash text NOT NULL UNIQUE CHECK(length(code_hash)=64), expires_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sl_invites_active_idx ON sl_invites(space_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS sl_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id),
 month date NOT NULL CHECK (extract(day FROM month)=1 AND month BETWEEN '2000-01-01' AND '2200-12-01'),
 budget_minor bigint NOT NULL CHECK(budget_minor BETWEEN 0 AND 999999999999), closed boolean NOT NULL DEFAULT false,
 UNIQUE(space_id,month), UNIQUE(id,space_id)
);
CREATE TABLE IF NOT EXISTS sl_members (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), phone text NOT NULL DEFAULT '' CHECK(length(phone)<=30), email text NOT NULL DEFAULT '' CHECK(length(email)<=254),
 joined_on date NOT NULL, left_on date CHECK(left_on>=joined_on), active boolean NOT NULL DEFAULT true,
 weight numeric(8,2) NOT NULL DEFAULT 1 CHECK(weight>0), note text NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 archived boolean NOT NULL DEFAULT false, UNIQUE(id,space_id), CHECK(active OR left_on IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sl_members_space_idx ON sl_members(space_id);
CREATE TABLE IF NOT EXISTS sl_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id),
 kind text NOT NULL CHECK(kind IN ('food','bill')), stable_key text NOT NULL,
 name text NOT NULL DEFAULT '' CHECK(length(name)<=100), archived boolean NOT NULL DEFAULT false, position integer NOT NULL DEFAULT 0 CHECK(position>=0),
 UNIQUE(space_id,kind,stable_key), UNIQUE(id,space_id)
);
CREATE TABLE IF NOT EXISTS sl_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id), period_id uuid NOT NULL,
 category_id uuid NOT NULL, date date NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 999999999999),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=1000), method text NOT NULL CHECK(method IN ('equal','selected','weighted','percentage','custom')),
 deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(period_id,space_id) REFERENCES sl_periods(id,space_id), FOREIGN KEY(category_id,space_id) REFERENCES sl_categories(id,space_id), UNIQUE(id,space_id)
);
CREATE INDEX IF NOT EXISTS sl_expenses_period_idx ON sl_expenses(space_id,period_id,date);
CREATE TABLE IF NOT EXISTS sl_bills (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id), period_id uuid NOT NULL,
 category_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), date date NOT NULL, due_date date NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 999999999999), paid boolean NOT NULL DEFAULT false,
 paid_by uuid, note text NOT NULL DEFAULT '' CHECK(length(note)<=1000), recurring boolean NOT NULL DEFAULT false,
 method text NOT NULL CHECK(method IN ('equal','selected','weighted','percentage','custom')), deleted boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(period_id,space_id) REFERENCES sl_periods(id,space_id), FOREIGN KEY(category_id,space_id) REFERENCES sl_categories(id,space_id),
 FOREIGN KEY(paid_by,space_id) REFERENCES sl_members(id,space_id), UNIQUE(id,space_id)
);
CREATE INDEX IF NOT EXISTS sl_bills_period_idx ON sl_bills(space_id,period_id,date);
CREATE TABLE IF NOT EXISTS sl_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id),
 expense_id uuid, bill_id uuid, member_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor>=0), manually_adjusted boolean NOT NULL DEFAULT false,
 CHECK((expense_id IS NULL) <> (bill_id IS NULL)),
 FOREIGN KEY(expense_id,space_id) REFERENCES sl_expenses(id,space_id), FOREIGN KEY(bill_id,space_id) REFERENCES sl_bills(id,space_id),
 FOREIGN KEY(member_id,space_id) REFERENCES sl_members(id,space_id), UNIQUE(expense_id,member_id), UNIQUE(bill_id,member_id)
);
CREATE INDEX IF NOT EXISTS sl_shares_member_idx ON sl_shares(space_id,member_id);
CREATE TABLE IF NOT EXISTS sl_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), space_id uuid NOT NULL REFERENCES sl_spaces(id), period_id uuid NOT NULL, member_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 999999999999), date date NOT NULL,
 method text NOT NULL CHECK(method IN ('cash','bank','mobile','other')), reference text NOT NULL DEFAULT '' CHECK(length(reference)<=100), note text NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(period_id,space_id) REFERENCES sl_periods(id,space_id), FOREIGN KEY(member_id,space_id) REFERENCES sl_members(id,space_id)
);
CREATE INDEX IF NOT EXISTS sl_payments_period_idx ON sl_payments(space_id,period_id,member_id);
CREATE TABLE IF NOT EXISTS sl_activity (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, space_id uuid NOT NULL REFERENCES sl_spaces(id), actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, entity text NOT NULL, entity_id uuid, before_values jsonb, after_values jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sl_activity_space_idx ON sl_activity(space_id,id DESC);

-- Deferred checks see the final transaction state, after replacement shares are inserted.
CREATE OR REPLACE FUNCTION sl_check_shares() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; expected bigint; actual numeric; source text;
BEGIN
 IF TG_TABLE_NAME='sl_shares' THEN
  target:=COALESCE(NEW.expense_id,NEW.bill_id,OLD.expense_id,OLD.bill_id);
  source:=CASE WHEN COALESCE(NEW.expense_id,OLD.expense_id) IS NOT NULL THEN 'sl_expenses' ELSE 'sl_bills' END;
 ELSE target:=COALESCE(NEW.id,OLD.id); source:=TG_TABLE_NAME; END IF;
 EXECUTE format('SELECT amount_minor FROM %I WHERE id=$1',source) INTO expected USING target;
 SELECT COALESCE(sum(amount_minor),0) INTO actual FROM sl_shares WHERE expense_id=target OR bill_id=target;
 IF expected IS NOT NULL AND expected<>actual THEN RAISE EXCEPTION 'Invalid share total' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS sl_shares_total ON sl_shares;
CREATE CONSTRAINT TRIGGER sl_shares_total AFTER INSERT OR UPDATE OR DELETE ON sl_shares DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sl_check_shares();
DROP TRIGGER IF EXISTS sl_expenses_total ON sl_expenses;
CREATE CONSTRAINT TRIGGER sl_expenses_total AFTER INSERT OR UPDATE ON sl_expenses DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sl_check_shares();
DROP TRIGGER IF EXISTS sl_bills_total ON sl_bills;
CREATE CONSTRAINT TRIGGER sl_bills_total AFTER INSERT OR UPDATE ON sl_bills DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sl_check_shares();

CREATE OR REPLACE FUNCTION sl_protect_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Activity is append only' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS sl_activity_immutable ON sl_activity;
CREATE TRIGGER sl_activity_immutable BEFORE UPDATE OR DELETE ON sl_activity FOR EACH ROW EXECUTE FUNCTION sl_protect_activity();

-- No browser database access; authorization runs through authenticated API endpoints.
DO $$ DECLARE tab text; browser_role text; BEGIN
 FOREACH tab IN ARRAY ARRAY['sl_spaces','sl_memberships','sl_invites','sl_periods','sl_members','sl_categories','sl_expenses','sl_bills','sl_shares','sl_payments','sl_activity'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=browser_role) THEN EXECUTE format('REVOKE ALL ON %I FROM %I',tab,browser_role); END IF;
  END LOOP;
 END LOOP;
END $$;
