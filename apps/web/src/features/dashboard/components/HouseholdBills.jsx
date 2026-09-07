import { Receipt } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import EmptyState from '../../../shared/components/ui/EmptyState';
import useT from '../../../shared/i18n/I18nProvider';
// Default import: contracts is CommonJS and Rollup cannot see named exports on it.
import catalogue from '@hisabkikitab/contracts/catalogue';
import { formatMoney } from '../../../shared/utils/format';

/**
 * The bills, on the dashboard, for a household.
 *
 * A student's month is one pot of money spent gradually. A household's month
 * has a handful of fixed obligations - rent, electricity, gas, water, the
 * internet, the phone - that arrive whether or not anybody planned for them,
 * and the useful question on the first of the month is not "how much have I
 * spent" but "how much of this month is already committed".
 *
 * So this reads the breakdown the dashboard already fetched rather than asking
 * the server anything new. The category ids come from the catalogue, so a
 * category renamed in either language still lands in the right total.
 */
const BILL_CATEGORIES = [
  'house_rent',
  'electricity_bill',
  'gas_bill',
  'water_bill',
  'internet',
  'mobile',
  'insurance',
  'loan_installment',
];

export default function HouseholdBills({ breakdown = [], currency = 'PKR' }) {
  const { t, language } = useT();

  const bills = breakdown
    .filter((row) => BILL_CATEGORIES.includes(row.category))
    .sort((a, b) => b.amount - a.amount);

  const total = bills.reduce((sum, row) => sum + row.amount, 0);

  return (
    <Card>
      <CardHeader
        title="Bills and fixed costs"
        subtitle={total > 0 ? `${formatMoney(total, currency)} this month` : undefined}
        icon={Receipt}
      />
      {bills.length === 0 ? (
        <EmptyState
          title="No bills recorded yet"
          message="Rent, electricity, gas, water and the phone will be totalled here as you log them."
        />
      ) : (
        <ul className="space-y-1.5">
          {bills.map((row) => (
            <li
              key={row.category}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
            >
              <span className="truncate text-slate-600 dark:text-slate-300">
                {catalogue.labelFor('expense', 'householder', row.category, language)}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                {formatMoney(row.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
