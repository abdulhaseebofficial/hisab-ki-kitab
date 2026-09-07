/**
 * The one call the wizard makes.
 *
 * The profile endpoint is shared - Settings writes the same record - so the
 * request itself lives in shared/api. This names the one thing onboarding does
 * with it, so the page reads as a step rather than a REST call.
 */

import profileApi from '../../../shared/api/profileApi';

const onboardingApi = {
  /**
   * Saves the profile and, optionally, a first goal, in one request.
   * Returns `{ user, goal }` - the goal is null when the student skipped it.
   */
  complete: (payload) => profileApi.completeOnboarding(payload),

  /**
   * Saves the language as soon as it is picked, before the wizard is finished.
   *
   * Without this the rest of setup stays in the language the person just said
   * they do not want, which is a strange thing to do to someone immediately
   * after asking. It is one small request, and the same profile field the
   * final save would have written anyway.
   */
  setLanguage: (language) => profileApi.update({ language }),
};

export default onboardingApi;
