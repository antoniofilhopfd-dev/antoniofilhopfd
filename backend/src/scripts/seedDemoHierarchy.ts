import "dotenv/config";
import { EntityStatus, Segment } from "@prisma/client";
import { prisma } from "../prisma";
import { getWeekStart, addDays } from "../metrics/weeks";

// Gera hierarquia de DEMONSTRAÇÃO (campanha -> conjunto -> anúncio) com
// métricas diárias por anúncio, para validar listagens/filtros/paginação
// antes da integração real com o Meta (Etapa 6). Idempotente: usa upsert
// por externalId/data, então pode ser reexecutado sem duplicar.
// NÃO sobrescreve classificação manual (segmentSource="manual") em
// reexecuções — respeita a regra da Seção 10.

const CAMPAIGNS: {
  externalId: string;
  name: string;
  objective: string;
  status: EntityStatus;
  segment: Segment;
  adSets: {
    externalId: string;
    name: string;
    status: EntityStatus;
    dailyBudget: number;
    ads: { externalId: string; name: string; status: EntityStatus; baseSpendShare: number }[];
  }[];
}[] = [
  {
    externalId: "demo-camp-1",
    name: "Matrículas 2027 — Educação Infantil",
    objective: "OUTCOME_TRAFFIC",
    status: EntityStatus.ACTIVE,
    segment: Segment.EDUCACAO_INFANTIL,
    adSets: [
      {
        externalId: "demo-adset-1",
        name: "Conjunto — Público amplo 25-45",
        status: EntityStatus.ACTIVE,
        dailyBudget: 80,
        ads: [
          { externalId: "demo-ad-1", name: "Anúncio — Carrossel matrículas", status: EntityStatus.ACTIVE, baseSpendShare: 0.6 },
          { externalId: "demo-ad-2", name: "Anúncio — Imagem depoimento", status: EntityStatus.ACTIVE, baseSpendShare: 0.4 },
        ],
      },
    ],
  },
  {
    externalId: "demo-camp-2",
    name: "Matrículas 2027 — Ensino Médio",
    objective: "OUTCOME_TRAFFIC",
    status: EntityStatus.ACTIVE,
    segment: Segment.ENSINO_MEDIO,
    adSets: [
      {
        externalId: "demo-adset-2",
        name: "Conjunto — Pais de alunos 30-55",
        status: EntityStatus.ACTIVE,
        dailyBudget: 100,
        ads: [
          { externalId: "demo-ad-3", name: "Anúncio — Resultados vestibular", status: EntityStatus.ACTIVE, baseSpendShare: 1 },
        ],
      },
    ],
  },
  {
    externalId: "demo-camp-3",
    name: "Institucional — Colégio Evolução",
    objective: "OUTCOME_AWARENESS",
    status: EntityStatus.PAUSED,
    segment: Segment.INSTITUCIONAL,
    adSets: [
      {
        externalId: "demo-adset-3",
        name: "Conjunto — Região local",
        status: EntityStatus.PAUSED,
        dailyBudget: 40,
        ads: [
          { externalId: "demo-ad-4", name: "Anúncio — Vídeo institucional", status: EntityStatus.PAUSED, baseSpendShare: 1 },
        ],
      },
    ],
  },
];

async function main() {
  const today = new Date();
  const currentWeekStart = getWeekStart(today);
  const startOfRange = addDays(currentWeekStart, -7 * 7);

  const days: Date[] = [];
  let cursor = startOfRange;
  while (cursor.getTime() <= today.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  let adsCreated = 0;
  let metricsCreated = 0;

  for (const campaignDef of CAMPAIGNS) {
    const existing = await prisma.campaign.findUnique({ where: { externalId: campaignDef.externalId } });

    const campaign = await prisma.campaign.upsert({
      where: { externalId: campaignDef.externalId },
      update: {
        name: campaignDef.name,
        objective: campaignDef.objective,
        status: campaignDef.status,
        // Não sobrescreve classificação manual (Seção 10).
        ...(existing?.segmentSource === "manual" ? {} : { segment: campaignDef.segment }),
      },
      create: {
        externalId: campaignDef.externalId,
        name: campaignDef.name,
        objective: campaignDef.objective,
        status: campaignDef.status,
        segment: campaignDef.segment,
        segmentSource: null,
        isDemo: true,
      },
    });

    for (const adSetDef of campaignDef.adSets) {
      const adSet = await prisma.adSet.upsert({
        where: { externalId: adSetDef.externalId },
        update: { name: adSetDef.name, status: adSetDef.status, dailyBudget: adSetDef.dailyBudget },
        create: {
          externalId: adSetDef.externalId,
          campaignId: campaign.id,
          name: adSetDef.name,
          status: adSetDef.status,
          dailyBudget: adSetDef.dailyBudget,
          isDemo: true,
        },
      });

      for (const adDef of adSetDef.ads) {
        const ad = await prisma.ad.upsert({
          where: { externalId: adDef.externalId },
          update: { name: adDef.name, status: adDef.status },
          create: {
            externalId: adDef.externalId,
            adSetId: adSet.id,
            name: adDef.name,
            status: adDef.status,
            isDemo: true,
          },
        });
        adsCreated += 1;

        for (const [index, date] of days.entries()) {
          const weekday = date.getUTCDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const baseSpend = (isWeekend ? 60 : 110) * adDef.baseSpendShare;
          const spend = Number((baseSpend + ((index * 5) % 20)).toFixed(2));
          const impressions = Math.round(spend * 50 + ((index * 11) % 300));
          const clicksLink = Math.round(impressions * 0.02);
          const clicksTotal = clicksLink + Math.round(impressions * 0.005);
          const reach = Math.round(impressions * 0.6);
          const frequency = Number((impressions / Math.max(reach, 1)).toFixed(3));
          const resultsConversations = Math.max(0, Math.round(clicksLink * 0.3));

          await prisma.adDailyMetric.upsert({
            where: { adId_date: { adId: ad.id, date } },
            update: {},
            create: {
              adId: ad.id,
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
          metricsCreated += 1;
        }
      }
    }
  }

  console.log(`Hierarquia de demonstração: ${CAMPAIGNS.length} campanhas, ${adsCreated} anúncios, ${metricsCreated} registros diários confirmados.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
