import { getWeekSummary } from "../metrics/service";
import { getFullHierarchy } from "../hierarchy/service";
import { listObservations } from "../observations/service";
import { getWeekStart } from "../metrics/weeks";

export async function getReportData(weekStartInput: Date) {
  const weekStart = getWeekStart(weekStartInput);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [week, campaigns, observations] = await Promise.all([
    getWeekSummary(weekStart),
    getFullHierarchy(weekStartIso),
    listObservations(weekStart),
  ]);

  return {
    week,
    campaigns,
    observations: observations.map((o) => ({
      id: o.id,
      text: o.text,
      createdAt: o.createdAt,
      authorName: o.author.name,
    })),
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;
