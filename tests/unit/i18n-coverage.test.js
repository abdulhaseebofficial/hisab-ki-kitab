/**
 * Both languages say the same things.
 *
 * A half-translated app is worse than an untranslated one: the reader cannot
 * tell whether the English sentence in the middle of their screen is a bug or a
 * word nobody could translate, and they stop trusting the rest. The failure is
 * also invisible in review, because the missing key is in the file nobody
 * opened.
 *
 * So the two bundles are compared key by key, in both directions, and this
 * fails if either one has something the other does not. Adding an English
 * string without its Roman Urdu is a broken build, not a to-do.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const catalogue = require(path.join(__dirname, '..', '..', 'packages', 'contracts', 'catalogue'));

const LOCALES = path.join(__dirname, '..', '..', 'apps', 'web', 'src', 'shared', 'i18n', 'locales');

const load = (file) => JSON.parse(fs.readFileSync(path.join(LOCALES, file), 'utf8'));
const en = load('en.json');
const romanUr = load('roman-ur.json');

/** Every leaf path in a nested bundle: `udhaar.summary.payable`. */
const keysOf = (node, prefix = '') => {
  const keys = [];
  for (const [name, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${name}` : name;
    if (value && typeof value === 'object' && !Array.isArray(value)) keys.push(...keysOf(value, full));
    else keys.push(full);
  }
  return keys;
};

const read = (bundle, key) =>
  key.split('.').reduce((node, part) => (node === undefined ? undefined : node[part]), bundle);

const enKeys = keysOf(en);
const urKeys = keysOf(romanUr);

/* --------------------------- the same key set ----------------------------- */

test('every English string has a Roman Urdu one', () => {
  const missing = enKeys.filter((key) => !urKeys.includes(key));
  assert.deepStrictEqual(missing, [], `Roman Urdu is missing: ${missing.join(', ')}`);
});

test('and Roman Urdu has nothing English does not', () => {
  // A key only in Roman Urdu is a key no component can be calling, because a
  // component that called it would have needed the English one too.
  const extra = urKeys.filter((key) => !enKeys.includes(key));
  assert.deepStrictEqual(extra, [], `only in Roman Urdu: ${extra.join(', ')}`);
});

test('the bundles have the same shape, not just the same names', () => {
  // A branch in one file and a string in the other reads as "present" to a
  // name comparison and breaks at runtime.
  for (const key of enKeys) {
    assert.strictEqual(
      typeof read(en, key), typeof read(romanUr, key),
      `${key} is a ${typeof read(en, key)} in English and a ${typeof read(romanUr, key)} in Roman Urdu`
    );
  }
});

/* ------------------------------ the strings ------------------------------- */

test('no translation is empty', () => {
  for (const [name, bundle] of [['English', en], ['Roman Urdu', romanUr]]) {
    for (const key of keysOf(bundle)) {
      const value = read(bundle, key);
      assert.strictEqual(typeof value, 'string', `${name}: ${key} is not a string`);
      assert.ok(value.trim().length > 0, `${name}: ${key} is empty`);
    }
  }
});

test('no translation is left as a copy of its own key', () => {
  // "udhaar.summary.payable" showing up on screen is the failure this whole
  // file exists to prevent.
  for (const [name, bundle] of [['English', en], ['Roman Urdu', romanUr]]) {
    for (const key of keysOf(bundle)) {
      assert.notStrictEqual(read(bundle, key), key, `${name}: ${key} is untranslated`);
    }
  }
});

test('both languages fill the same gaps', () => {
  // t('mode.switched', { mode }) has to work in both. A placeholder present in
  // one and absent from the other produces a sentence with a hole in it.
  const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  for (const key of enKeys) {
    assert.deepStrictEqual(
      placeholders(read(romanUr, key)), placeholders(read(en, key)),
      `${key} uses different placeholders in the two languages`
    );
  }
});

/* -------------------------- what must not be here ------------------------- */

test('every stored status and direction has a label in both languages', () => {
  // The ids below are what the database holds and the API sends. If one of
  // them ever arrives without a label, the screen shows a person the word
  // PARTIALLY_PAID. This is the check that a new status cannot be added on the
  // server and quietly reach the interface untranslated.

  const labelled = (group) => new Set(
    enKeys.filter((key) => key.startsWith(group + '.')).map((key) => key.split('.').pop())
  );

  // PENDING is shown as "Active"/"Jari": the stored word and the human word are
  // deliberately different, so the mapping is spelled out rather than guessed.
  const statusKey = { PENDING: 'active', PARTIALLY_PAID: 'partially_paid', SETTLED: 'settled', CANCELLED: 'cancelled', OVERDUE: 'overdue' };
  const statusLabels = labelled('udhaar.status');
  for (const id of catalogue.idsOf('udhaarStatus')) {
    assert.ok(statusKey[id], `status ${id} has no key mapped for it in this test`);
    assert.ok(statusLabels.has(statusKey[id]), `status ${id} has no label to show`);
  }

  const directionKey = { BORROWED: 'payable', LENT: 'receivable' };
  for (const id of catalogue.idsOf('udhaarKind')) {
    assert.ok(directionKey[id], `direction ${id} has no key mapped for it in this test`);
    assert.ok(read(en, `udhaar.${directionKey[id]}`), `direction ${id} has no English label`);
    assert.ok(read(romanUr, `udhaar.${directionKey[id]}`), `direction ${id} has no Roman Urdu label`);
  }
});

test('no stored identifier is used verbatim as a translation key', () => {
  // A key literally named PENDING would mean somebody is translating the
  // stored value instead of mapping it, which is how a language switch starts
  // rewriting history.
  const stored = new Set([...catalogue.idsOf('udhaarStatus'), ...catalogue.idsOf('udhaarKind')]);

  for (const key of enKeys) {
    assert.ok(!stored.has(key.split('.').pop()), `${key} is a stored identifier, not a label`);
  }
});

test('the languages the bundles cover are the languages the app allows', () => {
  assert.deepStrictEqual([...catalogue.LANGUAGES].sort(), ['en', 'roman_ur']);
});

/* ------------------------------ actual size ------------------------------- */

test('the bundles are not a token gesture', () => {
  // A coverage test passes trivially when both files are empty. This is the
  // floor, not a target: it only says translation was actually attempted.
  assert.ok(enKeys.length >= 100, `only ${enKeys.length} keys - is anything translated?`);
});
