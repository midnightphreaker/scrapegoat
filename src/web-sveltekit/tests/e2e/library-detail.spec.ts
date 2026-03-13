import { expect, test } from "@playwright/test";

test("library detail page shows search form", async ({ page }) => {
  await page.goto("/libraries/react");

  // Should show library name
  await expect(page.getByRole("heading", { name: /react/i })).toBeVisible();

  // Should have search input
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
});
