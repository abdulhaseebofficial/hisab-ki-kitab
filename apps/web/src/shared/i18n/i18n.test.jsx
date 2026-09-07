/**
 * The translation layer, from a reader's side.
 *
 * The key sets are compared in tests/unit/i18n-coverage.test.js. What is left
 * to prove is behaviour: that the right language is picked, that a gap is
 * filled, and above all that a missing translation degrades into English
 * rather than into a dotted key on someone's screen.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, STORAGE_KEY } from './I18nProvider';
import useT from './I18nProvider';

/** A component that only exists to show what t() returned. */
function Says({ k, values }) {
  const { t, language } = useT();
  return (
    <div>
      <span data-testid="said">{t(k, values)}</span>
      <span data-testid="lang">{language}</span>
    </div>
  );
}

const show = (props, k, values) =>
  render(
    <I18nProvider {...props}>
      <Says k={k} values={values} />
    </I18nProvider>
  );

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = '';
});

describe('which language is used', () => {
  it('follows the signed-in profile', () => {
    show({ language: 'roman_ur' }, 'nav.dashboard');
    expect(screen.getByTestId('said')).toHaveTextContent('Khulasa');
  });

  it('falls back to what this browser last used, so the login screen is already right', () => {
    // There is no profile before sign-in. Without this the reader logs in in
    // English every time and only sees their language after the redirect.
    window.localStorage.setItem(STORAGE_KEY, 'roman_ur');
    show({ language: null }, 'nav.dashboard');
    expect(screen.getByTestId('said')).toHaveTextContent('Khulasa');
  });

  it('and to English when nobody has ever chosen', () => {
    show({ language: null }, 'nav.dashboard');
    expect(screen.getByTestId('said')).toHaveTextContent('Dashboard');
  });

  it('ignores a language the app does not have', () => {
    show({ language: 'fr' }, 'nav.dashboard');
    expect(screen.getByTestId('said')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('remembers the profile choice for the next visit', () => {
    show({ language: 'roman_ur' }, 'nav.dashboard');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('roman_ur');
  });

  it('tells the browser and screen reader which language the page is in', () => {
    show({ language: 'roman_ur' }, 'nav.dashboard');
    expect(document.documentElement.lang).toBe('ur-Latn');
  });
});

describe('what t() returns', () => {
  it('fills a placeholder', () => {
    show({ language: 'en' }, 'mode.switched', { mode: 'Householder' });
    expect(screen.getByTestId('said')).toHaveTextContent('Now showing your Householder records');
  });

  it('fills it in Roman Urdu too', () => {
    show({ language: 'roman_ur' }, 'mode.switched', { mode: 'Ghar Ka Hisab' });
    expect(screen.getByTestId('said')).toHaveTextContent('Ab Ghar Ka Hisab ke record dikh rahe hain');
  });

  it('leaves a placeholder nobody supplied visible rather than blanking it', () => {
    // An empty gap reads as a finished sentence with a word missing. A visible
    // {mode} reads as a bug, which is what it is.
    show({ language: 'en' }, 'mode.switched', {});
    expect(screen.getByTestId('said')).toHaveTextContent('{mode}');
  });

  it('never shows a raw key for a key that exists', () => {
    show({ language: 'roman_ur' }, 'udhaar.summary.overdue');
    expect(screen.getByTestId('said')).not.toHaveTextContent('udhaar.');
  });

  it('shows the key only when there is no such string anywhere', () => {
    // Better than an empty label: a blank space in the interface tells the
    // reader nothing, and tells whoever is debugging it even less.
    show({ language: 'en' }, 'nothing.like.this');
    expect(screen.getByTestId('said')).toHaveTextContent('nothing.like.this');
  });
});

describe('outside the provider', () => {
  it('a component still renders English instead of throwing', () => {
    // Components are rendered on their own in tests all over this codebase.
    // Requiring a provider around each one would be a tax on every test file.
    render(<Says k="common.save" />);
    expect(screen.getByTestId('said')).toHaveTextContent('Save');
  });
});
