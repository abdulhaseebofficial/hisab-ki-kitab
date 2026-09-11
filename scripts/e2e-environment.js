// Reuses documented npm commands against a fresh schema, without changing .env.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const state = path.join(root, '.env.e2e.local');
const action = process.argv[2];
const npm = (args) => new Promise((resolve, reject) => {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true })
    : spawn('npm', args, { cwd: root, env: process.env, stdio: 'inherit' });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} exited ${code}`)));
});
async function main() {
  if (!['setup', 'dev', 'check', 'e2e', 'cleanup'].includes(action)) throw new Error('Use setup, dev, check, e2e or cleanup');
  require('dotenv').config({ path: path.join(root, 'apps/api/.env'), quiet: true });
  if (action === 'setup' && !fs.existsSync(state)) {
    const schema = `hw_e2e_${crypto.randomBytes(8).toString('hex')}`;
    const { migrationUrl } = require('../apps/api/src/infrastructure/database/databaseUrl');
    process.env.DATABASE_URL = migrationUrl();
    const db = require('../apps/api/src/infrastructure/database/pool');
    try { await db.query(`CREATE SCHEMA ${schema}`); } finally { await db.closePool(); }
    fs.writeFileSync(state, `HW_E2E_SCHEMA=${schema}\n`);
  }
  require('dotenv').config({ path: state, override: true, quiet: true });
  require('./e2e-preload');
  const db = require('../apps/api/src/infrastructure/database/pool');
  try {
    const row = await db.queryOne('SELECT current_schema() AS name');
    if (row.name !== process.env.HW_E2E_SCHEMA) throw new Error('Database did not honor isolated search_path; refusing to continue');
    console.log(`[e2e] isolated schema: ${row.name}`);
    if (action === 'cleanup') {
      await db.query(`DROP SCHEMA ${process.env.HW_E2E_SCHEMA} CASCADE`);
      fs.unlinkSync(state);
    }
  } finally { await db.closePool(); }
  if (action === 'cleanup') return;
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --require "${path.join(__dirname, 'e2e-preload.js').replace(/\\/g, '/')}"`.trim();
  if (action === 'setup') { await npm(['run', 'migrate']); await npm(['run', 'seed']); }
  else await npm(['run', { dev: 'dev', check: 'check', e2e: 'test:e2e' }[action]]);
}
main().catch((error) => { console.error('[e2e]', error.code || '', error.message, ...(error.errors || []).map((item) => item.message)); process.exitCode = 1; });
