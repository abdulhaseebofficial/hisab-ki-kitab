-- Forward compatibility for development servers that applied 0010 during rollout.
-- Personal finance tables are unchanged. Run through the migration runner only.
ALTER TABLE sl_periods ADD COLUMN IF NOT EXISTS food_budget_minor bigint;
UPDATE sl_periods SET food_budget_minor=budget_minor WHERE food_budget_minor IS NULL;
ALTER TABLE sl_periods ALTER COLUMN food_budget_minor SET NOT NULL;
ALTER TABLE sl_periods DROP CONSTRAINT IF EXISTS sl_periods_food_budget_minor_check;
ALTER TABLE sl_periods ADD CONSTRAINT sl_periods_food_budget_minor_check CHECK(food_budget_minor BETWEEN 0 AND 999999999999);
ALTER TABLE sl_spaces DROP CONSTRAINT IF EXISTS sl_spaces_currency_check;
ALTER TABLE sl_spaces ADD CONSTRAINT sl_spaces_currency_check CHECK(currency IN ('PKR','BDT','USD','EUR','GBP','INR','AED','SAR'));

-- Preserve the actor's historical name without preventing a viewer deleting their account.
DROP TRIGGER IF EXISTS sl_activity_immutable ON sl_activity;
ALTER TABLE sl_activity ADD COLUMN IF NOT EXISTS actor_name text;
UPDATE sl_activity a SET actor_name=COALESCE((SELECT u.name FROM users u WHERE u.id=a.actor_id),'') WHERE actor_name IS NULL;
ALTER TABLE sl_activity ALTER COLUMN actor_name SET NOT NULL;
ALTER TABLE sl_activity DROP CONSTRAINT IF EXISTS sl_activity_actor_id_fkey;
CREATE TRIGGER sl_activity_immutable BEFORE UPDATE OR DELETE ON sl_activity FOR EACH ROW EXECUTE FUNCTION sl_protect_activity();

CREATE TABLE IF NOT EXISTS sl_receipts (
 bill_id uuid PRIMARY KEY, space_id uuid NOT NULL, image bytea NOT NULL CHECK(octet_length(image) BETWEEN 45 AND 524288),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(bill_id,space_id) REFERENCES sl_bills(id,space_id)
);

-- Financial rows cannot move between periods, and closed periods reject direct writes too.
CREATE OR REPLACE FUNCTION sl_guard_financial() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p sl_periods%ROWTYPE; expected_kind text;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.space_id<>OLD.space_id OR NEW.period_id<>OLD.period_id) THEN
  RAISE EXCEPTION 'Ledger scope is immutable' USING ERRCODE='23514';
 END IF;
 SELECT * INTO p FROM sl_periods WHERE id=COALESCE(NEW.period_id,OLD.period_id) FOR UPDATE;
 IF p.closed THEN RAISE EXCEPTION 'Month is closed' USING ERRCODE='23514'; END IF;
 IF TG_OP<>'DELETE' AND TG_TABLE_NAME<>'sl_payments' THEN
  IF date_trunc('month',NEW.date)::date<>p.month THEN RAISE EXCEPTION 'Wrong period' USING ERRCODE='23514'; END IF;
  expected_kind:=CASE WHEN TG_TABLE_NAME='sl_bills' THEN 'bill' ELSE 'food' END;
  IF NOT EXISTS(SELECT 1 FROM sl_categories WHERE id=NEW.category_id AND kind=expected_kind) THEN
   RAISE EXCEPTION 'Wrong category' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['sl_expenses','sl_bills','sl_payments'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS sl_financial_guard ON %I',tab);
  EXECUTE format('CREATE TRIGGER sl_financial_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION sl_guard_financial()',tab);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION sl_guard_share() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE period uuid; locked boolean;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.space_id<>OLD.space_id OR NEW.expense_id IS DISTINCT FROM OLD.expense_id OR NEW.bill_id IS DISTINCT FROM OLD.bill_id) THEN
  RAISE EXCEPTION 'Share scope is immutable' USING ERRCODE='23514';
 END IF;
 SELECT period_id INTO period FROM sl_expenses WHERE id=COALESCE(NEW.expense_id,OLD.expense_id);
 IF period IS NULL THEN SELECT period_id INTO period FROM sl_bills WHERE id=COALESCE(NEW.bill_id,OLD.bill_id); END IF;
 SELECT closed INTO locked FROM sl_periods WHERE id=period FOR UPDATE;
 IF locked THEN RAISE EXCEPTION 'Month is closed' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS sl_share_guard ON sl_shares;
CREATE TRIGGER sl_share_guard BEFORE INSERT OR UPDATE OR DELETE ON sl_shares FOR EACH ROW EXECUTE FUNCTION sl_guard_share();


ALTER TABLE sl_receipts ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON sl_receipts FROM %I',r); END IF; END LOOP; END $$;
