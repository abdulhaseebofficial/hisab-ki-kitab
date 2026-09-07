import { CalendarClock, Receipt } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import EmptyState from '../../../shared/components/ui/EmptyState';
import useT from '../../../shared/i18n/I18nProvider';
import useCategoryLabel from '../../../shared/i18n/useCategoryLabel';
import { cn, formatDate, formatMoney } from '../../../shared/utils/format';

/**
 * What is already committed in the next fortnight.
 *
 * These are real recurring expenses with a real next due date, not a forecast.
 * Nothing here is estimated from past behaviour: if a person has not marked
 * anything as recurring there is genuinely nothing to show, and the card says
 * so rather than inventing a plausible-looking figure.
 *
 * It leads the householder dashboard because a household's month is largely
 * decided before it starts. A student sees it too, lower down, since a hostel
 * fee behaves the same way.
 */
export default function UpcomingBills({ bills = [], currency = 'PKR' }) {
  const { t } = useT();
  const label = useCategoryLabel();

  const total = bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const now = Date.now();

  return (
    <Card>
      <CardHeader
        title={t('dashboard.upcomingBills')}
        subtitle={
          bills.length
            ? t('dashboard.billsDueSoon', {
                count: bills.length,
                amount: formatMoney(total, currency),
              })
            : t('dashboard.noBillsDue')
        }
        icon={Receipt}
      />

      {bills.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t('dashboard.noBillsDue')}
          message={t('dashboard.noBillsMessage')}
        />
      ) : (
        <ul className="space-y-1.5">
          {bills.map((bill) => {
            const due = bill.nextRunAt ? new Date(bill.nextRunAt) : null;
            const late = due && due.getTime() < now;

            return (
              <li
                key={bill._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800"
              >
                <div className="min-w-0">
                  {/* The description is the person's own words; the category
                      falls back to its translated label. */}
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {bill.description || label(bill.category)}
                  </p>
                  <p
                    className={cn(
                      'truncate text-[11px]',
                      late ? 'font-semibold text-danger' : 'text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {late
                      ? t('dashboard.overdueBill')
                      : t('dashboard.dueOn', { date: due ? formatDate(due) : '' })}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatMoney(bill.amount, currency)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
