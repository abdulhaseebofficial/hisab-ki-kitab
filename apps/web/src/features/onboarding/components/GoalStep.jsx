import Input from '../../../shared/components/ui/Input';
import { cn, currencySymbol } from '../../../shared/utils/format';
import useT from '../../../shared/i18n/I18nProvider';

/**
 * What a first goal looks like, per kind of life.
 *
 * These are not decoration. Most people setting a first savings goal have never
 * set one, and the suggestions are what tell them what a realistic target looks
 * like. Offering "trip with friends" and "laptop for projects" to somebody
 * budgeting for a household is the app describing a life that is not theirs -
 * so the two lists have nothing in common except the emergency fund, which
 * genuinely is the right first goal either way.
 *
 * The amounts differ too: a student's emergency fund and a household's are the
 * same idea at very different scales.
 */
const SUGGESTIONS = {
  student: [
    { key: 'goalEmergency', targetAmount: 10000, icon: '\u{1F6E1}' },
    { key: 'goalPhone', targetAmount: 45000, icon: '\u{1F4F1}' },
    { key: 'goalTrip', targetAmount: 25000, icon: '\u{1F3D6}' },
    { key: 'goalLaptop', targetAmount: 120000, icon: '\u{1F4BB}' },
  ],
  householder: [
    { key: 'goalHouseholdEmergency', targetAmount: 100000, icon: '\u{1F6E1}' },
    { key: 'goalRentBuffer', targetAmount: 60000, icon: '\u{1F3E0}' },
    { key: 'goalGrocery', targetAmount: 40000, icon: '\u{1F6D2}' },
    { key: 'goalSchoolFees', targetAmount: 75000, icon: '\u{1F393}' },
  ],
};

/** Skippable: someone with no goal in mind should still reach the dashboard. */
export default function GoalStep({ form, onChange }) {
  const { t } = useT();

  const householder = form.financeMode === 'householder';
  const suggestions = householder ? SUGGESTIONS.householder : SUGGESTIONS.student;

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t(householder ? 'onboarding.goalIntroHouseholder' : 'onboarding.goalIntroStudent')}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((suggestion) => {
          // The stored goal title is the translated label, because it is the
          // person's own goal from the moment they pick it - they can rename it,
          // and nothing should rewrite it under them later.
          const title = t(`onboarding.${suggestion.key}`);

          return (
            <button
              key={suggestion.key}
              type="button"
              onClick={() =>
                onChange({
                  goalTitle: title,
                  goalTarget: String(suggestion.targetAmount),
                  goalIcon: suggestion.icon,
                })
              }
              className={cn(
                'rounded-xl border p-3 text-left transition',
                form.goalTitle === title
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-slate-200 hover:border-brand-300 dark:border-slate-800'
              )}
            >
              <span className="text-xl" aria-hidden="true">
                {suggestion.icon}
              </span>
              <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{title}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currencySymbol(form.currency)}
                {suggestion.targetAmount.toLocaleString('en-PK')}
              </p>
            </button>
          );
        })}
      </div>

      <Input
        label={t('goals.goalName')}
        placeholder={t('goals.savingFor')}
        value={form.goalTitle}
        onChange={(event) => onChange({ goalTitle: event.target.value })}
      />

      <Input
        label={t('goals.targetAmount')}
        type="number"
        inputMode="decimal"
        placeholder={householder ? '100000' : '20000'}
        prefix={currencySymbol(form.currency)}
        value={form.goalTarget}
        onChange={(event) => onChange({ goalTarget: event.target.value })}
      />
    </>
  );
}
