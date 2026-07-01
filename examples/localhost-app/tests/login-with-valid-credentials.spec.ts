import { test, expect } from '@playwright/test';

test('Verifies that users can log in with correct credentials and are redirected to dashboard', async ({ page }) => {
  await test.step('Navigate to the login page', async () => {
    await page.goto('http://localhost:3000/login');
  });

  await test.step('Enter the correct username and password', async () => {
    await page.getByLabel('Username').fill('correctUsername');
    await page.getByLabel('Password').fill('correctPassword');
  });

  await test.step("Click the 'Log In' button", async () => {
    await page.getByRole('button', { name: 'Log In' }).first().click();
  });

  await test.step('Verify that the user is redirected to the dashboard page', async () => {
    await expect(page).toHaveURL(/dashboard/i);
  });
});
