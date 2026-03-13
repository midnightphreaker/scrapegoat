import { expect, test } from "@playwright/test";

test.describe("Scrapegoat Full Flow", () => {
  test("scrape form can be filled and submitted", async ({ page }) => {
    await page.goto("/");

    const urlInput = page.getByPlaceholder(/url/i);
    await urlInput.fill("https://httpbin.org");
    await expect(urlInput).toHaveValue("https://httpbin.org");

    const libInput = page.getByLabel(/library/i);
    await libInput.fill("test-lib");
    await expect(libInput).toHaveValue("test-lib");

    const submitBtn = page.getByRole("button", { name: /queue/i });
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();
  });

  test("navigate to library from home", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Indexed Libraries")).toBeVisible();

    const libraryLink = page.getByRole("link").filter({ hasText: /react/i }).first();
    if (await libraryLink.isVisible()) {
      await libraryLink.click();
      await expect(page).toHaveURL(/\/libraries\//);
    }
  });

  test("home page displays all key sections", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /scrape documentation/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /job queue/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /indexed libraries/i })).toBeVisible();
  });

  test("scrape form validation", async ({ page }) => {
    await page.goto("/");

    const submitBtn = page.getByRole("button", { name: /queue/i });
    await expect(submitBtn).toBeVisible();

    const urlInput = page.getByPlaceholder(/url/i);
    const libInput = page.getByLabel(/library/i);

    await expect(urlInput).toBeVisible();
    await expect(libInput).toBeVisible();
  });

  test("library list loads on home page", async ({ page }) => {
    await page.goto("/");

    const librariesSection = page
      .locator("section")
      .filter({ hasText: "Indexed Libraries" });
    await expect(librariesSection).toBeVisible();
  });

  test("job list displays on home page", async ({ page }) => {
    await page.goto("/");

    const jobQueueSection = page.locator("section").filter({ hasText: "Job Queue" });
    await expect(jobQueueSection).toBeVisible();
  });
});
