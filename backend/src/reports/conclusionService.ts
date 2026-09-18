import { prisma } from "../prisma";
import { getWeekStart } from "../metrics/weeks";

export async function getConclusion(weekStartInput: Date) {
  const weekStart = getWeekStart(weekStartInput);
  return prisma.reportConclusion.findUnique({
    where: { weekStart },
    include: { author: { select: { id: true, name: true } } },
  });
}

export async function upsertConclusion(weekStartInput: Date, text: string, authorId: string) {
  const weekStart = getWeekStart(weekStartInput);
  return prisma.reportConclusion.upsert({
    where: { weekStart },
    update: { text, authorId },
    create: { weekStart, text, authorId },
    include: { author: { select: { id: true, name: true } } },
  });
}
