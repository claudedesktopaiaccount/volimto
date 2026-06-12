import { test, expect } from "@playwright/test";

test.describe("Metodika", () => {
  test("renders the methodology page", async ({ page }) => {
    await page.goto("/metodika");

    await expect(
      page.getByRole("heading", {
        name: /Ako z verejných dát skladáme čitateľný obraz slovenskej politiky/i,
      })
    ).toBeVisible();
    await expect(page.getByTestId("methodology-party-lab")).toBeVisible();
  });

  test("anchor navigation opens data sources", async ({ page }) => {
    await page.goto("/metodika");

    await page.getByRole("link", { name: "Zdroje dát" }).first().click();
    await expect(page).toHaveURL(/#zdroje-dat$/);
    await expect(page.getByRole("heading", { name: "Každá vrstva má iný pôvod a inú mieru istoty" })).toBeVisible();
  });

  test("poll age slider updates the weight indicator", async ({ page }) => {
    await page.goto("/metodika");

    const slider = page.getByRole("slider", { name: "Vek prieskumu v dňoch" });
    const bar = page.getByTestId("poll-weight-bar");
    const before = await bar.evaluate((el) => getComputedStyle(el).width);

    await slider.fill("90");

    const after = await bar.evaluate((el) => getComputedStyle(el).width);
    expect(after).not.toBe(before);
    await expect(page.getByText(/Aktuálna váha: 13 %/)).toBeVisible();
  });

  test("party percentage slider recalculates seats", async ({ page }) => {
    await page.goto("/metodika");

    const snsRow = page.getByTestId("party-row-sns");
    await expect(snsRow.getByText(/mandátov/)).toBeVisible();

    await page.getByRole("slider", { name: "Percentá SNS" }).fill("4.0");

    await expect(snsRow.getByText("pod prahom")).toBeVisible();
    await expect(page.getByText("Resetovať demo")).toBeVisible();
  });

  test("footer links point to methodology and data sources", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Metodika" })).toHaveAttribute("href", "/metodika");
    await expect(footer.getByRole("link", { name: "Zdroje dát" })).toHaveAttribute(
      "href",
      "/metodika#zdroje-dat"
    );
  });
});
