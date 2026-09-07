/**
 * The shape of the wizard, per kind of life.
 *
 * A householder used to be walked through "Where you study" and asked for a
 * university and a hostel block. Skipping it was possible; being asked at all
 * was the problem - it is the app telling somebody it has not understood who
 * they are.
 *
 * These check the step list rather than the rendered wizard, because the list
 * IS the decision. What renders follows from it.
 */

import { describe, it, expect } from 'vitest';
import { stepsFor } from './OnboardingPage';

const keys = (mode) => stepsFor(mode).map((step) => step.key);

describe('which steps each person is asked', () => {
  it('a student is asked where they study', () => {
    expect(keys('student')).toEqual(['setup', 'income', 'place', 'goal']);
  });

  it('a householder is not', () => {
    expect(keys('householder')).toEqual(['setup', 'income', 'goal']);
    expect(keys('householder')).not.toContain('place');
  });

  it('and the wizard is genuinely shorter, not just missing a page', () => {
    // A hidden-but-counted step leaves the progress header claiming four when
    // there are three, which reads as a step that failed to load.
    expect(stepsFor('householder')).toHaveLength(3);
    expect(stepsFor('student')).toHaveLength(4);
  });

  it('every remaining step still has what the header needs to draw it', () => {
    for (const mode of ['student', 'householder']) {
      for (const step of stepsFor(mode)) {
        expect(step.key).toBeTruthy();
        expect(step.titleKey).toMatch(/^onboarding\./);
        expect(step.icon).toBeTruthy();
        expect(step.Component).toBeTruthy();
      }
    }
  });

  it('the money step is never dropped, whoever is asked', () => {
    // It is the one figure the rest of the app is sized against.
    for (const mode of ['student', 'householder', 'anything-else']) {
      expect(keys(mode)).toContain('income');
    }
  });

  it('an unrecognised mode is treated as not-a-student rather than crashing', () => {
    expect(keys(undefined)).not.toContain('place');
    expect(keys(undefined).length).toBeGreaterThan(0);
  });
});
