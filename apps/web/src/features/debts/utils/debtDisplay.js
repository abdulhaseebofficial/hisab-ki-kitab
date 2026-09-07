/**
 * How a debt reads on screen.
 *
 * Colour alone never carries the meaning: every state ships a word as well, so
 * the list is usable in greyscale and to anyone who cannot separate red from
 * green. The badge classes follow the same palette the rest of the app uses.
 */

export const KIND_STYLE = {
  BORROWED: 'bg-danger/10 text-danger dark:bg-danger/15',
  LENT: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
};

/**
 * The status a row should show.
 *
 * Overdue is not a stored status - the server derives it from the due date -
 * so it is resolved here rather than read off the record.
 */
export const displayStatus = (debt) => {
  // Cancelled first: a cancelled record is out of the running whatever its
  // dates say, and the server already stops counting it as overdue.
  if (debt.status === 'CANCELLED') return 'CANCELLED';
  if (debt.status === 'SETTLED') return 'SETTLED';
  if (debt.isOverdue) return 'OVERDUE';
  return debt.status;
};

/**
 * Stored status to translation key.
 *
 * PENDING is shown as "Active"/"Jari", because nothing is pending about a debt
 * somebody is living with - it is simply still running. The stored word does
 * not change to match; only what the reader sees does.
 */
export const STATUS_KEY = {
  PENDING: 'active',
  PARTIALLY_PAID: 'partially_paid',
  SETTLED: 'settled',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

export const STATUS_STYLE = {
  PENDING: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  SETTLED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  OVERDUE: 'bg-danger/15 text-danger dark:bg-danger/20',
  // Deliberately the quietest of the five: a cancelled record is still on the
  // page, but it is not asking anybody to do anything.
  CANCELLED: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400',
};

/** How far through paying a record is, as a whole percentage. */
export const progressPercent = (debt) => {
  if (!debt.originalAmount) return 0;
  return Math.min(100, Math.round((debt.paidAmount / debt.originalAmount) * 100));
};
