import "dotenv/config";
import { prisma } from "../prisma";
import { getWeekStart, addDays, formatDateOnly } from "../metrics/weeks";

// Gera métricas diárias de DEMONSTRAÇÃO (isDemo=true) para permitir validar
// o Dashboard e a comparação de semanas antes da integração real com o
// Meta (Etapa 6). Determinístico (sem aleatoriedade real) para reprodutibilidade.
async function main() {
  const today = new Date();
  const currentWeekStart = getWeekStart(today);
  const startOfRange = addDays(currentWeekStart, -7 * 7); // 8 semanas incluindo a atual

  const days: Date[] = [];
  let cursor = startOfRange;
  while (cursor.getTime() <= today.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  let created = 0;

  for (const [index, date] of days.entries()) {
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;

    const baseSpend = isWeekend ? 180 : 320;
    const spend = baseSpend + ((index * 7) % 60);
    const impressions = Math.round(spend * 55 + ((index * 13) % 500));
    const clicksLink = Math.round(impressions * 0.018 + (index % 5));
    const clicksTotal = clicksLink + Math.round(impressions * 0.006);
    const reach = Math.round(impressions * 0.62);
    const frequency = Number((impressions / Math.max(reach, 1)).toFixed(3));
    const resultsConversations = Math.max(1, Math.round(clicksLink * 0.35 + (index % 3)));

    await prisma.dailyMetric.upsert({
      where: { date },
      update: {},
      create: {
        date,
        spend,
        resultsConversations,
        reach,
        impressions,
        frequency,
        clicksTotal,
        clicksLink,
        isDemo: true,
      },
    });
    created += 1;
  }

  console.log(`Métricas de demonstração criadas/confirmadas: ${created} dias (${formatDateOnly(startOfRange)} a ${formatDateOnly(today)}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
