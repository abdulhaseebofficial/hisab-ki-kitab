import { Search } from 'lucide-react';
import Select from '../../../shared/components/ui/Select';
import useT from '../../../shared/i18n/I18nProvider';
import { cn } from '../../../shared/utils/format';

// Every list below pairs the value the API expects with the key the reader
// sees. The values never change with the language; only the keys are looked up.

/** The direction tabs: everything, what is owed, what is owing. */
const KINDS = [
  { value: '', key: 'common.all' },
  { value: 'BORROWED', key: 'udhaar.payableShort' },
  { value: 'LENT', key: 'udhaar.receivableShort' },
];

const STATUSES = [
  { value: 'OUTSTANDING', key: 'udhaar.filters.stillOpen' },
  { value: '', key: 'udhaar.filters.anyStatus' },
  { value: 'PENDING', key: 'udhaar.status.active' },
  { value: 'PARTIALLY_PAID', key: 'udhaar.status.partially_paid' },
  { value: 'OVERDUE', key: 'udhaar.status.overdue' },
  { value: 'SETTLED', key: 'udhaar.status.settled' },
  { value: 'CANCELLED', key: 'udhaar.status.cancelled' },
];

const SORTS = [
  { value: 'newest', key: 'udhaar.sort.newest' },
  { value: 'oldest', key: 'udhaar.sort.oldest' },
  { value: 'remaining', key: 'udhaar.sort.remaining' },
  { value: 'amount', key: 'udhaar.sort.amount' },
  { value: 'due', key: 'udhaar.sort.due' },
];

export default function DebtFilters({ filters, onChange }) {
  const { t } = useT();
  const set = (patch) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label={t('udhaar.filters.direction')}
        className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {KINDS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => set({ kind: option.value })}
            aria-pressed={(filters.kind || '') === option.value}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition',
              (filters.kind || '') === option.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {t(option.key)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search || ''}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Search a name or note"
            aria-label={t('udhaar.filters.person')}
            className="hw-input pl-9"
          />
        </div>

        <Select
          label=""
          aria-label={t('udhaar.filters.status')}
          options={STATUSES.map((o) => ({ value: o.value, label: t(o.key) }))}
          value={filters.status || 'OUTSTANDING'}
          onChange={(event) => set({ status: event.target.value })}
        />

        <Select
          label=""
          aria-label="Sort records"
          options={SORTS.map((o) => ({ value: o.value, label: t(o.key) }))}
          value={filters.sort || 'newest'}
          onChange={(event) => set({ sort: event.target.value })}
        />
      </div>
    </div>
  );
}
