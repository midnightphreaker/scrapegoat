import { expect, test } from "@playwright/test";

test("home page displays scrape form and job queue", async ({ page }) => {
  await page.goto("/");

  // Should have URL input
  await expect(page.getByPlaceholder(/url/i)).toBeVisible();

  // Should have library name input
  await expect(page.getByLabel(/library/i)).toBeVisible();

  // Should have submit button
  await expect(page.getByRole("button", { name: /queue/i })).toBeVisible();
});
