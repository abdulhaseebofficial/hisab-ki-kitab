/**
 * Income rules.
 *
 * Small feature, but the two decisions it does make live here: what an entry
 * defaults to when the student leaves fields out, and how this month's income
 * is summarised against the pocket money they planned for.
 */

const incomeRepo = require('./income.repository');
const ApiError = require('../../shared/errors/ApiError');
const { modeOf } = require('../../shared/categories');
const catalogue = require('@hisabkikitab/contracts/catalogue');
const {
  round2,
  startOfMonth,
  endOfMonth,
  currentPeriod,
} = require('../../shared/utils/calculations');

/**
 * What an entry is filed under when the caller names no source.
 *
 * Per mode, because "Pocket Money" is not a thing a household receives. The
 * catalogue's first income category for the mode is the ordinary case for that
 * mode - pocket money for a student, a salary for a household.
 */
const defaultSource = (financeMode) => catalogue.categoryIdsFor('income', financeMode)[0];

const list = (userId, financeMode, filters) => incomeRepo.list(userId, financeMode, filters);

/**
 * This month's income at a glance.
 *
 * `plannedIncome` is what the student said their monthly pocket money is;
 * `total` is what actually arrived. Both are returned because the difference
 * is the interesting part.
 */
const summary = async (user) => {
  const { month, year } = currentPeriod();
  const from = startOfMonth(year, month);
  const to = endOfMonth(year, month);

  const bySource = await incomeRepo.totalsBySource(user._id, modeOf(user), from, to);
  const total = bySource.reduce((sum, row) => sum + row.total, 0);

  return {
    month,
    year,
    total: round2(total),
    plannedIncome: round2(user.monthlyIncome || 0),
    bySource: bySource.map((row) => ({ source: row.source, amount: round2(row.total) })),
  };
};

const create = (userId, financeMode, { amount, source, note, date }) =>
  incomeRepo.create(userId, {
    financeMode,
    amount,
    source: source || defaultSource(financeMode),
    note: note || '',
    date: date ? new Date(date) : new Date(),
  });

/** Only the fields a student is allowed to change are copied across. */
const EDITABLE = ['amount', 'source', 'note', 'date'];

const update = async (id, financeMode, userId, body) => {
  const existing = await incomeRepo.findById(id, financeMode, userId);
  if (!existing) throw ApiError.notFound('Income entry not found');

  const patch = {};
  EDITABLE.forEach((field) => {
    if (body[field] !== undefined) patch[field] = body[field];
  });

  return incomeRepo.update(id, financeMode, userId, patch);
};

const remove = async (id, financeMode, userId) => {
  const removed = await incomeRepo.remove(id, financeMode, userId);
  if (!removed) throw ApiError.notFound('Income entry not found');
  return id;
};

/* ------------------- for other modules to build on ------------------ */

/** Income grouped by source over a range, for the monthly report. */
const totalsBySource = (userId, financeMode, from, to) =>
  incomeRepo.totalsBySource(userId, financeMode, from, to);

/** Every income entry, for the data export. */
const listAllForUser = (userId, financeMode) => incomeRepo.listAllForUser(userId, financeMode);

module.exports = {
  totalsBySource,
  listAllForUser,
  list,
  summary,
  create,
  update,
  remove,
};
