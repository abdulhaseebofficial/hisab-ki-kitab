/**
 * The tip of the day, per kind of life.
 *
 * This is the rule-based tip - the one that runs when no AI key is configured,
 * which is most deployments and therefore what most people actually read. The
 * AI path already has separate personas; this one used to have one voice, and
 * it was a student's.
 *
 * Telling somebody who just paid an electricity bill to watch their chai
 * spending is how an app announces it has not understood who is using it.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const API = path.join(__dirname, '..', '..', 'apps', 'api');
const ai = require(path.join(API, 'src/modules/advisor/advisor.ai'));

const student = { currency: 'PKR', financeMode: 'student', monthlyIncome: 28000 };
const household = { currency: 'PKR', financeMode: 'householder', monthlyIncome: 145000 };

const withSpending = {
  breakdown: [{ category: 'Groceries', amount: 26000 }],
  remaining: 40000,
  daysLeftInMonth: 12,
};

const empty = { breakdown: [], remaining: 0, daysLeftInMonth: 12 };

const overspent = {
  breakdown: [{ category: 'House Rent', amount: 35000 }],
  remaining: -8000,
  daysLeftInMonth: 6,
};

/** The rule-based tip, reached through the public entry point. */
const tipFor = async (user, snapshot) => {
  const result = await ai.dailyTip({ user, snapshot });
  return result.tip;
};

/* ------------------------------ they differ ------------------------------- */

test('a household and a student are not given the same tip', async () => {
  const forStudent = await tipFor(student, withSpending);
  const forHousehold = await tipFor(household, withSpending);

  assert.notStrictEqual(forStudent, forHousehold);
});

test('and not the same one when nothing is logged yet', async () => {
  const forStudent = await tipFor(student, empty);
  const forHousehold = await tipFor(household, empty);

  assert.notStrictEqual(forStudent, forHousehold);
});

test('nor when the month has already gone over', async () => {
  const forStudent = await tipFor(student, overspent);
  const forHousehold = await tipFor(household, overspent);

  assert.notStrictEqual(forStudent, forHousehold);
});

/* ------------------------ each sounds like its reader ---------------------- */

test('the student tip talks about student life', async () => {
  const tip = await tipFor(student, empty);
  assert.match(tip, /chai|canteen/i);
});

test('the household tip talks about the household', async () => {
  const tip = await tipFor(household, empty);
  assert.match(tip, /household|bijli|bazaar/i);
  assert.doesNotMatch(tip, /canteen/i);
});

test('a household is never told about the canteen', async () => {
  for (const snapshot of [empty, withSpending, overspent]) {
    const tip = await tipFor(household, snapshot);
    assert.doesNotMatch(tip, /canteen|chai|hostel/i, `leaked student wording: ${tip}`);
  }
});

/* ---------------------------- still real advice --------------------------- */

test('both tips quote the person', async () => {
  // A tip with no number in it is a motivational poster, not advice.
  const forHousehold = await tipFor(household, withSpending);
  assert.match(forHousehold, /26,?000|40,?000|12/);

  const forStudent = await tipFor(student, withSpending);
  assert.match(forStudent, /26,?000|40,?000|12/);
});

test('an overspent household is told the truth, not a daily allowance', async () => {
  // Dividing a negative balance across the remaining days produces a confident
  // negative number, which is not advice.
  const tip = await tipFor(household, overspent);

  assert.match(tip, /past its income/i);
  assert.doesNotMatch(tip, /-\s*\d/, 'a negative allowance reached the reader');
});

test('the mode decides it, not the language', async () => {
  // Roman Urdu must not quietly select a different persona.
  const englishHousehold = await tipFor(household, withSpending);
  const urduHousehold = await tipFor({ ...household, language: 'roman_ur' }, withSpending);

  assert.strictEqual(englishHousehold, urduHousehold);
});
