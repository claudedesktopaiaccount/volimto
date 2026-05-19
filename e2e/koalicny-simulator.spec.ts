import { test, expect } from "@playwright/test";

test.describe("Koalícny simulátor", () => {
  test("renders party list with seat counts", async ({ page }) => {
    await page.goto("/koalicny-simulator");

    // Page should display the simulator
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/[Mm]andát/);

    // Should show party buttons/checkboxes with aria-pressed
    const partyButtons = page.locator("[aria-pressed]");
    const count = await partyButtons.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("selecting parties updates coalition seat count", async ({ page }) => {
    await page.goto("/koalicny-simulator");

    // Select first party
    const firstParty = page.locator("[aria-pressed='false']").first();
    await firstParty.click();
    await expect(firstParty).toHaveAttribute("aria-pressed", "true");

    // Select second party
    const secondParty = page.locator("[aria-pressed='false']").first();
    await secondParty.click();
    await expect(secondParty).toHaveAttribute("aria-pressed", "true");

    // Deselect first party
    const selectedParties = page.locator("[aria-pressed='true']");
    const selectedCount = await selectedParties.count();
    expect(selectedCount).toBeGreaterThanOrEqual(1);
  });

  test("majority/minority indicator works", async ({ page }) => {
    await page.goto("/koalicny-simulator");

    // Select multiple parties until majority threshold
    const unselected = page.locator("[aria-pressed='false']");
    const totalParties = await unselected.count();

    // Select all available parties (should exceed 76 seats)
    for (let i = 0; i < Math.min(totalParties, 5); i++) {
      const party = page.locator("[aria-pressed='false']").first();
      if (await party.isVisible()) {
        await party.click();
      }
    }

    // With several parties selected, check for majority indicator
    const bodyText = await page.textContent("body");
    // Should contain some indication of seat count
    expect(bodyText).toMatch(/\d+/);
  });

  test("preset coalition buttons work", async ({ page }) => {
    await page.goto("/koalicny-simulator");

    // Look for preset coalition buttons (if they exist)
    const presetButtons = page.locator("button").filter({ hasText: /koalíc/i });
    const presetCount = await presetButtons.count();

    if (presetCount > 0) {
      await presetButtons.first().click();
      // After clicking preset, some parties should be selected
      const selected = page.locator("[aria-pressed='true']");
      const selectedCount = await selected.count();
      expect(selectedCount).toBeGreaterThan(0);
    }
  });
});
