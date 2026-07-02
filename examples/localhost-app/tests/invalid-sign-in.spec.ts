import { test, expect } from '@playwright/test';

async function login(page, username = 'gardener', password = 'Greenhouse123') {
  await page.goto('http://localhost:3000');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#signin');
  await expect(page.locator('text=Welcome back, gardener!')).toBeVisible();
}

test('shows an error for invalid credentials and keeps the user on the login screen', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('#username', 'wronguser');
  await page.fill('#password', 'wrongpass');
  await page.click('#signin');

  await expect(page.locator('#login-error')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
  await expect(page.locator('#login')).toBeVisible();
});

test('does not add a plant when the name is empty', async ({ page }) => {
  await login(page);
  await page.click('#add');

  await expect(page.locator('#list')).toBeEmpty();
  await expect(page.locator('#list .item')).toHaveCount(0);
});

test('logout returns to the login screen and clears the plant list', async ({ page }) => {
  await login(page);
  await page.fill('#plant', 'Basil');
  await page.click('#add');
  await expect(page.locator('#list >> text=Basil')).toBeVisible();

  await page.click('#nav-logout');

  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#dashboard')).toBeHidden();
  await expect(page.locator('#list')).toBeEmpty();
  await expect(page.locator('#username')).toHaveValue('');
});