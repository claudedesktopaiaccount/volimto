import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("renders page with key sections", async ({ page }) => {
    await page.goto("/");

    // Page should load without errors
    await expect(page).toHaveTitle(/Vol.mTo/i);

    // Hero section should be visible
    const hero = page.locator("main");
    await expect(hero).toBeVisible();

    // Should display party names in the page
    const pageText = await page.textContent("body");
    expect(pageText).toContain("Smer");
    expect(pageText).toContain("PS");
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");

    // Click on Prieskumy link
    const prieskumyLink = page.locator('a[href="/prieskumy"]').first();
    await expect(prieskumyLink).toBeVisible();
    await prieskumyLink.click();

    await expect(page).toHaveURL("/prieskumy");
  });

  test("all main navigation routes are accessible", async ({ page }) => {
    await page.goto("/");

    // Check that key navigation links exist
    const routes = ["/prieskumy", "/predikcia", "/tipovanie", "/koalicny-simulator"];
    for (const route of routes) {
      const link = page.locator(`a[href="${route}"]`).first();
      await expect(link).toBeVisible();
    }
  });
});
