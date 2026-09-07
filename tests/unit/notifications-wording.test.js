/**
 * Alert wording, in both languages and both modes.
 *
 * The rule this protects is the one that makes the whole thing work: a
 * notification stores WHAT it is, never what it said. Freeze the sentence at
 * write time and somebody who switches language reads their new alerts in it
 * and every older one in English, permanently, with no way back short of
 * deleting their own history.
 *
 * So these check the contract the API renders through - that every key exists
 * in both languages, that placeholders match, and that a key nobody knows
 * degrades to null rather than to a half-built sentence.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const CONTRACTS = path.join(__dirname, '..', '..', 'packages', 'contracts');
const { renderNotification, notificationKeys, LANGUAGES, MODES } = require(
  path.join(CONTRACTS, 'notifications')
);
const templates = require(path.join(CONTRACTS, 'notifications.json'));

/** Every string in an entry, whether it is flat or split by mode. */
const stringsOf = (entry) => {
  const out = [];
  for (const language of LANGUAGES) {
    if (typeof entry[language] === 'string') out.push([language, null, entry[language]]);
  }
  for (const mode of MODES) {
    if (entry[mode]) {
      for (const language of LANGUAGES) {
        if (typeof entry[mode][language] === 'string') out.push([language, mode, entry[mode][language]]);
      }
    }
  }
  return out;
};

const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/* ---------------------------- both languages ------------------------------ */

test('every alert has a title and a message in both languages', () => {
  for (const key of notificationKeys()) {
    for (const part of ['title', 'message']) {
      const entry = templates[key][part];
      assert.ok(entry, `${key}.${part} is missing`);

      for (const language of LANGUAGES) {
        const rendered = renderNotification(key, { language, financeMode: 'student' });
        assert.ok(rendered, `${key} does not render in ${language}`);
        assert.ok(rendered[part].trim().length > 0, `${key}.${part} is empty in ${language}`);
      }
    }
  }
});

test('and in both finance modes', () => {
  for (const key of notificationKeys()) {
    for (const financeMode of MODES) {
      const rendered = renderNotification(key, { language: 'roman_ur', financeMode });
      assert.ok(rendered, `${key} does not render for ${financeMode}`);
    }
  }
});

test('the two languages fill the same gaps', () => {
  // A placeholder present in one language and absent from the other produces a
  // sentence with a hole in it for exactly one set of readers.
  for (const key of notificationKeys()) {
    for (const part of ['title', 'message']) {
      const strings = stringsOf(templates[key][part]);
      const byGroup = {};
      for (const [language, mode, text] of strings) {
        (byGroup[mode || 'flat'] ||= {})[language] = placeholders(text);
      }
      for (const [group, langs] of Object.entries(byGroup)) {
        assert.deepStrictEqual(
          langs.roman_ur, langs.en,
          `${key}.${part} (${group}) uses different placeholders in the two languages`
        );
      }
    }
  }
});

test('no alert is left as English standing in for Roman Urdu', () => {
  // An untranslated string is easy to ship and impossible to notice.
  const allowed = new Set(['Udhaar settled']);
  for (const key of notificationKeys()) {
    for (const part of ['title', 'message']) {
      const strings = stringsOf(templates[key][part]);
      const en = strings.filter(([l]) => l === 'en').map(([, , t]) => t);
      const ur = strings.filter(([l]) => l === 'roman_ur').map(([, , t]) => t);
      for (let i = 0; i < en.length; i += 1) {
        if (allowed.has(en[i])) continue;
        assert.notStrictEqual(ur[i], en[i], `${key}.${part} is identical in both languages`);
      }
    }
  }
});

/* --------------------------- the words themselves ------------------------- */

test('a student is not told about household bills, and the reverse', () => {
  const student = renderNotification('logReminder', { language: 'en', financeMode: 'student' });
  const household = renderNotification('logReminder', { language: 'en', financeMode: 'householder' });

  assert.notStrictEqual(student.message, household.message,
    'the two modes should not share one reminder if they were given separate entries');
  assert.match(household.message, /household/i);
});

test('values are filled in, not left as braces', () => {
  const rendered = renderNotification('overspendOver', {
    language: 'roman_ur',
    values: { category: 'Bijli Ka Bill', spent: 'PKR 12,000', limit: 'PKR 9,000', percent: 133 },
  });

  assert.match(rendered.title, /Bijli Ka Bill/);
  assert.doesNotMatch(rendered.message, /\{/, 'a placeholder was left unfilled');
});

test('a value nobody supplied stays visible rather than blanking the sentence', () => {
  // An empty gap reads as a finished sentence with a word missing; a visible
  // {category} reads as the bug it is.
  const rendered = renderNotification('overspendOver', { language: 'en', values: {} });
  assert.match(rendered.title, /\{category\}/);
});

/* ------------------------------ safe failure ------------------------------ */

test('an unknown key renders nothing rather than half a sentence', () => {
  // Rows written by a newer deploy, or by a rule since removed, must not take
  // down the tray - the caller falls back to the stored text.
  assert.strictEqual(renderNotification('no-such-alert', { language: 'en' }), null);
});

test('an unknown language and mode fall back instead of failing', () => {
  const rendered = renderNotification('logReminder', { language: 'fr', financeMode: 'landlord' });
  assert.ok(rendered);
  assert.strictEqual(
    rendered.message,
    renderNotification('logReminder', { language: 'en', financeMode: 'student' }).message
  );
});

/* ------------------- the rules only use keys that exist ------------------- */

test('every key the alert rules raise is one this contract knows', () => {
  // A rule pushing a key with no template writes a blank title and message
  // into somebody's tray, and the failure is invisible until they look.
  const fs = require('fs');
  const known = new Set(notificationKeys());
  const sources = [
    'apps/api/src/modules/notifications/notifications.service.js',
    'apps/api/src/modules/notifications/notifications.subscriptions.js',
  ].map((rel) => path.join(__dirname, '..', '..', rel));

  const used = new Set();
  for (const file of sources) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/key:\s*'([A-Za-z]+)'/g)) used.add(m[1]);
    // The ternary form: key: overdue ? 'goalOverdue' : 'goalDueSoon'
    for (const m of src.matchAll(/key:\s*[^,\n]*\?\s*'([A-Za-z]+)'\s*:\s*'([A-Za-z]+)'/g)) {
      used.add(m[1]);
      used.add(m[2]);
    }
  }

  assert.ok(used.size > 0, 'no alert keys were found in the rules - has the parsing drifted?');
  for (const key of used) {
    assert.ok(known.has(key), `the rules raise "${key}", which the contract has no wording for`);
  }
});
