import { Languages } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import useT from '../../../shared/i18n/I18nProvider';
import { cn } from '../../../shared/utils/format';

const OPTIONS = [
  { key: 'en', label: 'English', sample: 'You have to pay' },
  { key: 'roman_ur', label: 'Roman Urdu', sample: 'Mujhe paise dene hain' },
];

/**
 * English or Roman Urdu.
 *
 * Each option carries a line of itself, because the name of a language is not
 * much use to someone deciding whether they can read it. "Roman Urdu" tells
 * you nothing; "Mujhe paise dene hain" tells you immediately.
 *
 * Both samples are written out here rather than pulled through t(), so the
 * choice reads the same whichever language is currently active - a person who
 * landed in the wrong one needs to recognise their way out.
 */
export default function LanguageCard({ language, onChange, saving }) {
  const { t } = useT();

  return (
    <Card>
      <CardHeader
        title={t('language.label')}
        subtitle={t('settings.languageHint')}
        icon={Languages}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const active = language === option.key;
          return (
            <button
              key={option.key}
              type="button"
              disabled={saving}
              aria-pressed={active}
              onClick={() => (active ? undefined : onChange(option.key))}
              className={cn(
                'rounded-xl border p-4 text-left transition disabled:opacity-60',
                active
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
              )}
            >
              <span
                className={cn(
                  'block text-sm font-semibold',
                  active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'
                )}
              >
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {option.sample}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
