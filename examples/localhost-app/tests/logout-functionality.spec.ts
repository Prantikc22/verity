import { test, expect } from '@playwright/test';

test('User can log out successfully and session is terminated', async ({ page }) => {
  // Step 1: Navigate to the homepage and verify the 'Log in' button is visible.
  await page.goto('http://localhost:3000');
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible();

  // Step 2: Log in using the provided credentials and confirm successful login by checking the presence of a 'Log out' button.
  await page.getByRole('button', { name: 'Log in' }).first().click();
  await page.getByLabel('Username').fill('student');
  await page.getByLabel('Password').fill('Password123');
  await page.getByRole('button', { name: 'Submit' }).first().click();
  await expect(page.getByRole('button', { name: 'Log out' }).first()).toBeVisible();

  // Step 3: Click the 'Log out' button and verify that the user is redirected to the homepage.
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await expect(page).toHaveURL(/localhost:3000/i);

  // Step 4: Confirm that the session is terminated by checking the visibility of the 'Log in' button again.
  await expect(page.getByRole('button', { name: 'Log in' }).first()).toBeVisible();
});
