import { EntityStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { addDays, formatDateOnly } from "../metrics/weeks";
import { collectAllPages, createMetaClient, MetaApiError, type MetaClient } from "./client";
import { getMetaConfig } from "./config";

const CONNECTION_ID = "singleton";

async function getOrCreateConnection() {
  return prisma.metaConnection.upsert({
    where: { id: CONNECTION_ID },
    update: {},
    create: { id: CONNECTION_ID },
  });
}

export async function getConnectionStatus() {
  const { configured } = getMetaConfig();
  const connection = await getOrCreateConnection();

  if (connection.configured !== configured) {
    await prisma.metaConnection.update({
      where: { id: CONNECTION_ID },
      data: { configured, connectionStatus: configured ? connection.connectionStatus : "not_configured" },
    });
  }

  const recentLogs = await prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return { ...connection, configured, recentLogs };
}

export async function checkConnection(client: MetaClient = createMetaClient()) {
  const { configured, adAccountId } = getMetaConfig();

  if (!configured) {
    await prisma.metaConnection.upsert({
      where: { id: CONNECTION_ID },
      update: { configured: false, connectionStatus: "not_configured", lastCheckedAt: new Date() },
      create: { id: CONNECTION_ID, configured: false, connectionStatus: "not_configured" },
    });
    return { status: "not_configured" as const };
  }

  try {
    const page = await client.get<{ id: string; name: string }>(`act_${adAccountId}`, {
      fields: "id,name",
    });
    const account = page.data[0] as unknown as { id: string; name: string } | undefined;

    await prisma.metaConnection.upsert({
      where: { id: CONNECTION_ID },
      update: {
        configured: true,
        connectionStatus: "ok",
        accountId: account?.id ?? adAccountId,
        accountName: account?.name ?? null,
        lastCheckedAt: new Date(),
        lastCheckedError: null,
      },
      create: {
        id: CONNECTION_ID,
        configured: true,
        connectionStatus: "ok",
        accountId: account?.id ?? adAccountId,
        accountName: account?.name ?? null,
        lastCheckedAt: new Date(),
      },
    });

    return { status: "ok" as const };
  } catch (error) {
    const kind = error instanceof MetaApiError ? error.kind : "unknown";
    const message = error instanceof Error ? error.message : "Erro desconhecido.";

    await prisma.metaConnection.upsert({
      where: { id: CONNECTION_ID },
      update: {
        configured: true,
        connectionStatus: kind,
        lastCheckedAt: new Date(),
        lastCheckedError: message,
      },
      create: {
        id: CONNECTION_ID,
        configured: true,
        connectionStatus: kind,
        lastCheckedAt: new Date(),
        lastCheckedError: message,
      },
    });

    return { status: kind, error: message };
  }
}

async function acquireSyncLock(): Promise<boolean> {
  await getOrCreateConnection();
  const result = await prisma.metaConnection.updateMany({
    where: { id: CONNECTION_ID, isSyncing: false },
    data: { isSyncing: true },
  });
  return result.count === 1;
}

async function releaseSyncLock() {
  await prisma.metaConnection.update({ where: { id: CONNECTION_ID }, data: { isSyncing: false } });
}

type MetaCampaign = { id: string; name: string; status: string; objective: string };
type MetaAdSet = { id: string; name: string; status: string; daily_budget?: string };
type MetaAd = { id: string; name: string; status: string };

function mapStatus(status: string): EntityStatus {
  if (status === "ACTIVE") return EntityStatus.ACTIVE;
  if (status === "PAUSED") return EntityStatus.PAUSED;
  return EntityStatus.ARCHIVED;
}

export async function syncHierarchy(
  triggeredById: string | undefined,
  client: MetaClient = createMetaClient()
) {
  const { configured, adAccountId } = getMetaConfig();
  if (!configured) throw new MetaApiError("not_configured", "Integração Meta não configurada.");

  const locked = await acquireSyncLock();
  if (!locked) {
    throw new Error("Já existe uma sincronização em andamento.");
  }

  const log = await prisma.syncLog.create({
    data: { type: "hierarchy", status: "failed", triggeredById },
  });

  let itemsProcessed = 0;

  try {
    const campaigns = await collectAllPages<MetaCampaign>(client, `act_${adAccountId}/campaigns`, {
      fields: "id,name,status,objective",
    });

    // Valida o lote inteiro antes de gravar qualquer coisa: um lote
    // inconsistente (campo essencial ausente) é rejeitado sem perder os
    // dados já existentes (Seção 11).
    for (const c of campaigns) {
      if (!c.id || !c.name || !c.status) {
        throw new Error("Lote de campanhas inconsistente (campo obrigatório ausente); importação abortada.");
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const c of campaigns) {
        await tx.campaign.upsert({
          where: { externalId: c.id },
          update: {
            name: c.name,
            status: mapStatus(c.status),
            objective: c.objective,
            isDemo: false,
            // Nunca sobrescreve classificação manual (Seção 10).
          },
          create: {
            externalId: c.id,
            name: c.name,
            status: mapStatus(c.status),
            objective: c.objective,
            isDemo: false,
          },
        });
        itemsProcessed += 1;

        const campaignRow = await tx.campaign.findUniqueOrThrow({ where: { externalId: c.id } });

        const adSets = await collectAllPages<MetaAdSet>(client, `${c.id}/adsets`, {
          fields: "id,name,status,daily_budget",
        });

        for (const adSetData of adSets) {
          if (!adSetData.id || !adSetData.name || !adSetData.status) {
            throw new Error("Lote de conjuntos inconsistente; importação abortada.");
          }

          await tx.adSet.upsert({
            where: { externalId: adSetData.id },
            update: {
              name: adSetData.name,
              status: mapStatus(adSetData.status),
              dailyBudget: adSetData.daily_budget ? Number(adSetData.daily_budget) / 100 : 0,
              isDemo: false,
            },
            create: {
              externalId: adSetData.id,
              campaignId: campaignRow.id,
              name: adSetData.name,
              status: mapStatus(adSetData.status),
              dailyBudget: adSetData.daily_budget ? Number(adSetData.daily_budget) / 100 : 0,
              isDemo: false,
            },
          });
          itemsProcessed += 1;

          const adSetRow = await tx.adSet.findUniqueOrThrow({ where: { externalId: adSetData.id } });

          const ads = await collectAllPages<MetaAd>(client, `${adSetData.id}/ads`, {
            fields: "id,name,status",
          });

          for (const adData of ads) {
            if (!adData.id || !adData.name || !adData.status) {
              throw new Error("Lote de anúncios inconsistente; importação abortada.");
            }

            await tx.ad.upsert({
              where: { externalId: adData.id },
              update: { name: adData.name, status: mapStatus(adData.status), isDemo: false },
              create: {
                externalId: adData.id,
                adSetId: adSetRow.id,
                name: adData.name,
                status: mapStatus(adData.status),
                isDemo: false,
              },
            });
            itemsProcessed += 1;
          }
        }
      }
    });

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", finishedAt: new Date(), itemsProcessed },
    });
    await prisma.metaConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastSyncAt: new Date(), lastSyncStatus: "success", lastSyncError: null },
    });

    return { status: "success" as const, itemsProcessed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "failed", finishedAt: new Date(), itemsProcessed, errorMessage: message },
    });
    await prisma.metaConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastSyncAt: new Date(), lastSyncStatus: "failed", lastSyncError: message },
    });
    throw error;
  } finally {
    await releaseSyncLock();
  }
}

type MetaInsight = {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  reach?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
};

const CONVERSATION_ACTION_TYPE = "onsite_conversion.messaging_conversation_started_7d";

export async function syncInsights(
  triggeredById: string | undefined,
  daysBack = 30,
  client: MetaClient = createMetaClient()
) {
  const { configured, adAccountId } = getMetaConfig();
  if (!configured) throw new MetaApiError("not_configured", "Integração Meta não configurada.");

  const locked = await acquireSyncLock();
  if (!locked) {
    throw new Error("Já existe uma sincronização em andamento.");
  }

  const log = await prisma.syncLog.create({
    data: { type: "insights", status: "failed", triggeredById },
  });

  let itemsProcessed = 0;

  try {
    const since = formatDateOnly(addDays(new Date(), -daysBack));
    const until = formatDateOnly(new Date());

    const ads = await prisma.ad.findMany({ select: { id: true, externalId: true } });
    const adByExternalId = new Map(ads.map((ad) => [ad.externalId, ad.id]));

    const insights = await collectAllPages<MetaInsight & { ad_id: string }>(
      client,
      `act_${adAccountId}/insights`,
      {
        level: "ad",
        time_range: JSON.stringify({ since, until }),
        time_increment: "1",
        fields: "ad_id,date_start,spend,impressions,clicks,inline_link_clicks,reach,frequency,actions",
      }
    );

    for (const row of insights) {
      if (!row.ad_id || !row.date_start) {
        throw new Error("Lote de métricas inconsistente (campo obrigatório ausente); importação abortada.");
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const row of insights) {
        const adId = adByExternalId.get(row.ad_id);
        if (!adId) continue; // anúncio ainda não sincronizado na hierarquia

        const conversations =
          row.actions?.find((a) => a.action_type === CONVERSATION_ACTION_TYPE)?.value ?? "0";

        await tx.adDailyMetric.upsert({
          where: { adId_date: { adId, date: new Date(`${row.date_start}T00:00:00.000Z`) } },
          update: {
            spend: Number(row.spend ?? 0),
            resultsConversations: Math.round(Number(conversations)),
            reach: Number(row.reach ?? 0),
            impressions: Number(row.impressions ?? 0),
            frequency: Number(row.frequency ?? 0),
            clicksTotal: Number(row.clicks ?? 0),
            clicksLink: Number(row.inline_link_clicks ?? 0),
            isDemo: false,
          },
          create: {
            adId,
            date: new Date(`${row.date_start}T00:00:00.000Z`),
            spend: Number(row.spend ?? 0),
            resultsConversations: Math.round(Number(conversations)),
            reach: Number(row.reach ?? 0),
            impressions: Number(row.impressions ?? 0),
            frequency: Number(row.frequency ?? 0),
            clicksTotal: Number(row.clicks ?? 0),
            clicksLink: Number(row.inline_link_clicks ?? 0),
            isDemo: false,
          },
        });
        itemsProcessed += 1;
      }
    });

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "success", finishedAt: new Date(), itemsProcessed },
    });
    await prisma.metaConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastSyncAt: new Date(), lastSyncStatus: "success", lastSyncError: null },
    });

    return { status: "success" as const, itemsProcessed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "failed", finishedAt: new Date(), itemsProcessed, errorMessage: message },
    });
    await prisma.metaConnection.update({
      where: { id: CONNECTION_ID },
      data: { lastSyncAt: new Date(), lastSyncStatus: "failed", lastSyncError: message },
    });
    throw error;
  } finally {
    await releaseSyncLock();
  }
}
