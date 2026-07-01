import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('#username', 'gardener');
  await page.fill('#password', 'Greenhouse123');
  await page.click('#signin');
  await expect(page.locator('text=Welcome back, gardener!')).toBeVisible();
});

test('add plant appears in list', async ({ page }) => {
  await page.fill('#plant', 'Basil');
  await page.click('#add');
  await expect(page.locator('#list >> text=Basil')).toBeVisible();
});

test('logout clears list', async ({ page }) => {
  await page.fill('#plant', 'Parsley');
  await page.click('#add');
  await expect(page.locator('#list >> text=Parsley')).toBeVisible();
  await page.click('#nav-logout');
  await expect(page.locator('#list')).toBeEmpty();
  await expect(page.locator('#dashboard')).toBeHidden();
  await expect(page.locator('#login')).toBeVisible();
});
