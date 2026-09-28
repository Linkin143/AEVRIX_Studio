import { test, expect } from "@playwright/test";
test("creator can configure a video", async ({ page }) => { await page.goto("/"); await expect(page.getByRole("heading", { name: "Turn an idea into motion." })).toBeVisible(); await page.getByLabel(/Prompt/).fill("A cinematic rooftop restaurant at sunset"); await expect(page.getByRole("button", { name: /Generate video/ })).toBeEnabled(); });
