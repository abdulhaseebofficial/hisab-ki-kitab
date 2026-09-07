/**
 * What the server refuses to start with, and what it merely warns about.
 *
 * The distinction is the whole point. A missing optional feature should not
 * stop the app booting - nobody wants an outage because Google sign-in was
 * never configured. A *malformed* setting is different: it means somebody
 * intended to turn the feature on, and the failure will surface at the moment
 * a real person tries to use it, which is the worst possible time to discover
 * it.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const API = path.join(__dirname, '..', '..', 'apps', 'api');
const VALIDATE = path.join(API, 'src/shared/config/validateEnv');

/** Runs validateEnv with a given environment, capturing what it printed. */
const validateWith = (overrides) => {
  const saved = { ...process.env };
  const warnings = [];
  const logs = [];
  const realWarn = console.warn;
  const realLog = console.log;

  // A minimum viable production configuration, so each test only has to say
  // what it is actually varying.
  Object.assign(process.env, {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    DATABASE_URL: 'postgres://user:pass@example.invalid:5432/db',
    CLIENT_URL: 'https://example.invalid',
    SMTP_HOST: 'smtp.example.invalid',
    SMTP_USER: 'someone',
    ...overrides,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
  }

  console.warn = (...args) => warnings.push(args.join(' '));
  console.log = (...args) => logs.push(args.join(' '));

  let error = null;
  try {
    delete require.cache[require.resolve(VALIDATE)];
    require(VALIDATE).validateEnv();
  } catch (err) {
    error = err;
  } finally {
    console.warn = realWarn;
    console.log = realLog;
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
    delete require.cache[require.resolve(VALIDATE)];
  }

  return { error, warnings: warnings.join('\n') };
};

/* ------------------------------ google sign-in ---------------------------- */

test('an absent Google client id only warns - the feature is optional', () => {
  const { error, warnings } = validateWith({ GOOGLE_CLIENT_ID: undefined });

  assert.strictEqual(error, null, 'the app must still boot without Google sign-in');
  assert.match(warnings, /GOOGLE_CLIENT_ID is not set/);
  assert.match(warnings, /switched off/i);
});

test('a well-formed client id passes without comment', () => {
  const { error, warnings } = validateWith({
    GOOGLE_CLIENT_ID: '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com',
  });

  assert.strictEqual(error, null);
  assert.ok(!/GOOGLE_CLIENT_ID/.test(warnings), 'a valid id should not be complained about');
});

test('a malformed client id refuses to start', () => {
  // Somebody meant to enable this. Booting anyway means the failure waits
  // until a real person clicks the button.
  const { error } = validateWith({ GOOGLE_CLIENT_ID: 'not-a-client-id' });

  assert.ok(error, 'a malformed client id should stop the boot');
  assert.match(error.message, /GOOGLE_CLIENT_ID/);
  assert.match(error.message, /googleusercontent\.com/);
});

test('a client secret pasted into the client id is caught', () => {
  // The commonest way to get this wrong, and one that looks plausible in a
  // dashboard until sign-in fails.
  const { error } = validateWith({ GOOGLE_CLIENT_ID: 'GOCSPX-abcdefghijklmnopqrstuvwx' });

  assert.ok(error, 'a secret in the client id slot should stop the boot');
  assert.match(error.message, /GOOGLE_CLIENT_ID/);
});

test('the error never repeats the value it rejected', () => {
  // Whatever was pasted in might be a secret. Saying what shape was expected
  // is enough to fix it.
  const secret = 'GOCSPX-super-secret-value';
  const { error } = validateWith({ GOOGLE_CLIENT_ID: secret });

  assert.ok(error);
  assert.ok(!error.message.includes(secret), 'the rejected value must not be echoed back');
});

/* ---------------------------- rate limit store ---------------------------- */

test('in-memory rate limiting in production is called out', () => {
  // It is a legitimate choice for a single long-lived server, and a trap on
  // anything that scales horizontally - so it warns rather than refusing.
  const { error, warnings } = validateWith({ RATE_LIMIT_STORE: 'memory' });

  assert.strictEqual(error, null);
  assert.match(warnings, /RATE_LIMIT_STORE=memory/);
  assert.match(warnings, /per instance/);
});

test('the shared store draws no complaint', () => {
  const { error, warnings } = validateWith({ RATE_LIMIT_STORE: 'postgres' });

  assert.strictEqual(error, null);
  assert.ok(!/RATE_LIMIT_STORE/.test(warnings));
});

test('and neither does leaving it unset', () => {
  // Unset means "use the shared counter in production", which is the safe
  // default and should not nag.
  const { error, warnings } = validateWith({ RATE_LIMIT_STORE: undefined });

  assert.strictEqual(error, null);
  assert.ok(!/RATE_LIMIT_STORE/.test(warnings));
});

/* ------------------------ the checks that already existed ----------------- */

test('a missing signing secret still refuses to start', () => {
  // Guarding the guard: the tests above all supply a valid configuration, so
  // this proves the harness is actually exercising the real validator.
  const { error } = validateWith({ JWT_ACCESS_SECRET: undefined });

  assert.ok(error, 'a missing JWT secret must stop the boot');
  assert.match(error.message, /JWT_ACCESS_SECRET/);
});
