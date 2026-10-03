import { test, expect } from "@playwright/test";

test("admin login rejects invalid credentials and accepts achu / 1234", async ({
  page,
}) => {
  // 1. Visit admin login page
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Welcome to Achu." }),
  ).toBeVisible();
  await expect(page.getByText("Sign in with Admin ID")).toBeVisible();

  // 2. Try invalid credentials
  await page.getByLabel("Admin ID or Email").fill("wronguser");
  await page.getByLabel("Password").fill("wrongpass");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(
    page.getByText("The admin ID or password is incorrect."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);

  // 3. Try correct credentials: Admin ID: achu, Pass: 1234
  await page.getByLabel("Admin ID or Email").fill("achu");
  await page.getByLabel("Password").fill("1234");
  await page.getByRole("button", { name: "Sign in securely" }).click();

  // 4. Verify redirected to dashboard and authenticated
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Welcome to your collection." }),
  ).toBeVisible();
  await expect(
    page.getByText("ACHU DESIGNER BOUTIQUE · OWNER’S SPACE"),
  ).toBeVisible();

  // 5. Navigate to Products page while authenticated
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/products/);
  await expect(
    page.getByRole("heading", { name: "Your collection" }),
  ).toBeVisible();

  // 6. Sign out
  const mobileMenu = page.getByRole("button", {
    name: "Open owner navigation",
  });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });

  // 7. Protected route redirects to login after sign out
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });
});
