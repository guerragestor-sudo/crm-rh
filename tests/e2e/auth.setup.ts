import { expect, test as setup } from "@playwright/test";

import { login, USERS } from "./helpers";

for (const [role, user] of Object.entries(USERS)) {
  setup(`autentica ${role}`, async ({ page }) => {
    await login(page, user.email);
    await expect(page).toHaveURL(/\/inicio$/);
    await page.context().storageState({ path: user.file });
  });
}
