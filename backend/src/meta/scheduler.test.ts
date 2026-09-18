import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import type { GraphPage, MetaClient } from "./client";
import { startMetaScheduler, stopMetaScheduler } from "./scheduler";

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

afterEach(async () => {
  stopMetaScheduler();
  await prisma.syncLog.deleteMany();
  await prisma.metaConnection.deleteMany();
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
  delete process.env.META_SYNC_INTERVAL_MINUTES;
  await prisma.$disconnect();
});

function fakeClient(onCall: () => void): MetaClient {
  return {
    get: async () => {
      onCall();
      return { data: [], nextUrl: null } as GraphPage<never>;
    },
    getPage: async () => ({ data: [], nextUrl: null }) as GraphPage<never>,
    post: async () => ({}) as never,
  };
}

describe("startMetaScheduler", () => {
  it("não inicia quando a variável de intervalo não está definida", () => {
    const result = startMetaScheduler();
    expect(result.started).toBe(false);
  });

  it("não inicia quando a integração não está configurada", () => {
    delete process.env.META_ACCESS_TOKEN;
    process.env.META_SYNC_INTERVAL_MINUTES = "5";
    const result = startMetaScheduler();
    expect(result.started).toBe(false);
  });

  it("dispara sincronização no intervalo configurado", async () => {
    // Intervalo real bem curto (0.001 min = 60ms) para observar o disparo
    // sem depender de fake timers, que não se combinam bem com I/O real
    // do Prisma dentro do callback do agendador.
    process.env.META_SYNC_INTERVAL_MINUTES = "0.001";
    let calls = 0;
    const client = fakeClient(() => {
      calls += 1;
    });

    const result = startMetaScheduler(client);
    expect(result.started).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(calls).toBeGreaterThan(0);
  });

  it("não inicia uma segunda vez se já estiver rodando", () => {
    process.env.META_SYNC_INTERVAL_MINUTES = "5";
    const first = startMetaScheduler(fakeClient(() => {}));
    const second = startMetaScheduler(fakeClient(() => {}));
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
  });
});
