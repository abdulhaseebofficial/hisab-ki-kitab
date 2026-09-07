import { PieChart as PieIcon, TrendingUp } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import EmptyState from '../../../shared/components/ui/EmptyState';
import CategoryPieChart from '../../../shared/components/charts/CategoryPieChart';
import TrendChart from '../../../shared/components/charts/TrendChart';
import { BudgetRow } from '../../budgets';
import useT from '../../../shared/i18n/I18nProvider';

/**
 * The parts of a dashboard that are genuinely the same in both modes.
 *
 * Kept here rather than duplicated into each one, because these ask the same
 * question of the same data whoever is reading: how did the month split up,
 * how did it run day by day, and which limits are closest to being passed.
 * What differs between the two dashboards is which figures lead and which
 * groupings matter - not this.
 */

/** Donut of the month's spending, with the trend line beside it. */
export function SpendingCharts({ breakdown, trend, totals, monthLabel, currency }) {
  const { t } = useT();

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('dashboard.whereItWent')} subtitle={monthLabel} icon={PieIcon} />
        <CategoryPieChart data={breakdown} currency={currency} total={totals.spent} />
      </Card>

      <Card>
        <CardHeader
          title={t('dashboard.dailySpending')}
          subtitle={t('dashboard.transactionsThisMonth', { count: totals.expenseCount })}
          icon={TrendingUp}
        />
        {/* Taller than the default: it sits beside the donut, whose legend
            runs one row per category, and a short chart left dead space. */}
        <TrendChart data={trend} currency={currency} average={totals.dailyAverage} height={340} />
      </Card>
    </section>
  );
}

/** The four limits closest to being passed, or an invitation to set some. */
export function BudgetHealth({ budgets = [], currency, onCreate }) {
  const { t } = useT();

  return (
    <Card>
      <CardHeader
        title={t('dashboard.budgetHealth')}
        subtitle={budgets.length ? t('dashboard.closestToLimit') : undefined}
        icon={PieIcon}
      />
      {budgets.length === 0 ? (
        <EmptyState
          icon={PieIcon}
          title={t('dashboard.noBudgets')}
          message={t('dashboard.noBudgetsMessage')}
          actionLabel={t('dashboard.setBudgets')}
          onAction={onCreate}
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {budgets.slice(0, 4).map((row) => (
            <BudgetRow key={row._id} row={row} currency={currency} />
          ))}
        </ul>
      )}
    </Card>
  );
}
