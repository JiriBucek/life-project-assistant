import { test, expect } from "@playwright/test";
import {
  DEFAULT_USER,
  attachSession,
  createUser,
  prisma,
  resetDatabase,
  signInAs,
} from "./auth";

/**
 * Accounts: signing in, signing out, and — the point of the whole exercise —
 * that one person's life map is invisible to another.
 */

test.beforeEach(async () => {
  await resetDatabase();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("a signed-out visitor is sent to the login screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email")).toBeVisible();

  // Deep links are protected too, not just the home page.
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
});

test("signing in with the form lands on the life map, and signing out returns", async ({
  page,
}) => {
  await createUser(DEFAULT_USER);

  await page.goto("/login");
  await page.getByLabel("Email").fill(DEFAULT_USER.email);
  await page.getByLabel("Password").fill(DEFAULT_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByText("Where would you like to begin today?"),
  ).toBeVisible();

  // The header says who you are and offers the way out.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session is really gone — going back doesn't restore it.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("a wrong password is refused, and says nothing about who has an account", async ({
  page,
}) => {
  await createUser(DEFAULT_USER);
  await page.goto("/login");

  // Wrong password for a real account.
  await page.getByLabel("Email").fill(DEFAULT_USER.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // By test id, not role — Next's own route announcer is also role="alert".
  const failure = page.getByTestId("login-error");
  await expect(failure).toBeVisible();
  const realAccountMessage = await failure.textContent();
  await expect(page).toHaveURL(/\/login$/);

  // An address with no account at all gets the identical message, so the form
  // can't be used to find out who is registered.
  await page.getByLabel("Email").fill("nobody@luma.local");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(failure).toBeVisible();
  expect(await failure.textContent()).toBe(realAccountMessage);
});

test("the login screen offers Google sign-in, politely declined while unconfigured", async ({
  page,
}) => {
  await page.goto("/login");
  const google = page.getByRole("link", { name: "Continue with Google" });
  await expect(google).toBeVisible();
  await expect(google).toHaveAttribute("href", "/api/auth/google");

  // The test server runs with Google switched off (see playwright.config.ts),
  // so the button's whole journey is: through the proxy without a session
  // cookie, into the start route, and straight back with a friendly notice.
  await google.click();
  await expect(page).toHaveURL(/\/login\?notice=google-off$/);
  await expect(page.getByTestId("google-notice")).toContainText(
    "isn't switched on here yet",
  );
});

test("a broken Google callback lands back on the login screen, not an error page", async ({
  page,
}) => {
  // No flow cookie, forged parameters — the strictest failure path.
  await page.goto("/api/auth/google/callback?code=forged&state=forged");
  await expect(page).toHaveURL(/\/login\?notice=google-failed$/);
  await expect(page.getByTestId("google-notice")).toContainText(
    "didn't finish this time",
  );
});

test("two people never see each other's life map", async ({ page }) => {
  // Ana signs in and maps an area with a value.
  await signInAs(page, {
    email: "ana@luma.local",
    password: "ana-password",
    name: "Ana",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "+ Life area" }).click();
  const anaInput = page.getByPlaceholder(/Name a life area/);
  await anaInput.fill("Ana's Health");
  await anaInput.press("Enter");
  const anaCard = page
    .locator(".react-flow__node")
    .filter({ hasText: "Ana's Health" })
    .first();
  await expect(anaCard).toBeVisible();
  await expect(anaCard).not.toHaveAttribute("data-id", /^tmp-/);

  // Ben signs in on his own browser and sees an empty map — not Ana's.
  const benContext = await page.context().browser()!.newContext();
  const benPage = await benContext.newPage();
  const benId = await createUser({
    email: "ben@luma.local",
    password: "ben-password",
    name: "Ben",
  });
  await attachSession(benPage, benId);

  await benPage.goto("/");
  await expect(
    benPage.getByText("Where would you like to begin today?"),
  ).toBeVisible();
  await expect(benPage.getByText("Ana's Health")).toHaveCount(0);

  // Ben adds his own area; Ana still sees only hers after a reload.
  await benPage.getByRole("button", { name: "+ Life area" }).click();
  const benInput = benPage.getByPlaceholder(/Name a life area/);
  await benInput.fill("Ben's Craft");
  await benInput.press("Enter");
  await expect(
    benPage.locator(".react-flow__node").filter({ hasText: "Ben's Craft" }),
  ).toBeVisible();

  // An area name also appears in the portfolio summary, so assert presence on
  // the map node specifically — but absence across the whole page, which is
  // the stronger claim and the one that matters here.
  await page.reload();
  await expect(
    page.locator(".react-flow__node").filter({ hasText: "Ana's Health" }),
  ).toBeVisible();
  await expect(page.getByText("Ben's Craft")).toHaveCount(0);

  await benContext.close();
});

test("one person cannot open another person's project by its URL", async ({
  page,
}) => {
  // Ana creates a project, and we note its real id.
  const anaId = await signInAs(page, {
    email: "ana@luma.local",
    password: "ana-password",
  });
  const anaProject = await prisma.project.create({
    data: {
      name: "Ana's private project",
      whyStatement: "Because it matters to Ana.",
      userId: anaId,
    },
  });

  // Ana can open it.
  await page.goto(`/projects/${anaProject.id}`);
  await expect(page.getByText("Ana's private project")).toBeVisible();

  // Ben, holding the exact id, gets the app's not-found page — the same answer
  // a deleted project gives, so the id isn't confirmed to exist.
  await page.context().clearCookies();
  const benId = await createUser({
    email: "ben@luma.local",
    password: "ben-password",
  });
  await attachSession(page, benId);

  await page.goto(`/projects/${anaProject.id}`);
  await expect(page.getByText("Ana's private project")).toHaveCount(0);
  await expect(page.getByText("This page wandered off the map.")).toBeVisible();
});
