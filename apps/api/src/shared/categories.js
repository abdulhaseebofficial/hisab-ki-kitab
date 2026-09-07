/**
 * Which categories a person may use, in the mode they are working in.
 *
 * A pure question about a user object: the built-in list for their current
 * mode, plus whatever they have added themselves. No database, no I/O, nothing
 * to await.
 *
 * It lived on the users repository, which meant expenses, budgets and the
 * advisor all had to depend on the whole users module to ask it - three
 * dependency cycles bought with one function that reads a property. It belongs
 * here, where anything can ask without taking on a module.
 *
 * Modes changed what "may use" means. A hostel room has no gas bill and a
 * household has no hostel fee, so the built-in list now depends on which life
 * the person is recording. Custom categories do not: somebody who added
 * "Cricket kit" keeps it in both, because they typed it and it is theirs.
 */

const { categoryIdsFor, safeMode } = require('@hisabkikitab/contracts/catalogue');

/** The mode a user is working in, defaulting safely for a row written before modes existed. */
const modeOf = (user) => safeMode(user && user.financeMode);

/**
 * Every category this user can pick from: their mode's defaults first, then
 * their own, in the order they were added. Duplicates are not filtered - a
 * custom category that clashes with a built-in one is refused when it is
 * created, so one appearing here would be a bug worth seeing rather than
 * hiding.
 */
const allCategories = (user, kind = 'expense') => [
  ...categoryIdsFor(kind, modeOf(user)),
  ...((user && user.customCategories) || []),
];

/** Whether a name is one this user may file an expense or a budget under. */
const isOwnCategory = (user, category, kind = 'expense') =>
  allCategories(user, kind).includes(category);

/**
 * Categories from the mode the user is NOT in.
 *
 * Needed to tell "this is not a category" apart from "this belongs to your
 * other mode", which are different mistakes and deserve different messages.
 */
const isOtherModeCategory = (user, category, kind = 'expense') => {
  const other = modeOf(user) === 'student' ? 'householder' : 'student';
  return categoryIdsFor(kind, other).includes(category);
};

module.exports = { allCategories, isOwnCategory, isOtherModeCategory, modeOf };
