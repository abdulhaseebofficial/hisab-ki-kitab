import { KIND_STYLE, STATUS_KEY, STATUS_STYLE, displayStatus } from '../utils/debtDisplay';
import useT from '../../../shared/i18n/I18nProvider';
import { cn } from '../../../shared/utils/format';

/** Whether the student owes this person or the other way round. */
export function KindBadge({ kind }) {
  const { t } = useT();
  // BORROWED and LENT are what the database stores; "You owe" and "Owed to
  // you" are what a person reads. The two are kept apart deliberately, so a
  // language change never touches a stored value.
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', KIND_STYLE[kind])}>
      {t(kind === 'BORROWED' ? 'udhaar.payableShort' : 'udhaar.receivableShort')}
    </span>
  );
}

/** Pending, part paid, settled or overdue - always with the word, not just a colour. */
export function StatusBadge({ debt }) {
  const { t } = useT();
  const status = displayStatus(debt);
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', STATUS_STYLE[status])}>
      {t(`udhaar.status.${STATUS_KEY[status]}`)}
    </span>
  );
}
