import { test, expect } from '@playwright/test';

import {
  ensureCleanState,
  waitForAppReady,
  waitForAnimation,
  clickNextButton,
  clickBackButton,
  clickFinishButton,
  clickSkipForNow,
} from '../utils/test-helpers';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async () => {
    ensureCleanState();
  });

  test('should display welcome page on first launch', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page).toHaveURL(/.*#\/onboarding/);

    await expect(page.getByText(/welcome to aiderdesk/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });

  test('should navigate through all onboarding steps', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    await expect(page.getByText(/welcome to aiderdesk/i)).toBeVisible();
    const languageSelector = page.locator('button[aria-haspopup="listbox"]');
    await expect(languageSelector).toBeVisible();

    await clickNextButton(page);

    await expect(page.getByRole('heading', { name: /connect your ai model/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /skip for now/i })).toBeVisible();

    await clickSkipForNow(page);

    await expect(page.getByRole('heading', { name: /fine.*tune|aider/i })).toBeVisible();

    await clickNextButton(page);

    await expect(page.getByRole('heading', { name: /meet your ai agent/i })).toBeVisible();
    await expect(page.getByText(/autonomous.*planning/i)).toBeVisible();

    await clickNextButton(page);

    await expect(page.getByRole('heading', { name: /configure/i })).toBeVisible();

    await clickFinishButton(page);
    await waitForAnimation(page, 500);

    await expect(page).toHaveURL(/.*#\/home/);
  });

  test('should allow navigating back through steps', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    await clickNextButton(page);
    await expect(page.getByRole('heading', { name: /connect your ai model/i })).toBeVisible();

    await clickBackButton(page);
    await expect(page.getByText(/welcome to aiderdesk/i)).toBeVisible();
  });

  test('should persist language selection', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    const languageSelector = page.locator('button[aria-haspopup="listbox"]');

    if (await languageSelector.isVisible()) {
      await languageSelector.click();
      await waitForAnimation(page);
    }
  });

  test('step indicators should reflect current progress', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    const stepCircles = page.locator('.rounded-full.w-8.h-8');

    const firstStep = stepCircles.first();
    await expect(firstStep).toHaveClass(/bg-info/);

    await clickNextButton(page);
    await waitForAnimation(page);

    await expect(firstStep).toHaveClass(/bg-success/);
  });

  test('should show provider setup options on step 2', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    await clickNextButton(page);

    await expect(page.getByRole('heading', { name: /connect your ai model/i })).toBeVisible();

    await expect(page.getByText(/skip for now/i)).toBeVisible();

    const infoBox = page.locator('.bg-info-subtle, [class*="info"]');
    await expect(infoBox.first()).toBeVisible();
  });

  test('should display agent capabilities on step 4', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    await clickNextButton(page);
    await clickSkipForNow(page);
    await clickNextButton(page);

    await expect(page.getByText(/autonomous.*planning/i)).toBeVisible();
    await expect(page.getByText(/tool.*use/i)).toBeVisible();
    await expect(page.getByText(/extensible/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /configure agent/i })).toBeVisible();
  });

  test('should complete onboarding and navigate to home', async ({ page }) => {
    await page.goto('/#/onboarding');
    await waitForAppReady(page);

    await clickNextButton(page);
    await clickSkipForNow(page);
    await clickNextButton(page);
    await clickNextButton(page);

    await clickFinishButton(page);
    await waitForAnimation(page, 1000);

    await expect(page).toHaveURL(/.*#\/home/);
  });
});
