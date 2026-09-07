/**
 * Which categories a person may use, and what they are called.
 *
 * Two things are being protected here. One is that a mode owns its list: a
 * student is never offered a gas bill and a household is never offered a hostel
 * fee, because filing a spend under a category from the other life is how a
 * dashboard starts lying.
 *
 * The other is that an id is not a label. `groceries` is stored; "Ghar Ka
 * Rashan" is read. If those ever became the same string, switching language
 * would rewrite a year of spending history - and that is exactly the failure
 * this separation exists to make impossible.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const API = path.join(__dirname, '..', '..', 'apps', 'api', 'src');
const { allCategories, isOwnCategory, isOtherModeCategory, modeOf } =
  require(path.join(API, 'shared', 'categories'));

const catalogue = require(path.join(__dirname, '..', '..', 'packages', 'contracts', 'catalogue'));

const student = (extra = {}) => ({ financeMode: 'student', customCategories: [], ...extra });
const householder = (extra = {}) => ({ financeMode: 'householder', customCategories: [], ...extra });

/* ------------------------------ the mode --------------------------------- */

test('a user with no mode is treated as a student', () => {
  // Every account and every row predates modes. Defaulting anywhere else would
  // hide people's existing records from them.
  assert.strictEqual(modeOf({}), 'student');
  assert.strictEqual(modeOf(null), 'student');
  assert.strictEqual(modeOf({ financeMode: undefined }), 'student');
});

test('an unrecognised mode falls back rather than throwing', () => {
  // A bad stored value must not lock somebody out of their own account.
  assert.strictEqual(modeOf({ financeMode: 'hacker' }), 'student');
  assert.strictEqual(modeOf({ financeMode: '' }), 'student');
});

/* --------------------------- what each mode offers ------------------------ */

test('each mode offers its own list', () => {
  const forStudent = allCategories(student());
  const forHouse = allCategories(householder());

  assert.ok(forStudent.includes('Mess/Food'), 'student lost their food category');
  assert.ok(forHouse.includes('groceries'), 'householder has no groceries');

  assert.ok(!forStudent.includes('electricity_bill'), 'a hostel room has no electricity bill');
  assert.ok(!forHouse.includes('Rent/Hostel Fee'), 'a household has no hostel fee');
});

test('the student list is exactly what it was, plus the new ones', () => {
  // The nine categories this app shipped with must all still be there under
  // the same ids, or every existing expense loses its category.
  const original = ['Mess/Food', 'Rent/Hostel Fee', 'Books & Stationery', 'Travel',
    'Mobile/Internet', 'Entertainment', 'Health', 'Personal Care', 'Misc'];
  const current = allCategories(student());
  for (const id of original) {
    assert.ok(current.includes(id), `the original category ${id} is gone`);
  }
});

test('custom categories belong to the person, not to a mode', () => {
  const own = { customCategories: ['Cricket kit', 'Chai fund'] };

  for (const user of [student(own), householder(own)]) {
    const list = allCategories(user);
    assert.ok(list.includes('Cricket kit'), `lost a custom category in ${user.financeMode} mode`);
    assert.ok(list.includes('Chai fund'));
  }
});

test('the defaults come first, then what the person added', () => {
  const list = allCategories(student({ customCategories: ['Cricket kit'] }));
  assert.strictEqual(list[list.length - 1], 'Cricket kit');
});

test('a missing or malformed custom list is not an error', () => {
  for (const custom of [null, undefined, []]) {
    assert.doesNotThrow(() => allCategories(student({ customCategories: custom })));
  }
  assert.doesNotThrow(() => allCategories(null));
});

test('income has its own lists, separate from expenses', () => {
  assert.ok(allCategories(householder(), 'income').includes('salary'));
  assert.ok(!allCategories(householder(), 'income').includes('groceries'));
  assert.ok(allCategories(student(), 'income').includes('Pocket Money'));
});

/* ----------------------------- what is allowed ---------------------------- */

test('a category from the other mode is refused', () => {
  assert.strictEqual(isOwnCategory(student(), 'electricity_bill'), false);
  assert.strictEqual(isOwnCategory(householder(), 'Rent/Hostel Fee'), false);
});

test('and is recognisable as the other mode, not as nonsense', () => {
  // Different mistakes deserve different messages: "that is not a category" and
  // "that belongs to your other mode" are not the same thing to explain.
  assert.strictEqual(isOtherModeCategory(student(), 'electricity_bill'), true);
  assert.strictEqual(isOtherModeCategory(student(), 'not-a-category-at-all'), false);
});

test('a category the person invented is allowed in either mode', () => {
  const own = { customCategories: ['Cricket kit'] };
  assert.strictEqual(isOwnCategory(student(own), 'Cricket kit'), true);
  assert.strictEqual(isOwnCategory(householder(own), 'Cricket kit'), true);
});

/* ------------------------ ids are not labels ------------------------------ */

test('the same id gives a different label in each language', () => {
  assert.strictEqual(catalogue.labelFor('expense', 'householder', 'groceries', 'en'), 'Groceries / Ration');
  assert.strictEqual(catalogue.labelFor('expense', 'householder', 'groceries', 'roman_ur'), 'Ghar Ka Rashan');
  assert.strictEqual(catalogue.labelFor('expense', 'student', 'Mess/Food', 'roman_ur'), 'Khana');
});

test('a custom category is never translated and never blanked', () => {
  // It is the person's own words. Coming back changed - or empty - would be
  // worse than showing it untranslated.
  assert.strictEqual(catalogue.labelFor('expense', 'student', 'Cricket kit', 'roman_ur'), 'Cricket kit');
  assert.strictEqual(catalogue.labelFor('expense', 'student', 'Chai fund', 'en'), 'Chai fund');
});

test('every category has a label in both languages', () => {
  for (const kind of ['expense', 'income']) {
    for (const mode of catalogue.MODES) {
      for (const entry of catalogue.categoriesFor(kind, mode)) {
        assert.ok(entry.en && entry.en.trim(), `${kind}/${mode}/${entry.id} has no English label`);
        assert.ok(entry.roman_ur && entry.roman_ur.trim(),
          `${kind}/${mode}/${entry.id} has no Roman Urdu label`);
      }
    }
  }
});

test('no id is reused within a list', () => {
  for (const kind of ['expense', 'income']) {
    for (const mode of catalogue.MODES) {
      const ids = catalogue.categoryIdsFor(kind, mode);
      assert.strictEqual(new Set(ids).size, ids.length, `${kind}/${mode} has a duplicate id`);
    }
  }
});

test('"Other" always asks the person to say more', () => {
  // A bucket called Other tells nobody anything a month later.
  assert.strictEqual(catalogue.requiresNote('expense', 'householder', 'other'), true);
  assert.strictEqual(catalogue.requiresNote('expense', 'student', 'Misc'), true);
  assert.strictEqual(catalogue.requiresNote('income', 'householder', 'other_income'), true);
  assert.strictEqual(catalogue.requiresNote('expense', 'householder', 'groceries'), false);
});

/* ---------------------- udhaar and status vocabulary ---------------------- */

test('udhaar direction reads as a sentence, in both languages', () => {
  assert.strictEqual(catalogue.lookup('udhaarKind', 'BORROWED', 'en'), 'I Have to Pay');
  assert.strictEqual(catalogue.lookup('udhaarKind', 'BORROWED', 'roman_ur'), 'Mujhe Paise Dene Hain');
  assert.strictEqual(catalogue.lookup('udhaarKind', 'LENT', 'en'), 'I Have to Receive');
  assert.strictEqual(catalogue.lookup('udhaarKind', 'LENT', 'roman_ur'), 'Mujhe Paise Lene Hain');
});

test('the stored status values are unchanged by any of this', () => {
  // These are what the database has always held. Renaming them to read better
  // would break every client already sending them, for a label that belongs on
  // a screen anyway.
  const ids = catalogue.idsOf('udhaarStatus');
  for (const id of ['PENDING', 'PARTIALLY_PAID', 'SETTLED']) {
    assert.ok(ids.includes(id), `${id} is no longer a known status`);
  }
  assert.ok(ids.includes('CANCELLED'), 'CANCELLED was not added');
});

test('modes and languages validate against an allowlist', () => {
  assert.strictEqual(catalogue.isMode('student'), true);
  assert.strictEqual(catalogue.isMode('householder'), true);
  assert.strictEqual(catalogue.isMode('admin'), false);

  assert.strictEqual(catalogue.isLanguage('en'), true);
  assert.strictEqual(catalogue.isLanguage('roman_ur'), true);
  assert.strictEqual(catalogue.isLanguage('ur'), false);
  assert.strictEqual(catalogue.isLanguage('../../etc/passwd'), false);
});
