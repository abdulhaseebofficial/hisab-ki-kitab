import { GraduationCap, Home } from 'lucide-react';
import useT from '../../../shared/i18n/I18nProvider';
import { cn } from '../../../shared/utils/format';

const MODES = [
  { key: 'student', icon: GraduationCap },
  { key: 'householder', icon: Home },
  { key: 'shared_living', icon: Home },
];

// Named in themselves, not through t(): somebody choosing a language has to be
// able to recognise it without already reading the one on screen.
const LANGUAGES = [
  { key: 'en', label: 'English', sample: 'You have to pay' },
  { key: 'roman_ur', label: 'Roman Urdu', sample: 'Mujhe paise dene hain' },
];

/**
 * The first question, before any money is mentioned.
 *
 * It comes first because everything downstream depends on it: which categories
 * exist, what the income field is called, whether the dashboard talks about
 * pocket money or the electricity bill. Asking it after the amounts would mean
 * asking someone to re-file what they had already entered.
 *
 * The language is asked here too, so the rest of the wizard is already in it.
 */
export default function SetupStep({ form, onChange }) {
  const { t } = useT();

  return (
    <>
      <fieldset>
        <legend className="hw-label mb-2">{t('mode.question')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((option) => {
            const active = form.financeMode === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ financeMode: option.key })}
                className={cn(
                  'flex gap-3 rounded-xl border p-4 text-left transition',
                  active
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                )}
              >
                <option.icon
                  className={cn('h-5 w-5 shrink-0', active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400')}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t(`mode.${option.key}`)}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {t(`mode.${option.key}Description`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="hw-label mb-2">{t('language.question')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LANGUAGES.map((option) => {
            const active = form.language === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ language: option.key })}
                className={cn(
                  'rounded-xl border p-4 text-left transition',
                  active
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                )}
              >
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  {option.sample}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.financeModeHint')}</p>
    </>
  );
}
