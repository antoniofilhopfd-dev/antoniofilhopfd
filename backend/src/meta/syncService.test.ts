import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EntityStatus, Segment } from "@prisma/client";
import { prisma } from "../prisma";
import type { GraphPage, MetaClient } from "./client";
import { MetaApiError } from "./client";
import { checkConnection, syncHierarchy, syncInsights } from "./syncService";

function fakeClient(handlers: {
  get?: (path: string, params?: Record<string, string>) => Promise<GraphPage<unknown>>;
}): MetaClient {
  return {
    get: (path, params) => (handlers.get ? (handlers.get(path, params) as Promise<GraphPage<never>>) : Promise.resolve({ data: [], nextUrl: null })),
    getPage: () => Promise.resolve({ data: [], nextUrl: null }),
  };
}

beforeEach(async () => {
  await prisma.adDailyMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.metaConnection.deleteMany();
  process.env.META_ACCESS_TOKEN = "fake-token";
  process.env.META_AD_ACCOUNT_ID = "123";
});

afterAll(async () => {
  await prisma.adDailyMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.metaConnection.deleteMany();
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
  await prisma.$disconnect();
});

describe("checkConnection", () => {
  it("marca conexão como ok quando a API responde normalmente", async () => {
    const client = fakeClient({
      get: async () => ({ data: [{ id: "123", name: "Conta Demo" }], nextUrl: null }),
    });

    const result = await checkConnection(client);
    expect(result.status).toBe("ok");

    const connection = await prisma.metaConnection.findUnique({ where: { id: "singleton" } });
    expect(connection?.connectionStatus).toBe("ok");
    expect(connection?.accountName).toBe("Conta Demo");
  });

  it("marca conexão como invalid_token quando a API retorna erro 190", async () => {
    const client = fakeClient({
      get: async () => {
        throw new MetaApiError("invalid_token", "Token expirado.");
      },
    });

    const result = await checkConnection(client);
    expect(result.status).toBe("invalid_token");

    const connection = await prisma.metaConnection.findUnique({ where: { id: "singleton" } });
    expect(connection?.connectionStatus).toBe("invalid_token");
  });

  it("não simula conexão quando não configurado", async () => {
    delete process.env.META_ACCESS_TOKEN;
    const client = fakeClient({});
    const result = await checkConnection(client);
    expect(result.status).toBe("not_configured");
  });
});

describe("syncHierarchy", () => {
  it("cria campanha -> conjunto -> anúncio a partir das respostas simuladas", async () => {
    const client = fakeClient({
      get: async (path) => {
        if (path === "act_123/campaigns") {
          return {
            data: [{ id: "camp-1", name: "Campanha Teste", status: "ACTIVE", objective: "OUTCOME_TRAFFIC" }],
            nextUrl: null,
          };
        }
        if (path === "camp-1/adsets") {
          return {
            data: [{ id: "adset-1", name: "Conjunto Teste", status: "ACTIVE", daily_budget: "5000" }],
            nextUrl: null,
          };
        }
        if (path === "adset-1/ads") {
          return { data: [{ id: "ad-1", name: "Anúncio Teste", status: "ACTIVE" }], nextUrl: null };
        }
        return { data: [], nextUrl: null };
      },
    });

    const result = await syncHierarchy(undefined, client);
    expect(result.status).toBe("success");

    const campaign = await prisma.campaign.findUnique({ where: { externalId: "camp-1" }, include: { adSets: { include: { ads: true } } } });
    expect(campaign?.name).toBe("Campanha Teste");
    expect(campaign?.adSets[0].name).toBe("Conjunto Teste");
    expect(campaign?.adSets[0].ads[0].name).toBe("Anúncio Teste");

    const log = await prisma.syncLog.findFirst({ where: { type: "hierarchy" } });
    expect(log?.status).toBe("success");
  });

  it("preserva classificação manual ao reimportar a mesma campanha", async () => {
    await prisma.campaign.create({
      data: {
        externalId: "camp-1",
        name: "Nome antigo",
        status: EntityStatus.ACTIVE,
        objective: "OUTCOME_TRAFFIC",
        segment: Segment.OUTROS,
        segmentSource: "manual",
        isDemo: false,
      },
    });

    const client = fakeClient({
      get: async (path) => {
        if (path === "act_123/campaigns") {
          return {
            data: [{ id: "camp-1", name: "Nome atualizado pela API", status: "ACTIVE", objective: "OUTCOME_TRAFFIC" }],
            nextUrl: null,
          };
        }
        return { data: [], nextUrl: null };
      },
    });

    await syncHierarchy(undefined, client);

    const campaign = await prisma.campaign.findUnique({ where: { externalId: "camp-1" } });
    expect(campaign?.name).toBe("Nome atualizado pela API");
    expect(campaign?.segment).toBe(Segment.OUTROS);
    expect(campaign?.segmentSource).toBe("manual");
  });

  it("rejeita o lote inteiro quando falta um campo obrigatório, sem perder dados existentes", async () => {
    await prisma.campaign.create({
      data: {
        externalId: "camp-existing",
        name: "Campanha existente",
        status: EntityStatus.ACTIVE,
        objective: "OUTCOME_TRAFFIC",
        isDemo: false,
      },
    });

    const client = fakeClient({
      get: async (path) => {
        if (path === "act_123/campaigns") {
          return {
            data: [{ id: "", name: "Sem id", status: "ACTIVE", objective: "OUTCOME_TRAFFIC" }],
            nextUrl: null,
          };
        }
        return { data: [], nextUrl: null };
      },
    });

    await expect(syncHierarchy(undefined, client)).rejects.toThrow(/inconsistente/);

    const existing = await prisma.campaign.findUnique({ where: { externalId: "camp-existing" } });
    expect(existing).not.toBeNull();

    const log = await prisma.syncLog.findFirst({ where: { type: "hierarchy" } });
    expect(log?.status).toBe("failed");
  });

  it("impede duas sincronizações simultâneas", async () => {
    let resolveFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const slowClient = fakeClient({
      get: async (path) => {
        if (path === "act_123/campaigns") {
          await gate;
          return { data: [], nextUrl: null };
        }
        return { data: [], nextUrl: null };
      },
    });

    const firstRun = syncHierarchy(undefined, slowClient);
    await new Promise((resolve) => setTimeout(resolve, 10));

    await expect(syncHierarchy(undefined, fakeClient({}))).rejects.toThrow(/em andamento/);

    resolveFirst?.();
    await firstRun;
  });
});

describe("syncInsights", () => {
  it("grava métricas diárias vinculadas ao anúncio pelo externalId, com isDemo=false", async () => {
    const campaign = await prisma.campaign.create({
      data: { externalId: "camp-1", name: "C", status: EntityStatus.ACTIVE, objective: "OUTCOME_TRAFFIC", isDemo: false },
    });
    const adSet = await prisma.adSet.create({
      data: { externalId: "adset-1", campaignId: campaign.id, name: "A", status: EntityStatus.ACTIVE, dailyBudget: 10, isDemo: false },
    });
    const ad = await prisma.ad.create({
      data: { externalId: "ad-1", adSetId: adSet.id, name: "Anúncio", status: EntityStatus.ACTIVE, isDemo: false },
    });

    const client = fakeClient({
      get: async () => ({
        data: [
          {
            ad_id: "ad-1",
            date_start: "2026-01-05",
            spend: "100.50",
            impressions: "1000",
            clicks: "30",
            inline_link_clicks: "20",
            reach: "800",
            frequency: "1.25",
            actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "5" }],
          },
        ],
        nextUrl: null,
      }),
    });

    const result = await syncInsights(undefined, 30, client);
    expect(result.status).toBe("success");

    const metric = await prisma.adDailyMetric.findUnique({
      where: { adId_date: { adId: ad.id, date: new Date("2026-01-05T00:00:00.000Z") } },
    });

    expect(Number(metric?.spend)).toBe(100.5);
    expect(metric?.resultsConversations).toBe(5);
    expect(metric?.isDemo).toBe(false);
  });
});

describe("uso do MetaApiError para diferenciar tipos de falha", () => {
  it("expõe o tipo (kind) do erro para tratamento diferenciado", () => {
    const error = new MetaApiError("rate_limit", "Limite de taxa atingido.");
    expect(error.kind).toBe("rate_limit");
  });
});

describe("robustez (Etapa 7)", () => {
  it("uma falha no meio da paginação de métricas não grava dado parcial", async () => {
    const campaign = await prisma.campaign.create({
      data: { externalId: "camp-1", name: "C", status: EntityStatus.ACTIVE, objective: "OUTCOME_TRAFFIC", isDemo: false },
    });
    const adSet = await prisma.adSet.create({
      data: { externalId: "adset-1", campaignId: campaign.id, name: "A", status: EntityStatus.ACTIVE, dailyBudget: 10, isDemo: false },
    });
    const ad = await prisma.ad.create({
      data: { externalId: "ad-1", adSetId: adSet.id, name: "Anúncio", status: EntityStatus.ACTIVE, isDemo: false },
    });

    let calls = 0;
    const client: MetaClient = {
      get: async () => {
        calls += 1;
        // Primeira página tem dado válido, mas indica haver uma próxima
        // página que falhará — collectAllPages busca tudo antes de a
        // transação começar a gravar, então nada deve ser persistido.
        return {
          data: [
            {
              ad_id: "ad-1",
              date_start: "2026-01-05",
              spend: "10",
              impressions: "100",
              clicks: "5",
              inline_link_clicks: "3",
              reach: "80",
              frequency: "1.1",
              actions: [],
            },
          ],
          nextUrl: "https://graph.facebook.com/v21.0/act_123/insights?after=x",
        } as GraphPage<never>;
      },
      getPage: async () => {
        throw new MetaApiError("rate_limit", "Limite de taxa atingido a meio da paginação.");
      },
    };

    await expect(syncInsights(undefined, 30, client)).rejects.toThrow(/Limite de taxa/);
    expect(calls).toBe(1);

    const metrics = await prisma.adDailyMetric.findMany({ where: { adId: ad.id } });
    expect(metrics).toHaveLength(0);

    const log = await prisma.syncLog.findFirst({ where: { type: "insights" } });
    expect(log?.status).toBe("failed");
  });

  it("executar a sincronização duas vezes seguidas não duplica hierarquia nem métricas", async () => {
    const client = fakeClient({
      get: async (path) => {
        if (path === "act_123/campaigns") {
          return { data: [{ id: "camp-1", name: "Campanha", status: "ACTIVE", objective: "OUTCOME_TRAFFIC" }], nextUrl: null };
        }
        if (path === "camp-1/adsets") {
          return { data: [{ id: "adset-1", name: "Conjunto", status: "ACTIVE", daily_budget: "1000" }], nextUrl: null };
        }
        if (path === "adset-1/ads") {
          return { data: [{ id: "ad-1", name: "Anúncio", status: "ACTIVE" }], nextUrl: null };
        }
        if (path === "act_123/insights") {
          return {
            data: [
              {
                ad_id: "ad-1",
                date_start: "2026-01-05",
                spend: "10",
                impressions: "100",
                clicks: "5",
                inline_link_clicks: "3",
                reach: "80",
                frequency: "1.1",
                actions: [],
              },
            ],
            nextUrl: null,
          };
        }
        return { data: [], nextUrl: null };
      },
    });

    await syncHierarchy(undefined, client);
    await syncInsights(undefined, 30, client);
    await syncHierarchy(undefined, client);
    await syncInsights(undefined, 30, client);

    const campaigns = await prisma.campaign.findMany({ where: { externalId: "camp-1" } });
    expect(campaigns).toHaveLength(1);

    const metrics = await prisma.adDailyMetric.findMany({
      where: { date: new Date("2026-01-05T00:00:00.000Z") },
    });
    expect(metrics).toHaveLength(1);
  });
});

