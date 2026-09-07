import Input from '../../../shared/components/ui/Input';
import useT from '../../../shared/i18n/I18nProvider';

/**
 * Optional. It only exists to make the AI advice sound like it knows you.
 *
 * Only a student is asked this - see stepsFor() in OnboardingPage. A household
 * has no university and no hostel block, and asking anyway is how a wizard
 * tells somebody it has not understood who they are.
 */
export default function PlaceStep({ form, onChange }) {
  const { t } = useT();

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('onboarding.placeIntro')}
      </p>

      <Input
        label={t('onboarding.university')}
        placeholder={t('onboarding.universityPlaceholder')}
        value={form.university}
        onChange={(event) => onChange({ university: event.target.value })}
      />

      <Input
        label={t('settings.hostelName')}
        placeholder={t('onboarding.hostelPlaceholder')}
        value={form.hostelName}
        onChange={(event) => onChange({ hostelName: event.target.value })}
      />
    </>
  );
}
