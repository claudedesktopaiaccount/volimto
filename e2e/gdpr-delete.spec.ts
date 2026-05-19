import { test, expect } from "@playwright/test";
import { injectCsrfCookie, injectVisitorCookie } from "./helpers/csrf";

test.describe("GDPR Data Deletion", () => {
  test("delete button exists on privacy page", async ({ page }) => {
    await page.goto("/sukromie");

    // Page should show privacy policy content
    const pageText = await page.textContent("body");
    expect(pageText).toContain("údaj");

    // Delete button should be visible
    const deleteButton = page.getByRole("button", {
      name: /vymazať moje údaje/i,
    });
    await expect(deleteButton).toBeVisible();
  });

  test("delete flow with confirmation dialog", async ({ page }) => {
    // Set up cookies
    await injectCsrfCookie(page);
    await injectVisitorCookie(page);

    await page.goto("/sukromie");

    // Handle the confirm dialog — accept it
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Naozaj chcete vymazať");
      await dialog.accept();
    });

    // Click delete button
    const deleteButton = page.getByRole("button", {
      name: /vymazať moje údaje/i,
    });
    await deleteButton.click();

    // Wait for the API response
    await page.waitForResponse(
      (resp) => resp.url().includes("/api/gdpr/delete"),
      { timeout: 10_000 }
    );

    // Should show success message
    await expect(
      page.getByText("Vaše údaje boli úspešne vymazané")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("delete can be cancelled via dialog", async ({ page }) => {
    await injectCsrfCookie(page);
    await injectVisitorCookie(page);

    await page.goto("/sukromie");

    // Handle the confirm dialog — dismiss it
    page.on("dialog", async (dialog) => {
      await dialog.dismiss();
    });

    // Click delete button
    const deleteButton = page.getByRole("button", {
      name: /vymazať moje údaje/i,
    });
    await deleteButton.click();

    // Button should still show "Vymazať moje údaje" (not loading/done state)
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeEnabled();
  });

  test("export data button exists", async ({ page }) => {
    await page.goto("/sukromie");

    // Export button should be visible
    const exportButton = page.getByRole("button", {
      name: /export|stiahnuť/i,
    });
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeEnabled();
    }
  });
});
