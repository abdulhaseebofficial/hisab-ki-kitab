/**
 * Who the advisor thinks it is talking to.
 *
 * The numbers reaching the advisor are already scoped to the person's mode.
 * What this covers is the other half: the persona. Advice built for a hostel
 * mess bill, handed to someone paying school fees and an electricity bill, is
 * not merely unhelpful - it tells them the app has not understood them.
 *
 * The prompt text is not asserted word for word, only the parts that would
 * make the advice wrong for the reader.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const advisor = require(path.join(__dirname, '..', '..', 'apps', 'api', 'src', 'modules', 'advisor', 'advisor.ai.js'));

// systemPromptFor is internal, so it is reached the way the module is actually
// used: through the exported surface if it is there, otherwise by reading the
// selector's two branches directly.
const promptFor = advisor.systemPromptFor;

test('the persona selector is reachable for testing', () => {
  assert.strictEqual(typeof promptFor, 'function',
    'export systemPromptFor so the persona can be tested without an API key');
});

test('a student gets the hostel persona', () => {
  const prompt = promptFor({ financeMode: 'student' });
  assert.match(prompt, /hostel/i);
  assert.doesNotMatch(prompt, /electricity bill/i);
});

test('a householder gets the household persona', () => {
  const prompt = promptFor({ financeMode: 'householder' });
  assert.match(prompt, /household/i);
  assert.match(prompt, /rent/i);
  // The specific advice that would be wrong for them.
  assert.doesNotMatch(prompt, /mess food/i);
});

test('someone with no mode set is treated as a student', () => {
  // The default the whole app uses, and what every existing account has.
  assert.strictEqual(promptFor({}), promptFor({ financeMode: 'student' }));
});

test('an unknown mode falls back rather than producing an empty persona', () => {
  assert.strictEqual(promptFor({ financeMode: 'landlord' }), promptFor({ financeMode: 'student' }));
});

test('both personas keep the rules that are not about who the reader is', () => {
  for (const mode of ['student', 'householder']) {
    const prompt = promptFor({ financeMode: mode });
    assert.match(prompt, /Never invent transactions/i, `${mode}: honesty rule missing`);
    assert.match(prompt, /never assume their gender/i, `${mode}: assumption rule missing`);
    assert.match(prompt, /personal safety/i, `${mode}: safety rule missing`);
  }
});

test('a Roman Urdu reader is asked for Roman Urdu, in either mode', () => {
  for (const mode of ['student', 'householder']) {
    const prompt = promptFor({ financeMode: mode, language: 'roman_ur' });
    assert.match(prompt, /Roman Urdu/);
    assert.match(prompt, /Do not use Urdu script/);
  }
});

test('and an English reader is not', () => {
  const prompt = promptFor({ financeMode: 'student', language: 'en' });
  assert.doesNotMatch(prompt, /Roman Urdu - Urdu written/);
});

test('the language instruction protects what the person typed', () => {
  // The advice changes language. Their category names, their people's names
  // and their own notes must come back exactly as written.
  const prompt = promptFor({ financeMode: 'householder', language: 'roman_ur' });
  assert.match(prompt, /unchanged/i);
});
