import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { FileBarChart, HandCoins, LayoutDashboard, PieChart, Receipt, Settings, Sparkles, Target, Wallet, X } from 'lucide-react';
import useT from '../../shared/i18n/I18nProvider';
import { cn } from '../../shared/utils/format';

export const NAV_ITEMS = [
  // `key` is the translation key, not the label: the route stays the same in
  // both languages and only the word on it changes.
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/expenses', key: 'expenses', icon: Receipt },
  { to: '/income', key: 'income', icon: Wallet },
  { to: '/goals', key: 'goals', icon: Target },
  { to: '/debts', key: 'udhaar', icon: HandCoins },
  { to: '/budget', key: 'budget', icon: PieChart },
  { to: '/advisor', key: 'advisor', icon: Sparkles },
  { to: '/reports', key: 'reports', icon: FileBarChart },
  { to: '/settings', key: 'settings', icon: Settings },
];

/**
 * The mobile tab bar shows FOUR screens, not five: the middle slot is the
 * raised "add expense" button. Logging a purchase is the thing a student does
 * many times a day, and it should never cost a scroll to the top of a page.
 * The two shown on each side are the most visited; everything else is one tap
 * away in the drawer.
 */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  ['/dashboard', '/expenses', '/goals', '/advisor'].includes(item.to)
);

function NavItems({ onNavigate, mode }) {
  const items = mode === 'shared_living' ? NAV_ITEMS.filter((item) => ['/dashboard', '/settings'].includes(item.to)) : NAV_ITEMS;
  const { t } = useT();

  return (
    <nav className="space-y-1">
      {items.map(({ to, key, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) => cn('hw-nav-item', isActive && 'hw-nav-item-active')}
        >
          {({ isActive }) => (
            <>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {t(`nav.${key}`)}
              {/* Announced by screen readers; "active" styling alone says nothing. */}
              {isActive && <span className="sr-only">{t('nav.currentPage')}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Desktop rail plus the mobile drawer. Both render the same list so a new
 * screen only has to be added to NAV_ITEMS once.
 */
export default function Sidebar({ open, onClose, mode }) {
  const { t } = useT();
  /*
   * While the drawer is open the page behind it must not scroll: on a phone,
   * dragging the overlay otherwise moves the page underneath and the student
   * closes the menu to find themselves somewhere else. The previous value is
   * restored rather than assumed to be '', so this cannot fight anything else
   * that manages scrolling.
   */
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/*
        Desktop rail. `h-full` inside the shell's fixed-height row is what keeps
        it still while the page moves: the rail is exactly as tall as the
        viewport and never taller, so there is nothing for the page scroll to
        move. `sticky top-4` used to do this job approximately - the rail slid
        upward until it caught, which looked like a bug on short pages.
        overflow-y-auto is the escape hatch for a viewport shorter than the nav
        list, so a small laptop still reaches Settings.
      */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-canvas-card px-3 py-4 lg:block lg:h-full dark:border-slate-800 dark:bg-canvas-darkCard">
        <NavItems mode={mode} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <aside className="relative z-10 h-full w-64 animate-slide-up overflow-y-auto border-r border-slate-200 bg-canvas-card px-3 py-4 dark:border-slate-800 dark:bg-canvas-darkCard">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Menu</span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('nav.closeMenu')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={onClose} mode={mode} />
          </aside>
        </div>
      )}
    </>
  );
}
