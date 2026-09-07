/**
 * The home screen, assembled.
 *
 * Dashboard owns no data of its own. What it decides is which numbers belong
 * on the home screen and in what shape, drawing on analytics for the month's
 * snapshot and on expenses for the recent list.
 *
 * Loading the dashboard is also the natural moment to catch recurring bills up
 * and refresh alerts, because it is the one screen a student opens every day.
 * Both are safe to re-run.
 */

const expenses = require('../expenses/expenses.service');
const advisor = require('../advisor/advisor.service');
const debts = require('../debts/debts.service');
const { buildSnapshot } = require('../analytics/analytics.service');
const {
  materializeForUser,
} = require('../../infrastructure/scheduling/recurringExpenses.job');
const { runChecksForUser } = require('../notifications/notifications.service');
const { currentPeriod, changePercent } = require('../../shared/utils/calculations');
const { modeOf } = require('../../shared/categories');

const RECENT_EXPENSE_COUNT = 8;

/** How far ahead "due soon" looks on the dashboard. */
const BILL_HORIZON_DAYS = 14;

const periodFrom = (query = {}) => {
  const now = currentPeriod();
  return {
    month: Number(query.month) || now.month,
    year: Number(query.year) || now.year,
  };
};

const summary = async (user, query) => {
  const period = periodFrom(query);

  await materializeForUser(user._id);

  // A household's month is mostly committed before it starts, so what is
  // already owed matters as much as what has been spent. These are the real
  // recurring templates falling due - nothing is estimated or projected.
  const billHorizon = new Date();
  billHorizon.setDate(billHorizon.getDate() + BILL_HORIZON_DAYS);

  const [snapshot, recent, debtPosition, upcomingBills] = await Promise.all([
    buildSnapshot(user, period),
    expenses.listRecent(user._id, modeOf(user), RECENT_EXPENSE_COUNT),
    // Fetched here rather than by a second request from the browser, and never
    // recomputed there: the debt totals are exact decimal sums in SQL.
    debts.summary(user._id, modeOf(user)),
    expenses.findBillsDueBy(user._id, modeOf(user), billHorizon),
  ]);

  // Fire and forget: the student should not wait on the alert rules.
  runChecksForUser(user).catch((err) => console.error('[notifications]', err.message));

  return {
    period,
    monthLabel: snapshot.monthLabel,
    currency: user.currency,

    // Headline cards
    totals: {
      income: snapshot.income,
      plannedIncome: snapshot.plannedIncome,
      incomeLogged: snapshot.incomeLogged,
      spent: snapshot.totalSpent,
      remaining: snapshot.remaining,
      spentPercent: snapshot.spentPercent,
      dailyAverage: snapshot.dailyAverage,
      safeDailySpend: snapshot.safeDailySpend,
      daysLeftInMonth: snapshot.daysLeftInMonth,
      expenseCount: snapshot.expenseCount,
    },

    // Charts
    categoryBreakdown: snapshot.breakdown,
    trend: snapshot.trend,

    // Comparison with last month
    comparison: {
      previousMonthSpent: snapshot.previousMonthSpent,
      changePercent: changePercent(snapshot.totalSpent, snapshot.previousMonthSpent),
    },

    budgets: snapshot.budgets,
    goals: snapshot.goals,
    recentExpenses: recent.items,

    // Recurring expenses falling due soon, in this mode. Both dashboards get
    // them; only the householder one leads with them, because a student's
    // month is rarely shaped by fixed dates.
    upcomingBills,

    // Deliberately its own block, not folded into `totals`. Debt principal is
    // neither income nor spending - see debts.service - so mixing it into the
    // month's figures would make both of them lie.
    debts: debtPosition,

    aiConfigured: advisor.isConfigured(),
  };
};

module.exports = { summary };
