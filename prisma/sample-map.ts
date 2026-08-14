import type { PrismaClient } from "@prisma/client";
import { addDays, todayUTC } from "../src/lib/timeline";

/**
 * A worked example of a life map, used for both the local seed and the hosted
 * showcase account.
 *
 * Everything is dated **relative to today**, so the demo never drifts stale:
 * some journeys are finishing, one is just beginning, and the timeline always
 * has something happening now. Satisfaction is backdated over several months so
 * the "how it's changed" chart has a real story in it.
 *
 * The content is deliberately ordinary — the kind of things people actually put
 * on a life map — and one area sits low on purpose, so the "worth noticing"
 * panel has something to say.
 */

type ValueSpec = string;

type TaskSpec = { title: string; done?: boolean };

type InitiativeSpec = {
  title: string;
  startDay: number;
  duration: number;
  lane: number;
  tasks: TaskSpec[];
};

type AreaSpec = {
  name: string;
  satisfaction: number;
  values: ValueSpec[];
  /** Past ratings, as [monthsAgo, score] — the satisfaction diary. */
  history: [number, number][];
};

type ProjectSpec = {
  name: string;
  why: string;
  /** Days from today the journey began (negative = already under way). */
  startOffset: number;
  length: number;
  /** Values it serves, as "Area / Value". */
  values: string[];
  y: number;
  initiatives: InitiativeSpec[];
  reflections?: { whatChanged: string; why: string; nextStep: string }[];
};

const AREAS: AreaSpec[] = [
  {
    name: "Health & Energy",
    satisfaction: 7,
    values: ["Vitality", "Strength", "Rest"],
    history: [
      [6, 4],
      [5, 5],
      [3, 5],
      [2, 6],
      [1, 7],
    ],
  },
  {
    name: "Craft & Career",
    satisfaction: 8,
    values: ["Mastery", "Autonomy", "Impact"],
    history: [
      [6, 6],
      [4, 7],
      [2, 7],
      [1, 8],
    ],
  },
  {
    name: "Relationships",
    satisfaction: 8,
    values: ["Presence", "Depth"],
    history: [
      [5, 7],
      [3, 8],
      [1, 8],
    ],
  },
  {
    name: "Learning",
    satisfaction: 6,
    values: ["Curiosity", "Patience"],
    history: [
      [6, 5],
      [3, 6],
      [1, 6],
    ],
  },
  {
    // Deliberately the low one — this is what "Worth noticing" surfaces.
    name: "Home & Space",
    satisfaction: 3,
    values: ["Calm", "Order"],
    history: [
      [6, 5],
      [4, 4],
      [2, 3],
      [1, 3],
    ],
  },
];

const PROJECTS: ProjectSpec[] = [
  {
    name: "Run a half marathon",
    why: "To prove to myself that consistency compounds — and to feel strong and awake again.",
    startOffset: -70,
    length: 140,
    values: ["Health & Energy / Vitality", "Health & Energy / Strength"],
    y: 60,
    initiatives: [
      {
        title: "Build an aerobic base",
        startDay: 0,
        duration: 42,
        lane: 0,
        tasks: [
          { title: "Run three easy times a week", done: true },
          { title: "Reach 5km without stopping", done: true },
          { title: "Reach 10km without stopping", done: true },
        ],
      },
      {
        title: "Speed & strength",
        startDay: 40,
        duration: 49,
        lane: 1,
        tasks: [
          { title: "One interval session a week", done: true },
          { title: "Strength twice a week", done: true },
          { title: "Hold pace for 15km", done: false },
        ],
      },
      {
        title: "Race prep & taper",
        startDay: 95,
        duration: 40,
        lane: 0,
        tasks: [
          { title: "Long run up to 18km", done: false },
          { title: "Plan race-day logistics", done: false },
        ],
      },
    ],
    reflections: [
      {
        whatChanged:
          "Moved the race four weeks later and dropped the sub-2-hour target.",
        why: "Six weeks in my knee started complaining, and chasing a time was making every run feel like a test I might fail.",
        nextStep:
          "Keep the long run, drop one interval session, and see how the knee feels in a fortnight.",
      },
    ],
  },
  {
    name: "Make the flat feel like home",
    why: "I want to walk in the door and feel my shoulders drop, instead of seeing a list of things I haven't done.",
    startOffset: -28,
    length: 112,
    values: ["Home & Space / Calm", "Home & Space / Order"],
    y: 330,
    initiatives: [
      {
        title: "Clear what I don't need",
        startDay: 0,
        duration: 35,
        lane: 0,
        tasks: [
          { title: "One room at a time — start with the hallway", done: true },
          { title: "Take three bags to the charity shop", done: true },
          { title: "Deal with the drawer of cables", done: false },
        ],
      },
      {
        title: "Make the living room somewhere to sit",
        startDay: 30,
        duration: 45,
        lane: 1,
        tasks: [
          { title: "Decent lamp instead of the ceiling light", done: false },
          { title: "A chair that faces the window", done: false },
          { title: "Somewhere for the books to live", done: false },
        ],
      },
    ],
  },
  {
    name: "Ship the side project",
    why: "To finish something that's mine end to end — and find out whether anyone else wants it.",
    startOffset: -14,
    length: 126,
    values: [
      "Craft & Career / Mastery",
      "Craft & Career / Autonomy",
      "Craft & Career / Impact",
    ],
    y: 600,
    initiatives: [
      {
        title: "Cut it down to something shippable",
        startDay: 0,
        duration: 35,
        lane: 0,
        tasks: [
          { title: "Write down what it is in one sentence", done: true },
          { title: "Decide what is not in version one", done: true },
          { title: "Sketch the three screens that matter", done: false },
        ],
      },
      {
        title: "Build the core",
        startDay: 30,
        duration: 56,
        lane: 1,
        tasks: [
          { title: "The one flow that has to feel good", done: false },
          { title: "Make it work on a phone", done: false },
        ],
      },
      {
        title: "Put it in front of ten people",
        startDay: 90,
        duration: 30,
        lane: 0,
        tasks: [
          { title: "Ask five friends to try it", done: false },
          { title: "Write down what confused them", done: false },
        ],
      },
    ],
  },
  {
    name: "Read twelve books this year",
    why: "Not for the number — because I think better when I'm reading, and I'd stopped.",
    startOffset: -150,
    length: 300,
    values: ["Learning / Curiosity", "Learning / Patience"],
    y: 870,
    initiatives: [
      {
        title: "Make room for it",
        startDay: 0,
        duration: 60,
        lane: 0,
        tasks: [
          { title: "Twenty minutes before sleep, no phone", done: true },
          { title: "Keep a book in my bag", done: true },
        ],
      },
      {
        title: "Read the ones I keep meaning to",
        startDay: 55,
        duration: 180,
        lane: 1,
        tasks: [
          { title: "Finish the one I abandoned in March", done: true },
          { title: "Two novels, two on work, two on anything", done: false },
          { title: "Write a line about each when I finish", done: false },
        ],
      },
    ],
    reflections: [
      {
        whatChanged:
          "Stopped forcing myself through books I wasn't enjoying, and started keeping notes.",
        why: "Three books in I noticed I was reading to finish rather than to think, which was the opposite of the point.",
        nextStep: "Allow myself to abandon one book a month without guilt.",
      },
    ],
  },
  {
    name: "See the people I actually miss",
    why: "The friendships that matter most are the ones I've been quietly leaving to chance.",
    startOffset: -42,
    length: 180,
    values: ["Relationships / Presence", "Relationships / Depth"],
    y: 1140,
    initiatives: [
      {
        title: "Make it a habit, not an intention",
        startDay: 0,
        duration: 70,
        lane: 0,
        tasks: [
          { title: "One evening a fortnight, in the calendar", done: true },
          { title: "Actually call instead of messaging", done: true },
          { title: "Say yes to the thing I'd normally skip", done: false },
        ],
      },
      {
        title: "The people I've drifted from",
        startDay: 60,
        duration: 90,
        lane: 1,
        tasks: [
          { title: "Write down who I miss", done: true },
          { title: "Get in touch with three of them", done: false },
        ],
      },
    ],
  },
];

/**
 * Create the whole example map for `userId`. Assumes the account currently has
 * nothing — callers decide whether that's true.
 */
export async function buildSampleMap(prisma: PrismaClient, userId: string) {
  const today = todayUTC();
  const monthsAgo = (n: number) => addDays(today, -n * 30);

  // --- Life areas, their values, and the satisfaction diary ---
  const valueIds = new Map<string, string>(); // "Area / Value" -> id

  for (const [index, area] of AREAS.entries()) {
    const created = await prisma.lifeArea.create({
      data: {
        name: area.name,
        satisfaction: area.satisfaction,
        userId,
        order: index,
        x: 80,
        y: 40 + index * 430,
        values: { create: area.values.map((name) => ({ name })) },
        satisfactionHistory: {
          create: [
            ...area.history.map(([months, value]) => ({
              value,
              createdAt: monthsAgo(months),
            })),
            // Today's rating closes the diary at the current score.
            { value: area.satisfaction, createdAt: today },
          ],
        },
      },
      include: { values: true },
    });

    for (const value of created.values) {
      valueIds.set(`${area.name} / ${value.name}`, value.id);
    }
  }

  // --- Projects, their journeys, and a couple of reflections ---
  for (const spec of PROJECTS) {
    const startDate = addDays(today, spec.startOffset);

    const connect = spec.values
      .map((ref) => valueIds.get(ref))
      .filter((id): id is string => Boolean(id))
      .map((id) => ({ id }));

    const project = await prisma.project.create({
      data: {
        name: spec.name,
        whyStatement: spec.why,
        userId,
        startDate,
        targetDate: addDays(startDate, spec.length),
        x: 640,
        y: spec.y,
        values: { connect },
      },
    });

    for (const initiative of spec.initiatives) {
      await prisma.initiative.create({
        data: {
          projectId: project.id,
          title: initiative.title,
          startDay: initiative.startDay,
          duration: initiative.duration,
          lane: initiative.lane,
          tasks: {
            create: initiative.tasks.map((task, order) => ({
              title: task.title,
              isComplete: Boolean(task.done),
              order,
            })),
          },
        },
      });
    }

    for (const [index, reflection] of (spec.reflections ?? []).entries()) {
      await prisma.reflection.create({
        data: {
          projectId: project.id,
          ...reflection,
          // Spread them through the journey rather than all at once.
          createdAt: addDays(startDate, 30 + index * 30),
        },
      });
    }
  }

  return { areas: AREAS.length, projects: PROJECTS.length };
}
