"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  addDays,
  dayDiff,
  durationDays,
  fromDateInputValue,
  todayUTC,
} from "@/lib/timeline";

// A fresh project defaults to a calm 12-week journey starting today — enough
// to feel real, easy to adjust on the timeline.
const DEFAULT_PROJECT_DAYS = 84;

// ---------------------------------------------------------------------------
// Life Areas
// ---------------------------------------------------------------------------

export async function createArea(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const count = await prisma.lifeArea.count();
  await prisma.lifeArea.create({
    data: {
      name: trimmed,
      satisfaction: 5,
      order: count,
      x: 80,
      y: 40 + count * 420,
    },
  });
  revalidatePath("/");
}

export async function updateArea(
  id: string,
  data: { name?: string; satisfaction?: number },
) {
  const patch: { name?: string; satisfaction?: number } = {};
  const name = data.name?.trim();
  if (name) patch.name = name; // never clear a name to empty
  if (data.satisfaction !== undefined) {
    patch.satisfaction = Math.min(10, Math.max(1, Math.round(data.satisfaction)));
  }
  if (Object.keys(patch).length === 0) return;
  await prisma.lifeArea.update({ where: { id }, data: patch });
  revalidatePath("/");
}

export async function moveArea(id: string, x: number, y: number) {
  await prisma.lifeArea.update({ where: { id }, data: { x, y } });
}

export async function deleteArea(id: string) {
  await prisma.lifeArea.delete({ where: { id } });
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export async function createValue(areaId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await prisma.value.create({ data: { name: trimmed, areaId } });
  revalidatePath("/");
}

export async function updateValue(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await prisma.value.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/");
}

export async function deleteValue(id: string) {
  await prisma.value.delete({ where: { id } });
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(input: {
  name: string;
  whyStatement: string;
  valueIds: string[];
}) {
  const name = input.name.trim();
  const whyStatement = input.whyStatement.trim();
  if (!name || !whyStatement) {
    throw new Error("A project needs a name and a Why.");
  }
  const count = await prisma.project.count();
  const startDate = todayUTC();
  const project = await prisma.project.create({
    data: {
      name,
      whyStatement,
      startDate,
      targetDate: addDays(startDate, DEFAULT_PROJECT_DAYS),
      x: 540,
      y: 120 + count * 200,
      values: { connect: input.valueIds.map((id) => ({ id })) },
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
  const current = await prisma.project.findUnique({
    where: { id },
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

  await prisma.project.update({
    where: { id },
    data: { startDate: newStart, targetDate: newTarget },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

export async function updateProject(
  id: string,
  data: { name?: string; whyStatement?: string; valueIds?: string[] },
) {
  const name = data.name?.trim();
  const whyStatement = data.whyStatement?.trim();
  await prisma.project.update({
    where: { id },
    data: {
      // A project must always keep a name and a Why — ignore blank updates.
      ...(name ? { name } : {}),
      ...(whyStatement ? { whyStatement } : {}),
      ...(data.valueIds
        ? { values: { set: data.valueIds.map((vid) => ({ id: vid })) } }
        : {}),
    },
  });
  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
}

export async function moveProject(id: string, x: number, y: number) {
  await prisma.project.update({ where: { id }, data: { x, y } });
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Initiatives (timeline bars)
// ---------------------------------------------------------------------------

export async function createInitiative(projectId: string, title: string) {
  const trimmed = title.trim() || "New initiative";
  const project = await prisma.project.findUnique({
    where: { id: projectId },
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
  revalidatePath(`/projects/${projectId}`);
}

export async function updateInitiative(
  id: string,
  data: { title?: string; startDay?: number; duration?: number; lane?: number },
) {
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
  const updated = await prisma.initiative.update({ where: { id }, data: clean });
  revalidatePath(`/projects/${updated.projectId}`);
}

export async function deleteInitiative(id: string) {
  const removed = await prisma.initiative.delete({ where: { id } });
  revalidatePath(`/projects/${removed.projectId}`);
}

// ---------------------------------------------------------------------------
// Epics (drive progress)
// ---------------------------------------------------------------------------

export async function createEpic(initiativeId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const count = await prisma.epic.count({ where: { initiativeId } });
  const epic = await prisma.epic.create({
    data: { initiativeId, title: trimmed, order: count },
    include: { initiative: { select: { projectId: true } } },
  });
  revalidatePath(`/projects/${epic.initiative.projectId}`);
}

export async function toggleEpic(id: string, isComplete: boolean) {
  const epic = await prisma.epic.update({
    where: { id },
    data: { isComplete },
    include: { initiative: { select: { projectId: true } } },
  });
  revalidatePath(`/projects/${epic.initiative.projectId}`);
}

export async function updateEpic(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const epic = await prisma.epic.update({
    where: { id },
    data: { title: trimmed },
    include: { initiative: { select: { projectId: true } } },
  });
  revalidatePath(`/projects/${epic.initiative.projectId}`);
}

export async function deleteEpic(id: string) {
  const epic = await prisma.epic.delete({
    where: { id },
    include: { initiative: { select: { projectId: true } } },
  });
  revalidatePath(`/projects/${epic.initiative.projectId}`);
}

// ---------------------------------------------------------------------------
// Reflections
// ---------------------------------------------------------------------------

export async function createReflection(
  projectId: string,
  input: { whatChanged: string; why: string; nextStep: string },
) {
  const whatChanged = input.whatChanged.trim();
  const why = input.why.trim();
  const nextStep = input.nextStep.trim();
  if (!whatChanged && !why && !nextStep) return;
  await prisma.reflection.create({
    data: { projectId, whatChanged, why, nextStep },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteReflection(id: string) {
  const removed = await prisma.reflection.delete({ where: { id } });
  revalidatePath(`/projects/${removed.projectId}`);
}
