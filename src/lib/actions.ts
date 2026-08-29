"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ifOwned, owned } from "@/lib/scope";
import {
  addDays,
  dayDiff,
  durationDays,
  fromDateInputValue,
  todayUTC,
} from "@/lib/timeline";

// Every action below is a public HTTP endpoint, so each one starts by
// establishing who is calling and then proves the row it touches belongs to
// them — see src/lib/scope.ts for how that proof is expressed.

// A fresh project defaults to a calm 12-week journey starting today — enough
// to feel real, easy to adjust on the timeline.
const DEFAULT_PROJECT_DAYS = 84;

// ---------------------------------------------------------------------------
// Life Areas
// ---------------------------------------------------------------------------

export async function createArea(name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return;
  // Position and order are relative to this user's own map, not everyone's.
  const count = await prisma.lifeArea.count({ where: { userId: user.id } });
  await prisma.lifeArea.create({
    data: {
      name: trimmed,
      satisfaction: 5,
      userId: user.id,
      order: count,
      x: 80,
      y: 40 + count * 420,
      // The initial rating opens the area's satisfaction diary.
      satisfactionHistory: { create: { value: 5 } },
    },
  });
  revalidatePath("/");
}

export async function updateArea(
  id: string,
  data: { name?: string; satisfaction?: number },
) {
  const user = await requireUser();
  const patch: { name?: string; satisfaction?: number } = {};
  const name = data.name?.trim();
  if (name) patch.name = name; // never clear a name to empty
  if (data.satisfaction !== undefined) {
    patch.satisfaction = Math.min(10, Math.max(1, Math.round(data.satisfaction)));
  }
  if (Object.keys(patch).length === 0) return;
  const area = await ifOwned(
    prisma.lifeArea.update({ where: owned.area(id, user.id), data: patch }),
  );
  if (!area) return;
  // Every rating becomes a dated diary entry — the raw material of the
  // "How it's changed" chart (multiple same-day ratings collapse there).
  // Safe to write unscoped: the update above already proved ownership.
  if (patch.satisfaction !== undefined) {
    await prisma.satisfactionEntry.create({
      data: { areaId: id, value: patch.satisfaction },
    });
  }
  revalidatePath("/");
}

export async function moveArea(id: string, x: number, y: number) {
  const user = await requireUser();
  await ifOwned(
    prisma.lifeArea.update({ where: owned.area(id, user.id), data: { x, y } }),
  );
}

export async function deleteArea(id: string) {
  const user = await requireUser();
  await ifOwned(prisma.lifeArea.delete({ where: owned.area(id, user.id) }));
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export async function createValue(areaId: string, name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return;
  // `connect` carries the ownership filter, so a value can only ever be hung
  // off one of the caller's own life areas.
  await ifOwned(
    prisma.value.create({
      data: { name: trimmed, area: { connect: owned.area(areaId, user.id) } },
    }),
  );
  revalidatePath("/");
}

export async function updateValue(id: string, name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return;
  await ifOwned(
    prisma.value.update({
      where: owned.value(id, user.id),
      data: { name: trimmed },
    }),
  );
  revalidatePath("/");
}

export async function deleteValue(id: string) {
  const user = await requireUser();
  await ifOwned(prisma.value.delete({ where: owned.value(id, user.id) }));
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Reduce a list of value ids to the ones this user actually owns.
 *
 * A project's values are supplied by the client, so without this a crafted
 * request could link someone else's value to your project — which would then
 * render that value's name (and its life area) on your map. Unknown ids are
 * dropped silently, exactly as a deleted value would be.
 */
async function ownValueIds(valueIds: string[], userId: string) {
  if (valueIds.length === 0) return [];
  const values = await prisma.value.findMany({
    where: { id: { in: valueIds }, area: { userId } },
    select: { id: true },
  });
  return values.map((v) => ({ id: v.id }));
}

export async function createProject(input: {
  name: string;
  whyStatement: string;
  valueIds: string[];
}) {
  const user = await requireUser();
  const name = input.name.trim();
  const whyStatement = input.whyStatement.trim();
  if (!name || !whyStatement) {
    throw new Error("A project needs a name and a Why.");
  }
  const count = await prisma.project.count({ where: { userId: user.id } });
  const startDate = todayUTC();
  const project = await prisma.project.create({
    data: {
      name,
      whyStatement,
      userId: user.id,
      startDate,
      targetDate: addDays(startDate, DEFAULT_PROJECT_DAYS),
      x: 540,
      y: 120 + count * 200,
      values: { connect: await ownValueIds(input.valueIds, user.id) },
    },
  });
  revalidatePath("/");
  return project.id;
}

// The project's timeframe — its journey from Start to intended outcome.
// Editing dates is normal adaptation, never a failure, so this stays forgiving:
// it keeps the Target a sensible distance after the Start, and when only the
// Start moves it slides the whole window to preserve the planned duration.
export async function updateProjectDates(
  id: string,
  data: { startDate?: string; targetDate?: string },
) {
  const user = await requireUser();
  const current = await prisma.project.findFirst({
    where: owned.project(id, user.id),
    select: { startDate: true, targetDate: true },
  });
  if (!current) return;

  const newStart = data.startDate
    ? fromDateInputValue(data.startDate)
    : current.startDate;

  let newTarget: Date;
  if (data.targetDate) {
    // An explicit Target is respected, but must stay at least a day after the
    // Start. Compare on raw dayDiff — durationDays floors at 1 and so could
    // never reject a too-early target.
    const requested = fromDateInputValue(data.targetDate);
    newTarget = dayDiff(newStart, requested) >= 1 ? requested : addDays(newStart, 1);
  } else if (data.startDate) {
    // Moving only the Start slides the journey, keeping its length.
    newTarget = addDays(newStart, durationDays(current.startDate, current.targetDate));
  } else {
    return;
  }

  await ifOwned(
    prisma.project.update({
      where: owned.project(id, user.id),
      data: { startDate: newStart, targetDate: newTarget },
    }),
  );
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

export async function updateProject(
  id: string,
  data: { name?: string; whyStatement?: string; valueIds?: string[] },
) {
  const user = await requireUser();
  const name = data.name?.trim();
  const whyStatement = data.whyStatement?.trim();
  await ifOwned(
    prisma.project.update({
      where: owned.project(id, user.id),
      data: {
        // A project must always keep a name and a Why — ignore blank updates.
        ...(name ? { name } : {}),
        ...(whyStatement ? { whyStatement } : {}),
        ...(data.valueIds
          ? { values: { set: await ownValueIds(data.valueIds, user.id) } }
          : {}),
      },
    }),
  );
  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
}

/**
 * The harvest: the user has closed a completed journey and answered whether it
 * brought some of its values into their life. Recording it stops the journey
 * page from offering the ritual again.
 */
export async function recordHarvest(id: string, brought: boolean) {
  const user = await requireUser();
  await ifOwned(
    prisma.project.update({
      where: owned.project(id, user.id),
      data: { harvestedAt: new Date(), harvestBrought: brought },
    }),
  );
  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
}

export async function moveProject(id: string, x: number, y: number) {
  const user = await requireUser();
  await ifOwned(
    prisma.project.update({ where: owned.project(id, user.id), data: { x, y } }),
  );
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  await ifOwned(prisma.project.delete({ where: owned.project(id, user.id) }));
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Initiatives (timeline bars)
// ---------------------------------------------------------------------------

export async function createInitiative(projectId: string, title: string) {
  const user = await requireUser();
  const trimmed = title.trim() || "New initiative";
  // Doubles as the ownership check: someone else's project reads as no project.
  const project = await prisma.project.findFirst({
    where: owned.project(projectId, user.id),
    select: { startDate: true, targetDate: true },
  });
  if (!project) return;
  const total = durationDays(project.startDate, project.targetDate);

  // Place new initiatives after existing ones, on an open lane, but keep them
  // inside the project's timeframe (they can never start before it begins or
  // run past the Target Completion Date).
  const existing = await prisma.initiative.findMany({
    where: { projectId },
    select: { startDay: true, duration: true, lane: true },
  });
  const duration = Math.min(14, total);
  const rawStart = existing.length
    ? Math.max(...existing.map((i) => i.startDay + i.duration))
    : 0;
  const startDay = Math.max(0, Math.min(rawStart, total - duration));
  const lane = existing.length % 3;
  await prisma.initiative.create({
    data: { projectId, title: trimmed, startDay, duration, lane },
  });
  // A new phase means the journey is underway again — a completed project
  // gains an unfulfilled phase, so any recorded harvest no longer holds.
  await clearHarvest(projectId, user.id);
  revalidatePath(`/projects/${projectId}`);
}

/**
 * The classic journey shape, laid out in one gesture: Preparation to arrive,
 * Execution for the heart of the work, Conclusion to land it — chained across
 * the whole timeframe on one lane, ready to be reshaped. Only offered while
 * the journey is still empty, so it can never disturb an existing plan.
 */
export async function scaffoldJourney(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: owned.project(projectId, user.id),
    select: {
      startDate: true,
      targetDate: true,
      initiatives: { select: { id: true }, take: 1 },
    },
  });
  if (!project || project.initiatives.length > 0) return;
  const total = durationDays(project.startDate, project.targetDate);
  // Roughly a fifth to arrive, half to work, a quarter to land — every phase
  // at least a day, and the middle absorbs whatever rounding leaves over.
  const discovery = Math.max(1, Math.round(total * 0.2));
  const conclusion = Math.max(1, Math.round(total * 0.25));
  const execution = Math.max(1, total - discovery - conclusion);
  await prisma.initiative.createMany({
    data: [
      { projectId, title: "Preparation", startDay: 0, duration: discovery, lane: 0 },
      { projectId, title: "Execution", startDay: discovery, duration: execution, lane: 0 },
      {
        projectId,
        title: "Conclusion",
        startDay: discovery + execution,
        duration: conclusion,
        lane: 0,
      },
    ],
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateInitiative(
  id: string,
  data: { title?: string; startDay?: number; duration?: number; lane?: number },
) {
  const user = await requireUser();
  const clean = {
    ...data,
    ...(data.startDay !== undefined
      ? { startDay: Math.max(0, Math.round(data.startDay)) }
      : {}),
    ...(data.duration !== undefined
      ? { duration: Math.max(1, Math.round(data.duration)) }
      : {}),
    ...(data.title !== undefined ? { title: data.title.trim() } : {}),
  };
  const updated = await ifOwned(
    prisma.initiative.update({
      where: owned.initiative(id, user.id),
      data: clean,
    }),
  );
  if (updated) revalidatePath(`/projects/${updated.projectId}`);
}

export async function deleteInitiative(id: string) {
  const user = await requireUser();
  const removed = await ifOwned(
    prisma.initiative.delete({ where: owned.initiative(id, user.id) }),
  );
  if (removed) revalidatePath(`/projects/${removed.projectId}`);
}

// ---------------------------------------------------------------------------
// Tasks (drive progress)
// ---------------------------------------------------------------------------

export async function createTask(initiativeId: string, title: string) {
  const user = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) return;
  // Sit after the current last task. Based on the highest order rather than a
  // count, so a new task still lands at the end after deletions or a reorder
  // (a count can collide with an order that is already taken).
  const last = await prisma.task.aggregate({
    where: { initiativeId },
    _max: { order: true },
  });
  // The connect proves the initiative is on one of the caller's projects.
  const task = await ifOwned(
    prisma.task.create({
      data: {
        initiative: { connect: owned.initiative(initiativeId, user.id) },
        title: trimmed,
        order: last._max.order === null ? 0 : last._max.order + 1,
      },
      include: { initiative: { select: { projectId: true } } },
    }),
  );
  if (task) {
    // A brand-new task is open, so a completed journey is underway again.
    await clearHarvest(task.initiative.projectId, user.id);
    revalidatePath(`/projects/${task.initiative.projectId}`);
  }
}

export async function toggleTask(id: string, isComplete: boolean) {
  const user = await requireUser();
  const task = await ifOwned(
    prisma.task.update({
      where: owned.task(id, user.id),
      // completedAt feeds the per-area Progress chart; reopening clears it so
      // the task counts as open again from that month on.
      data: { isComplete, completedAt: isComplete ? new Date() : null },
      include: { initiative: { select: { projectId: true } } },
    }),
  );
  if (task) {
    if (!isComplete) await clearHarvest(task.initiative.projectId, user.id);
    revalidatePath(`/projects/${task.initiative.projectId}`);
  }
}

/**
 * Un-harvest: a journey that regains an open task is underway again.
 * Completeness itself is derived from the tasks, so the rest of the app
 * (portfolio counts, quiet/closing nudges, statistics) follows on its own —
 * only the stored harvest needs clearing. The "Journey complete" note
 * disappears, and the ritual offers itself anew when the project completes
 * a second time.
 */
async function clearHarvest(projectId: string, userId: string) {
  await prisma.project.updateMany({
    where: { ...owned.project(projectId, userId), harvestedAt: { not: null } },
    data: { harvestedAt: null, harvestBrought: null },
  });
}

export async function updateTask(id: string, title: string) {
  const user = await requireUser();
  const trimmed = title.trim();
  if (!trimmed) return;
  const task = await ifOwned(
    prisma.task.update({
      where: owned.task(id, user.id),
      data: { title: trimmed },
      include: { initiative: { select: { projectId: true } } },
    }),
  );
  if (task) revalidatePath(`/projects/${task.initiative.projectId}`);
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  const task = await ifOwned(
    prisma.task.delete({
      where: owned.task(id, user.id),
      include: { initiative: { select: { projectId: true } } },
    }),
  );
  if (task) revalidatePath(`/projects/${task.initiative.projectId}`);
}

/**
 * Put an initiative's tasks in the order the user just dragged them into —
 * which one comes first, which comes next. `orderedIds` is the full list as the
 * client sees it; anything the client didn't know about (a task added in
 * another tab meanwhile) keeps its relative place at the end, so a stale drag
 * can never make a task disappear from the list.
 */
export async function reorderTasks(initiativeId: string, orderedIds: string[]) {
  const user = await requireUser();
  const initiative = await prisma.initiative.findFirst({
    where: owned.initiative(initiativeId, user.id),
    select: { projectId: true },
  });
  if (!initiative) return;

  const tasks = await prisma.task.findMany({
    where: { initiativeId },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  const own = new Set(tasks.map((e) => e.id));
  const placed = new Set<string>();
  const finalOrder: string[] = [];
  for (const id of orderedIds) {
    if (own.has(id) && !placed.has(id)) {
      placed.add(id);
      finalOrder.push(id);
    }
  }
  for (const e of tasks) if (!placed.has(e.id)) finalOrder.push(e.id);
  if (finalOrder.length === 0) return;

  await prisma.$transaction(
    finalOrder.map((id, index) =>
      prisma.task.update({ where: { id }, data: { order: index } }),
    ),
  );
  revalidatePath(`/projects/${initiative.projectId}`);
}

// ---------------------------------------------------------------------------
// Reflections
// ---------------------------------------------------------------------------

export async function createReflection(
  projectId: string,
  input: { whatChanged: string; why: string; nextStep: string },
) {
  const user = await requireUser();
  const whatChanged = input.whatChanged.trim();
  const why = input.why.trim();
  const nextStep = input.nextStep.trim();
  if (!whatChanged && !why && !nextStep) return;
  await ifOwned(
    prisma.reflection.create({
      data: {
        project: { connect: owned.project(projectId, user.id) },
        whatChanged,
        why,
        nextStep,
      },
    }),
  );
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteReflection(id: string) {
  const user = await requireUser();
  const removed = await ifOwned(
    prisma.reflection.delete({ where: owned.reflection(id, user.id) }),
  );
  if (removed) revalidatePath(`/projects/${removed.projectId}`);
}
