const fs = require('fs');
const path = require('path');
/**
 * Verifies the fresh-database path without touching production data.
 *
 * Creates a throwaway schema, points search_path at it, runs every migration
 * into it, checks what came out, and drops it again. The migrations use
 * unqualified names, so they land in the temporary schema rather than public.
 *
 * It connects on its OWN client, to the direct (non-pooled) URL, and never
 * through the shared pool.
 *
 * That is not tidiness. `SET search_path` is session state, and a
 * transaction-mode pooler hands the same backend connection to whoever asks
 * next - so this test's search_path could be inherited by a completely
 * different process, which would then look for its tables in a schema this
 * test had already dropped. That is exactly what happened: an API server
 * running alongside started answering "column finance_mode does not exist"
 * for a column that was plainly there.
 */
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'apps', 'api', '.env') });


const { Client } = require('pg');

const API = path.join(__dirname, '..', '..', 'apps', 'api');
const { migrationFiles } = require(path.join(API, 'src/infrastructure/database/migrate'));
const { migrationUrl } = require(path.join(API, 'src/infrastructure/database/databaseUrl'));

const MIGRATIONS = path.join(__dirname, '..', '..', 'database', 'migrations');
// Unique per run. With a fixed name, two runs at once each begin by dropping
// the other's schema, and both then fail reporting tables that were there a
// moment ago - a confusing way to discover you started the suite twice.
const SCHEMA = 'migration_smoke_test_' + process.pid + '_' + Date.now().toString(36);

(async () => {
  // A dedicated connection, on the direct URL where one is configured, so no
  // session state of this test's can reach anybody else.
  const client = new Client({
    connectionString: migrationUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let failed = false;
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA}, public`);

    const files = migrationFiles();
    console.log('  migrations found: ' + files.join(', '));

    for (const name of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS, name), 'utf8');
      await client.query(sql);
      console.log('  applied ' + name);
    }

    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 ORDER BY table_name`,
      [SCHEMA]
    );
    const tables = rows.map((r) => r.table_name);
    console.log('  tables created: ' + tables.length + ' -> ' + tables.join(', '));

    const expected = ['budgets', 'chat_messages', 'debt_payments', 'debts',
      'expenses', 'feedback', 'goal_contributions', 'goals', 'income',
      'notifications', 'refresh_tokens', 'users'];
    const missing = expected.filter((t) => !tables.includes(t));
    if (missing.length) {
      console.log('  FAIL missing: ' + missing.join(', '));
      failed = true;
    } else {
      console.log('  ok: a fresh database gets the complete schema');
    }

    // Constraints, not just tables. A migration whose "does this already
    // exist?" guard is not schema-aware will find the copy in public, decide
    // there is nothing to do, and create a table here with none of its rules -
    // silently, because the tables all still appear.
    const { rows: cons } = await client.query(
      `SELECT c.conname FROM pg_constraint c
         JOIN pg_class t  ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1`,
      [SCHEMA]
    );
    const names = cons.map((r) => r.conname);
    const expectedConstraints = [
      'debts_id_user_key',
      'debt_payments_debt_owner_fkey',
      'debts_status_matches_balance',
      'debts_settled_at_matches_status',
      // 0005: every account must be reachable by password or by Google.
      'users_has_a_way_in',
    ];
    const missingConstraints = expectedConstraints.filter((c) => !names.includes(c));
    if (missingConstraints.length) {
      console.log('  FAIL missing constraints: ' + missingConstraints.join(', '));
      failed = true;
    } else {
      console.log('  ok: and every constraint that protects it');
    }

    // Running them a second time into the same schema must not error.
    for (const name of files) {
      await client.query(fs.readFileSync(path.join(MIGRATIONS, name), 'utf8'));
    }
    console.log('  ok: re-applying the same migrations is harmless');
  } catch (err) {
    console.log('  FAIL ' + err.message);
    failed = true;
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
    await client.query('SET search_path TO public').catch(() => {});
    // A dedicated client is closed, not returned to a pool.
    await client.end().catch(() => {});
  }
  process.exit(failed ? 1 : 0);
})();
