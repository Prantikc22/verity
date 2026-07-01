import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');
});

test('login - success', async ({ page }) => {
  await page.fill('#username', 'gardener');
  await page.fill('#password', 'Greenhouse123');
  await page.click('#signin');
  await expect(page.locator('text=Welcome back, gardener!')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeVisible();
});

test('login - failure shows error and stays on login', async ({ page }) => {
  await page.fill('#username', 'gardener');
  await page.fill('#password', 'wrong');
  await page.click('#signin');
  await expect(page.locator('#login-error')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
});
