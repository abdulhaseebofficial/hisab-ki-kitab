/**
 * Turns a stored alert key back into a sentence, in the reader's language.
 *
 * The alternative - and what this replaces - is writing the finished English
 * sentence into the row when the rule fires. That freezes the wording at write
 * time, so somebody who switches to Roman Urdu reads their new alerts in it and
 * every older one in English, permanently, with no way back short of deleting
 * their own history.
 *
 * So a notification stores the key and the values. The words are chosen when
 * somebody reads it.
 *
 * Rows written before this existed have no key. They keep their rendered
 * columns and are shown exactly as they were - untranslated, but readable,
 * which is the right trade for history nobody can regenerate.
 */

const templates = require('./notifications.json');

const LANGUAGES = ['en', 'roman_ur'];
const MODES = ['student', 'householder'];

const safeLanguage = (language) => (LANGUAGES.includes(language) ? language : 'en');
const safeMode = (mode) => (MODES.includes(mode) ? mode : 'student');

/** Replaces {name} with values.name, leaving an unsupplied placeholder visible. */
const fill = (template, values = {}) =>
  String(template).replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? whole : String(values[name])
  );

/**
 * Picks the right string out of a template entry.
 *
 * An entry is either `{ en, roman_ur }` or, where the two modes genuinely need
 * different words, `{ student: { en, roman_ur }, householder: {...} }`.
 */
const pick = (entry, language, mode) => {
  if (!entry) return null;
  if (typeof entry[safeLanguage(language)] === 'string') return entry[safeLanguage(language)];

  const byMode = entry[safeMode(mode)];
  if (byMode && typeof byMode[safeLanguage(language)] === 'string') {
    return byMode[safeLanguage(language)];
  }
  return null;
};

/**
 * `{ title, message }` for a stored alert, or null when the key is unknown.
 *
 * Returning null rather than throwing is deliberate: an alert whose key no
 * longer exists - a rule that was removed, a row from a newer deploy - must
 * still be readable through its stored text, not take down the whole tray.
 */
const renderNotification = (key, { language, financeMode, values } = {}) => {
  const template = templates[key];
  if (!template) return null;

  const title = pick(template.title, language, financeMode);
  const message = pick(template.message, language, financeMode);
  if (title === null || message === null) return null;

  return { title: fill(title, values), message: fill(message, values) };
};

/** Every key this contract knows, so a test can prove the rules only use these. */
const notificationKeys = () => Object.keys(templates).filter((key) => !key.startsWith('_'));

module.exports = { renderNotification, notificationKeys, LANGUAGES, MODES };
