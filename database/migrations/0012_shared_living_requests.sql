-- Optional client submission IDs preserve compatibility with existing clients.
-- A retry with the same ID can never create another financial record.
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['sl_expenses','sl_bills','sl_payments'] LOOP
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS request_id uuid',tab);
  EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS request_hash text',tab);
  EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I(space_id,request_id) WHERE request_id IS NOT NULL',tab||'_request_idx',tab);
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=tab::regclass AND conname=tab||'_request_check') THEN
   EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((request_id IS NULL AND request_hash IS NULL) OR (request_id IS NOT NULL AND request_hash IS NOT NULL AND request_hash ~ ''^[0-9a-f]{64}$''))',tab,tab||'_request_check');
  END IF;
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS sl_receipts_space_idx ON sl_receipts(space_id);
