import { test, expect } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL || "http://127.0.0.1:8000/api/v1";

test.describe("KPM smoke", () => {
  test("signup → dashboard → inventory", async ({ page, request }) => {
    const health = await request.get(`${API}/health`).catch(() => null);
    test.skip(!health || !health.ok(), "Backend not reachable — start API before Playwright smoke");

    const email = `e2e-${Date.now()}@kpm.test`;
    const password = "password123";

    await page.goto("/signup");
    await page.locator('input[type="email"]').first().fill(email);
    const texts = page.locator('input[type="text"]');
    if (await texts.count()) await texts.first().fill("E2E User");
    const passwords = page.locator('input[type="password"]');
    await passwords.first().fill(password);
    if ((await passwords.count()) > 1) await passwords.nth(1).fill(password);
    const company = page.getByPlaceholder(/Acme|Business|Company|organization/i);
    if (await company.count()) await company.first().fill("E2E Co");

    await page.getByRole("button", { name: /create account|sign up|get started/i }).first().click();
    await page.waitForURL(/dashboard|signin/, { timeout: 25000 });

    if (page.url().includes("signin")) {
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.getByRole("button", { name: /sign in/i }).first().click();
      await page.waitForURL(/dashboard/, { timeout: 20000 });
    }

    await page.goto("/inventory");
    await expect(page.locator("body")).toContainText(/inventory|product|stock/i, { timeout: 15000 });

    const addBtn = page.getByRole("button", { name: /add product|new product|add item/i }).first();
    if (await addBtn.count()) {
      await addBtn.click();
      const modalName = page.getByPlaceholder(/product name|name/i).first();
      if (await modalName.count()) {
        await modalName.fill(`E2E Widget ${Date.now()}`);
        const sku = page.getByPlaceholder(/sku/i).first();
        if (await sku.count()) await sku.fill(`E2E-${Date.now()}`);
        await page.getByRole("button", { name: /save|create|add/i }).last().click();
      }
    }
  });
});
