import useT from './I18nProvider';
// Default import: contracts is CommonJS and Rollup cannot see named exports on it.
import catalogue from '@hisabkikitab/contracts/catalogue';

/**
 * Turns a stored category id into the words a person reads.
 *
 * Before this, charts and report lines rendered the id itself. In student mode
 * that was survivable - the ids happen to be readable English - but a
 * householder's donut legend said "electricity_bill" and "house_rent", which
 * reads as broken data rather than as a category.
 *
 * The mode is not a parameter on purpose. Every row already belongs to one, and
 * rows from the other mode are never on screen; searching both is therefore
 * always correct and saves each caller from having to know which one it is
 * holding. Anything unrecognised comes back exactly as stored, which is what a
 * category the person invented themselves needs.
 *
 *   const label = useCategoryLabel();
 *   label(row.category)              // an expense category
 *   label(row.source, 'income')      // an income source
 */
export default function useCategoryLabel() {
  const { language } = useT();
  return (id, kind = 'expense') => catalogue.labelForAnyMode(kind, id, language);
}
