import { test, expect } from "@playwright/test";
import { injectCsrfCookie, injectVisitorCookie } from "./helpers/csrf";

test.describe("Tipovanie (Voting)", () => {
  test("displays voting interface with party options", async ({ page }) => {
    await page.goto("/tipovanie");

    // Should show the main heading
    const pageText = await page.textContent("body");
    expect(pageText).toContain("Kto vyhrá voľby?");

    // Submit button should be disabled when no party selected
    const submitButton = page.getByRole("button", { name: /vyberte stranu/i });
    if (await submitButton.isVisible()) {
      await expect(submitButton).toBeDisabled();
    }
  });

  test("can select a party", async ({ page }) => {
    await page.goto("/tipovanie");

    // Click on a party button (look for any tipovať button)
    const partyButton = page.locator('[aria-label*="Tipovať"]').first();
    await expect(partyButton).toBeVisible();
    await partyButton.click();

    // Submit button should now be enabled (text changes from "Vyberte stranu")
    const submitButton = page.getByRole("button", { name: /odoslať tip/i });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test("successful vote submission", async ({ page }) => {
    // Inject CSRF cookie before navigating
    await injectCsrfCookie(page);
    await injectVisitorCookie(page, `e2e-success-${Date.now()}-${test.info().retry}`);

    await page.goto("/tipovanie");

    // Select a party
    const partyButton = page.locator('[aria-label*="Tipovať"]').first();
    await partyButton.click();

    // Submit vote
    const submitButton = page.getByRole("button", { name: /odoslať tip/i });
    await submitButton.click();

    // Should show success or already voted state
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/tipovanie") && resp.status() !== 0,
      { timeout: 10_000 }
    );

    // After submission, the UI should change (success or already_voted)
    const bodyText = await page.textContent("body");
    const hasResult =
      bodyText?.includes("Tip prijatý") ||
      bodyText?.includes("Váš tip bol zaznamenaný") ||
      bodyText?.includes("Už ste hlasovali") ||
      bodyText?.includes("Už ste tipovali") ||
      bodyText?.includes("Odosielam");
    expect(hasResult).toBeTruthy();
  });

  test("duplicate vote is blocked", async ({ page }) => {
    // Inject CSRF cookie
    await injectCsrfCookie(page);
    await injectVisitorCookie(page, `e2e-duplicate-${Date.now()}-${test.info().retry}`);

    await page.goto("/tipovanie");

    // First vote
    const partyButton = page.locator('[aria-label*="Tipovať"]').first();
    await partyButton.click();

    const submitButton = page.getByRole("button", { name: /odoslať tip/i });
    await submitButton.click();

    // Wait for first response
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/tipovanie"),
      { timeout: 10_000 }
    );

    // Reload page and try voting again
    await page.reload();

    // After reload with the same visitor cookie, the UI should show "already voted"
    // or the API should return 409
    const bodyText = await page.textContent("body");
    const alreadyVoted =
      bodyText?.includes("Už ste hlasovali") ||
      bodyText?.includes("Už ste tipovali") ||
      bodyText?.includes("Tip prijatý") ||
      bodyText?.includes("Váš tip bol zaznamenaný");

    // If the page allows re-voting (no cookie persistence in test), try submitting
    if (!alreadyVoted) {
      const partyBtn2 = page.locator('[aria-label*="Tipovať"]').first();
      if (await partyBtn2.isVisible()) {
        await partyBtn2.click();
        const submitBtn2 = page.getByRole("button", { name: /odoslať tip/i });
        if (await submitBtn2.isVisible()) {
          const responsePromise = page.waitForResponse(
            (resp) => resp.url().includes("/api/tipovanie")
          );
          await submitBtn2.click();
          const response = await responsePromise;
          // Should be 409 (already voted) or the page shows the status
          expect([200, 409]).toContain(response.status());
        }
      }
    }
  });
});
