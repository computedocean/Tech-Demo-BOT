import { expect, test } from "@playwright/test";

test("shows the graph, ranked findings, and minimum fix set", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ranked findings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minimum fix set" })).toBeVisible();
  await expect(page.getByTestId("path-graph")).toBeVisible();
  await expect(page.getByTestId("residual")).toContainText("21 of 21");
  await expect(
    page.getByRole("button", { name: /Ada Okonkwo has a session on NG-FILE01/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Remove AdminTo from All Staff to NG-FILE01" }),
  ).toBeVisible();
  await expect(page.locator("[data-badge='New']").first()).toBeVisible();
  await expect(page.locator("[data-badge='Regressed']").first()).toBeVisible();
  await page.screenshot({ path: "docs/screenshot.png" });
});

test("a fix closes the highlighted path and the timeline shows Fixed", async ({ page }) => {
  await page.goto("/");
  const residual = page.getByTestId("residual");
  const before = await residual.innerText();
  await page.getByRole("switch", { name: "Remove AdminTo from All Staff to NG-FILE01" }).click();
  await expect(page.getByText("This path is closed by a selected fix.")).toBeVisible();
  await expect(residual).not.toHaveText(before);
  await page.getByRole("button", { name: /October collection/ }).click();
  await expect(page.locator("[data-badge='Fixed']").first()).toBeVisible();
});
