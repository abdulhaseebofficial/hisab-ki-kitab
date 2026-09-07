import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Languages, PartyPopper, Target, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../../shared/components/ui/Button';
import { useAuth } from '../../auth';
import { getErrorMessage } from '../../../shared/api/client';
import { GOAL_ICONS } from '../../../shared/utils/constants';
import onboardingApi from '../api/onboardingApi';
import WizardHeader from '../components/WizardHeader';
import SetupStep from '../components/SetupStep';
import MoneyStep from '../components/MoneyStep';
import PlaceStep from '../components/PlaceStep';
import GoalStep from '../components/GoalStep';

const STEPS = [
  // Mode and language come first: every later step is worded by them, and the
  // categories a person will use are decided here.
  { key: 'setup', title: 'How you keep your books', icon: Languages, Component: SetupStep },
  { key: 'income', title: 'Your monthly money', icon: Wallet, Component: MoneyStep },
  { key: 'place', title: 'Where you study', icon: Check, Component: PlaceStep },
  { key: 'goal', title: 'Your first goal', icon: Target, Component: GoalStep },
];

/**
 * First-run wizard. Everything except the income figure is skippable.
 *
 * The three steps are separate components; what stays here is the wizard: one
 * form object, which step is showing, and what finishing means. Saving happens
 * once, at the end, in a single request - so a student who closes the tab
 * halfway through has not half-created an account.
 */
export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    financeMode: (user && user.financeMode) || 'student',
    language: (user && user.language) || 'en',
    monthlyIncome: '',
    currency: user && user.currency ? user.currency : 'INR',
    university: '',
    hostelName: '',
    goalTitle: '',
    goalTarget: '',
    goalIcon: GOAL_ICONS[0],
  });

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }));

    // The language is the one answer that has to take effect while the wizard
    // is still open, so it is saved on the spot rather than at the end.
    if (patch.language && patch.language !== form.language) {
      onboardingApi
        .setLanguage(patch.language)
        .then(updateUser)
        .catch(() => {
          // Not worth interrupting setup for: the final save carries it too.
        });
    }
  };

  const finish = async (skipGoal = false) => {
    if (!form.monthlyIncome || Number(form.monthlyIncome) < 0) {
      setStep(STEPS.findIndex((s) => s.key === 'income'));
      return toast.error('Enter your monthly pocket money first');
    }

    setSaving(true);
    try {
      const payload = {
        financeMode: form.financeMode,
        language: form.language,
        monthlyIncome: Number(form.monthlyIncome),
        currency: form.currency,
        university: form.university,
        hostelName: form.hostelName,
      };

      if (!skipGoal && form.goalTitle && Number(form.goalTarget) > 0) {
        payload.goal = {
          title: form.goalTitle,
          targetAmount: Number(form.goalTarget),
          icon: form.goalIcon,
        };
      }

      const data = await onboardingApi.complete(payload);
      updateUser(data.user);
      toast.success('All set. Welcome to Hisab Ki Kitab!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const goForward = () => {
    if (STEPS[step].key === 'income' && !form.monthlyIncome) {
      return toast.error('Enter your monthly pocket money to continue');
    }
    setStep((current) => current + 1);
    return undefined;
  };

  const CurrentStep = STEPS[step].Component;
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-10">
      <WizardHeader steps={STEPS} step={step} />

      <div className="hw-card space-y-5 p-6">
        <CurrentStep form={form} onChange={set} />
      </div>

      <div className="mt-6 flex items-center gap-2">
        {step > 0 && (
          <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((current) => current - 1)}>
            Back
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isLastStep ? (
            <>
              <Button variant="ghost" onClick={() => finish(true)} disabled={saving}>
                Skip for now
              </Button>
              <Button icon={PartyPopper} loading={saving} onClick={() => finish(false)}>
                Finish setup
              </Button>
            </>
          ) : (
            <Button icon={ArrowRight} onClick={goForward}>
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
