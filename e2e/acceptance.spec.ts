import { test, expect, type Page, type Locator } from "@playwright/test";
import { prisma, resetDatabase, signInAs } from "./auth";

/**
 * Mirrors the spec's Final Acceptance Test, driven through the real UI:
 *   Create 3 Life Areas → rate satisfaction → create Values → create a Project
 *   → connect to Values → open the Journey → add Initiatives → add Tasks
 *   → mark progress → add a Reflection. No tutorial, all from an empty state.
 */

// Each test starts from a clean database as a newly created account — a
// "completely new user" in both senses, now that the app has accounts.
test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await signInAs(page);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

function areaCard(page: Page, name: string): Locator {
  return page.locator(".react-flow__node").filter({ hasText: name }).first();
}

async function createArea(page: Page, name: string) {
  await page.getByRole("button", { name: "+ Life area" }).click();
  const input = page.getByPlaceholder(/Name a life area/);
  await input.fill(name);
  await input.press("Enter");
  const card = areaCard(page, name);
  await expect(card).toBeVisible();
  // Wait for the server id to replace the optimistic tmp- id: the node
  // remounts at that moment, which would reset any in-progress typing in the
  // card (the historical source of flakes in the value-creation steps).
  await expect(card).not.toHaveAttribute("data-id", /^tmp-/);
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

  // The empty map greets a first-time user with both starting paths.
  await expect(
    page.getByText("Where would you like to begin today?"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Map a life area" }),
  ).toBeVisible();

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

  // Portfolio summary reflects the lowest area under "Worth noticing".
  await expect(page.getByText("Worth noticing")).toBeVisible();
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

  // --- 5. Open the Project Journey (entered from the map → back leads there) ---
  await projectNode.getByRole("button", { name: /Open journey/ }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(
    page.getByRole("link", { name: "← Back to life map" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Ship my first album", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/No tasks yet/)).toBeVisible();

  // --- 6. Add Initiatives ---
  const initInput = page.getByPlaceholder("Name an initiative…");
  await initInput.fill("Write the songs");
  await page.getByRole("button", { name: "+ Initiative" }).click();
  await expect(page.getByText("Write the songs").first()).toBeVisible();

  await initInput.fill("Record & mix");
  await page.getByRole("button", { name: "+ Initiative" }).click();
  await expect(page.getByText("Record & mix").first()).toBeVisible();

  // --- 7. Add Tasks to the selected initiative ---
  // Select the first initiative on the timeline (target the bar itself — the
  // current-phase status chip echoes the title too).
  await page.getByTestId("initiative-bar").getByText("Write the songs").click();
  const taskInput = page.getByPlaceholder("+ add a task");
  await taskInput.fill("Draft 10 song ideas");
  await taskInput.press("Enter");
  await expect(page.getByText("Draft 10 song ideas")).toBeVisible();

  await taskInput.fill("Pick the final 5");
  await taskInput.press("Enter");
  await expect(page.getByText("Pick the final 5")).toBeVisible();

  // --- 8. Mark progress — completing a task updates the rollups ---
  await page.getByLabel("Toggle complete").first().click();
  await expect(page.getByText(/1 of 2 tasks complete · 50%/)).toBeVisible();

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
  await expect(page.getByText(/1 of 2 tasks complete · 50%/)).toBeVisible();
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

test("tasks inside an initiative can be dragged into a new order", async ({
  page,
}) => {
  await page.goto("/");
  await createArea(page, "Craft");
  await addValue(page, "Craft", "Mastery");

  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Build a shed");
  await dialog
    .getByPlaceholder(/benefit you/i)
    .fill("Somewhere to make things.");
  await dialog.getByRole("button", { name: "Mastery" }).click();
  await dialog.getByRole("button", { name: "Create project" }).click();

  await page
    .locator(".react-flow__node")
    .filter({ hasText: "Build a shed" })
    .getByRole("button", { name: /Open journey/ })
    .click();

  await page.getByPlaceholder("Name an initiative…").fill("Prepare the site");
  await page.getByRole("button", { name: "+ Initiative" }).click();
  await page.getByTestId("initiative-bar").getByText("Prepare the site").click();

  const taskInput = page.getByPlaceholder("+ add a task");
  for (const title of ["Clear the ground", "Pour the base", "Order timber"]) {
    await taskInput.fill(title);
    await taskInput.press("Enter");
    await expect(page.getByText(title)).toBeVisible();
  }

  const rows = page.getByTestId("task-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Clear the ground");
  await expect(rows.nth(2)).toContainText("Order timber");

  // Drag the last task up by its grip so it becomes the first step.
  const grip = rows.nth(2).getByRole("button", { name: "Reorder Order timber" });
  const from = (await grip.boundingBox())!;
  const to = (await rows.nth(0).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // A few pixels first to pass the drag activation threshold, then all the way up.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 8, {
    steps: 4,
  });
  await page.mouse.move(from.x + from.width / 2, to.y + 3, { steps: 12 });
  await page.mouse.up();

  await expect(rows.nth(0)).toContainText("Order timber");
  await expect(rows.nth(1)).toContainText("Clear the ground");
  await expect(rows.nth(2)).toContainText("Pour the base");

  // The new order is the persisted one.
  await page.reload();
  const reloaded = page.getByTestId("task-row");
  await expect(reloaded.nth(0)).toContainText("Order timber");
  await expect(reloaded.nth(1)).toContainText("Clear the ground");

  // An task added afterwards still lands at the end of the reordered list.
  await page.getByPlaceholder("+ add a task").fill("Paint it");
  await page.getByPlaceholder("+ add a task").press("Enter");
  await expect(reloaded).toHaveCount(4);
  await expect(reloaded.nth(3)).toContainText("Paint it");
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

test("no mandatory order — both creation paths are immediately available", async ({
  page,
}) => {
  await page.goto("/");

  // The welcome section presents both paths as equal starting points.
  await expect(page.getByText(/no right place to begin/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Life area" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "+ Project" })).toBeEnabled();

  // A project can be created FIRST, with zero life areas in existence.
  await page.getByRole("button", { name: "Start a project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Plan a trip");
  await dialog.getByPlaceholder(/benefit you/i).fill("Time away together.");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.locator(".react-flow__node").filter({ hasText: "Plan a trip" }),
  ).toBeVisible();

  // A life area can still be added afterwards — order never mattered.
  await createArea(page, "Adventure");
});

test("the Projects page shows every journey on one shared timeline", async ({
  page,
}) => {
  // With no projects, the page explains where projects are born.
  await page.goto("/projects");
  await expect(page.getByText("No projects on the road yet.")).toBeVisible();
  await page.getByRole("link", { name: "← Go to your Life Map" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Create a project on the map…
  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill("Sail the coast");
  await dialog.getByPlaceholder(/benefit you/i).fill("Salt air and quiet.");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.locator(".react-flow__node").filter({ hasText: "Sail the coast" }),
  ).toBeVisible();

  // …then step over via the header tab: load count, month + year labels, the bar.
  await page.getByRole("navigation").getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole("heading", { name: "Projects" }),
  ).toBeVisible();
  await expect(page.getByText(/1 running today/)).toBeVisible();
  await expect(page.getByText(/’2\d/).first()).toBeVisible(); // e.g. "Jul ’26"
  const bar = page.getByTitle(/Sail the coast/);
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("0%");

  // Clicking a bar steps into that journey, and back returns to Projects.
  await bar.click();
  await expect(page).toHaveURL(/\/projects\/[^?]+\?from=projects/);
  await page.getByRole("link", { name: "← Back to projects" }).first().click();
  await expect(page).toHaveURL(/\/projects$/);
});

/** Create a project from the Life Map and open its journey. */
async function createProjectWithJourney(page: Page, name: string, why: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Project" }).click();
  const dialog = page.getByTestId("project-dialog");
  await dialog.getByPlaceholder("e.g. Run a half marathon").fill(name);
  await dialog.getByPlaceholder(/benefit you/i).fill(why);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page
    .locator(".react-flow__node")
    .filter({ hasText: name })
    .getByRole("button", { name: /Open journey/ })
    .click();
  await expect(page).toHaveURL(/\/projects\/.+/);
}

async function addInitiative(page: Page, title: string) {
  await page.getByPlaceholder("Name an initiative…").fill(title);
  await page.getByRole("button", { name: "+ Initiative" }).click();
  await expect(
    page.getByTestId("initiative-bar").getByText(title),
  ).toBeVisible();
}

test("the Projects roadmap expands each project down to its initiatives", async ({
  page,
}) => {
  await createProjectWithJourney(page, "Grow a garden", "Food and quiet.");
  await addInitiative(page, "Prepare the beds");
  await addInitiative(page, "Plant the seeds");

  // Finish the first initiative's only task, so it reads as complete.
  await page.getByTestId("initiative-bar").getByText("Prepare the beds").click();
  const taskInput = page.getByPlaceholder("+ add a task");
  await taskInput.fill("Turn the soil");
  await taskInput.press("Enter");
  await page.getByLabel("Toggle complete").first().click();
  await expect(page.getByText(/1 of 1 tasks complete/)).toBeVisible();

  // A second journey, so expansion can be shown to be per project.
  await createProjectWithJourney(page, "Learn to sail", "Salt air and quiet.");
  await addInitiative(page, "Take the course");

  // On the roadmap the initiative level starts hidden.
  await page.getByRole("navigation").getByRole("link", { name: "Projects" }).click();
  await expect(page.getByText("1 of 2 initiatives complete")).toBeVisible();
  const subBars = page.getByTestId("initiative-sub-bar");
  await expect(subBars).toHaveCount(0);

  // Expanding one project shows only its own initiatives, with their standing.
  await page
    .getByRole("button", { name: "Show the initiatives of Grow a garden" })
    .click();
  await expect(subBars).toHaveCount(2);
  await expect(subBars.nth(0)).toContainText("complete");
  await expect(subBars.nth(1)).toContainText("ahead");
  // (the titles also exist in the phone card markup, hidden at this viewport)
  await expect(page.getByText("Prepare the beds").first()).toBeVisible();
  await expect(page.getByText("Plant the seeds").first()).toBeVisible();
  // The other project is untouched — still collapsed, still offering to open.
  await expect(
    page.getByRole("button", { name: "Show the initiatives of Learn to sail" }),
  ).toBeVisible();

  // Both can be open at once…
  await page
    .getByRole("button", { name: "Show the initiatives of Learn to sail" })
    .click();
  await expect(subBars).toHaveCount(3);

  // …and each closes on its own.
  await page
    .getByRole("button", { name: "Hide the initiatives of Grow a garden" })
    .click();
  await expect(subBars).toHaveCount(1);
});

test("the roadmap can be held closer, down to weeks", async ({ page }) => {
  await createProjectWithJourney(page, "Grow a garden", "Food and quiet.");
  await addInitiative(page, "Prepare the beds");

  await page.getByRole("navigation").getByRole("link", { name: "Projects" }).click();
  await page
    .getByRole("button", { name: "Show the initiatives of Grow a garden" })
    .click();
  const subBar = page.getByTestId("initiative-sub-bar").first();
  const track = page.getByTestId("roadmap-track");
  const scrolls = () =>
    track.evaluate((el) => el.scrollWidth > el.clientWidth + 1);

  // Fitted: months across the top, the whole road in view, and a two-week
  // initiative is only wide enough to say where it stands.
  await expect(page.getByText(/’2\d/).first()).toBeVisible(); // e.g. "Jul ’26"
  await expect(subBar).toContainText("in progress");
  expect(await scrolls()).toBe(false);

  // Held to weeks: the axis is dated to the day, the track now runs past the
  // screen, and the initiative has room for its own name.
  await page.getByRole("button", { name: "Weeks", exact: true }).click();
  await expect(page.getByText(/^[A-Z][a-z]{2} \d{1,2}$/).first()).toBeVisible();
  await expect(subBar).toContainText("Prepare the beds");
  expect(await scrolls()).toBe(true);
  // Zooming in throws most of the road off-screen, but lands where the user
  // actually is: today stays inside the visible window.
  const todayInView = await track.evaluate((el) => {
    const line = el.querySelector<HTMLElement>("[data-testid='today-line']");
    if (!line) return false;
    const x = line.offsetLeft - el.scrollLeft;
    return x >= 0 && x <= el.clientWidth;
  });
  expect(todayInView).toBe(true);

  // And back out again — nothing about the projects themselves changed.
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await expect(subBar).toContainText("in progress");
  expect(await scrolls()).toBe(false);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("bottom tabs navigate and the guide opens full-screen", async ({
    page,
  }) => {
    await page.goto("/");
    // The empty map still greets a newcomer on a small screen.
    await expect(
      page.getByText("Where would you like to begin today?"),
    ).toBeVisible();

    // The bottom bar is the phone's navigation: hop to Projects and back.
    await page.getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText("No projects on the road yet.")).toBeVisible();
    await page.getByRole("link", { name: "Life Map", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    // Ellie's welcome and the concept guide are two separate doors.
    await page.getByRole("button", { name: "Welcome from Ellie" }).click();
    const welcome = page.getByTestId("welcome-note");
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText("glad you’re here");
    await expect(welcome).toContainText("no right place to begin");
    await page.getByLabel("Close welcome").click();
    await expect(welcome).toBeHidden();

    await page.getByRole("button", { name: "How this works" }).click();
    const guide = page.getByTestId("journey-guide");
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("a wish appears");
    await page.getByLabel("Close guide").click();
    await expect(guide).toBeHidden();
  });
});

test("the satisfaction story charts rating history per life area", async ({
  page,
}) => {
  await page.goto("/");
  await createArea(page, "Wellness");
  await areaCard(page, "Wellness").getByLabel("Set satisfaction to 8").click();
  await expect(areaCard(page, "Wellness").getByText("8/10")).toBeVisible();

  await page.getByRole("button", { name: /see how it’s changed/ }).click();
  const story = page.getByTestId("satisfaction-story");
  await expect(story).toBeVisible();
  await expect(story).toContainText("How it’s changed");
  await expect(story).toContainText("Wellness"); // legend + direct label
  await expect(story).toContainText("TODAY");
  await page.getByLabel("Close chart").click();
  await expect(story).toBeHidden();
});

test("the journey guide explains the tool's concept", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How this works" }).click();
  const guide = page.getByTestId("journey-guide");
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("a wish appears");
  await expect(guide).toContainText("a project begins");
  await expect(guide).toContainText("the messy middle");
  await expect(guide).toContainText("reflection");
  await expect(guide).toContainText("life satisfaction grows");
  await expect(guide).toContainText("the project ends");
  await expect(guide).toContainText("a new wish appears");
  await expect(guide).toContainText("your life areas");
  await expect(guide).toContainText("never at the same height");
  await expect(guide).toContainText("your values");
  await page.getByLabel("Close guide").click();
  await expect(guide).toBeHidden();
});

test("Ellie's welcome is its own door, separate from the guide", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Welcome from Ellie" }).click();
  const welcome = page.getByTestId("welcome-note");
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("Hi, I’m glad you’re here!");
  await expect(welcome).toContainText("no right place to begin");
  // The concept diagram is not mixed in — it lives behind its own button.
  await expect(welcome).not.toContainText("a wish appears");
  await page.getByLabel("Close welcome").click();
  await expect(welcome).toBeHidden();
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
  // Move in steps so React Flow registers an active connection drag. Release
  // over the card's left edge — on short viewports the floating summary panel
  // can overlap the card's right half, and a drop must land on visible card.
  await page.mouse.move(cardBox.x + 30, cardBox.y + 30, {
    steps: 12,
  });
  await page.mouse.up();

  await expect(projectNode.getByText(/1 value connected/)).toBeVisible();
});
