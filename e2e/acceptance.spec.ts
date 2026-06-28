import { test, expect, type Page, type Locator } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Mirrors the spec's Final Acceptance Test, driven through the real UI:
 *   Create 3 Life Areas → rate satisfaction → create Values → create a Project
 *   → connect to Values → open the Journey → add Initiatives → add Epics
 *   → mark progress → add a Reflection. No tutorial, all from an empty state.
 */

// Talk to the same test database the app uses (relative path → prisma/test.db).
const prisma = new PrismaClient({
  datasources: { db: { url: "file:./test.db" } },
});

// Each test starts from a clean, empty database (a "completely new user").
test.beforeEach(async () => {
  await prisma.reflection.deleteMany();
  await prisma.epic.deleteMany();
  await prisma.initiative.deleteMany();
  await prisma.project.deleteMany();
  await prisma.value.deleteMany();
  await prisma.lifeArea.deleteMany();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

function areaCard(page: Page, name: string): Locator {
  return page.locator(".react-flow__node").filter({ hasText: name }).first();
}

async function createArea(page: Page, name: string) {
  const input = page.getByPlaceholder(/Name a life area/);
  await input.fill(name);
  await input.press("Enter");
  await expect(areaCard(page, name)).toBeVisible();
}

async function addValue(page: Page, areaName: string, value: string) {
  const card = areaCard(page, areaName);
  const input = card.getByPlaceholder("+ add a value");
  await input.fill(value);
  await input.press("Enter");
  await expect(card.getByText(value, { exact: true })).toBeVisible();
}

test("a new user can complete the full Life Map → Journey → Reflection flow", async ({
  page,
}) => {
  await page.goto("/");

  // Empty-state guidance is shown to a first-time user.
  await expect(page.getByText("This is your life map.")).toBeVisible();

  // --- 1. Create 3 Life Areas ---
  await createArea(page, "Health");
  await createArea(page, "Craft");
  await createArea(page, "Relationships");

  // --- 2. Rate satisfaction for each ---
  await areaCard(page, "Health").getByLabel("Set satisfaction to 8").click();
  await areaCard(page, "Craft").getByLabel("Set satisfaction to 6").click();
  await areaCard(page, "Relationships")
    .getByLabel("Set satisfaction to 3")
    .click();
  await expect(areaCard(page, "Health").getByText("8/10")).toBeVisible();

  // Portfolio summary reflects the lowest area as "needs attention".
  await expect(page.getByText("Needs attention")).toBeVisible();
  await expect(
    page.locator("text=Relationships").last(),
  ).toBeVisible();

  // --- 3. Create Values ---
  await addValue(page, "Health", "Vitality");
  await addValue(page, "Craft", "Mastery");
  await addValue(page, "Relationships", "Presence");

  // --- 4. Create a Project with a required name + Why, connected to values ---
  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await expect(dialog).toBeVisible();

  // Save is disabled until both name and Why are present.
  const saveBtn = dialog.getByRole("button", { name: "Create project" });
  await expect(saveBtn).toBeDisabled();

  await dialog
    .getByPlaceholder("e.g. Run a half marathon")
    .fill("Ship my first album");
  await dialog
    .getByPlaceholder(/benefit you/i)
    .fill("To finally finish something I'm proud of.");

  // Connect to two values across two areas.
  await dialog.getByRole("button", { name: "Vitality" }).click();
  await dialog.getByRole("button", { name: "Mastery" }).click();
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(dialog).toBeHidden();

  // Project node appears with its Why and a value-connection count.
  const projectNode = page
    .locator(".react-flow__node")
    .filter({ hasText: "Ship my first album" });
  await expect(projectNode).toBeVisible();
  await expect(projectNode.getByText(/2 values connected/)).toBeVisible();

  // --- 5. Open the Project Journey ---
  await projectNode.getByRole("button", { name: /Open journey/ }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(
    page.getByText("Ship my first album", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/No epics yet/)).toBeVisible();

  // --- 6. Add Initiatives ---
  const initInput = page.getByPlaceholder("Name an initiative…");
  await initInput.fill("Write the songs");
  await page.getByRole("button", { name: "+ Initiative" }).click();
  await expect(page.getByText("Write the songs").first()).toBeVisible();

  await initInput.fill("Record & mix");
  await page.getByRole("button", { name: "+ Initiative" }).click();
  await expect(page.getByText("Record & mix").first()).toBeVisible();

  // --- 7. Add Epics to the selected initiative ---
  // Select the first initiative on the timeline (target the bar itself — the
  // current-phase status chip echoes the title too).
  await page.getByTestId("initiative-bar").getByText("Write the songs").click();
  const epicInput = page.getByPlaceholder("+ add an epic");
  await epicInput.fill("Draft 10 song ideas");
  await epicInput.press("Enter");
  await expect(page.getByText("Draft 10 song ideas")).toBeVisible();

  await epicInput.fill("Pick the final 5");
  await epicInput.press("Enter");
  await expect(page.getByText("Pick the final 5")).toBeVisible();

  // --- 8. Mark progress — completing an epic updates the rollups ---
  await page.getByLabel("Toggle complete").first().click();
  await expect(page.getByText(/1 of 2 epics complete · 50%/)).toBeVisible();

  // --- 9. Add a Reflection (what / why / next) ---
  await page.getByRole("button", { name: "+ Reflect" }).click();
  await page
    .getByLabel("What changed?")
    .fill("Narrowed the album to 5 songs.");
  await page.getByLabel("Why?").fill("Quality over quantity felt truer.");
  await page.getByLabel("Next step?").fill("Book a studio day.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(
    page.getByText("Narrowed the album to 5 songs."),
  ).toBeVisible();

  // A second reflection — entries should read in chronological order (oldest first).
  await page.getByRole("button", { name: "+ Reflect" }).click();
  await page.getByLabel("What changed?").fill("Booked a studio for two days.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByText("Booked a studio for two days.")).toBeVisible();

  const firstY = (await page
    .getByText("Narrowed the album to 5 songs.")
    .boundingBox())!.y;
  const secondY = (await page
    .getByText("Booked a studio for two days.")
    .boundingBox())!.y;
  expect(firstY).toBeLessThan(secondY); // oldest above newest

  // Persistence: reload and confirm the journey survived.
  await page.reload();
  await expect(page.getByText(/1 of 2 epics complete · 50%/)).toBeVisible();
  await expect(page.getByText("Draft 10 song ideas")).toBeVisible();
});

test("the timeline supports dragging an initiative to a later start", async ({
  page,
}) => {
  await page.goto("/");
  await createArea(page, "Focus");
  await addValue(page, "Focus", "Depth");

  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Learn piano");
  await dialog.getByPlaceholder(/benefit you/i).fill("Play for joy.");
  await dialog.getByRole("button", { name: "Depth" }).click();
  await dialog.getByRole("button", { name: "Create project" }).click();

  const projectNode = page
    .locator(".react-flow__node")
    .filter({ hasText: "Learn piano" });
  await projectNode.getByRole("button", { name: /Open journey/ }).click();

  await page.getByPlaceholder("Name an initiative…").fill("Learn the basics");
  await page.getByRole("button", { name: "+ Initiative" }).click();

  // Target the timeline bar specifically (the current-phase chip echoes the title).
  const bar = page.getByTestId("initiative-bar").getByText("Learn the basics");
  await expect(bar).toBeVisible();
  const before = await bar.boundingBox();
  expect(before).not.toBeNull();

  // Drag the bar ~10 days to the right.
  await bar.hover();
  await page.mouse.down();
  await page.mouse.move(before!.x + 130, before!.y + before!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();

  await page.waitForTimeout(500);
  const after = await bar.boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x + 40);

  // The new start position persists across a reload.
  await page.reload();
  const persisted = await bar.boundingBox();
  expect(persisted!.x).toBeGreaterThan(before!.x + 40);
});

test("deleting a value disconnects it from any linked project (adaptation)", async ({
  page,
}) => {
  await page.goto("/");
  await createArea(page, "Wellbeing");
  await addValue(page, "Wellbeing", "Calm");

  // Create a project linked to the one value.
  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Daily meditation");
  await dialog.getByPlaceholder(/benefit you/i).fill("A quieter mind.");
  await dialog.getByRole("button", { name: "Calm" }).click();
  await dialog.getByRole("button", { name: "Create project" }).click();

  const projectNode = page
    .locator(".react-flow__node")
    .filter({ hasText: "Daily meditation" });
  await expect(projectNode.getByText(/1 value connected/)).toBeVisible();

  // Delete the value from its life area.
  await areaCard(page, "Wellbeing").getByTitle("Delete value").click();

  // The project survives but is now unlinked — its meaning can be re-chosen later.
  await expect(projectNode.getByText(/Not yet connected to a value/)).toBeVisible();
});

test("required fields are enforced — a project needs a name and a Why", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  const save = dialog.getByRole("button", { name: "Create project" });

  await expect(save).toBeDisabled();
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Some project");
  await expect(save).toBeDisabled(); // name alone isn't enough
  await dialog.getByPlaceholder(/benefit you/i).fill("Because it matters.");
  await expect(save).toBeEnabled();
});

test("the + Area button is disabled until a name is entered", async ({ page }) => {
  await page.goto("/");
  const addArea = page.getByRole("button", { name: "+ Area" });
  await expect(addArea).toBeDisabled();
  await page.getByPlaceholder(/Name a life area/).fill("Career");
  await expect(addArea).toBeEnabled();
});

test("a value can be connected by dragging onto the whole project card", async ({
  page,
}) => {
  await page.goto("/");
  await createArea(page, "Mind");
  await addValue(page, "Mind", "Focus");

  // Create a project with NO value linked yet.
  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Write a book");
  await dialog.getByPlaceholder(/benefit you/i).fill("To share what I know.");
  await dialog.getByRole("button", { name: "Create project" }).click();

  const projectNode = page
    .locator(".react-flow__node")
    .filter({ hasText: "Write a book" });
  await expect(projectNode.getByText(/Not yet connected to a value/)).toBeVisible();

  // Drag from the value's connection dot and release over the project card body
  // (not its dot) — it should still connect.
  const valueHandle = areaCard(page, "Mind").locator(".react-flow__handle").first();
  const handleBox = (await valueHandle.boundingBox())!;
  const cardBox = (await projectNode.boundingBox())!;

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  // Move in steps so React Flow registers an active connection drag.
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 30, {
    steps: 12,
  });
  await page.mouse.up();

  await expect(projectNode.getByText(/1 value connected/)).toBeVisible();
});
