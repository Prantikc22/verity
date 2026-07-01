import { test, expect } from '@playwright/test';

test('Home page loads successfully and main elements are visible', async ({ page }) => {
  await test.step('Navigate to the home page', async () => {
    await page.goto('http://localhost:3000');
  });

  await test.step('Verify the page title is "Home"', async () => {
    await expect(page).toHaveTitle('Home');
  });

  await test.step('Check that the main heading "Welcome to Our Site" is visible', async () => {
    await expect(page.getByRole('heading', { name: 'Welcome to Our Site' }).first()).toBeVisible();
  });

  await test.step('Ensure the "Get Started" button is visible', async () => {
    await expect(page.getByRole('button', { name: 'Get Started' }).first()).toBeVisible();
  });

  await test.step('Confirm the "Contact Us" link is present', async () => {
    await expect(page.getByRole('link', { name: 'Contact Us' }).first()).toBeVisible();
  });
});
