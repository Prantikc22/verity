import { test, expect } from '@playwright/test';

test('Navigation links resolve correctly to their target pages', async ({ page }) => {
  // Step 1: Navigate to the homepage and verify the URL is correct.
  await page.goto('http://localhost:3000');
  await expect(page).toHaveURL(/localhost:3000/);

  // Step 2: Click the 'Home' link and confirm the URL is correct for the homepage.
  await test.step('Verify Home link', async () => {
    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(page).toHaveURL(/localhost:3000/);
  });

  // Step 3: Click the 'About Us' link and confirm the URL is correct for the About Us page.
  await test.step('Verify About Us link', async () => {
    await page.getByRole('link', { name: 'About Us' }).first().click();
    await expect(page).toHaveURL(/about-us/);
  });

  // Step 4: Click the 'Services' link and confirm the URL is correct for the Services page.
  await test.step('Verify Services link', async () => {
    await page.getByRole('link', { name: 'Services' }).first().click();
    await expect(page).toHaveURL(/services/);
  });

  // Step 5: Click the 'Contact' link and confirm the URL is correct for the Contact page.
  await test.step('Verify Contact link', async () => {
    await page.getByRole('link', { name: 'Contact' }).first().click();
    await expect(page).toHaveURL(/contact/);
  });
});
