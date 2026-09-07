import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import PasswordInput from '../../../shared/components/ui/PasswordInput';
import PasswordChecklist from '../../../shared/components/ui/PasswordChecklist';
import useT from '../../../shared/i18n/I18nProvider';

/** Changing the password signs every other device out. */
export default function ChangePasswordModal({ open, onClose, form, onSubmit }) {
  const { t } = useT();
  const { errors, isSubmitting } = form.formState;

  return (
    <Modal open={open} onClose={onClose} title={t('settings.changePassword')} size="sm">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <PasswordInput
          label={t('settings.currentPassword')}
          autoComplete="current-password"
          error={errors.currentPassword && errors.currentPassword.message}
          {...form.register('currentPassword')}
        />
        <div className="space-y-2">
          <PasswordInput
            label={t('auth.newPassword')}
            autoComplete="new-password"
            error={errors.newPassword && errors.newPassword.message}
            {...form.register('newPassword')}
          />
          {/* The hint here used to read "at least 8 characters, with a letter
              and a number", which stopped being true when the policy tightened.
              The checklist reads the policy itself, so it cannot go stale. */}
          <PasswordChecklist value={form.watch('newPassword') || ''} />
        </div>
        <PasswordInput
          label={t('auth.confirmNewPassword')}
          autoComplete="new-password"
          error={errors.confirmPassword && errors.confirmPassword.message}
          {...form.register('confirmPassword')}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
