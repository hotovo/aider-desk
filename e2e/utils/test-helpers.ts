import fs from 'fs';
import path from 'path';

import { Page, expect } from '@playwright/test';

import { testConfig } from '../playwright.config';

export const resetOnboardingState = (): void => {
  const setupCompleteFile = path.join(testConfig.dataDir, 'setup-complete');
  if (fs.existsSync(setupCompleteFile)) {
    fs.unlinkSync(setupCompleteFile);
  }
};

export const ensureCleanState = (): void => {
  resetOnboardingState();
};

export const waitForAppReady = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle');
};

export const waitForAnimation = async (page: Page, ms = 300): Promise<void> => {
  await page.waitForTimeout(ms);
};

export const navigateToOnboarding = async (page: Page): Promise<void> => {
  await page.goto('/#/onboarding');
  await waitForAppReady(page);
};

export const expectOnboardingStep = async (page: Page, stepNumber: number): Promise<void> => {
  const stepIndicators = page.locator('.rounded-full');
  const currentStep = stepIndicators.nth(stepNumber - 1);
  await expect(currentStep).toHaveClass(/bg-info/);
};

export const clickNextButton = async (page: Page): Promise<void> => {
  const nextButton = page.getByRole('button', { name: /next|configure agent/i });
  await nextButton.click();
  await waitForAnimation(page);
};

export const clickBackButton = async (page: Page): Promise<void> => {
  const backButton = page.getByRole('button', { name: /back/i });
  await backButton.click();
  await waitForAnimation(page);
};

export const clickFinishButton = async (page: Page): Promise<void> => {
  const finishButton = page.getByRole('button', { name: /finish/i });
  await finishButton.click();
  await waitForAnimation(page);
};

export const clickSkipForNow = async (page: Page): Promise<void> => {
  const skipButton = page.getByRole('button', { name: /skip for now/i });
  await skipButton.click();
  await waitForAnimation(page);
};

export const getTestDataPath = (filename: string): string => {
  return path.join(testConfig.dataDir, filename);
};

export const setupCompleteFileExists = (): boolean => {
  return fs.existsSync(getTestDataPath('setup-complete'));
};
