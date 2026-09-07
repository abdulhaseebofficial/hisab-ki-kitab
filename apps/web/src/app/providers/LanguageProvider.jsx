import { I18nProvider } from '../../shared/i18n/I18nProvider';
import { useAuth } from '../../features/auth/index';

/**
 * Joins the signed-in profile to the translation layer.
 *
 * I18nProvider lives in shared/ and so cannot know about auth - shared code
 * importing a feature is exactly the layering the boundary check exists to
 * stop. It takes a language instead, and this is the one place that knows
 * where to get one.
 *
 * Before sign-in there is no profile, and the provider falls back to whatever
 * was last stored in this browser. That is what keeps the login screen in the
 * reader's language rather than flipping to it a second after the dashboard
 * loads.
 */
export default function LanguageProvider({ children }) {
  const { user } = useAuth();
  return <I18nProvider language={user ? user.language : null}>{children}</I18nProvider>;
}
