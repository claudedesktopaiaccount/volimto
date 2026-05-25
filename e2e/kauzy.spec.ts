import { expect, test } from "@playwright/test";

test.describe("Kauzy map", () => {
  test("starts with a case picker and no map", async ({ page }) => {
    await page.goto("/kauzy");

    await expect(page.getByTestId("kauzy-case-picker")).toBeVisible();
    await expect(page.getByTestId("kauzy-map-shell")).toHaveCount(0);
    await expect(page.locator('[data-testid^="kauzy-select-case-"]').first()).toBeVisible();
  });

  test("filters cases by politician name", async ({ page }) => {
    await page.goto("/kauzy");

    const politicianFilter = page.getByTestId("kauzy-politician-filter");
    const firstPolitician = await politicianFilter.locator("option").nth(1).innerText();
    const initialCount = await page.locator('[data-testid^="kauzy-select-case-"]').count();

    await politicianFilter.selectOption({ label: firstPolitician });

    const filteredCards = page.locator('[data-testid^="kauzy-select-case-"]');
    const filteredCount = await filteredCards.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    for (let index = 0; index < filteredCount; index += 1) {
      await expect(filteredCards.nth(index)).toContainText(firstPolitician);
    }
  });

  test("selects a case and renders the map and case detail", async ({ page }) => {
    await page.goto("/kauzy");
    const { title } = await selectFirstCase(page);

    await expect(page.getByTestId("kauzy-map-shell")).toBeVisible();
    await expect(page.getByTestId("kauzy-map-node").first()).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("complementary")).toContainText("Čo je doložené");
    await expect(page.getByRole("complementary")).toContainText("Toto nie je verdikt aplikácie");
    await expect(page.getByRole("complementary")).toContainText(/obžaloba|podozrenie|rozsudok|zastavené/i);
  });

  test("opens actor info and toggles actor expansion", async ({ page }) => {
    await page.goto("/kauzy");
    await selectFirstCase(page);

    const actor = page.locator('[data-map-node^="actor:"]').first();
    const actorName = await actor.locator("span").nth(1).innerText();
    await expect(actor).toHaveAttribute("aria-expanded", "false");

    await actor.click();
    await expect(actor).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("complementary").getByRole("heading", { name: actorName })).toBeVisible();
    await expect(page.getByRole("complementary")).toContainText("Čo sa mu pripisuje");
    await expect(page.getByRole("complementary").getByRole("link").first()).toBeVisible();

    await actor.click();
    await expect(actor).toHaveAttribute("aria-expanded", "false");
  });

  test("opens connection info and returns to case info", async ({ page }) => {
    await page.goto("/kauzy");
    const { title } = await selectFirstCase(page);

    const connection = page.locator('[data-map-node^="connection:"]').first();
    const connectionName = await connection.locator("span").nth(1).innerText();
    await connection.click();
    await expect(page.getByRole("complementary").getByRole("heading", { name: connectionName })).toBeVisible();

    await page.locator('[data-map-node^="case:"]').first().click();
    await expect(page.getByRole("complementary").getByRole("heading", { name: title })).toBeVisible();
  });

  test("pans with drag and exposes grab cursor", async ({ page }) => {
    await page.goto("/kauzy");
    await selectFirstCase(page);

    const shell = page.getByTestId("kauzy-map-shell");
    const canvas = page.getByTestId("kauzy-map-canvas");
    await shell.scrollIntoViewIfNeeded();
    await expect(shell).toHaveCSS("cursor", "grab");

    const before = await canvas.evaluate((element) => getComputedStyle(element).transform);
    const box = await shell.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + 420, box!.y + 180);
    await page.mouse.down();
    await page.mouse.move(box!.x + 540, box!.y + 250);
    await page.mouse.up();

    const after = await canvas.evaluate((element) => getComputedStyle(element).transform);
    expect(after).not.toBe(before);
  });

  test("toggles fullscreen or the CSS fullscreen fallback", async ({ page }) => {
    await page.goto("/kauzy");
    await selectFirstCase(page);

    await page.getByTestId("kauzy-map-fullscreen").click();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const shell = document.querySelector('[data-testid="kauzy-map-shell"]');
          return Boolean(document.fullscreenElement) || shell?.className.includes("fixed");
        })
      )
      .toBe(true);

    await page.keyboard.press("Escape");
  });

  test("does not overlap map nodes on desktop and small viewports", async ({ page }) => {
    await page.goto("/kauzy");
    await selectFirstCase(page);
    await expectNoLargeNodeOverlaps(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/kauzy");
    await selectFirstCase(page);
    await expect(page.getByTestId("kauzy-map-shell")).toBeVisible();
    await expectNoLargeNodeOverlaps(page);
  });
});

async function selectFirstCase(page: import("@playwright/test").Page) {
  const card = page.locator('[data-testid^="kauzy-select-case-"]').first();
  await expect(card).toBeVisible();
  const title = await card.locator("h2").innerText();
  await card.click();
  return { title };
}

async function expectNoLargeNodeOverlaps(page: import("@playwright/test").Page) {
  const overlaps = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-map-node]")].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.dataset.mapNode ?? "",
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    const result: Array<{ a: string; b: string; area: number }> = [];

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const area = x * y;

        if (area > 2) {
          result.push({ a: a.id, b: b.id, area });
        }
      }
    }

    return result;
  });

  expect(overlaps).toEqual([]);
}
