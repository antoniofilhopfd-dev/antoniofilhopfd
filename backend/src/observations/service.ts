import { prisma } from "../prisma";
import { getWeekStart } from "../metrics/weeks";

export async function listObservations(weekStartInput: Date) {
  const weekStart = getWeekStart(weekStartInput);

  return prisma.weeklyObservation.findMany({
    where: { weekStart },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });
}

export async function createObservation(weekStartInput: Date, text: string, authorId: string) {
  const weekStart = getWeekStart(weekStartInput);

  return prisma.weeklyObservation.create({
    data: { weekStart, text, authorId },
    include: { author: { select: { id: true, name: true } } },
  });
}

export async function deleteObservation(id: string, requester: { id: string; role: string }) {
  const observation = await prisma.weeklyObservation.findUnique({ where: { id } });
  if (!observation) return null;

  if (observation.authorId !== requester.id && requester.role !== "ADMIN") {
    return "forbidden" as const;
  }

  await prisma.weeklyObservation.delete({ where: { id } });
  return observation;
}
