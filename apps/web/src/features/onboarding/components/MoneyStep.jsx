import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { CURRENCIES } from '../../../shared/utils/constants';
import { currencySymbol } from '../../../shared/utils/format';
import useT from '../../../shared/i18n/I18nProvider';

/** Common starting points, so the first field is a tap rather than typing. */
const QUICK_AMOUNTS = [15000, 20000, 25000, 35000];

/** The only step that cannot be skipped: everything else is sized against it. */
export default function MoneyStep({ form, onChange }) {
  const { t } = useT();
  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t(form.financeMode === 'householder'
          ? 'onboarding.incomeQuestionHouseholder'
          : 'onboarding.incomeQuestionStudent')}
      </p>

      {/*
        Currency first, then the amount. The other way round, somebody typed a
        figure against one symbol and watched it change meaning underneath them
        when they corrected the currency - and every number after this point
        (the quick amounts below, the goal targets on the next step) is rendered
        in whatever is chosen here.
      */}
      <Select
        label={t('onboarding.currency')}
        options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol}  ${c.label}` }))}
        value={form.currency}
        onChange={(event) => onChange({ currency: event.target.value })}
        hint={t('onboarding.currencyFirst')}
      />

      <Input
        label={t(form.financeMode === 'householder' ? 'settings.monthlyHouseholdIncome' : 'settings.monthlyPocketMoney')}
        type="number"
        inputMode="decimal"
        placeholder="25000"
        autoFocus
        prefix={currencySymbol(form.currency)}
        value={form.monthlyIncome}
        onChange={(event) => onChange({ monthlyIncome: event.target.value })}
        hint={t('settings.incomeHint')}
      />

      <div className="flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange({ monthlyIncome: String(amount) })}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {currencySymbol(form.currency)}
            {amount.toLocaleString('en-PK')}
          </button>
        ))}
      </div>
    </>
  );
}
